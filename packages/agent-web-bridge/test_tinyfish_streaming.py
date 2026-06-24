"""
Tests for TinyFish async streaming, anti-bot posture, and Browser Context Profiles.

Covers ADR 0008 phases 1, 1.5, and 2.

Run with: pytest test_tinyfish_streaming.py -v
"""

import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import httpx

from tinyfish_client import (
    TinyFishClient,
    TinyFishAgentUpdate,
    TinyFishResult,
    _looks_blocked,
    _products_from_agent_result,
)


# ── Fixtures ────────────────────────────────────────────────────────────────


@pytest.fixture
def client():
    return TinyFishClient(api_key="test_key")


def make_response(status_code: int, json_data: dict | None = None, text: str = ""):
    """Build a mock httpx.Response."""
    resp = MagicMock(spec=httpx.Response)
    resp.status_code = status_code
    resp.is_success = 200 <= status_code < 300
    resp.text = text or (str(json_data) if json_data else "")
    if json_data is not None:
        resp.json = MagicMock(return_value=json_data)
    return resp


# ── Phase 1: Async polling ─────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_start_run_posts_browser_profile_and_proxy(client):
    """Phase 1 + 1.5: stealth + proxy are forwarded to the run-async body."""
    captured = {}

    async def fake_post(url, json=None, **_):
        captured["url"] = url
        captured["body"] = json
        return make_response(200, {"run_id": "run_123"})

    client._client.post = fake_post

    run_id = await client._start_run(
        goal="find shoes",
        use_profile=True,
        profile_id=None,
        browser_profile="STEALTH",
        proxy_country="US",
    )

    assert run_id == "run_123"
    assert captured["body"]["browser_profile"] == "STEALTH"
    assert captured["body"]["proxy_config"] == {"enabled": True, "country_code": "US"}
    assert captured["body"]["use_profile"] is True
    assert "use_profile" in captured["body"]


@pytest.mark.asyncio
async def test_start_run_omits_proxy_when_country_none(client):
    """Per ADR 0008 D4: LITE posture must not add a proxy line (cost)."""
    captured = {}

    async def fake_post(url, json=None, **_):
        captured["body"] = json
        return make_response(200, {"run_id": "run_124"})

    client._client.post = fake_post
    await client._start_run(
        goal="x",
        use_profile=True,
        profile_id=None,
        browser_profile="LITE",
        proxy_country=None,
    )

    assert "proxy_config" not in captured["body"]
    assert captured["body"]["browser_profile"] == "LITE"


@pytest.mark.asyncio
async def test_async_poll_loop_yields_starting_then_running_then_done(client):
    """The async generator must emit starting → running → done in order,
    capturing streaming_url as soon as it appears."""
    updates: list[TinyFishAgentUpdate] = []

    async def fake_start_run(**_):
        return "run_001"

    async def fake_get_run(run_id):
        # First poll: RUNNING with streaming_url present
        if not hasattr(fake_get_run, "called"):
            fake_get_run.called = True
            return {
                "run_id": run_id,
                "status": "RUNNING",
                "streaming_url": "https://stream.tinyfish/abc",
                "result": None,
            }
        # Second poll: COMPLETED
        return {
            "run_id": run_id,
            "status": "COMPLETED",
            "streaming_url": "https://stream.tinyfish/abc",
            "result": [{"name": "Jacket", "price": 99, "source": "ssense.com",
                        "url": "https://ssense.com/x", "image_url": None,
                        "currency": "USD"}],
        }

    with patch.object(client, "_start_run", new=fake_start_run), \
         patch.object(client, "_get_run", new=fake_get_run):
        async for update in client._async_poll_loop(
            goal="g",
            use_profile=True,
            profile_id=None,
            browser_profile="LITE",
            proxy_country=None,
            max_wait_ms=10_000,
        ):
            updates.append(update)
            if update.phase == "done":
                break

    phases = [u.phase for u in updates]
    assert phases[0] == "starting"
    assert "running" in phases
    assert phases[-1] == "done"
    # Streaming URL must be surfaced at the running phase.
    running = next(u for u in updates if u.phase == "running")
    assert running.streaming_url == "https://stream.tinyfish/abc"
    # Terminal phase carries the result.
    assert updates[-1].result is not None


@pytest.mark.asyncio
async def test_async_poll_loop_emits_error_on_failed_status(client):
    async def fake_start_run(**_):
        return "run_002"

    async def fake_get_run(run_id):
        return {
            "run_id": run_id,
            "status": "FAILED",
            "streaming_url": None,
            "error": {"message": "captcha detected"},
        }

    with patch.object(client, "_start_run", new=fake_start_run), \
         patch.object(client, "_get_run", new=fake_get_run):
        updates = []
        async for update in client._async_poll_loop(
            goal="g",
            use_profile=False,
            profile_id=None,
            browser_profile="LITE",
            proxy_country=None,
            max_wait_ms=5_000,
        ):
            updates.append(update)

    assert updates[-1].phase == "error"
    assert updates[-1].error == "captcha detected"


# ── Phase 1.5: Anti-bot helpers ────────────────────────────────────────────


def test_looks_blocked_detects_error_sentinel():
    """When the agent returns {error: 'blocked'} per the goal suffix."""
    update = TinyFishAgentUpdate(
        phase="done",
        result=[{"name": "x", "error": "blocked"}],
    )
    assert _looks_blocked(update) is True


def test_looks_blocked_detects_captcha_in_error_message():
    update = TinyFishAgentUpdate(phase="error", error="CAPTCHA encountered")
    assert _looks_blocked(update) is True


def test_looks_blocked_false_for_normal_results():
    update = TinyFishAgentUpdate(
        phase="done",
        result=[{"name": "Jacket", "price": 99}],
    )
    assert _looks_blocked(update) is False


def test_products_from_agent_result_trusts_structured_json():
    """Phase 1 D1: the regex fallback is removed from agent_browse."""
    products = _products_from_agent_result(
        [{"name": "Sneaker", "price": "120", "source": "ssense.com",
          "url": "https://ssense.com/s", "currency": "USD"}],
        query="sneakers",
    )
    assert len(products) == 1
    assert products[0].name == "Sneaker"
    assert products[0].price == 120.0  # coerced from string


def test_products_from_agent_result_returns_empty_on_blocked_dict():
    products = _products_from_agent_result({"error": "blocked"}, query="x")
    assert products == []


# ── Phase 2: Browser Context Profiles ──────────────────────────────────────


@pytest.mark.asyncio
async def test_agent_browse_forwards_use_profile_and_profile_id(client):
    """Phase 2: use_profile + profile_id are sent in the run-async body."""
    with patch.dict("os.environ", {"TINYFISH_DEFAULT_PROFILE_ID": "prof_default"}):
        captured = {}

        async def fake_post(url, json=None, **_):
            captured["body"] = json
            return make_response(200, {"run_id": "run_p"})

        async def fake_get_run(run_id):
            return {"run_id": run_id, "status": "COMPLETED",
                    "streaming_url": None, "result": []}

        client._client.post = fake_post
        with patch.object(client, "_get_run", new=fake_get_run):
            await client.agent_browse("jacket", 3, use_profile=True)

    assert captured["body"]["use_profile"] is True
    assert captured["body"]["profile_id"] == "prof_default"


@pytest.mark.asyncio
async def test_agent_browse_populates_live_url_and_streaming_url(client):
    """live_url and streaming_url must both be populated from streaming_url."""
    with patch.dict("os.environ", {}, clear=False):
        async def fake_post(url, json=None, **_):
            return make_response(200, {"run_id": "run_x"})

        async def fake_get_run(run_id):
            return {
                "run_id": run_id,
                "status": "COMPLETED",
                "streaming_url": "https://stream.tinyfish/live",
                "result": [{"name": "Blazer", "price": 200, "source": "farfetch.com",
                            "url": "https://farfetch.com/b", "currency": "USD"}],
            }

        client._client.post = fake_post
        with patch.object(client, "_get_run", new=fake_get_run):
            result = await client.agent_browse("blazer", 3)

    assert result.live_url == "https://stream.tinyfish/live"
    assert result.streaming_url == "https://stream.tinyfish/live"
    assert len(result.products) == 1
    assert result.last_phase == "done"
    assert result.blocked is False


@pytest.mark.asyncio
async def test_agent_browse_marks_blocked_when_agent_returns_block_sentinel(client):
    async def fake_post(url, json=None, **_):
        return make_response(200, {"run_id": "run_b"})

    async def fake_get_run(run_id):
        return {
            "run_id": run_id,
            "status": "COMPLETED",
            "streaming_url": None,
            "result": [{"error": "blocked"}],
        }

    client._client.post = fake_post
    with patch.object(client, "_get_run", new=fake_get_run):
        result = await client.agent_browse("ssense jacket", 3)

    assert result.blocked is True
    assert result.products == []
    assert result.last_phase == "done"


# ── Phase 1.5: Goal hardening suffix ──────────────────────────────────────


def test_build_agent_goal_includes_anti_bot_suffix(client):
    goal = client._build_agent_goal("black blazer", 3)
    # Anti-bot suffix must be present (ADR 0008 D3).
    assert "cookie consent" in goal.lower() or "gdpr" in goal.lower()
    assert "captcha" in goal.lower() or "access denied" in goal.lower()
    assert "blocked" in goal
    # Original search intent preserved.
    assert "black blazer" in goal
    assert "farfetch.com" in goal  # whitelist inlined


# ── Public surface preservation ───────────────────────────────────────────


@pytest.mark.asyncio
async def test_search_and_fetch_unchanged(client):
    """Public surface must be backward-compatible (ADR 0008 D1)."""
    async def fake_get(url, params=None, **_):
        return make_response(200, {"results": [
            {"url": "https://farfetch.com/p1"},
            {"url": "https://example.com/p2"},
        ]})

    async def fake_post(url, json=None, **_):
        return make_response(200, {"results": [
            {"title": "Black Blazer", "text": "Price $250 buy now", "final_url": "https://farfetch.com/p1"},
        ]})

    client._client.get = fake_get
    client._client.post = fake_post

    result = await client.search_and_fetch("black blazer", 2)
    assert len(result.products) == 1
    assert result.products[0].name == "Black Blazer"
    assert result.products[0].price == 250.0


# ── Phase 3 review: TINYFISH_ASYNC=0 kill switch ──────────────────────────


@pytest.mark.asyncio
async def test_kill_switch_reverts_to_blocking_path(monkeypatch, client):
    """When TINYFISH_ASYNC=0, agent_browse hits the legacy blocking endpoint."""
    monkeypatch.setenv("TINYFISH_ASYNC", "0")

    captured = {}

    async def fake_post(url, json=None, **_):
        captured["url"] = url
        captured["body"] = json
        return make_response(200, {
            "result": [{"name": "Sneaker", "price": 120, "source": "ssense.com",
                        "url": "https://ssense.com/s", "currency": "USD"}],
            "live_url": "https://stream.tinyfish/live-legacy",
        })

    client._client.post = fake_post

    result = await client.agent_browse(
        "sneakers", 3,
        browser_profile="STEALTH",
        proxy_country="US",
        use_profile=True,
    )

    # Hit the legacy blocking endpoint, not the async one.
    assert captured["url"].endswith("/v1/automation/run")
    assert captured["body"]["browser_profile"] == "STEALTH"
    assert captured["body"]["proxy_config"] == {"enabled": True, "country_code": "US"}
    assert captured["body"]["use_profile"] is True
    assert result.live_url == "https://stream.tinyfish/live-legacy"
    assert len(result.products) == 1
    assert result.last_phase == "done"


@pytest.mark.asyncio
async def test_kill_switch_default_uses_async_path(monkeypatch, client):
    """When TINYFISH_ASYNC is unset or '1', agent_browse uses the async path."""
    monkeypatch.delenv("TINYFISH_ASYNC", raising=False)

    start_run_called = False

    async def fake_start_run(*args, **_kwargs):
        nonlocal start_run_called
        start_run_called = True
        return "run_async_default"

    async def fake_get_run(*_args, **_kwargs):
        return {"run_id": "x", "status": "COMPLETED",
                "streaming_url": None, "result": []}

    # Make any direct POST call fail loudly so we know the async path was taken.
    client._client.post = AsyncMock(
        side_effect=AssertionError("should not hit the blocking endpoint")
    )
    with patch.object(client, "_start_run", new=fake_start_run), \
         patch.object(client, "_get_run", new=fake_get_run):
        await client.agent_browse("x", 3)

    assert start_run_called is True


# ── Phase 3 review: SSE consumer in dispatchExternalAction ────────────────
# (Tested in the TypeScript agent-core suite; see __tests__/agent-controls.test.ts)
