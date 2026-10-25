export interface Source {
  ref: number;
  url: string;
  title: string;
  publisher: string;
  excerpt: string;
}

export interface SourceRegistry {
  record(source: Omit<Source, "ref">): { ref: number };
  list(): Source[];
}

/** One registry per job: numbers sources from 1 and deduplicates by URL (first excerpt wins). */
export function createSourceRegistry(): SourceRegistry {
  const byUrl = new Map<string, Source>();
  return {
    record(source) {
      const existing = byUrl.get(source.url);
      if (existing) return { ref: existing.ref };
      const ref = byUrl.size + 1;
      byUrl.set(source.url, { ref, ...source });
      return { ref };
    },
    list: () => [...byUrl.values()],
  };
}
