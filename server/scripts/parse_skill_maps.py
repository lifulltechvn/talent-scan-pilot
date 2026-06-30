"""Parse TechSkill PDFs into structured JSON for skill_maps.
Run: python3 server/scripts/parse_skill_maps.py
Output: server/config/skill_maps.json
"""
import fitz
import json
import os
import re

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
TECHSKILL_DIR = os.path.join(BASE_DIR, "TechSkill")
OUTPUT_PATH = os.path.join(BASE_DIR, "server", "config", "skill_maps.json")

# Category mapping from filename
CATEGORY_MAP = {
    "Application Engineer": "application_engineer",
    "Bridge System Engineer": "bridge_se",
    "QA Engineer": "qa_engineer",
    "Admin": "admin",
    "HR": "hr",
    "Accounting": "accounting",
}

TITLE_MAP = {
    "application_engineer": ("Nhân viên phát triển phần mềm", "Application Engineer"),
    "bridge_se": ("Kỹ sư cầu nối", "Bridge System Engineer"),
    "qa_engineer": ("Nhân viên kiểm soát chất lượng", "QA Engineer"),
    "admin": ("Nhân viên hành chính", "Admin"),
    "hr": ("Nhân viên nhân sự", "HR"),
    "accounting": ("Nhân viên kế toán", "Accounting"),
}

G_LEVELS = ["G0", "G1", "G2", "G3", "G4", "G5", "G6"]


def extract_pdf_text(path: str) -> str:
    doc = fitz.open(path)
    text = ""
    for page in doc:
        text += page.get_text()
    doc.close()
    return text


def detect_category(filename: str) -> str:
    for key, cat in CATEGORY_MAP.items():
        if key in filename:
            return cat
    return "unknown"


def parse_skill_map_text(text: str, category: str) -> dict:
    """Use Claude to parse the skill map text into structured JSON."""
    # For now, we save raw text and let the AI parse during assessment
    # This gives us the structure we need
    title_vi, title_en = TITLE_MAP.get(category, ("", ""))
    
    return {
        "title_vi": title_vi,
        "title_en": title_en,
        "raw_text": text,
    }


def main():
    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    
    result = {}
    for filename in sorted(os.listdir(TECHSKILL_DIR)):
        if not filename.endswith(".pdf"):
            continue
        
        category = detect_category(filename)
        if category == "unknown":
            print(f"  SKIP: {filename}")
            continue
        
        path = os.path.join(TECHSKILL_DIR, filename)
        text = extract_pdf_text(path)
        
        data = parse_skill_map_text(text, category)
        result[category] = data
        print(f"  {category}: {len(text)} chars extracted")
    
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    
    print(f"\nSaved to: {OUTPUT_PATH}")
    print(f"Categories: {list(result.keys())}")


if __name__ == "__main__":
    main()
