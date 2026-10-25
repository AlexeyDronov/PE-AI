import { afterAll, afterEach, beforeAll } from "vitest";
import { setupServer } from "msw/node";

/** Every outbound HTTP call in tests must be mocked: no live network. */
export const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
