import { EmptyState, PageHeader } from "@/components/ui";

export function PlaceholderPage({ title, question }: { title: string; question: string }) {
  return (
    <>
      <PageHeader title={title} description={question} />
      <EmptyState title="This page is being built" />
    </>
  );
}
