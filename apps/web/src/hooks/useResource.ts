import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { apiFetch, buildPath, type ApiError, type Params } from "@/lib/api/client";
import { useApiContext } from "@/lib/api/provider";
import { canonical, resourceKey, resources, type ResourceKey } from "@/lib/api/registry";
import type { ResourceData, ResourceParams } from "@/lib/api/types";
import { useDebounced } from "./useDebounced";

function fetchResource<K extends ResourceKey>(baseUrl: string, key: K, params: Params | null): Promise<ResourceData<K>> {
  const def: { path: string; method?: "GET" | "POST" } = resources[key];
  const p = params ?? {};
  if (def.method === "POST") return apiFetch<ResourceData<K>>(baseUrl, def.path, { method: "POST", body: p });
  const { path, rest } = buildPath(def.path, p);
  return apiFetch<ResourceData<K>>(baseUrl, path, { params: rest });
}

export function useResource<K extends ResourceKey>(
  key: K,
  params?: ResourceParams<K> | null,
  opts: { debounceMs?: number; keepPrevious?: boolean } = {},
) {
  const { baseUrl } = useApiContext();
  const sig = canonical(params === undefined ? {} : params);
  const debouncedSig = useDebounced(sig, opts.debounceMs ?? 0);
  const effective = JSON.parse(opts.debounceMs ? debouncedSig : sig) as Params | null;

  return useQuery<ResourceData<K>, ApiError>({
    queryKey: resourceKey(key, effective),
    enabled: effective !== null,
    placeholderData: opts.keepPrevious ? keepPreviousData : undefined,
    queryFn: () => fetchResource(baseUrl, key, effective),
  });
}

/** Warms the cache for a resource (e.g. on hover of a link to the page that reads it); skipped while it is fresh. */
export function usePrefetchResource() {
  const { baseUrl } = useApiContext();
  const queryClient = useQueryClient();
  return useCallback(
    <K extends ResourceKey>(key: K, params?: ResourceParams<K>) => {
      const effective = JSON.parse(canonical(params === undefined ? {} : params)) as Params;
      void queryClient.prefetchQuery({ queryKey: resourceKey(key, effective), queryFn: () => fetchResource(baseUrl, key, effective) });
    },
    [baseUrl, queryClient],
  );
}
