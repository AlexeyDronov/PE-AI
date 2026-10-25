"use client";

import type { ReactNode } from "react";
import { ApiProvider } from "@/lib/api/provider";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export function Providers({ children }: { children: ReactNode }) {
  return <ApiProvider baseUrl={BASE_URL}>{children}</ApiProvider>;
}
