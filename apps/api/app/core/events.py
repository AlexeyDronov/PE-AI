"""In-process event bus and its server-sent-events encoding."""

import asyncio
import json
from typing import Any

CLOSE: dict[str, Any] = {"type": "__close__"}


class EventBus:
    """Fans events out to subscriber queues; a full queue drops its oldest item."""

    def __init__(self, max_queue: int = 100) -> None:
        self._max_queue = max_queue
        self._queues: set[asyncio.Queue[dict[str, Any]]] = set()
        self._closed = False
        self.data_version = 0  # bumped on every "changed" event, so cached computes expire on writes

    @property
    def subscriber_count(self) -> int:
        return len(self._queues)

    @property
    def closed(self) -> bool:
        return self._closed

    async def close(self) -> None:
        """Wake every subscriber with a sentinel so their streams end."""
        self._closed = True
        for queue in self._queues:
            self._offer(queue, CLOSE)

    def _offer(self, queue: asyncio.Queue[dict[str, Any]], event: dict[str, Any]) -> None:
        if queue.full():
            queue.get_nowait()
        queue.put_nowait(event)

    def subscribe(self) -> asyncio.Queue[dict[str, Any]]:
        queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue(self._max_queue)
        if self._closed:
            queue.put_nowait(CLOSE)
        self._queues.add(queue)
        return queue

    def unsubscribe(self, queue: asyncio.Queue[dict[str, Any]]) -> None:
        self._queues.discard(queue)

    async def publish(self, event: dict[str, Any]) -> None:
        if event["type"] == "changed":
            self.data_version += 1
        for queue in self._queues:
            self._offer(queue, event)


def sse_format(event: dict[str, Any]) -> str:
    """Encode one event as an SSE frame."""
    return f"event: {event['type']}\ndata: {json.dumps(event)}\n\n"
