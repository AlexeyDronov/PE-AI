import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { apiFetch, buildPath, type ApiError, type Params } from "@/lib/api/client";
import { useApiContext } from "@/lib/api/provider";
import { canonical, resourceKey, resources, type ResourceKey } from "@/lib/api/registry";
import type { ResourceData, ResourceParams } from "@/lib/api/types";
import { useDebounced } from "./useDebounced";

export function useResource<K extends ResourceKey>(
  key: K,
  params?: ResourceParams<K> | null,
  opts: { debounceMs?: number; keepPrevious?: boolean } = {},
) {
  const { baseUrl } = useApiContext();
  const sig = canonical(params === undefined ? {} : params);
  const debouncedSig = useDebounced(sig, opts.debounceMs ?? 0);
  const effective = JSON.parse(opts.debounceMs ? debouncedSig : sig) as Params | null;
  const def: { path: string; method?: "GET" | "POST" } = resources[key];

  return useQuery<ResourceData<K>, ApiError>({
    queryKey: resourceKey(key, effective),
    enabled: effective !== null,
    placeholderData: opts.keepPrevious ? keepPreviousData : undefined,
    queryFn: () => {
      const p = effective ?? {};
      if (def.method === "POST") return apiFetch<ResourceData<K>>(baseUrl, def.path, { method: "POST", body: p });
      const { path, rest } = buildPath(def.path, p);
      return apiFetch<ResourceData<K>>(baseUrl, path, { params: rest });
    },
  });
}
