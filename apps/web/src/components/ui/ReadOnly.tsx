"use client";

import { createContext } from "react";

/** Set (to the reason, e.g. "View-only account") when the signed-in user may only look; buttons marked `writes` obey it. */
export const ReadOnlyContext = createContext<string | null>(null);
