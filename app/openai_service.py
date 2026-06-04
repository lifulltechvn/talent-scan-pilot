"""AWS Bedrock service for Desktop App — CV parsing, OCR, embedding."""

import base64
import json
import logging
import os

logger = logging.getLogger(__name__)

AWS_ACCESS_KEY_ID = os.environ.get("AWS_ACCESS_KEY_ID", "")
AWS_SECRET_ACCESS_KEY = os.environ.get("AWS_SECRET_ACCESS_KEY", "")
AWS_REGION = os.environ.get("AWS_REGION", "us-east-1")
MODEL_SONNET = os.environ.get("BEDROCK_MODEL_SONNET", "us.anthropic.claude-sonnet-4-5-20250929-v1:0")
MODEL_EMBEDDING = os.environ.get("BEDROCK_MODEL_EMBEDDING", "amazon.titan-embed-text-v2:0")

_client = None

PRICING = {
    "us.anthropic.claude-sonnet-4-5-20250929-v1:0": {"input": 0.003, "output": 0.015},
    "amazon.titan-embed-text-v2:0": {"input": 0.00002, "output": 0.0},
}


def _get_client():
    global _client
    if _client is None:
        import boto3
        _client = boto3.client(
            "bedrock-runtime",
            region_name=AWS_REGION,
            aws_access_key_id=AWS_ACCESS_KEY_ID,
            aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
        )
    return _client


def _log_usage(model_id: str, feature: str, input_tokens: int, output_tokens: int):
    """Log usage to server via API (fire-and-forget)."""
    import threading

    def _send():
        try:
            import api_client
            token = api_client.get_token()
            if not token:
                return
            import httpx
            httpx.post(
                f"{api_client.SERVER_URL}/api/v1/ai-usage/log",
                json={"model_id": model_id, "feature": feature, "input_tokens": input_tokens, "output_tokens": output_tokens, "source": "desktop"},
                headers={"Authorization": f"Bearer {token}"},
                timeout=5,
            )
        except Exception as e:
            logger.debug(f"Usage log failed: {e}")

    threading.Thread(target=_send, daemon=True).start()


def parse_cv_with_gpt(text: str, file_name: str) -> dict:
    """Parse CV text into structured data using Claude Sonnet."""
    client = _get_client()
    tools = [{
        "name": "save_cv_data",
        "description": "Save parsed CV data",
        "input_schema": {
            "type": "object",
            "properties": {
                "name": {"type": "string"},
                "email": {"type": "string"},
                "phone": {"type": "string"},
                "skills": {"type": "array", "items": {"type": "string"}},
                "experience": {"type": "array", "items": {"type": "object", "properties": {"company": {"type": "string"}, "role": {"type": "string"}, "duration": {"type": "string"}}}},
                "education": {"type": "array", "items": {"type": "object", "properties": {"school": {"type": "string"}, "degree": {"type": "string"}, "year": {"type": "string"}}}},
                "languages": {"type": "array", "items": {"type": "object", "properties": {"language": {"type": "string"}, "level": {"type": "string"}}}},
                "experience_years": {"type": "number"},
                "expected_salary": {"type": "string"},
                "insight": {"type": "object", "properties": {"strengths": {"type": "string"}, "weaknesses": {"type": "string"}, "recommendation": {"type": "string"}}},
            },
            "required": ["name", "skills", "experience", "education", "experience_years", "insight"],
        },
    }]

    body = {
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": 4096,
        "temperature": 0,
        "system": "You are a CV parser. Extract the candidate's real name as-is. Parse the CV into structured data. Provide a 3-line insight (strengths, weaknesses, recommendation).",
        "messages": [{"role": "user", "content": f"Parse this CV:\n\n{text[:6000]}"}],
        "tools": tools,
        "tool_choice": {"type": "tool", "name": "save_cv_data"},
    }

    response = client.invoke_model(modelId=MODEL_SONNET, body=json.dumps(body))
    result = json.loads(response["body"].read())

    usage = result.get("usage", {})
    _log_usage(MODEL_SONNET, "parsing", usage.get("input_tokens", 0), usage.get("output_tokens", 0))

    for block in result["content"]:
        if block["type"] == "tool_use":
            return block["input"]
    return {}


def ocr_scanned_pdf(image_bytes: bytes) -> str:
    """OCR a scanned PDF using Claude Sonnet Vision."""
    client = _get_client()
    b64 = base64.b64encode(image_bytes).decode()

    body = {
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": 4096,
        "temperature": 0,
        "messages": [{
            "role": "user",
            "content": [
                {"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": b64}},
                {"type": "text", "text": "Extract all text from this CV image. Preserve structure and formatting. Output raw text only, no commentary."},
            ],
        }],
    }

    response = client.invoke_model(modelId=MODEL_SONNET, body=json.dumps(body))
    result = json.loads(response["body"].read())

    usage = result.get("usage", {})
    _log_usage(MODEL_SONNET, "ocr", usage.get("input_tokens", 0), usage.get("output_tokens", 0))

    return result["content"][0]["text"]


def get_embedding(text: str) -> list[float]:
    """Get 1024-dim embedding from Amazon Titan Embedding V2."""
    client = _get_client()
    body = {"inputText": text[:8000], "dimensions": 1024, "normalize": True}
    response = client.invoke_model(modelId=MODEL_EMBEDDING, body=json.dumps(body))
    result = json.loads(response["body"].read())

    _log_usage(MODEL_EMBEDDING, "embedding", result.get("inputTextTokenCount", 0), 0)

    return result["embedding"]
