import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const notFound = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});
vi.mock("next/navigation", () => ({ notFound }));

const { default: DevLayout } = await import("@/app/dev/layout");

afterEach(() => {
  vi.unstubAllEnvs();
  notFound.mockClear();
});

// User request: the component gallery is a development tool, not part of the public site.
describe("/dev routes", () => {
  it("are a 404 on the Vercel production deployment", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    expect(() => render(<DevLayout>gallery</DevLayout>)).toThrow("NEXT_NOT_FOUND");
  });

  it.each([undefined, "preview", "development"])("stay available elsewhere (VERCEL_ENV=%s)", (env) => {
    if (env) vi.stubEnv("VERCEL_ENV", env);
    render(<DevLayout>gallery</DevLayout>);
    expect(screen.getByText("gallery")).toBeInTheDocument();
    expect(notFound).not.toHaveBeenCalled();
  });
});
