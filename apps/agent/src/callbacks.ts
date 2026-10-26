import type { Config } from "./config";
import { CallbackError } from "./errors";
import type { Usage } from "./llm";

const MAX_ATTEMPTS = 3;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function errorMessage(response: Response): Promise<string> {
  const fallback = `API responded ${response.status}`;
  try {
    const body: unknown = await response.json();
    const message = (body as { error?: { message?: unknown } })?.error?.message;
    return typeof message === "string" ? `${fallback}: ${message}` : fallback;
  } catch {
    return fallback;
  }
}

/** Reports job progress, results and failures to the API's internal endpoints. */
export class ApiCallbacks {
  constructor(private readonly config: Config) {}

  progress(jobId: string, step: string, message: string): Promise<void> {
    return this.post(jobId, "progress", { step, message });
  }

  result(jobId: string, payload: Record<string, unknown>, usage?: Usage): Promise<void> {
    return this.post(jobId, "result", usage ? { payload, usage } : { payload });
  }

  fail(jobId: string, error: string, usage?: Usage): Promise<void> {
    return this.post(jobId, "fail", usage ? { error, usage } : { error });
  }

  private async post(jobId: string, action: string, body: unknown): Promise<void> {
    const url = `${this.config.apiUrl}/internal/jobs/${encodeURIComponent(jobId)}/${action}`;
    let failure = new CallbackError(0, "API unreachable");
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.config.serviceToken}` },
          body: JSON.stringify(body),
        });
        if (response.ok) return;
        failure = new CallbackError(response.status, await errorMessage(response));
        if (response.status < 500) throw failure;
      } catch (err) {
        if (err === failure) throw err;
        failure = new CallbackError(0, err instanceof Error ? err.message : String(err));
      }
      if (attempt < MAX_ATTEMPTS) await sleep(100 * attempt);
    }
    throw failure;
  }
}
