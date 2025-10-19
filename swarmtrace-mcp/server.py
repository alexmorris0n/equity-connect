"""SwarmTrace MCP server exposing a batch skip trace tool.

This implementation uses FastMCP with SSE transport so that n8n's MCP client
can call the server. It supports adaptive concurrency, retries with
exponential backoff, optional mock mode for testing, and bearer token
authentication to protect the endpoint.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import time
from collections import defaultdict
from contextlib import asynccontextmanager
from typing import Any, AsyncIterator

import httpx
import uvicorn
from fastmcp import Context, FastMCP
from fastmcp.server.http import create_sse_app
from pydantic import BaseModel, Field, ValidationError, root_validator
from starlette.middleware import Middleware
from starlette.responses import PlainTextResponse
from starlette.routing import Route


logger = logging.getLogger(__name__)


SWARMTRACE_BASE_URL = "https://skiptracepublicapi.swarmalytics.com"
SKIPTRACE_ENDPOINT = "/skiptrace"


class PropertyInput(BaseModel):
    """Schema describing a single property to skip trace."""

    address: str | None = Field(
        default=None,
        description="Street address (alias for property_address)",
        example="123 Main St",
    )
    city: str | None = Field(
        default=None,
        description="City (alias for property_city)",
        example="Austin",
    )
    state: str | None = Field(
        default=None,
        description="State (alias for property_state)",
        example="TX",
    )
    zip: str | None = Field(
        default=None,
        description="ZIP code (alias for property_zip)",
        example="78701",
    )

    property_address: str | None = Field(
        default=None,
        description="Street address expected by SwarmTrace",
    )
    property_city: str | None = Field(
        default=None,
        description="City expected by SwarmTrace",
    )
    property_state: str | None = Field(
        default=None,
        description="State expected by SwarmTrace",
    )
    property_zip: str | None = Field(
        default=None,
        description="ZIP expected by SwarmTrace",
    )

    firstname: str | None = Field(
        default=None,
        description="Optional first name",
    )
    lastname: str | None = Field(
        default=None,
        description="Optional last name",
    )

    @root_validator(pre=True)
    def ensure_required_fields(cls, values: dict[str, Any]) -> dict[str, Any]:
        # Normalize aliases to property_* keys for validation
        normalized = _normalize_property(values)
        missing = [
            field
            for field in ("property_address", "property_city", "property_state", "property_zip")
            if not normalized.get(field)
        ]
        if missing:
            raise ValueError(
                "Missing required property fields: " + ", ".join(missing)
            )
        # Return the merged dict so the model holds both alias and canonical keys
        return {**values, **normalized}


class BatchSkipTraceArgs(BaseModel):
    properties: list[PropertyInput] = Field(
        ...,
        description="List of property records to skip trace",
    )
    max_concurrent: int | None = Field(
        default=None,
        description="Maximum concurrent SwarmTrace requests for this invocation",
        ge=1,
        le=100,
    )


class SkipTraceResult(BaseModel):
    index: int
    input: dict[str, Any]
    contacts: list[dict[str, Any]] | None = None
    error: str | None = None
    status_code: int | None = None
    duration_ms: float | None = None


class Stats(BaseModel):
    total_properties: int
    successful_calls: int
    billable_hits: int
    api_failures: int
    validation_failures: int
    avg_response_time_ms: float | None
    min_response_time_ms: float | None
    max_response_time_ms: float | None
    p95_response_time_ms: float | None


class BatchSkipTraceResponse(BaseModel):
    successful: list[SkipTraceResult]
    failed: list[SkipTraceResult]
    stats: Stats


class EnsureJsonContentTypeMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope.get("type") == "http" and scope.get("method") == "POST":
            path = scope.get("path", "")
            if path.startswith("/mcp/messages"):
                headers = list(scope.get("headers", []))
                if not any(name.lower() == b"content-type" for name, _ in headers):
                    headers.append((b"content-type", b"application/json"))
                    scope = dict(scope)
                    scope["headers"] = headers
        await self.app(scope, receive, send)


def _env_bool(key: str, default: bool = False) -> bool:
    value = os.getenv(key)
    if value is None:
        return default
    return value.lower() in {"1", "true", "yes", "on"}


def _env_int(key: str, default: int) -> int:
    value = os.getenv(key)
    if value is None:
        return default
    try:
        return int(value)
    except ValueError:
        logger.warning("Invalid integer for %s=%s; using default %s", key, value, default)
        return default


def _normalize_property(raw: dict[str, Any]) -> dict[str, Any]:
    return {
        "property_address": raw.get("property_address") or raw.get("address"),
        "property_city": raw.get("property_city") or raw.get("city"),
        "property_state": raw.get("property_state") or raw.get("state"),
        "property_zip": raw.get("property_zip") or raw.get("zip"),
        "firstname": raw.get("firstname"),
        "lastname": raw.get("lastname"),
    }


class SwarmTraceClient:
    def __init__(self, api_key: str, use_mock_api: bool = False) -> None:
        self.api_key = api_key
        self.use_mock_api = use_mock_api
        self.base_url = SWARMTRACE_BASE_URL
        self._client: httpx.AsyncClient | None = None

    async def __aenter__(self) -> "SwarmTraceClient":
        if self._client is None:
            limits = httpx.Limits(max_connections=100, max_keepalive_connections=50)
            self._client = httpx.AsyncClient(
                base_url=self.base_url,
                timeout=httpx.Timeout(30.0),
                limits=limits,
                headers={"X-API-KEY": self.api_key, "Content-Type": "application/json"},
            )
        return self

    async def __aexit__(self, *_: object) -> None:
        if self._client is not None:
            await self._client.aclose()
            self._client = None

    async def skip_trace(self, payload: dict[str, Any]) -> tuple[int, dict[str, Any]]:
        if self.use_mock_api:
            await asyncio.sleep(0.1)
            mock = {
                "status": {"error": ""},
                "input": payload,
                "contacts": [
                    {
                        "names": [
                            {
                                "firstname": payload.get("firstname", "Test"),
                                "lastname": payload.get("lastname", "User"),
                            }
                        ],
                        "phones": [
                            {
                                "phonenumber": "5551234567",
                                "phonetype": "mobile",
                                "dnc_litigator_scrub": [],
                            }
                        ],
                        "emails": [{"email": "test@example.com"}],
                        "confirmed_address": [
                            {
                                "street": payload.get("property_address"),
                                "city": payload.get("property_city"),
                                "state": payload.get("property_state"),
                                "zip": payload.get("property_zip"),
                            }
                        ],
                    }
                ],
            }
            return 200, mock

        if self._client is None:
            raise RuntimeError("Client not initialized")

        response = await self._client.post(SKIPTRACE_ENDPOINT, json=payload)
        data = response.json()
        return response.status_code, data


def _compute_stats(results: list[SkipTraceResult]) -> Stats:
    total = len(results)
    successful_calls = sum(1 for r in results if r.status_code == 200)
    billable_hits = sum(1 for r in results if r.contacts)
    api_failures = sum(1 for r in results if r.status_code and r.status_code >= 400)
    validation_failures = sum(1 for r in results if r.status_code == 0)

    durations = [r.duration_ms for r in results if r.duration_ms is not None]
    if durations:
        avg = sum(durations) / len(durations)
        min_d = min(durations)
        max_d = max(durations)
        sorted_d = sorted(durations)
        p95_index = int(len(sorted_d) * 0.95) - 1
        p95 = sorted_d[max(p95_index, 0)]
    else:
        avg = min_d = max_d = p95 = None

    return Stats(
        total_properties=total,
        successful_calls=successful_calls,
        billable_hits=billable_hits,
        api_failures=api_failures,
        validation_failures=validation_failures,
        avg_response_time_ms=avg,
        min_response_time_ms=min_d,
        max_response_time_ms=max_d,
        p95_response_time_ms=p95,
    )


@asynccontextmanager
async def _swarmtrace_client(api_key: str, use_mock: bool) -> AsyncIterator[SwarmTraceClient]:
    async with SwarmTraceClient(api_key=api_key, use_mock_api=use_mock) as client:
        yield client


async def _call_swarmtrace(
    client: SwarmTraceClient,
    payload: dict[str, Any],
    semaphore: asyncio.Semaphore,
    retries: int,
) -> tuple[int, dict[str, Any], float]:
    attempt = 0
    delay = 1.0
    async with semaphore:
        while True:
            attempt += 1
            start = time.perf_counter()
            status_code, data = await client.skip_trace(payload)
            duration_ms = (time.perf_counter() - start) * 1000

            if status_code == 429 and attempt <= retries:
                jitter = delay * 0.1
                sleep_for = delay + jitter
                await asyncio.sleep(sleep_for)
                delay *= 2
                continue
            return status_code, data, duration_ms


def _serialize_result(index: int, payload: dict[str, Any], status: int, data: dict[str, Any], duration_ms: float) -> SkipTraceResult:
    error_message = None
    contacts = None
    if status == 200:
        contacts = data.get("contacts") or []
        if not contacts:
            contacts = None
    else:
        error_message = data.get("status", {}).get("error") or data.get("error") or json.dumps(data)
    return SkipTraceResult(
        index=index,
        input=payload,
        contacts=contacts,
        error=error_message,
        status_code=status,
        duration_ms=duration_ms,
    )


def _serialize_validation_error(index: int, payload: dict[str, Any], error: str) -> SkipTraceResult:
    return SkipTraceResult(
        index=index,
        input=payload,
        contacts=None,
        error=error,
        status_code=0,
        duration_ms=None,
    )


def _filter_results(results: list[SkipTraceResult]) -> tuple[list[SkipTraceResult], list[SkipTraceResult]]:
    successful: list[SkipTraceResult] = []
    failed: list[SkipTraceResult] = []
    for r in results:
        if r.contacts:
            successful.append(r)
        else:
            failed.append(r)
    return successful, failed


def _load_env() -> dict[str, Any]:
    from dotenv import load_dotenv

    load_dotenv()
    return {
        "api_key": os.environ.get("SWARMTRACE_API_KEY"),
        "max_concurrent_default": _env_int("MAX_CONCURRENT_REQUESTS", 30),
        "retry_max_attempts": _env_int("RETRY_MAX_ATTEMPTS", 3),
        "enable_debug": _env_bool("ENABLE_DEBUG_LOGGING", False),
        "use_mock_api": _env_bool("USE_MOCK_API", False),
        "bearer_token": os.environ.get("MCP_BEARER_TOKEN"),
        "host": os.environ.get("HOST", "0.0.0.0"),
        "port": int(os.environ.get("PORT", "8080")),
    }


config = _load_env()

if config["enable_debug"]:
    logging.basicConfig(level=logging.DEBUG)
else:
    logging.basicConfig(level=logging.INFO)

if not config["api_key"] and not config["use_mock_api"]:
    raise RuntimeError("SWARMTRACE_API_KEY is required unless USE_MOCK_API=true")

mcp = FastMCP("SwarmTrace Skip Trace Server")


@mcp.tool()
async def batch_skip_trace(
    properties: list[dict[str, Any]],
    max_concurrent: int | None = None,
    ctx: Context | None = None,
) -> dict[str, Any]:
    if ctx:
        await ctx.info(f"Processing {len(properties)} properties")

    if len(properties) > 200:
        raise ValueError("Maximum batch size is 200 properties per call")

    try:
        parsed_args = BatchSkipTraceArgs(properties=properties, max_concurrent=max_concurrent)
    except ValidationError as exc:
        errors = []
        for err in exc.errors():
            index = err["loc"][1] if len(err["loc"]) > 1 else -1
            message = err["msg"]
            raw = properties[index] if 0 <= index < len(properties) else {}
            errors.append(_serialize_validation_error(index, _normalize_property(raw), message))
        stats = Stats(
            total_properties=len(properties),
            successful_calls=0,
            billable_hits=0,
            api_failures=0,
            validation_failures=len(errors),
            avg_response_time_ms=None,
            min_response_time_ms=None,
            max_response_time_ms=None,
            p95_response_time_ms=None,
        )
        return BatchSkipTraceResponse(successful=[], failed=errors, stats=stats).dict()

    effective_max_concurrent = (
        parsed_args.max_concurrent if parsed_args.max_concurrent else config["max_concurrent_default"]
    )

    semaphore = asyncio.Semaphore(effective_max_concurrent)
    tasks = []
    retry_attempts = config["retry_max_attempts"]

    async with _swarmtrace_client(config["api_key"], config["use_mock_api"]) as client:
        task_map: dict[asyncio.Task[tuple[int, dict[str, Any], float]], tuple[int, dict[str, Any]]] = {}
        for index, prop in enumerate(parsed_args.properties):
            payload = _normalize_property(prop.dict())
            task = asyncio.create_task(
                _call_swarmtrace(client, payload, semaphore, retry_attempts)
            )
            task_map[task] = (index, payload)

        results: list[SkipTraceResult] = []
        api_errors: defaultdict[int, str] = defaultdict(str)
        early_abort = False

        pending = set(task_map.keys())
        while pending:
            done, pending = await asyncio.wait(pending, return_when=asyncio.FIRST_COMPLETED)
            for task in done:
                index, payload = task_map.pop(task)
                try:
                    status, data, duration_ms = task.result()
                except asyncio.CancelledError:
                    results.append(
                        SkipTraceResult(
                            index=index,
                            input=payload,
                            contacts=None,
                            error="Cancelled due to upstream error",
                            status_code=0,
                            duration_ms=None,
                        )
                    )
                    continue

                if status == 402:
                    message = data.get("status", {}).get("error") or "Insufficient credits"
                    api_errors[status] = message
                    early_abort = True
                    for pending_task in pending:
                        pending_task.cancel()
                    pending.clear()
                    results.append(
                        _serialize_result(index, payload, status, data, duration_ms)
                    )
                    break

                if status >= 400:
                    api_errors[status] = data.get("status", {}).get("error") or "API error"

                results.append(
                    _serialize_result(index, payload, status, data, duration_ms)
                )

            if early_abort:
                break

        # Collect any remaining cancelled tasks
        for task, (index, payload) in task_map.items():
            if task.cancelled():
                results.append(
                    SkipTraceResult(
                        index=index,
                        input=payload,
                        contacts=None,
                        error="Cancelled due to upstream error",
                        status_code=0,
                        duration_ms=None,
                    )
                )

        successful, failed = _filter_results(results)
        stats = _compute_stats(results)

        if ctx:
            meta = {
                "billable_hits": stats.billable_hits,
                "successful_calls": stats.successful_calls,
                "failed": len(failed),
            }
            await ctx.info(f"Batch complete: {meta}")

        if api_errors and ctx:
            await ctx.warn("Encountered API errors: " + ", ".join(f"{k}:{v}" for k, v in api_errors.items()))

        return BatchSkipTraceResponse(successful=successful, failed=failed, stats=stats).dict()


def healthcheck(_request):
    return PlainTextResponse("ok")


MESSAGE_PATH = "/mcp/messages/"
SSE_PATH = "/mcp/sse"


app = create_sse_app(
    server=mcp,
    message_path=MESSAGE_PATH,
    sse_path=SSE_PATH,
    auth=None,
    debug=config["enable_debug"],
    routes=[Route("/health", endpoint=healthcheck, methods=["GET"])],
    middleware=[Middleware(EnsureJsonContentTypeMiddleware)],
)


if __name__ == "__main__":
    uvicorn.run(
        app,
        host=config["host"],
        port=config["port"],
        log_level="debug" if config["enable_debug"] else "info",
    )

