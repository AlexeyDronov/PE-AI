import { z } from "zod";
import type { ApiCallbacks } from "./callbacks";
import type { Config } from "./config";

export const JOB_KINDS = ["market_research", "teaser_screen", "memo_draft"] as const;
export type JobKind = (typeof JOB_KINDS)[number];

export interface JobContext {
  callbacks: Pick<ApiCallbacks, "progress" | "result" | "fail">;
  config: Config;
}
export type JobRunner = (jobId: string, input: Record<string, unknown>, ctx: JobContext) => Promise<void>;
export type JobRunners = Partial<Record<JobKind, JobRunner>>;

/** Filled in by the workflow steps as each job kind is implemented. */
export const jobRunners: JobRunners = {};

const startBody = z.object({ jobId: z.string().min(1), input: z.record(z.string(), z.unknown()) });

interface StartRequest {
  kind: string;
  authorization: string | undefined;
  body: unknown;
}
interface StartDeps extends JobContext {
  runners: JobRunners;
}
export interface StartResponse {
  status: 202 | 401 | 404 | 422;
  body: Record<string, unknown>;
}

const problem = (status: 401 | 404 | 422, code: string, message: string): StartResponse => ({
  status,
  body: { error: { code, message } },
});

/** Authenticate and validate a start request, then run the job in the background. */
export async function handleStartJob(
  { kind, authorization, body }: StartRequest,
  { config, callbacks, runners }: StartDeps,
): Promise<StartResponse> {
  if (authorization !== `Bearer ${config.serviceToken}`) {
    return problem(401, "unauthorized", "Missing or invalid service token");
  }
  const runner = Object.hasOwn(runners, kind) ? runners[kind as JobKind] : undefined;
  if (!runner) return problem(404, "unknown_job_kind", `Unknown job kind '${kind}'`);
  const parsed = startBody.safeParse(body);
  if (!parsed.success) return problem(422, "validation_error", "Body must be {jobId: string, input: object}");

  const { jobId, input } = parsed.data;
  void runner(jobId, input, { callbacks, config }).catch(async (err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Job ${jobId} (${kind}) failed: ${message}`);
    await callbacks.fail(jobId, message).catch((cbErr: unknown) => console.error(`Could not report failure of ${jobId}`, cbErr));
  });
  return { status: 202, body: { accepted: true, jobId } };
}
