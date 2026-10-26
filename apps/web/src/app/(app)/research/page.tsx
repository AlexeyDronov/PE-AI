import { Suspense } from "react";
import { ResearchView } from "@/features/research/ResearchView";

export default function ResearchPage() {
  return (
    <Suspense>
      <ResearchView />
    </Suspense>
  );
}
