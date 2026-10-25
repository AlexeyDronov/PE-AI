import type { Tone } from "@/components/ui";

/** The one platform-status-to-tone mapping every status badge uses. */
export const PLATFORM_TONE: Record<string, Tone> = { good: "good", warn: "warn", bad: "bad", acc: "accent" };

export const platformTone = (status: string): Tone => PLATFORM_TONE[status] ?? "neutral";
