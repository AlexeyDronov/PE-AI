import type { Tone } from "@/components/ui";

export type Verdict = "Advance" | "Watch" | "Pass";

/** The one verdict-to-tone mapping every verdict badge uses. */
export const VERDICT_TONE: Record<Verdict, Tone> = { Advance: "good", Watch: "warn", Pass: "bad" };
