/**
 * Every API type is derived from the generated contract (packages/contracts) via the endpoints named
 * in the registry, so adding a registry entry is the only step needed to get its types.
 */
import type { components, paths } from "@contracts/openapi";
import type { commands, resources } from "./registry";

export type Job = components["schemas"]["JobRead"];

type ResourceKey = keyof typeof resources;
type CommandKey = keyof typeof commands;

type PathItem<P extends string> = `/api${P}` extends keyof paths ? paths[`/api${P}`] : never;
type IsCompute<K extends ResourceKey> = (typeof resources)[K] extends { method: "POST" } ? true : false;
type Operation<K extends ResourceKey> =
  PathItem<(typeof resources)[K]["path"]> extends infer Item
    ? IsCompute<K> extends true
      ? Item extends { post: infer Op }
        ? Op
        : never
      : Item extends { get: infer Op }
        ? Op
        : never
    : never;

type JsonBody<R> = R extends { content: { "application/json": infer B } } ? B : never;
type Success<Op> = Op extends { responses: infer R } ? JsonBody<R[Extract<keyof R, 200 | 201 | 202>]> : never;
type RequestBody<Op> = Op extends { requestBody: infer R } ? JsonBody<R> : never;
type Slot<P, S extends string> = P extends { [Key in S]?: infer V }
  ? [NonNullable<V>] extends [never]
    ? unknown
    : NonNullable<V>
  : unknown;
type UrlParams<Op> = Op extends { parameters: infer P } ? Slot<P, "path"> & Slot<P, "query"> : unknown;

/** The response body of a registry resource. */
export type ResourceData<K extends ResourceKey> = Success<Operation<K>>;

/** Path params (required) and query params (optional); the request model for compute resources. */
export type ResourceParams<K extends ResourceKey> =
  IsCompute<K> extends true ? RequestBody<Operation<K>> : UrlParams<Operation<K>>;

type CommandOperation<K extends CommandKey> = PathItem<(typeof commands)[K]> extends { post: infer Op } ? Op : never;

export type CommandInput<K extends CommandKey> = RequestBody<CommandOperation<K>>;
export type CommandResult<K extends CommandKey> = Success<CommandOperation<K>>;
