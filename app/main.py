"""TalentScan Desktop App — Flet native GUI for CV scanning."""

import sys
from pathlib import Path
from dotenv import load_dotenv

# Load .env from same directory as executable (or script)
if getattr(sys, 'frozen', False):
    _base = Path(sys.executable).parent
else:
    _base = Path(__file__).parent

_env_path = _base / ".env"
load_dotenv(_env_path)

import os
import threading

import flet as ft

from extractor import extract, SUPPORTED_EXTENSIONS
from pii_filter import filter_pii
from pii_crypto import encrypt_pii
from offline_queue import add_to_queue, get_queue_count, get_pending, mark_uploaded, mark_failed
from cv_parser import parse_cv_text
from openai_service import ocr_scanned_pdf, get_embedding
from updater import CURRENT_VERSION, check_update, download_and_install, apply_update
import api_client


RETRY_INTERVAL_SEC = 30


def retry_offline_queue():
    """Background thread: retry pending uploads every RETRY_INTERVAL_SEC."""
    import json
    import time
    while True:
        time.sleep(RETRY_INTERVAL_SEC)
        if not api_client.get_token():
            continue
        pending = get_pending()
        if not pending:
            continue
        for row in pending:
            try:
                structured = json.loads(row["structured_data_json"]) if row["structured_data_json"] else {}
                job_id = row.get("job_id")
                embedding = json.loads(row["embedding_json"]) if row.get("embedding_json") else None
                api_client.upload_candidate(job_id, structured, embedding)
                mark_uploaded(row["id"])
            except Exception:
                mark_failed(row["id"])


def main(page: ft.Page):
    page.title = f"TalentScan — CV Scanner v{CURRENT_VERSION}"
    page.window.width = 950
    page.window.height = 750
    page.padding = 30
    page.theme_mode = ft.ThemeMode.LIGHT

    # State
    selected_job_id = {"value": None}
    is_logged_in = {"value": False}

    # ── Update check overlay ──
    update_overlay = ft.Container(visible=False, expand=True, bgcolor=ft.Colors.with_opacity(0.95, ft.Colors.WHITE), alignment=ft.alignment.center)

    def do_update_check():
        info = check_update()
        if not info:
            update_overlay.visible = False
            page.update()
            return
        update_status = ft.Text("", size=12, color=ft.Colors.GREY_600)
        update_progress = ft.ProgressBar(visible=False, width=300)

        def start_download(_):
            update_status.value = "Đang tải bản cập nhật..."
            update_progress.visible = True
            page.update()
            try:
                update_dir = download_and_install(info["download_url"])
                apply_update(update_dir)
                update_status.value = "✅ Cập nhật xong! Đang khởi động lại..."
                page.update()
            except Exception as e:
                update_status.value = f"❌ Lỗi: {e}"
                update_progress.visible = False
                page.update()

        update_overlay.content = ft.Column([
            ft.Icon(ft.Icons.SYSTEM_UPDATE, size=48, color=ft.Colors.BLUE_600),
            ft.Text("Có bản cập nhật mới!", size=20, weight=ft.FontWeight.BOLD),
            ft.Text(f"v{CURRENT_VERSION} → v{info['version']}", size=14),
            ft.ElevatedButton("⬇️ Cập nhật ngay", on_click=start_download),
            update_progress, update_status,
        ], horizontal_alignment=ft.CrossAxisAlignment.CENTER, spacing=8)
        update_overlay.visible = True
        page.update()

    # ── Login Panel ──
    email_field = ft.TextField(label="Email", value="hr@test.com", width=300, text_size=13)
    password_field = ft.TextField(label="Password", value="test1234", password=True, width=300, text_size=13)
    login_status = ft.Text("", size=12)
    main_content = ft.Column(visible=False, expand=True)

    # ── Job selector ──
    job_dropdown = ft.Dropdown(label="Chọn Job để gắn CV", width=400, text_size=13)

    def load_jobs():
        try:
            jobs = api_client.get_jobs()
            job_dropdown.options = [ft.dropdown.Option(key=j["id"], text=f"{j['title']} ({j['location'] or 'N/A'})") for j in jobs]
            if jobs:
                job_dropdown.value = jobs[0]["id"]
                selected_job_id["value"] = jobs[0]["id"]
            page.update()
        except Exception as e:
            login_status.value = f"⚠️ Không tải được jobs: {e}"
            page.update()

    def on_job_change(e):
        selected_job_id["value"] = e.control.value

    job_dropdown.on_change = on_job_change

    def do_login(_):
        try:
            api_client.login(email_field.value, password_field.value)
            is_logged_in["value"] = True
            login_panel.visible = False
            main_content.visible = True
            login_status.value = ""
            load_jobs()
            threading.Thread(target=retry_offline_queue, daemon=True).start()
            page.update()
        except Exception as e:
            login_status.value = f"❌ Login thất bại: {e}"
            page.update()

    login_panel = ft.Container(
        content=ft.Column([
            ft.Text("🔐 Đăng nhập", size=20, weight=ft.FontWeight.BOLD),
            ft.Text("Đăng nhập để upload CV lên server", size=12, color=ft.Colors.GREY_600),
            email_field, password_field,
            ft.ElevatedButton("Đăng nhập", on_click=do_login, style=ft.ButtonStyle(bgcolor=ft.Colors.BLUE_600, color=ft.Colors.WHITE)),
            login_status,
        ], spacing=12, horizontal_alignment=ft.CrossAxisAlignment.CENTER),
        alignment=ft.alignment.center, expand=True,
    )

    # ── Main UI (after login) ──
    results_column = ft.Column(scroll=ft.ScrollMode.AUTO, expand=True)
    progress_bar = ft.ProgressBar(visible=False, width=400)
    status_text = ft.Text("", size=12, color=ft.Colors.GREY_600)
    stats_text = ft.Text("", size=13, weight=ft.FontWeight.W_500)

    def process_and_upload(path: str) -> tuple[ft.Container, bool]:
        name = os.path.basename(path)
        try:
            with open(path, "rb") as f:
                data = f.read()
            r = extract(data, name)

            if r.is_scanned:
                # OCR via GPT-4o Vision (or mock)
                r.text = ocr_scanned_pdf(data)

            # Filter PII
            masked_text, pii_data = filter_pii(r.text)

            # Encrypt PII locally
            pii_encrypted = encrypt_pii(pii_data) if pii_data else None

            # Parse CV text into structured data
            structured = parse_cv_text(masked_text, name)

            # Generate embedding via Bedrock Titan V2
            embed_text = " ".join(structured.get("skills", [])) + " " + " ".join(
                e.get("role", "") for e in structured.get("experience", [])
            )
            embedding = get_embedding(embed_text) if embed_text.strip() else None

            # Upload to server
            upload_status = "✅ Uploaded"
            try:
                result = api_client.upload_candidate(selected_job_id["value"], structured, embedding)
                candidate_id = result.get("id", "?")
                upload_status = f"✅ Uploaded → ID: {candidate_id[:8]}..."
            except Exception as e:
                # Save to offline queue
                add_to_queue(name, masked_text, structured, pii_encrypted, job_id=selected_job_id["value"], embedding=embedding)
                upload_status = f"📥 Saved offline (queue: {get_queue_count()})"

            # PII info
            pii_info = ", ".join(f"{k}: {len(v)}" for k, v in pii_data.items()) if pii_data else "Không phát hiện PII"

            card = ft.Container(
                content=ft.Column([
                    ft.Row([
                        ft.Icon(ft.Icons.DESCRIPTION, color=ft.Colors.BLUE_400),
                        ft.Text(name, weight=ft.FontWeight.BOLD, size=13, expand=True),
                        ft.Text(f"{r.page_count} trang", size=11, color=ft.Colors.GREY_500),
                    ]),
                    ft.Text(upload_status, size=12, color=ft.Colors.GREEN_700 if "Uploaded" in upload_status else ft.Colors.ORANGE_600),
                    ft.Text(f"🔒 PII: {pii_info}", size=11, color=ft.Colors.GREY_600),
                    ft.Container(
                        content=ft.Text(masked_text[:300] + ("…" if len(masked_text) > 300 else ""), size=11, selectable=True, color=ft.Colors.GREY_700),
                        bgcolor=ft.Colors.GREY_100, border_radius=6, padding=10,
                    ),
                ], spacing=6),
                border=ft.border.all(1, ft.Colors.GREY_300), border_radius=10, padding=14, margin=ft.margin.only(bottom=8),
            )
            return card, False
        except Exception as e:
            card = ft.Container(
                content=ft.Text(f"❌ {name}: {e}", color=ft.Colors.RED_400, size=12),
                border=ft.border.all(1, ft.Colors.RED_200), border_radius=8, padding=12, margin=ft.margin.only(bottom=8),
            )
            return card, True

    def on_pick_result(e: ft.FilePickerResultEvent):
        if not e.files:
            return
        results_column.controls.clear()
        progress_bar.visible = True
        progress_bar.value = 0
        page.update()

        total = len(e.files)
        success = errors = 0

        for i, f in enumerate(e.files):
            progress_bar.value = (i + 1) / total
            status_text.value = f"Đang xử lý {i + 1}/{total}: {f.name}"
            page.update()

            card, is_err = process_and_upload(f.path)
            results_column.controls.append(card)
            if is_err:
                errors += 1
            else:
                success += 1

        progress_bar.visible = False
        status_text.value = ""
        stats_text.value = f"✅ {success} uploaded | ❌ {errors} lỗi"

        # Auto trigger scoring
        if success > 0 and selected_job_id["value"]:
            try:
                score_result = api_client.trigger_scoring(selected_job_id["value"])
                stats_text.value += f" | 🎯 Scored {score_result['candidates_scored']} candidates"
            except Exception:
                pass

        page.update()

    file_picker = ft.FilePicker(on_result=on_pick_result)
    page.overlay.append(file_picker)

    def pick_files(_):
        file_picker.pick_files(allow_multiple=True, allowed_extensions=["pdf", "docx"], dialog_title="Chọn CV (PDF, DOCX)")

    # ── Settings Dialog ──
    aws_key_field = ft.TextField(label="AWS Access Key ID", value=os.environ.get("AWS_ACCESS_KEY_ID", ""), width=400, text_size=13)
    aws_secret_field = ft.TextField(label="AWS Secret Access Key", value=os.environ.get("AWS_SECRET_ACCESS_KEY", ""), width=400, text_size=13, password=True, can_reveal_password=True)
    aws_region_field = ft.TextField(label="AWS Region", value=os.environ.get("AWS_REGION", "us-east-1"), width=400, text_size=13)
    settings_status = ft.Text("", size=12)

    def save_settings(_):
        lines = []
        if _env_path.exists():
            existing = _env_path.read_text().splitlines()
            keys_to_update = {"AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_REGION"}
            for line in existing:
                key = line.split("=", 1)[0].strip() if "=" in line else ""
                if key not in keys_to_update:
                    lines.append(line)
        lines.append(f"AWS_ACCESS_KEY_ID={aws_key_field.value}")
        lines.append(f"AWS_SECRET_ACCESS_KEY={aws_secret_field.value}")
        lines.append(f"AWS_REGION={aws_region_field.value}")
        _env_path.write_text("\n".join(lines) + "\n")
        os.environ["AWS_ACCESS_KEY_ID"] = aws_key_field.value
        os.environ["AWS_SECRET_ACCESS_KEY"] = aws_secret_field.value
        os.environ["AWS_REGION"] = aws_region_field.value
        import openai_service
        openai_service._client = None
        settings_status.value = "✅ Đã lưu!"
        page.update()

    settings_dialog = ft.AlertDialog(
        title=ft.Text("⚙️ Cài đặt AWS"),
        content=ft.Column([aws_key_field, aws_secret_field, aws_region_field, settings_status], tight=True, spacing=12),
        actions=[
            ft.TextButton("Lưu", on_click=save_settings),
            ft.TextButton("Đóng", on_click=lambda _: page.close(settings_dialog)),
        ],
    )

    def open_settings(_):
        settings_status.value = ""
        page.open(settings_dialog)

    # Main content layout
    main_content.controls = [
        ft.Row([
            ft.Text("TalentScan", size=24, weight=ft.FontWeight.BOLD, color=ft.Colors.BLUE_700),
            ft.Container(expand=True),
            ft.IconButton(ft.Icons.SETTINGS, on_click=open_settings, tooltip="Cài đặt AWS"),
            ft.Text(f"v{CURRENT_VERSION}", size=11, color=ft.Colors.GREY_400),
        ]),
        ft.Text("Quét CV → Lọc PII → Upload → Scoring tự động", size=13, color=ft.Colors.GREY_600),
        ft.Container(height=10),
        job_dropdown,
        ft.Container(height=10),
        ft.Container(
            content=ft.Column([
                ft.Icon(ft.Icons.CLOUD_UPLOAD, size=36, color=ft.Colors.BLUE_300),
                ft.Text("Chọn file CV để quét & upload", size=13, color=ft.Colors.GREY_500),
                ft.ElevatedButton("📂 Chọn file CV", on_click=pick_files, style=ft.ButtonStyle(bgcolor=ft.Colors.BLUE_600, color=ft.Colors.WHITE)),
            ], horizontal_alignment=ft.CrossAxisAlignment.CENTER, spacing=8),
            border=ft.border.all(2, ft.Colors.BLUE_200), border_radius=12, padding=20, alignment=ft.alignment.center, bgcolor=ft.Colors.BLUE_50,
        ),
        ft.Container(content=ft.Column([progress_bar, status_text, stats_text], spacing=4), margin=ft.margin.only(top=12, bottom=8)),
        ft.Divider(),
        ft.Text("Kết quả", size=15, weight=ft.FontWeight.W_600),
        results_column,
    ]

    # Page layout
    page.add(ft.Stack([
        ft.Column([login_panel, main_content], expand=True),
        update_overlay,
    ], expand=True))

    threading.Thread(target=do_update_check, daemon=True).start()


ft.app(target=main)
