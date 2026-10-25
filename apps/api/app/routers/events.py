import asyncio
from collections.abc import AsyncIterator

from fastapi import Request
from fastapi.responses import StreamingResponse

from app.core.events import CLOSE, EventBus, sse_format

KEEP_ALIVE_SECONDS = 15


async def event_stream(bus: EventBus, keepalive_seconds: float = KEEP_ALIVE_SECONDS) -> AsyncIterator[str]:
    """Yield SSE frames until the bus closes."""
    queue = bus.subscribe()
    try:
        yield ": connected\n\n"
        while True:
            try:
                event = await asyncio.wait_for(queue.get(), keepalive_seconds)
            except TimeoutError:
                yield ": keep-alive\n\n"
                continue
            if event is CLOSE:
                return
            yield sse_format(event)
    finally:
        bus.unsubscribe(queue)


async def stream_events(request: Request) -> StreamingResponse:
    async def until_disconnect() -> AsyncIterator[str]:
        async for frame in event_stream(request.app.state.events):
            if await request.is_disconnected():
                return
            yield frame

    return StreamingResponse(until_disconnect(), media_type="text/event-stream")
