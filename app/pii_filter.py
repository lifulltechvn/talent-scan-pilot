"""PII regex pre-filter: detect and mask Vietnamese PII in text."""
import re

# Order: email first (contains digits), then dob, then cccd (exactly 12 digits), then phone
PATTERNS = [
    ("email", re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")),
    ("dob", re.compile(r"\b\d{1,2}[/-]\d{1,2}[/-]\d{4}\b")),
    ("cccd", re.compile(r"\b0\d{11}\b")),
    ("phone", re.compile(r"(?:\+84\d{9}|0[3-9]\d{8})")),
]


def filter_pii(text: str) -> tuple[str, dict[str, list[str]]]:
    """
    Detect and mask PII in text.
    Returns (masked_text, extracted_pii_dict).
    """
    extracted: dict[str, list[str]] = {}
    masked = text

    for pii_type, pattern in PATTERNS:
        matches = pattern.findall(masked)
        if matches:
            extracted[pii_type] = matches
            masked = pattern.sub(f"[{pii_type.upper()}]", masked)

    return masked, extracted
