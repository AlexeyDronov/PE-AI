import { Suspense } from "react";
import { PipelineView } from "@/features/pipeline/PipelineView";

export default function PipelinePage() {
  return (
    <Suspense>
      <PipelineView />
    </Suspense>
  );
}
