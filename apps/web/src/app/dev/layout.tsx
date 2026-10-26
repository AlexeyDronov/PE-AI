import { notFound } from "next/navigation";
import type { ReactNode } from "react";

/** Development-only routes (the component gallery): a 404 on the Vercel production site, available everywhere else. */
export default function DevLayout({ children }: { children: ReactNode }) {
  if (process.env.VERCEL_ENV === "production") notFound();
  return children;
}
