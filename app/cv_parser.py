"""CV parser: uses OpenAI GPT-4o when API key available, mock otherwise."""

from openai_service import parse_cv_with_gpt


def parse_cv_text(text: str, file_name: str) -> dict:
    """Parse extracted CV text into structured data."""
    return parse_cv_with_gpt(text, file_name)
