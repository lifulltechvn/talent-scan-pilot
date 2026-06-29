"""Prompt injection guard: sanitize text before sending to LLM."""
import re

# Patterns that indicate prompt injection attempts
INJECTION_PATTERNS = [
    # Direct instruction override
    r"ignore\s+(all\s+)?previous\s+instructions?",
    r"ignore\s+(all\s+)?above",
    r"disregard\s+(all\s+)?previous",
    r"forget\s+(all\s+|everything\s+)?(above|previous|prior)",
    r"override\s+(all\s+)?instructions?",
    r"new\s+instructions?\s*:",
    # Role manipulation
    r"you\s+are\s+now\s+a",
    r"act\s+as\s+(a\s+)?",
    r"pretend\s+(to\s+be|you\s+are)",
    r"roleplay\s+as",
    r"switch\s+to\s+\w+\s+mode",
    # System prompt injection
    r"system\s*:\s*",
    r"<\s*system\s*>",
    r"</?\s*instructions?\s*>",
    r"\[\s*SYSTEM\s*\]",
    r"\[\s*INST\s*\]",
    r"<\|im_start\|>",
    r"<\|im_end\|>",
    # Jailbreak keywords
    r"ADMIN\s*OVERRIDE",
    r"jailbreak",
    r"DAN\s+mode",
    r"developer\s+mode",
    r"unrestricted\s+mode",
    # Output manipulation (scoring/evaluation attacks)
    r"(?:respond|reply|output|return|answer)\s+(?:with|only|exactly)\s*:?\s*(?:SCORE|score)",
    r"(?:your|the)\s+(?:score|rating|evaluation)\s+(?:should|must|is)\s+(?:be\s+)?\d+",
    r"always\s+(?:give|return|output)\s+(?:a\s+)?(?:score|rating)\s+(?:of\s+)?\d+",
    # Prompt leaking
    r"(?:show|reveal|print|display|repeat)\s+(?:me\s+)?(?:your|the)\s+(?:system\s+)?(?:prompt|instructions?|rules?)",
    r"what\s+(?:are|is)\s+your\s+(?:system\s+)?(?:prompt|instructions?|rules?)",
    # Delimiter/boundary injection
    r"---\s*END\s+OF\s+(?:USER\s+)?INPUT\s*---",
    r"---\s*END\s*---",
    r"(?:NEW|UPDATED?)\s+(?:SYSTEM\s+)?INSTRUCTION",
    r"(?:SYSTEM|ADMIN)\s+(?:INSTRUCTION|COMMAND|DIRECTIVE)",
    r"from\s+now\s+on\s*,?\s*(?:you|always|append|ignore|return)",
    r"(?:append|prepend|add|insert)\s+['\"]?\w+['\"]?\s+to\s+(?:every|all|each)\s+(?:response|output|answer)",
]

_compiled = [re.compile(p, re.IGNORECASE) for p in INJECTION_PATTERNS]

# Leet speak normalization map
_LEET_MAP = str.maketrans("013457@", "oieasla")


def _normalize_leet(text: str) -> str:
    """Normalize common leet speak substitutions for detection."""
    return text.translate(_LEET_MAP)


def detect_injection(text: str) -> list[str]:
    """Return list of detected injection patterns. Empty = safe."""
    found = []
    # Check both original and leet-normalized text
    normalized = _normalize_leet(text)
    for pattern in _compiled:
        if pattern.search(text) or pattern.search(normalized):
            found.append(pattern.pattern)
    return found


def sanitize_for_llm(text: str, context_label: str = "CV_CONTENT") -> str:
    """Wrap user-provided text in XML delimiters to prevent injection."""
    # Remove any existing XML-like tags that could confuse the model
    cleaned = re.sub(r"</?(?:system|instructions?|prompt|admin|override|INST|im_start|im_end)[^>]*>", "", text, flags=re.IGNORECASE)
    # Remove model-specific special tokens
    cleaned = re.sub(r"<\|[^|]+\|>", "", cleaned)
    # Remove bracket-style injections
    cleaned = re.sub(r"\[\s*(?:SYSTEM|INST|ADMIN|OVERRIDE)\s*\]", "", cleaned, flags=re.IGNORECASE)
    return f"<{context_label}>\n{cleaned}\n</{context_label}>"


def guard(text: str, context_label: str = "CV_CONTENT") -> tuple[str, list[str]]:
    """Full guard: detect + sanitize. Returns (safe_text, warnings). Strips injected content."""
    warnings = detect_injection(text)
    if warnings:
        # Remove detected injection patterns from the text
        cleaned = text
        for pattern in _compiled:
            cleaned = pattern.sub("[REDACTED]", cleaned)
        # Also normalize and strip from leet speak variant
        safe_text = sanitize_for_llm(cleaned, context_label)
    else:
        safe_text = sanitize_for_llm(text, context_label)
    return safe_text, warnings
