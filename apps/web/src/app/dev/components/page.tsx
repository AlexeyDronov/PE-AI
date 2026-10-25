"use client";

import { type ReactNode, useState } from "react";
import { Chart } from "@/components/charts/Chart";
import {
  barOption,
  heatmapOption,
  lineOption,
  rangeBarOption,
  scatterOption,
  stackedBarOption,
  waterfallOption,
} from "@/components/charts/options";
import { useChartTheme } from "@/components/charts/theme";
import { CompanyFlags, DebtCapacityPanel, DiligenceList, RiskChecks, Scorecard } from "@/components/domain/deal";
import { type Deal, PipelineTable, SegmentScores, StageFunnel } from "@/components/domain/pipeline";
import { VERDICT_TONE } from "@/components/domain/verdict";
import {
  AlertItem,
  Badge,
  Breadcrumb,
  Button,
  Card,
  type Column,
  DataTable,
  DotRating,
  EmptyState,
  ErrorState,
  HeadroomMeter,
  KeyValueList,
  OnThisPage,
  PageHeader,
  PageSection,
  ProgressSteps,
  ScoreBar,
  SegmentedControl,
  Sidebar,
  Skeleton,
  Slider,
  Stat,
  StatStrip,
  Tabs,
  Textarea,
  TextField,
} from "@/components/ui";
import { fmt } from "@/lib/format";
import styles from "./gallery.module.css";

type Row = { id: string; name: string; sub: string; value: number };

const ROWS: Row[] = [
  { id: "a", name: "Northvale", sub: "Compliance", value: 14.6 },
  { id: "b", name: "Veritest", sub: "TIC", value: 31 },
  { id: "c", name: "Ledgerline", sub: "Payroll", value: 19 },
];

const COLUMNS: Column<Row>[] = [
  { key: "name", header: "Company", render: (r) => r.name, sub: (r) => r.sub, sortValue: (r) => r.name },
  { key: "value", header: "EBITDA £m", align: "right", render: (r) => r.value.toFixed(1), sortValue: (r) => r.value },
];

const STEPS = [
  { key: "extract", label: "Extract" },
  { key: "score", label: "Score" },
  { key: "flags", label: "Flags" },
];

const MOCK_DEALS: Deal[] = [
  { id: "d1", code_name: "Project Keel", stage: "CIM", ask_multiple: 15.5, process: "Targeted auction", origin: "seed", source: "seed", company: { id: "c1", name: "Northvale Compliance", hq: "London, UK", description: "", segment_id: "s1" }, segment: { id: "s1", name: "Compliance & regulatory services", short: "Compliance", median_multiple: 16 }, financials: { revenue: 61, ebitda: 14.6, growth: 0.22, recurring_pct: 0.71, capex_pct: 0.03 }, screening: { score: 81, verdict: "Advance", gate_reason: null } },
  { id: "d2", code_name: "Project Vale", stage: "NDA", ask_multiple: 13.5, process: "Bilateral", origin: "seed", source: "seed", company: { id: "c2", name: "Veritest Group", hq: "Leeds, UK", description: "", segment_id: "s2" }, segment: { id: "s2", name: "Testing, inspection & certification", short: "TIC", median_multiple: 14 }, financials: { revenue: 142, ebitda: 31, growth: 0.11, recurring_pct: 0.64, capex_pct: 0.065 }, screening: { score: 60, verdict: "Watch", gate_reason: null } },
  { id: "d3", code_name: "Project Mere", stage: "Teaser", ask_multiple: 11, process: "Auction", origin: "seed", source: "seed", company: { id: "c3", name: "Meridian Legal Ops", hq: "Bristol, UK", description: "", segment_id: "s1" }, segment: { id: "s1", name: "Compliance & regulatory services", short: "Compliance", median_multiple: 16 }, financials: { revenue: 40, ebitda: 8.2, growth: 0.05, recurring_pct: 0.4, capex_pct: 0.02 }, screening: { score: 47, verdict: "Pass", gate_reason: "EBITDA £8.2m is below the £10m mandate floor" } },
] as unknown as Deal[];

const MOCK_STAGES = ["Teaser", "NDA", "CIM", "IOI", "LOI"].map((stage, i) => ({ stage, count: 5 - i }));

const MOCK_SEGMENTS = [
  { segment_id: "s1", short: "Compliance", count: 4, average_score: 66, best_score: 81 },
  { segment_id: "s2", short: "TIC", count: 3, average_score: 58, best_score: 70 },
];

type Point = { id: string; label: string; values: string };

const money = (v: number) => fmt.money(v);

const textColumns: Column<Point>[] = [
  { key: "label", header: "Item", render: (r) => r.label },
  { key: "values", header: "Values", align: "right", render: (r) => r.values },
];

function tableOf(labels: string[], values: (i: number) => string) {
  return { columns: textColumns, rows: labels.map((label, i) => ({ id: label, label, values: values(i) })), getRowId: (r: Point) => r.id };
}

const TONES = ["neutral", "good", "warn", "bad", "accent"] as const;

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <PageSection id={title.toLowerCase().replace(/\W+/g, "-")} title={title}>
      <div className={styles.grid}>{children}</div>
    </PageSection>
  );
}

function Variant({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div className={styles.variant}>
      <span className={styles.caption}>{name}</span>
      {children}
    </div>
  );
}

export default function ComponentGallery() {
  const [theme, setTheme] = useState("light");
  const [segment, setSegment] = useState("base");
  const [tab, setTab] = useState("chart");
  const [slider, setSlider] = useState(15.5);
  const [text, setText] = useState("");
  const [selected, setSelected] = useState("a");

  function changeTheme(next: string) {
    setTheme(next);
    document.documentElement.dataset.theme = next;
  }

  return (
    <main className={styles.page}>
      <PageHeader
        title="Component gallery"
        description="Every shared UI primitive in its main states. Development only."
        actions={
          <SegmentedControl
            label="Theme"
            value={theme}
            onChange={changeTheme}
            options={[
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" },
            ]}
          />
        }
      />

      <Group title="Buttons and badges">
        <Variant name="Button variants">
          <div className={styles.row}>
            <Button variant="primary">Primary</Button>
            <Button>Secondary</Button>
            <Button variant="ghost">Ghost</Button>
          </div>
        </Variant>
        <Variant name="Button sizes">
          <div className={styles.row}>
            <Button size="sm">Small</Button>
            <Button size="md">Default</Button>
            <Button size="lg" variant="primary">
              Large
            </Button>
          </div>
        </Variant>
        <Variant name="Button disabled, loading, icon">
          <div className={styles.row}>
            <Button disabled>Disabled</Button>
            <Button loading variant="primary">
              Screening
            </Button>
            <Button loading icon={<span>+</span>}>
              Saving
            </Button>
            <Button icon={<span>+</span>}>With icon</Button>
          </div>
        </Variant>
        <Variant name="Badge tones">
          <div className={styles.row}>
            {TONES.map((tone) => (
              <Badge key={tone} tone={tone}>
                {tone}
              </Badge>
            ))}
          </div>
        </Variant>
      </Group>

      <Group title="Navigation">
        <Variant name="SegmentedControl">
          <SegmentedControl
            label="Case"
            value={segment}
            onChange={setSegment}
            options={[
              { value: "down", label: "Downside" },
              { value: "base", label: "Base" },
              { value: "up", label: "Upside" },
            ]}
          />
        </Variant>
        <Variant name="Tabs (buttons)">
          <Tabs
            label="View"
            value={tab}
            onChange={setTab}
            tabs={[
              { value: "chart", label: "Chart" },
              { value: "table", label: "Table" },
            ]}
          />
        </Variant>
        <Variant name="Tabs (links)">
          <Tabs
            label="Deal"
            value="model"
            tabs={[
              { value: "overview", label: "Overview", href: "/dev/components" },
              { value: "model", label: "Model", href: "/dev/components" },
              { value: "memo", label: "IC memo", href: "/dev/components" },
            ]}
          />
        </Variant>
        <Variant name="Breadcrumb">
          <Breadcrumb items={[{ label: "Deals", href: "/deals" }, { label: "Northvale Compliance" }]} />
        </Variant>
        <Variant name="Sidebar">
          <div className={styles.sidebarFrame}>
            <Sidebar
              fund={{ name: "Harrowgate", detail: "Fund VII · £1.4bn" }}
              activeHref="/deals"
              groups={[
                { items: [{ href: "/", label: "Overview", icon: "home" }] },
                {
                  label: "Origination",
                  items: [
                    { href: "/markets", label: "Markets", icon: "globe" },
                    { href: "/research", label: "Research", icon: "search" },
                  ],
                },
                {
                  label: "Deals",
                  items: [
                    { href: "/deals", label: "Pipeline", icon: "list", count: 8 },
                    { href: "/deals/new", label: "Screen a teaser", icon: "plus" },
                  ],
                },
                {
                  label: "Portfolio",
                  items: [
                    { href: "/portfolio", label: "Platforms", icon: "briefcase" },
                    { href: "/portfolio/covenants", label: "Covenants", icon: "shield" },
                    { href: "/exits", label: "Exits", icon: "logout" },
                  ],
                },
                { label: "Fund", items: [{ href: "/fund", label: "Performance", icon: "trending" }] },
              ]}
              footer="Signed in as analyst"
            />
          </div>
        </Variant>
      </Group>

      <Group title="Inputs">
        <Variant name="Slider">
          <Slider
            label="Entry EV / EBITDA"
            value={slider}
            min={6}
            max={20}
            step={0.5}
            onChange={setSlider}
            format={(x) => `${x.toFixed(1)}x`}
            hint="Segment median 16.0x"
          />
        </Variant>
        <Variant name="Slider disabled">
          <Slider label="Leverage" value={4} min={0} max={8} step={0.1} onChange={() => {}} format={(x) => `${x.toFixed(1)}x`} disabled />
        </Variant>
        <Variant name="TextField with help">
          <TextField label="Search" value={text} onChange={setText} help="Company or code name" />
        </Variant>
        <Variant name="TextField disabled">
          <TextField label="Fund" value="Fund VII" onChange={() => {}} disabled />
        </Variant>
        <Variant name="Textarea with error">
          <Textarea label="Teaser text" value="" onChange={() => {}} error="Paste at least one paragraph" />
        </Variant>
      </Group>

      <Group title="Figures">
        <Variant name="StatStrip">
          <StatStrip
            items={[
              { label: "NAV", value: "£1.2bn", hint: "Fund VII" },
              { label: "Net IRR", value: "12.6%", hint: "Gross 17.8%", delta: { text: "0.3pt", direction: "up", good: true } },
              { label: "Leverage", value: "3.6x", delta: { text: "0.4x", direction: "down", good: true } },
              { label: "DPI", value: "0.21x", delta: { text: "0.02x", direction: "down", good: false } },
            ]}
          />
        </Variant>
        <Variant name="StatStrip loading">
          <StatStrip loading count={4} items={[]} />
        </Variant>
        <Variant name="Stat">
          <Stat label="TVPI" value="1.46x" hint="vs 1.40x prior quarter" />
        </Variant>
        <Variant name="ScoreBar good / warn / bad">
          <div className={styles.row}>
            <ScoreBar value={83} label="Score" thresholds={{ good: 68, warn: 55 }} />
            <ScoreBar value={60} label="Score" thresholds={{ good: 68, warn: 55 }} />
            <ScoreBar value={40} label="Score" thresholds={{ good: 68, warn: 55 }} />
          </div>
        </Variant>
        <Variant name="HeadroomMeter good / warn / bad">
          <div className={styles.stack}>
            <HeadroomMeter label="Covenant headroom" value={0.27} threshold={0.15} />
            <HeadroomMeter label="Covenant headroom" value={0.07} threshold={0.15} />
            <HeadroomMeter label="Covenant headroom" value={-0.02} threshold={0.15} />
          </div>
        </Variant>
        <Variant name="DotRating">
          <div className={styles.row}>
            <DotRating value={1} max={3} label="Technical moat" />
            <DotRating value={2} max={3} label="Technical moat" />
            <DotRating value={3} max={3} label="Technical moat" />
          </div>
        </Variant>
        <Variant name="KeyValueList">
          <KeyValueList
            items={[
              { label: "Senior debt", value: "43.8" },
              { label: "Equity", value: "190.7" },
              { label: "Total uses", value: "234.5", emphasis: true },
            ]}
          />
        </Variant>
      </Group>

      <Group title="Cards and alerts">
        <Variant name="Card">
          <Card title="Sources and uses" description="£m" actions={<Button size="sm">Copy</Button>}>
            Body content
          </Card>
        </Variant>
        <Variant name="Card flush with AlertItems">
          <Card flush title="Alerts" description="Needs attention">
            <AlertItem severity="bad" label="Action" title="Orbis Language Tech" body="Net leverage of 5.6x leaves 7% headroom." action="Open lender dialogue." meta="2h ago" />
            <AlertItem severity="warn" label="Watch" title="Veritest" body="EBITDA is 6% behind budget." action="Review cost plan." meta="1d ago" />
            <AlertItem severity="good" label="Clear" title="Ledgerline" body="Back on plan." />
            <AlertItem severity="info" label="Info" title="Northvale" body="New data room documents." />
          </Card>
        </Variant>
        <Variant name="ProgressSteps running / succeeded / failed">
          <div className={styles.stack}>
            <ProgressSteps steps={STEPS} current="score" status="running" />
            <ProgressSteps steps={STEPS} current="flags" status="succeeded" />
            <ProgressSteps steps={STEPS} current="score" status="failed" error="Quota exceeded" onRetry={() => {}} />
          </div>
        </Variant>
      </Group>

      <Group title="Tables">
        <Variant name="DataTable default">
          <Card flush title="Pipeline">
            <DataTable label="Deals" columns={COLUMNS} rows={ROWS} getRowId={(r) => r.id} selectedId={selected} onRowClick={(r) => setSelected(r.id)} isRecent={(id) => id === "c"} />
          </Card>
        </Variant>
        <Variant name="DataTable loading">
          <Card flush>
            <DataTable label="Deals loading" columns={COLUMNS} rows={[]} getRowId={(r) => r.id} loading />
          </Card>
        </Variant>
        <Variant name="DataTable empty">
          <Card flush>
            <DataTable label="Deals empty" columns={COLUMNS} rows={[]} getRowId={(r) => r.id} empty="No deals match this filter." />
          </Card>
        </Variant>
        <Variant name="DataTable error">
          <Card flush>
            <DataTable label="Deals error" columns={COLUMNS} rows={[]} getRowId={(r) => r.id} error="Couldn't load deals." onRetry={() => {}} />
          </Card>
        </Variant>
      </Group>

      <Group title="States">
        <Variant name="EmptyState">
          <EmptyState title="No reports yet" body="Run research to create one." action={<Button>Run research</Button>} />
        </Variant>
        <Variant name="ErrorState">
          <ErrorState message="Couldn't load deals." onRetry={() => {}} />
        </Variant>
        <Variant name="Skeleton">
          <div className={styles.stack}>
            <Skeleton width="60%" />
            <Skeleton width="40%" height={12} />
          </div>
        </Variant>
      </Group>


      <ChartGroup />
      <PipelineGroup />

      <Group title="Page layout">
        <Variant name="PageHeader with meta and tabs">
          <PageHeader
            title="Northvale Compliance"
            description="Compliance software, UK and Ireland."
            meta={<Badge tone={VERDICT_TONE.Advance}>Advance</Badge>}
            actions={<Button variant="primary">Build model</Button>}
            tabs={<Tabs label="Deal" value="overview" tabs={[{ value: "overview", label: "Overview", href: "/dev/components" }, { value: "model", label: "Model", href: "/dev/components" }]} />}
          />
        </Variant>
        <Variant name="OnThisPage (visible at 1280px and wider)">
          <OnThisPage items={[{ id: "snapshot", label: "Snapshot" }, { id: "scorecard", label: "Scorecard" }]} />
        </Variant>
      </Group>

      <DealGroup />
    </main>
  );
}

const MOCK_CRITERIA = [
  { key: "scale", label: "Scale", value: 14.6, score: 100, weight: 0.1, target_text: "LTM EBITDA £10-60m" },
  { key: "margin", label: "EBITDA margin", value: 0.2393, score: 93.7, weight: 0.15, target_text: "Above 20%" },
  { key: "moat", label: "Moat / AI resilience", value: 72, score: 72, weight: 0.15, target_text: "Resilience score above 70" },
  { key: "entry_price", label: "Entry price", value: -0.03125, score: 42, weight: 0.1, target_text: "Below 13x EBITDA" },
];

const MOCK_CHECKS = [
  { key: "concentration", label: "Customer concentration", status: "watch", detail: "Largest customer is 9% of revenue." },
  { key: "churn", label: "Churn", status: "clear", detail: "Gross revenue retention of 93%." },
  { key: "key_person", label: "Key person", status: "flag", detail: "Founder holds key relationships." },
] as const;

const MOCK_FLAGS = [
  { id: "f1", deal_id: "d1", severity: "h", text: "Remediation projects are 29% of revenue.", mitigant: "Split run-rate from project revenue in the QoE.", source: "seed", created_at: "2026-10-01T00:00:00Z" },
  { id: "f2", deal_id: "d1", severity: "l", text: "Two offices on short leases.", mitigant: "Confirm renewal terms.", source: "seed", created_at: "2026-10-01T00:00:00Z" },
] as const;

const MOCK_CAPACITY = {
  ebitda: 14.6, senior_multiple: 3, policy_leverage: 4.5, rate_senior: 0.0875, rate_sub: 0.11, stress_drop: 0.225,
  cover_floor: 2, senior_debt: 43.8, total_debt: 65.7, interest: 6.24, interest_cover: 2.34, stressed_cover: 1.81,
  max_leverage: 4.14, max_debt: 60.4,
};

function DealGroup() {
  const thresholds = { good: 68, warn: 55 };
  return (
    <PageSection id="deal" title="Deal overview">
      <div className={styles.stack}>
        <Variant name="Scorecard">
          <Scorecard criteria={MOCK_CRITERIA} thresholds={thresholds} />
        </Variant>
        <Variant name="Scorecard loading">
          <Scorecard criteria={[]} thresholds={thresholds} loading />
        </Variant>
        <div className={styles.grid}>
          <Variant name="RiskChecks">
            <RiskChecks checks={[...MOCK_CHECKS]} />
          </Variant>
          <Variant name="CompanyFlags">
            <CompanyFlags flags={[...MOCK_FLAGS]} />
          </Variant>
          <Variant name="CompanyFlags empty">
            <CompanyFlags flags={[]} />
          </Variant>
          <Variant name="DebtCapacityPanel">
            <DebtCapacityPanel capacity={MOCK_CAPACITY} />
          </Variant>
          <Variant name="DiligenceList">
            <DiligenceList questions={["What is net revenue retention on managed clients?", "How much of the stack is proprietary?"]} />
          </Variant>
          <Variant name="RiskChecks loading">
            <RiskChecks checks={[]} loading />
          </Variant>
        </div>
      </div>
    </PageSection>
  );
}

function PipelineGroup() {
  const [verdict, setVerdict] = useState("All");
  const thresholds = { good: 68, warn: 55 };
  return (
    <PageSection id="pipeline" title="Pipeline">
      <div className={styles.stack}>
        <Variant name="PipelineTable">
          <PipelineTable deals={MOCK_DEALS} verdict={verdict} onVerdictChange={setVerdict} thresholds={thresholds} onOpen={() => undefined} isRecent={(id) => id === "d3"} />
        </Variant>
        <Variant name="PipelineTable loading / error">
          <PipelineTable deals={[]} verdict="All" onVerdictChange={() => undefined} thresholds={thresholds} onOpen={() => undefined} loading />
          <PipelineTable deals={[]} verdict="All" onVerdictChange={() => undefined} thresholds={thresholds} onOpen={() => undefined} error="Couldn't load deals." onRetry={() => undefined} />
        </Variant>
        <div className={styles.grid}>
          <Variant name="StageFunnel">
            <StageFunnel byStage={MOCK_STAGES} />
          </Variant>
          <Variant name="SegmentScores">
            <SegmentScores bySegment={MOCK_SEGMENTS} />
          </Variant>
        </div>
      </div>
    </PageSection>
  );
}

function ChartGroup() {
  const theme = useChartTheme();
  const companies = ["Halden", "Orbis", "Veritest"];
  const actual = [39.5, 9.2, 31];
  const budget = [37, 12.6, 28.4];
  const years = ["2019", "2020", "2021", "2022"];
  const cash = [-80, -260, 100, 340];
  const nav = [70, 240, 450, 620];
  const multiples = ["12x", "14x", "16x"];
  const irr = [
    [24, 20, 16],
    [27, 23, 19],
    [30, 26, 22],
  ];
  const steps = [
    { label: "Entry equity", value: 571, kind: "start" as const },
    { label: "Revenue growth", value: 241, kind: "delta" as const },
    { label: "Multiple", value: -62, kind: "delta" as const },
    { label: "Fair value", kind: "end" as const },
  ];
  const points = [
    { name: "TIC", x: 6, y: 18, size: 28 },
    { name: "Payroll", x: 9, y: 24, size: 12 },
    { name: "Compliance", x: 12, y: 30, size: 36 },
  ];
  const ranges = [
    { label: "Trading comps", low: 180, high: 240, marker: 226 },
    { label: "Precedents", low: 200, high: 270 },
    { label: "DCF", low: 190, high: 260, marker: 230 },
  ];
  const buyers = ["TIC", "Payroll"];
  const split = [
    [45, 30],
    [55, 70],
  ];

  return (
    <PageSection id="charts" title="Charts">
      <div className={styles.grid}>
        <Variant name="Bar with budget markers">
          <Chart
            label="LTM EBITDA vs budget"
            option={barOption(
              {
                categories: companies,
                series: [
                  { name: "Actual", values: actual },
                  { name: "Budget", values: budget, role: "comparison", mark: "marker" },
                ],
                orientation: "horizontal",
                valueFormat: money,
                unit: "money",
              },
              theme,
            )}
            table={tableOf(companies, (i) => `${money(actual[i] ?? 0)} vs ${money(budget[i] ?? 0)}`)}
          />
        </Variant>
        <Variant name="Waterfall">
          <Chart
            label="Value bridge"
            option={waterfallOption({ steps, valueFormat: money, unit: "money" }, theme)}
            table={tableOf(steps.map((s) => s.label), (i) => String(steps[i]?.value ?? "total"))}
          />
        </Variant>
        <Variant name="Line with area and zero line">
          <Chart
            label="Net cash flow and NAV"
            option={lineOption(
              {
                categories: years,
                series: [
                  { name: "Net cash flow", values: cash, area: true },
                  { name: "NAV", values: nav, role: "comparison" },
                ],
                zeroLine: true,
                valueFormat: money,
                unit: "money",
              },
              theme,
            )}
            table={tableOf(years, (i) => `${money(cash[i] ?? 0)} / ${money(nav[i] ?? 0)}`)}
          />
        </Variant>
        <Variant name="Scatter">
          <Chart
            label="Growth vs margin"
            option={scatterOption({ points, xLabel: "Growth", yLabel: "Margin" }, theme)}
            table={tableOf(points.map((p) => p.name), (i) => `${points[i]?.x}, ${points[i]?.y}`)}
          />
        </Variant>
        <Variant name="Heatmap">
          <Chart
            label="IRR by entry and exit multiple"
            option={heatmapOption({ xLabels: multiples, yLabels: multiples, values: irr, midpoint: 20, range: [16, 30], format: (v) => `${v.toFixed(1)}%` }, theme)}
            table={tableOf(multiples, (i) => (irr[i] ?? []).join(", "))}
          />
        </Variant>
        <Variant name="Range bar">
          <Chart
            label="Valuation range"
            option={rangeBarOption({ rows: ranges, unit: "money" }, theme)}
            table={tableOf(ranges.map((r) => r.label), (i) => `${money(ranges[i]?.low ?? 0)} to ${money(ranges[i]?.high ?? 0)}`)}
          />
        </Variant>
        <Variant name="Stacked 100%">
          <Chart
            label="Buyer mix"
            option={stackedBarOption(
              {
                categories: buyers,
                series: [
                  { name: "Strategic", values: split[0] ?? [] },
                  { name: "Sponsor", values: split[1] ?? [] },
                ],
                percent: true,
              },
              theme,
            )}
            table={tableOf(buyers, (i) => `${split[0]?.[i]}% / ${split[1]?.[i]}%`)}
          />
        </Variant>
      </div>
    </PageSection>
  );
}
