import { Button, Card } from "@/components/ui";
import type { Scenario } from "./types";

export function ScenarioList({ scenarios, onLoad }: { scenarios: Scenario[]; onLoad: (scenario: Scenario) => void }) {
  if (scenarios.length === 0) return null;
  return (
    <Card title="Saved scenarios" testId="scenario-list">
      {scenarios.map((s) => (
        <Button key={s.id} variant="ghost" size="sm" onClick={() => onLoad(s)}>
          Load {s.name}
        </Button>
      ))}
    </Card>
  );
}
