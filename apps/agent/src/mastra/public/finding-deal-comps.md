# Finding deal comps

Goal: a short list of relevant transactions and trading peers with the multiples paid, so the fund can judge an entry price.

Where multiples are disclosed:
- Listed acquirers' annual reports and RNS or press releases for acquisitions (often state consideration and acquired EBITDA or revenue). Use webSearch then fetchPage.
- SEC filings (secFilings) for US-listed buyers and targets: 8-K, 10-K and 10-Q acquisition notes.
- UK Companies House filings (companyRegistry to verify the target) for accounts and share purchase details.
- Fund and adviser press releases, trade press and the fund's own history via internalData (deals, transactions).
Most private deals disclose no price. Do not infer a multiple from rumours or from a single press estimate without labelling it as such.

Get the definitions right:
- Enterprise value (EV) includes net debt; equity value does not. Multiples must be EV over EBITDA. If only equity value is given, say so and do not present it as EV.
- State whether EBITDA is LTM (last twelve months, trailing) or forward (current-year estimate), and whether it is adjusted. Do not mix them in one table.
- Separate platform deals (scale buyer, higher multiple) from add-ons (small bolt-ons bought cheaply, often 4 to 8x). A blended average hides this.
- Compute multiples with the calculator tool (multiple). Convert currencies with fxRates.

Recency and relevance: prefer deals in the last three years, in the same segment and geography; flag anything older than five years or from a different rate environment. Record date, buyer, target, EV, EBITDA basis and source ref for each comp, and give a median and range only when you have at least three comps; otherwise say the sample is too small.
