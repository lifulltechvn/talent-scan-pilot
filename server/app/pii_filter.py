"""PII regex pre-filter: detect and mask PII in CV text before sending to AI."""
import re

# --- Email ---
_EMAIL = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}")

# --- Phone patterns ---
# Vietnamese: 0[3-9]xxxxxxxx with optional spaces/dots/dashes (total 10 digits)
_PHONE_VN = re.compile(
    r"(?<!\d)"  # Not preceded by digit
    r"(?:"
    r"(?:\+84|84)[\s.\-]?(?:\(?\d\)?)[\s.\-]?\d[\s.\-]?\d[\s.\-]?\d[\s.\-]?\d[\s.\-]?\d[\s.\-]?\d[\s.\-]?\d[\s.\-]?\d"
    r"|"
    r"0[3-9][\s.\-]?\d[\s.\-]?\d[\s.\-]?\d[\s.\-]?\d[\s.\-]?\d[\s.\-]?\d[\s.\-]?\d[\s.\-]?\d"
    r")"
    r"(?!\d)"  # Not followed by digit
)

# --- Date of birth ---
# Labeled DOB: "DOB: 03/08/1993", "Birthdate:03-08-1993", "Ngày sinh: 03/08/1993", "Sinh năm 1993", "Born: 1988"
_DOB_LABEL = re.compile(
    r"(?:Date\s*of\s*Birth|DOB|Birth\s*(?:date|day|year)?|Ngày\s*sinh|Sinh\s*(?:ngày|năm)|Năm\s*sinh|Birthdate|Born)"
    r"\s*[:：\s]\s*"
    r"(\d{1,2}\s?[/\-.\s]\s?\d{1,2}\s?[/\-.\s]\s?\d{4}|\d{4}\s?[/\-.\s]\s?\d{1,2}\s?[/\-.\s]\s?\d{1,2}|\d{4})",
    re.IGNORECASE | re.UNICODE
)
# Standalone date formats (without label) - only match dd/mm/yyyy not work durations like 02/2022
_DOB_FULL = re.compile(r"\b(\d{1,2}[/\-.]0?[1-9]|1[0-2])[/\-.]\d{4}\b")

# --- CCCD / CMND ---
# CCCD: 12 digits starting with 0 (with optional separators)
_CCCD = re.compile(r"\b0\d{2}[\s.\-]?\d{3}[\s.\-]?\d{3}[\s.\-]?\d{3}\b")

# --- URLs (social/professional profiles) ---
_URL_SOCIAL = re.compile(
    r"https?://(?:www\.)?(?:linkedin\.com|github\.com|facebook\.com|fb\.com|twitter\.com|x\.com|instagram\.com|gitlab\.com|bitbucket\.org|stackoverflow\.com|behance\.net|dribbble\.com)[/\w\-.?=&#%@:~]*",
    re.IGNORECASE
)

# --- Address ---
# Vietnamese format: "Đường X, Phường Y, Quận Z"
_ADDRESS_VN = re.compile(
    r"(?:Số\s*\d+[/\-]?\d*\s*,?\s*)?(?:Đường|đường|Phố|phố|Ngõ|ngõ|Hẻm|hẻm|Ngách|ngách)\s+[\w\s]+?,\s*(?:Phường|phường|P\.?\s*|Xã|xã)\s*[\w\s]+?,\s*(?:Quận|quận|Q\.?\s*|Huyện|huyện|TP\.?\s*|Thành phố)[\w\s\d,]*?(?=\s*\n|\s*$)",
    re.UNICODE
)
# Labeled address: "Address: ...\n" or "Địa chỉ: ...\n"
_ADDRESS_LABEL = re.compile(
    r"(?:Address|Địa\s*chỉ|Đ/c)\s*[:：]\s*(.+?)(?=\n|$)",
    re.IGNORECASE | re.UNICODE
)


def filter_pii(text: str) -> tuple[str, dict[str, list[str]]]:
    """Mask PII in text. Returns (masked_text, extracted_pii_dict).
    
    PII is detected and masked BEFORE sending to AI model.
    After AI parsing, real PII values are injected back into structured_data.
    This ensures AI never sees actual PII.
    """
    extracted: dict[str, list[str]] = {}
    
    # Collect all matches with positions — order matters (specific first)
    all_matches: list[tuple[int, int, str, str]] = []  # (start, end, pii_type, value)
    
    patterns_ordered: list[tuple[str, re.Pattern]] = [
        ("email", _EMAIL),
        ("url", _URL_SOCIAL),
        ("dob", _DOB_LABEL),
        ("cccd", _CCCD),
        ("phone", _PHONE_VN),
        ("address", _ADDRESS_VN),
        ("address", _ADDRESS_LABEL),
    ]
    
    for pii_type, pattern in patterns_ordered:
        for match in pattern.finditer(text):
            start, end = match.start(), match.end()
            # Skip if overlaps with any existing match
            if any(
                (start >= s and start < e) or (end > s and end <= e) or (start <= s and end >= e)
                for s, e, _, _ in all_matches
            ):
                continue
            # Use capturing group if available, else full match
            value = (match.group(1) if match.lastindex else match.group(0)).strip()
            if not value:
                continue
            all_matches.append((start, end, pii_type, value))
    
    # Sort by position (reverse) for safe in-place replacement
    all_matches.sort(key=lambda x: x[0], reverse=True)
    
    # Build extracted dict and do replacements
    masked = text
    for start, end, pii_type, value in all_matches:
        extracted.setdefault(pii_type, [])
        if value not in extracted[pii_type]:
            extracted[pii_type].append(value)
        masked = masked[:start] + f"[{pii_type.upper()}]" + masked[end:]
    
    # Reverse lists so they appear in text order
    for key in extracted:
        extracted[key] = list(reversed(extracted[key]))
    
    return masked, extracted
