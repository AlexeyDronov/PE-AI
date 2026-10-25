import { Suspense } from "react";
import { DealModel } from "@/features/deal/DealModel";

export default async function ModelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense>
      <DealModel dealId={id} />
    </Suspense>
  );
}
