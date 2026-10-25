"""In-process event bus and its server-sent-events encoding."""

import json

from app.core.events import EventBus, sse_format


async def test_publish_fans_out_to_every_subscriber():
    bus = EventBus()
    a, b = bus.subscribe(), bus.subscribe()
    await bus.publish({"type": "changed", "resources": ["deals"], "ids": ["d1"]})
    assert (await a.get())["ids"] == ["d1"]
    assert (await b.get())["ids"] == ["d1"]


async def test_unsubscribed_queue_receives_nothing():
    bus = EventBus()
    q = bus.subscribe()
    bus.unsubscribe(q)
    await bus.publish({"type": "changed", "resources": ["deals"], "ids": []})
    assert q.empty()
    assert bus.subscriber_count == 0


async def test_slow_subscriber_does_not_block_others():
    bus = EventBus(max_queue=2)
    slow, fast = bus.subscribe(), bus.subscribe()
    for i in range(5):
        await bus.publish({"type": "job", "id": str(i)})
        await fast.get()
    assert slow.qsize() <= 2


def test_sse_format():
    frame = sse_format({"type": "changed", "resources": ["deals"], "ids": ["d1"]})
    assert frame.startswith("event: changed\n")
    data_line = frame.splitlines()[1]
    assert data_line.startswith("data: ")
    assert json.loads(data_line[len("data: ") :]) == {
        "type": "changed",
        "resources": ["deals"],
        "ids": ["d1"],
    }
    assert frame.endswith("\n\n")


def test_events_route_is_registered(app):
    paths = {getattr(r, "path", None) for r in app.routes}
    assert "/api/events" in paths


# ---------- found in browser review: open streams blocked server reload ----------


async def test_closing_the_bus_ends_every_stream():
    from app.routers.events import event_stream

    bus = EventBus()
    stream = event_stream(bus, keepalive_seconds=60)
    first = await anext(stream)  # opening comment so proxies flush
    assert first.startswith(":")
    await bus.close()
    rest = [frame async for frame in stream]
    assert rest == []
    assert bus.subscriber_count == 0


async def test_closed_bus_refuses_new_subscribers_gracefully():
    bus = EventBus()
    await bus.close()
    from app.routers.events import event_stream

    frames = [f async for f in event_stream(bus, keepalive_seconds=60)]
    assert len(frames) <= 1 and all(f.startswith(":") for f in frames)


def test_app_shutdown_closes_the_bus(app):
    from fastapi.testclient import TestClient

    with TestClient(app):
        assert not app.state.events.closed
    assert app.state.events.closed
