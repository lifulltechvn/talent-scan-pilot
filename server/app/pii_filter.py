"""PII regex pre-filter: detect and mask Vietnamese PII in text."""
import re

PATTERNS = [
    ("email", re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")),
    ("dob", re.compile(r"\b\d{1,2}[/-]\d{1,2}[/-]\d{4}\b")),
    ("cccd", re.compile(r"\b0\d{11}\b")),
    ("phone", re.compile(r"(?:\+84\d{9}|0[3-9]\d{8})")),
    ("url", re.compile(r"https?://(?:www\.)?(?:linkedin\.com|github\.com|facebook\.com|fb\.com)[/\w\-.?=&#%]*", re.IGNORECASE)),
    ("address", re.compile(
        r"(?:Số\s*\d+[/\-]?\d*\s*,?\s*)?(?:Đường|đường|Phố|phố|Ngõ|ngõ|Hẻm|hẻm)\s+[\w\s]+?,\s*(?:Phường|phường|P\.)\s*[\w\s]+?,\s*(?:Quận|quận|Q\.)\s*[\w\s\d]+?(?=\s*\n|\s*$|,)",
        re.UNICODE
    )),
]


def filter_pii(text: str) -> tuple[str, dict[str, list[str]]]:
    """Mask PII in text. Returns (masked_text, extracted_pii_dict)."""
    extracted: dict[str, list[str]] = {}
    masked = text
    for pii_type, pattern in PATTERNS:
        matches = pattern.findall(masked)
        if matches:
            extracted[pii_type] = matches
            masked = pattern.sub(f"[{pii_type.upper()}]", masked)
    return masked, extracted
