"use client";

import { FileText } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Chart } from "@/components/charts/Chart";
import { heatmapOption, rangeBarOption, waterfallOption } from "@/components/charts/options";
import { useChartTheme } from "@/components/charts/theme";
import {
  AssumptionsPanel,
  CreditProfileCard,
  type LboCase,
  type Overrides,
  ProjectionsTable,
  ScenarioList,
  SourcesUsesCard,
} from "@/components/domain/model";
import { Button, ButtonLink, Card, ErrorState, OnThisPage, PageSection, StatStrip, TextField } from "@/components/ui";
import { useCommand } from "@/hooks/useCommand";
import { useDownload } from "@/hooks/useDownload";
import { useResource } from "@/hooks/useResource";
import { useUrlState } from "@/hooks/useUrlState";
import { fmt } from "@/lib/format";
import styles from "./DealModel.module.css";

const SECTIONS = [
  { id: "returns", label: "Returns" },
  { id: "assumptions", label: "Assumptions and structure" },
  { id: "projections", label: "Projections" },
  { id: "sensitivity", label: "Sensitivity" },
  { id: "value-bridge", label: "Value bridge" },
];

const CASES: LboCase[] = ["down", "base", "up"];
const asCase = (v: string): LboCase => CASES.find((c) => c === v) ?? "base";

function Figures({ stale, children }: { stale: boolean; children: ReactNode }) {
  return (
    <div className={styles.figures} data-stale={stale} aria-busy={stale || undefined}>
      {children}
    </div>
  );
}

export function DealModel({ dealId }: { dealId: string }) {
  const theme = useChartTheme();
  const [caseParam, setCase] = useUrlState("case", "base");
  const scenario = asCase(caseParam);
  const [overrides, setOverrides] = useState<Overrides>({});
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const [exportError, setExportError] = useState<string>();

  const request = { deal_id: dealId, case: scenario, overrides };
  const lbo = useResource("lbo", request, { debounceMs: 150, keepPrevious: true });
  const sensitivity = useResource("lboSensitivity", request, { debounceMs: 150, keepPrevious: true });
  const valuation = useResource("valuationRange", { deal_id: dealId });
  const benchmarks = useResource("benchmarks");
  const scenarios = useResource("lboScenarios", { deal_id: dealId });
  const save = useCommand("saveScenario");
  const download = useDownload();

  if (lbo.isError) return <ErrorState message="Couldn't run the model." onRetry={() => void lbo.refetch()} />;

  const data = lbo.data;
  const stale = lbo.isPlaceholderData;
  const hurdle = data ? fmt.pct(data.hurdle, { dp: 0 }) : "";
  const gap = data ? (data.returns.irr - data.hurdle) * 100 : 0;
  const stats = data
    ? [
        {
          label: "Gross IRR",
          value: fmt.pct(data.returns.irr),
          delta: { text: `${Math.abs(gap).toFixed(1)}pt ${gap >= 0 ? "above" : "below"} the ${hurdle} hurdle`, direction: gap >= 0 ? ("up" as const) : ("down" as const), good: gap >= 0 },
        },
        { label: "MOIC", value: fmt.multiple(data.returns.moic, { dp: 2 }) },
        { label: "Equity cheque", value: fmt.money(data.sources_uses.sponsor_equity) },
        {
          label: `Max bid at ${hurdle}`,
          value: fmt.money(data.max_bid?.enterprise_value),
          hint: data.max_bid ? `${fmt.multiple(data.max_bid.multiple)} EBITDA` : undefined,
        },
        { label: "Exit equity", value: fmt.money(data.returns.exit_equity) },
      ]
    : [];

  const grid = sensitivity.data;
  const flat = grid?.irr.flat() ?? [];
  const heat = grid
    ? heatmapOption(
        {
          xLabels: grid.exit.map((m) => fmt.multiple(m)),
          yLabels: grid.entry.map((m) => fmt.multiple(m)),
          values: grid.irr,
          midpoint: data?.hurdle ?? 0,
          range: [Math.min(...flat, data?.hurdle ?? 0), Math.max(...flat, data?.hurdle ?? 0)],
          format: (v) => fmt.pct(v),
        },
        theme,
      )
    : {};
  const heatRows = grid?.entry.map((entry, i) => ({ id: String(entry), entry: fmt.multiple(entry), irr: grid.exit.map((_, j) => fmt.pct(grid.irr[i]?.[j])).join(" · ") })) ?? [];

  const range = valuation.data;
  const rangeOption = range
    ? rangeBarOption({ rows: range.rows.map((r) => ({ ...r, marker: range.ask })), valueFormat: fmt.money, unit: "money" }, theme)
    : {};

  const bridge = data?.bridge ?? [];
  const bridgeOption = waterfallOption(
    { steps: bridge.map((b, i) => ({ label: b.label, value: b.value, kind: i === 0 ? "start" : i === bridge.length - 1 ? "end" : "delta" })), valueFormat: fmt.money, unit: "money" },
    theme,
  );

  const saveScenario = () =>
    void save
      .run({ deal_id: dealId, name: name.trim(), case: scenario, overrides })
      .then(() => {
        setNaming(false);
        setName("");
      })
      .catch(() => undefined);

  const exportExcel = () => {
    setExportError(undefined);
    download("/exports/lbo", request).catch((e: Error) => setExportError(e.message));
  };

  return (
    <div className={styles.layout} data-testid="deal-model">
      <div className={styles.sections}>
        <div className={styles.actions}>
          {naming ? (
            <div className={styles.saveForm}>
              <TextField label="Scenario name" value={name} onChange={setName} />
              <Button variant="primary" disabled={!name.trim()} loading={save.status === "pending"} onClick={saveScenario}>
                Save
              </Button>
            </div>
          ) : (
            <Button onClick={() => setNaming(true)}>Save scenario</Button>
          )}
          <Button onClick={exportExcel}>Export Excel</Button>
          <ButtonLink href={`/deals/${dealId}/memo`} variant="primary" icon={<FileText size={16} strokeWidth={1.5} />}>
            Draft IC memo
          </ButtonLink>
        </div>
        {save.error ? <p className={styles.error}>{save.error.message}</p> : null}
        {exportError ? <p className={styles.error}>{exportError}</p> : null}

        <PageSection id="returns" title="Returns" description={data ? `${scenario === "base" ? "Base" : scenario === "down" ? "Downside" : "Upside"} case · ${data.assumptions.years}-year hold · ${fmt.pct(data.assumptions.sweep, { dp: 0 })} cash sweep` : undefined}>
          <Figures stale={stale}>
            <StatStrip items={stats} loading={!data} count={5} />
          </Figures>
        </PageSection>

        <PageSection id="assumptions" title="Assumptions and structure" description="Move a lever and the model reruns">
          <div className={styles.trio}>
            <AssumptionsPanel
              assumptions={data?.assumptions}
              overrides={overrides}
              scenario={scenario}
              onScenarioChange={setCase}
              onOverride={(key, value) => setOverrides((prev) => ({ ...prev, [key]: value }))}
              onReset={() => setOverrides({})}
            />
            <Figures stale={stale}>
              <SourcesUsesCard sourcesUses={data?.sources_uses} assumptions={data?.assumptions} />
            </Figures>
            <Figures stale={stale}>
              <CreditProfileCard credit={data?.credit} benchmarks={benchmarks.data?.items ?? []} />
            </Figures>
          </div>
          <ScenarioList
            scenarios={scenarios.data?.items ?? []}
            onLoad={(s) => {
              setCase(s.case);
              setOverrides(s.overrides);
            }}
          />
        </PageSection>

        <PageSection id="projections" title="Projections" description="Cash flow and debt schedule">
          <Figures stale={stale}>
            <ProjectionsTable schedule={data?.schedule ?? []} loading={!data} />
          </Figures>
        </PageSection>

        <PageSection id="sensitivity" title="Sensitivity" description="How returns move with price and exit">
          <div className={styles.pair}>
            <Card title="IRR by entry and exit multiple" description={`Midpoint is the ${hurdle} hurdle`}>
              <Figures stale={sensitivity.isPlaceholderData}>
                <Chart
                  label="IRR by entry and exit multiple"
                  option={heat}
                  loading={!grid}
                  table={{
                    columns: [
                      { key: "entry", header: "Entry", render: (r) => r.entry },
                      { key: "irr", header: "IRR by exit multiple", align: "right", render: (r) => r.irr },
                    ],
                    rows: heatRows,
                    getRowId: (r) => r.id,
                  }}
                />
              </Figures>
            </Card>
            <Card title="Valuation range" description={range ? `Marker shows the ask of ${fmt.money(range.ask)}` : "Enterprise value against the ask"}>
              <Chart
                label="Valuation range"
                option={rangeOption}
                loading={!range}
                table={{
                  columns: [
                    { key: "label", header: "Method", render: (r) => r.label },
                    { key: "low", header: "Low", align: "right", render: (r) => fmt.money(r.low) },
                    { key: "high", header: "High", align: "right", render: (r) => fmt.money(r.high) },
                  ],
                  rows: range?.rows ?? [],
                  getRowId: (r) => r.label,
                }}
              />
            </Card>
          </div>
        </PageSection>

        <PageSection id="value-bridge" title="Value bridge">
          <Card title="Equity value bridge" description="Entry equity to exit equity">
            <Figures stale={stale}>
              <Chart
                label="Equity value bridge"
                option={bridgeOption}
                loading={!data}
                table={{
                  columns: [
                    { key: "label", header: "Step", render: (r) => r.label },
                    { key: "value", header: "£m", align: "right", render: (r) => fmt.money(r.value, { style: "financial" }) },
                  ],
                  rows: bridge,
                  getRowId: (r) => r.label,
                }}
              />
            </Figures>
          </Card>
        </PageSection>
      </div>
      <OnThisPage items={SECTIONS} />
    </div>
  );
}
