import { Suspense } from "react";
import { DealMemo } from "@/features/deal/DealMemo";

export default async function MemoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense>
      <DealMemo dealId={id} />
    </Suspense>
  );
}
