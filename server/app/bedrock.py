import json
import boto3
from app.config import settings

_client = None


def get_bedrock_client():
    global _client
    if _client is None:
        _client = boto3.client(
            "bedrock-runtime",
            region_name=settings.AWS_REGION,
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        )
    return _client


def invoke_claude(prompt: str, *, model: str | None = None, max_tokens: int = 4096, temperature: float = 0, system: str | None = None) -> str:
    """Invoke Claude (Sonnet/Haiku) via Bedrock. Returns assistant text."""
    client = get_bedrock_client()
    model_id = model or settings.BEDROCK_MODEL_HAIKU

    body = {
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": max_tokens,
        "temperature": temperature,
        "messages": [{"role": "user", "content": prompt}],
    }
    if system:
        body["system"] = system

    response = client.invoke_model(modelId=model_id, body=json.dumps(body))
    result = json.loads(response["body"].read())
    return result["content"][0]["text"]


def invoke_claude_with_tools(prompt: str, tools: list, *, model: str | None = None, max_tokens: int = 4096, system: str | None = None) -> dict:
    """Invoke Claude with tool_use for structured output."""
    client = get_bedrock_client()
    model_id = model or settings.BEDROCK_MODEL_SONNET

    body = {
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": max_tokens,
        "temperature": 0,
        "messages": [{"role": "user", "content": prompt}],
        "tools": tools,
        "tool_choice": {"type": "any"},
    }
    if system:
        body["system"] = system

    response = client.invoke_model(modelId=model_id, body=json.dumps(body))
    result = json.loads(response["body"].read())

    for block in result["content"]:
        if block["type"] == "tool_use":
            return block["input"]
    return {}


def get_embedding(text: str) -> list[float]:
    """Get embedding from Amazon Titan Embedding V2 (1024-dim)."""
    client = get_bedrock_client()
    body = {"inputText": text, "dimensions": 1024, "normalize": True}

    response = client.invoke_model(
        modelId=settings.BEDROCK_MODEL_EMBEDDING,
        body=json.dumps(body),
    )
    result = json.loads(response["body"].read())
    return result["embedding"]
