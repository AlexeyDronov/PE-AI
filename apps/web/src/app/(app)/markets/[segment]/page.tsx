import { SegmentView } from "@/features/markets/SegmentView";

export default async function SegmentPage({ params }: { params: Promise<{ segment: string }> }) {
  const { segment } = await params;
  return <SegmentView segmentId={segment} />;
}
