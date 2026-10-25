from typing import Any

import httpx


class AgentClient:
    """HTTP client for the Mastra agent service."""

    def __init__(self, base_url: str, token: str) -> None:
        self.base_url = base_url.rstrip("/")
        self.token = token

    async def start_job(self, kind: str, job_id: str, payload: dict[str, Any]) -> None:
        async with httpx.AsyncClient() as http:
            response = await http.post(
                f"{self.base_url}/jobs/{kind}/start",
                json={"jobId": job_id, "input": payload},
                headers={"Authorization": f"Bearer {self.token}"},
            )
            response.raise_for_status()
