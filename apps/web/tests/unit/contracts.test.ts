/**
 * Frontend types come from the generated contract (packages/contracts), never hand-written.
 * The expectTypeOf assertions are checked by `tsc --noEmit`; the runtime checks guard the files.
 */
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, expectTypeOf, it } from "vitest";
import type { components } from "@contracts/openapi";
import type { useCommand } from "@/hooks/useCommand";
import type { useResource } from "@/hooks/useResource";
import type { CommandInput, CommandResult, ResourceData, ResourceParams } from "@/lib/api/types";

type Schemas = components["schemas"];

const contracts = fileURLToPath(new URL("../../../../packages/contracts/", import.meta.url));

describe("generated contract", () => {
  it("exists and was generated from the API's OpenAPI document", () => {
    expect(existsSync(`${contracts}openapi.json`)).toBe(true);
    const ts = readFileSync(`${contracts}src/openapi.ts`, "utf8");
    expect(ts).toMatch(/DealListItem/);
    expect(ts).toMatch(/LboResponse/);
  });
});

describe("resource and command types are derived from it", () => {
  it("lists are pages of generated items", () => {
    expectTypeOf<ResourceData<"deals">["items"][number]>().toEqualTypeOf<Schemas["DealListItem"]>();
    expectTypeOf<ResourceData<"deals">["total"]>().toEqualTypeOf<number>();
    expectTypeOf<ResourceData<"deal">>().toEqualTypeOf<Schemas["DealDetail"]>();
    expectTypeOf<ResourceData<"portfolioCompanies">["items"][number]>().toEqualTypeOf<Schemas["PortfolioCompanyListItem"]>();
    expectTypeOf<ResourceData<"pipelineSummary">>().toEqualTypeOf<Schemas["PipelineSummary"]>();
  });

  it("verdicts are a closed set", () => {
    expectTypeOf<ResourceData<"deals">["items"][number]["screening"]["verdict"]>().toEqualTypeOf<
      "Advance" | "Watch" | "Pass"
    >();
  });

  it("compute params and results are the request and response models", () => {
    expectTypeOf<ResourceParams<"lbo">>().toEqualTypeOf<Schemas["LboRequest"]>();
    expectTypeOf<ResourceData<"lbo">>().toEqualTypeOf<Schemas["LboResponse"]>();
  });

  it("commands take and return generated models", () => {
    expectTypeOf<CommandInput<"saveScenario">>().toEqualTypeOf<Schemas["SaveScenarioInput"]>();
    expectTypeOf<CommandResult<"saveScenario">>().toEqualTypeOf<Schemas["LboScenarioRead"]>();
  });

  it("path params are required strings for detail resources", () => {
    expectTypeOf<ResourceParams<"deal">>().toMatchTypeOf<{ id: string }>();
  });

  it("hook inputs are exactly the contract, not partials", () => {
    type RunArg = Parameters<ReturnType<typeof useCommand<"saveScenario">>["run"]>[0];
    expectTypeOf<RunArg>().toEqualTypeOf<CommandInput<"saveScenario">>();
    type LboParams = NonNullable<Parameters<typeof useResource<"lbo">>[1]>;
    expectTypeOf<LboParams>().toEqualTypeOf<ResourceParams<"lbo">>();
  });

  it("runtime placeholder so vitest reports the type suite", () => {
    expect(true).toBe(true);
  });
});
