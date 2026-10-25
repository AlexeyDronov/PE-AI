import { PlatformView } from "@/features/portfolio/PlatformView";

export default async function PlatformPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PlatformView platformId={id} />;
}
