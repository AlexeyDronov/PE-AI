import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch, type ApiError } from "@/lib/api/client";
import { useApiContext } from "@/lib/api/provider";
import { commands, resourceKey, type CommandKey } from "@/lib/api/registry";
import type { CommandInput, CommandResult, Job } from "@/lib/api/types";
import { useResource } from "./useResource";

function isJob(v: unknown): v is Job {
  return typeof v === "object" && v !== null && "id" in v && "kind" in v && "status" in v;
}

function asJob(v: unknown): Job | undefined {
  return isJob(v) ? v : undefined;
}

export function useCommand<K extends CommandKey>(key: K) {
  const { baseUrl } = useApiContext();
  const queryClient = useQueryClient();
  const mutation = useMutation<CommandResult<K>, ApiError, CommandInput<K>>({
    mutationFn: (input) => apiFetch<CommandResult<K>>(baseUrl, commands[key], { method: "POST", body: input }),
    onSuccess: (result) => {
      const job = asJob(result);
      if (job) queryClient.setQueryData(resourceKey("job", { id: job.id }), job);
    },
  });
  const started = asJob(mutation.data);
  const live = useResource("job", started ? { id: started.id } : null);

  return {
    run: mutation.mutateAsync,
    status: mutation.status,
    result: mutation.data,
    error: mutation.error ?? undefined,
    job: started ? (live.data ?? started) : undefined,
    reset: mutation.reset,
  };
}
