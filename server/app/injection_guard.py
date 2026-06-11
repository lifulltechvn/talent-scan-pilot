"""Prompt injection guard: sanitize text before sending to LLM."""
import re

# Patterns that indicate prompt injection attempts
INJECTION_PATTERNS = [
    r"ignore\s+(all\s+)?previous\s+instructions",
    r"ignore\s+(all\s+)?above",
    r"disregard\s+(all\s+)?previous",
    r"you\s+are\s+now\s+a",
    r"act\s+as\s+(a\s+)?",
    r"system\s*:\s*",
    r"<\s*system\s*>",
    r"</?\s*instructions?\s*>",
    r"ADMIN\s*OVERRIDE",
    r"jailbreak",
    r"DAN\s+mode",
]

_compiled = [re.compile(p, re.IGNORECASE) for p in INJECTION_PATTERNS]


def detect_injection(text: str) -> list[str]:
    """Return list of detected injection patterns. Empty = safe."""
    found = []
    for pattern in _compiled:
        if pattern.search(text):
            found.append(pattern.pattern)
    return found


def sanitize_for_llm(text: str, context_label: str = "CV_CONTENT") -> str:
    """Wrap user-provided text in XML delimiters to prevent injection."""
    # Remove any existing XML-like tags that could confuse the model
    cleaned = re.sub(r"</?(?:system|instructions?|prompt|admin|override)[^>]*>", "", text, flags=re.IGNORECASE)
    return f"<{context_label}>\n{cleaned}\n</{context_label}>"


def guard(text: str, context_label: str = "CV_CONTENT") -> tuple[str, list[str]]:
    """Full guard: detect + sanitize. Returns (safe_text, warnings)."""
    warnings = detect_injection(text)
    safe_text = sanitize_for_llm(text, context_label)
    return safe_text, warnings
