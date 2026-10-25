import { DealOverview } from "@/features/deal/DealOverview";

export default async function DealOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DealOverview dealId={id} />;
}
