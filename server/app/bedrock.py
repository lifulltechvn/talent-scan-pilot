import json
import logging

import boto3

from app.config import settings

logger = logging.getLogger(__name__)

_client = None

# Pricing per 1K tokens (USD) — updated June 2025
PRICING = {
    "us.anthropic.claude-sonnet-4-5-20250929-v1:0": {"input": 0.003, "output": 0.015},
    "us.anthropic.claude-haiku-4-5-20251001-v1:0": {"input": 0.001, "output": 0.005},
    "amazon.titan-embed-text-v2:0": {"input": 0.00002, "output": 0.0},
}


def _get_pricing(model_id: str) -> dict:
    return PRICING.get(model_id, {"input": 0.003, "output": 0.015})


def calculate_cost(model_id: str, input_tokens: int, output_tokens: int) -> float:
    p = _get_pricing(model_id)
    return (input_tokens * p["input"] + output_tokens * p["output"]) / 1000


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


def _log_usage(model_id: str, feature: str, input_tokens: int, output_tokens: int, source: str = "server"):
    """Log AI usage to database (fire-and-forget in background thread)."""
    import threading

    def _save():
        try:
            import asyncio
            import uuid
            from datetime import datetime, timezone
            from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
            from app.models import AIUsageLog

            async def _do():
                engine = create_async_engine(settings.DATABASE_URL, pool_size=1)
                session_factory = async_sessionmaker(engine, expire_on_commit=False)
                async with session_factory() as db:
                    db.add(AIUsageLog(
                        model_id=model_id, feature=feature,
                        input_tokens=input_tokens, output_tokens=output_tokens,
                        cost_usd=calculate_cost(model_id, input_tokens, output_tokens),
                        source=source,
                    ))
                    await db.commit()
                await engine.dispose()

            loop = asyncio.new_event_loop()
            loop.run_until_complete(_do())
            loop.close()
        except Exception as e:
            logger.warning(f"Failed to log AI usage: {e}")

    threading.Thread(target=_save, daemon=True).start()


def invoke_claude(prompt: str, *, model: str | None = None, max_tokens: int = 4096, temperature: float = 0, system: str | None = None, feature: str = "general") -> str:
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

    # Extract token usage
    usage = result.get("usage", {})
    input_tokens = usage.get("input_tokens", 0)
    output_tokens = usage.get("output_tokens", 0)
    _log_usage(model_id, feature, input_tokens, output_tokens)

    return result["content"][0]["text"]


def invoke_claude_with_tools(prompt: str, tools: list, *, model: str | None = None, max_tokens: int = 4096, system: str | None = None, feature: str = "general") -> dict:
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

    # Extract token usage
    usage = result.get("usage", {})
    input_tokens = usage.get("input_tokens", 0)
    output_tokens = usage.get("output_tokens", 0)
    _log_usage(model_id, feature, input_tokens, output_tokens)

    for block in result["content"]:
        if block["type"] == "tool_use":
            return block["input"]
    return {}


def get_embedding(text: str) -> list[float]:
    """Get embedding from Amazon Titan Embedding V2 (1024-dim)."""
    client = get_bedrock_client()
    model_id = settings.BEDROCK_MODEL_EMBEDDING
    body = {"inputText": text, "dimensions": 1024, "normalize": True}

    response = client.invoke_model(modelId=model_id, body=json.dumps(body))
    result = json.loads(response["body"].read())

    # Titan returns inputTextTokenCount
    input_tokens = result.get("inputTextTokenCount", 0)
    _log_usage(model_id, "embedding", input_tokens, 0)

    return result["embedding"]
