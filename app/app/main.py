"""TalentScan Desktop App — Flet native GUI for CV scanning."""

import os
import threading

import flet as ft

from extractor import extract, SUPPORTED_EXTENSIONS
from updater import CURRENT_VERSION, check_update, download_and_install, apply_update


def main(page: ft.Page):
    page.title = f"TalentScan — CV Scanner v{CURRENT_VERSION}"
    page.window.width = 900
    page.window.height = 700
    page.padding = 30
    page.theme_mode = ft.ThemeMode.LIGHT

    # ── Update check (blocks UI until resolved) ──
    update_overlay = ft.Container(
        visible=False, expand=True,
        bgcolor=ft.Colors.with_opacity(0.95, ft.Colors.WHITE),
        alignment=ft.alignment.center,
    )

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
                update_progress.visible = False
                page.update()
                import time, os, sys
                time.sleep(0.5)
                page.window.destroy()
                time.sleep(0.5)
                os.execv(sys.executable, [sys.executable, os.path.abspath("main.py")])
            except Exception as e:
                update_status.value = f"❌ Lỗi cập nhật: {e}"
                update_progress.visible = False
                page.update()

        update_overlay.content = ft.Column([
            ft.Icon(ft.Icons.SYSTEM_UPDATE, size=48, color=ft.Colors.BLUE_600),
            ft.Text("Có bản cập nhật mới!", size=20, weight=ft.FontWeight.BOLD),
            ft.Text(f"v{CURRENT_VERSION} → v{info['version']}", size=14, color=ft.Colors.GREY_600),
            ft.Text("Bắt buộc cập nhật để tiếp tục sử dụng.", size=12, color=ft.Colors.RED_400),
            ft.Container(height=10),
            ft.ElevatedButton(
                "⬇️ Cập nhật ngay", on_click=start_download,
                style=ft.ButtonStyle(bgcolor=ft.Colors.BLUE_600, color=ft.Colors.WHITE,
                                     padding=ft.padding.symmetric(horizontal=24, vertical=14)),
            ),
            update_progress,
            update_status,
        ], horizontal_alignment=ft.CrossAxisAlignment.CENTER, spacing=8)
        update_overlay.visible = True
        page.update()

    # ── Main UI ──
    results_column = ft.Column(scroll=ft.ScrollMode.AUTO, expand=True)
    progress_bar = ft.ProgressBar(visible=False, width=400)
    status_text = ft.Text("", size=12, color=ft.Colors.GREY_600)
    stats_text = ft.Text("", size=13, weight=ft.FontWeight.W_500)

    def process_file(path: str):
        name = os.path.basename(path)
        try:
            with open(path, "rb") as f:
                data = f.read()
            r = extract(data, name)
            preview = r.text[:500] + "…" if len(r.text) > 500 else r.text
            status = "⚠️ Scanned — cần GPT-4o Vision OCR" if r.is_scanned else "✅ Digital — đã trích xuất"
            if r.is_scanned:
                preview = "(Không trích xuất được text — cần GPT-4o Vision OCR)"
            return ft.Container(
                content=ft.Column([
                    ft.Row([
                        ft.Icon(ft.Icons.DESCRIPTION, color=ft.Colors.BLUE_400),
                        ft.Text(r.file_name, weight=ft.FontWeight.BOLD, size=14, expand=True),
                        ft.Text(f"{r.page_count} trang", size=12, color=ft.Colors.GREY_500),
                    ]),
                    ft.Text(status, size=12),
                    ft.Container(
                        content=ft.Text(preview, size=11, selectable=True, color=ft.Colors.GREY_700),
                        bgcolor=ft.Colors.GREY_100, border_radius=6, padding=10,
                    ),
                ], spacing=8),
                border=ft.border.all(1, ft.Colors.GREY_300),
                border_radius=10, padding=16, margin=ft.margin.only(bottom=10),
            ), False
        except Exception as e:
            return ft.Container(
                content=ft.Text(f"❌ {name}: {e}", color=ft.Colors.RED_400, size=12),
                border=ft.border.all(1, ft.Colors.RED_200),
                border_radius=8, padding=12, margin=ft.margin.only(bottom=10),
            ), True

    def on_pick_result(e: ft.FilePickerResultEvent):
        if not e.files:
            return
        results_column.controls.clear()
        progress_bar.visible = True
        progress_bar.value = 0
        page.update()

        total = len(e.files)
        success = scanned = errors = 0

        for i, f in enumerate(e.files):
            progress_bar.value = (i + 1) / total
            status_text.value = f"Đang xử lý {i + 1}/{total}: {f.name}"
            page.update()

            card, is_err = process_file(f.path)
            results_column.controls.append(card)
            if is_err:
                errors += 1
            else:
                success += 1
                if "Scanned" in card.content.controls[1].value:
                    scanned += 1

        progress_bar.visible = False
        status_text.value = ""
        stats_text.value = f"✅ {success} thành công | ⚠️ {scanned} cần OCR | ❌ {errors} lỗi"
        page.update()

    file_picker = ft.FilePicker(on_result=on_pick_result)
    page.overlay.append(file_picker)

    def pick_files(_):
        file_picker.pick_files(
            allow_multiple=True,
            allowed_extensions=["pdf", "docx"],
            dialog_title="Chọn CV (PDF, DOCX)",
        )

    header = ft.Column([
        ft.Row([
            ft.Text("TalentScan", size=28, weight=ft.FontWeight.BOLD, color=ft.Colors.BLUE_700),
            ft.Container(expand=True),
            ft.Text(f"v{CURRENT_VERSION}", size=11, color=ft.Colors.GREY_400),
        ]),
        ft.Text("AI CV Screening — Quét CV, trích xuất text tự động", size=14, color=ft.Colors.GREY_600),
    ], spacing=4)

    drop_zone = ft.Container(
        content=ft.Column([
            ft.Icon(ft.Icons.CLOUD_UPLOAD, size=48, color=ft.Colors.BLUE_300),
            ft.Text("Kéo thả file CV vào đây", size=14, color=ft.Colors.GREY_500),
            ft.Text("Hỗ trợ: PDF, DOCX", size=11, color=ft.Colors.GREY_400),
            ft.ElevatedButton(
                "📂 Chọn file CV", icon=ft.Icons.UPLOAD_FILE, on_click=pick_files,
                style=ft.ButtonStyle(bgcolor=ft.Colors.BLUE_600, color=ft.Colors.WHITE,
                                     padding=ft.padding.symmetric(horizontal=24, vertical=14)),
            ),
        ], horizontal_alignment=ft.CrossAxisAlignment.CENTER, spacing=10),
        border=ft.border.all(2, ft.Colors.BLUE_200),
        border_radius=12, padding=30, alignment=ft.alignment.center, bgcolor=ft.Colors.BLUE_50,
    )

    # Stack: main UI + update overlay on top
    page.add(ft.Stack([
        ft.Column([
            header,
            ft.Container(height=20),
            drop_zone,
            ft.Container(
                content=ft.Column([progress_bar, status_text, stats_text], spacing=6),
                margin=ft.margin.only(top=16, bottom=8),
            ),
            ft.Divider(),
            ft.Text("Kết quả trích xuất", size=16, weight=ft.FontWeight.W_600),
            results_column,
        ], expand=True),
        update_overlay,
    ], expand=True))

    # Check update in background thread to not block initial render
    threading.Thread(target=do_update_check, daemon=True).start()


ft.app(target=main)
