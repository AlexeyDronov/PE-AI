# Sizing a market

Goal: a defensible estimate of the revenue pool a segment addresses in the UK and Europe, with a range and a stated confidence, not a single headline number.

1. Define the scope first. Write down what is in and out (for example "UK outsourced payroll services, excluding payroll software licences"). Most disagreement between analyst reports is scope, not arithmetic.
2. Top-down: start from a published market figure (trade body, regulator, listed-company filings, analyst report), then narrow by geography and by the share that is outsourced or addressable. Use extractTables for report tables.
3. Bottom-up: number of buyers (companies, sites, regulated entities) multiplied by average annual spend per buyer, taken from company filings, pricing pages or fund data via internalData. Check buyer counts against companyRegistry where relevant.
4. Triangulate. Aim for at least two independent routes (top-down and bottom-up) or three sources. If they differ by more than about 30%, explain why (scope, year, currency) before choosing.
5. Normalise before comparing. Convert every figure to GBP with fxRates, noting the rate date, and restate to a common year. Compute growth with the calculator tool (cagr, pct_change) and shares with share; never do arithmetic yourself.
6. Distinguish market size (revenue of all suppliers) from spend (buyer budgets), and actuals from forecasts. Label each figure with its year and whether it is an estimate.
7. Report a low, base and high case with the assumption driving each, and a confidence rating (high, medium, low) with a one-line reason. Vendor-sponsored reports with no method are low confidence.
8. If no credible figure exists, lead with the closest evidence you found, then state the gap and what you did try. Do not extrapolate from an unrelated market.
