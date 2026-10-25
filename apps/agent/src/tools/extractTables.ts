import { type HTMLElement, parse } from "node-html-parser";
import { inlineText } from "./html";

export interface Table {
  caption: string | null;
  headers: string[];
  rows: string[][];
}

const cells = (row: HTMLElement, tag: "th" | "td"): string[] =>
  row.childNodes.filter((n): n is HTMLElement => "tagName" in n && n.tagName === tag.toUpperCase()).map((cell) => inlineText(cell.innerHTML));

/** Turn every HTML table into caption, headers and body rows. */
export function extractTables(html: string): Table[] {
  return parse(html).querySelectorAll("table").map((table) => {
    const caption = table.querySelector("caption");
    const rows = table.querySelectorAll("tr");
    const headerIndex = rows.findIndex((r) => cells(r, "th").length > 0 && cells(r, "td").length === 0);
    const headerRow = rows[headerIndex];
    const headers = headerRow ? cells(headerRow, "th") : [];
    const data = rows.filter((_, i) => i !== headerIndex).map((r) => cells(r, "td")).filter((r) => r.length > 0);
    return { caption: caption ? inlineText(caption.innerHTML) : null, headers, rows: data };
  });
}
