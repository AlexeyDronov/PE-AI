import { apiDownload } from "@/lib/api/client";
import { useApiContext } from "@/lib/api/provider";

/** Fetches a file from the API and hands it to the browser as a download. */
export function useDownload() {
  const { baseUrl } = useApiContext();
  return async (path: string, body: unknown) => {
    const { blob, filename } = await apiDownload(baseUrl, path, body);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };
}
