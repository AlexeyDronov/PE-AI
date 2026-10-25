import { type HTMLElement, type Node, NodeType, parse } from "node-html-parser";

const NOISE = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "SVG", "NAV", "HEADER", "FOOTER", "ASIDE", "FORM", "HEAD"]);
const PARAGRAPH = new Set(["P", "H1", "H2", "H3", "H4", "H5", "H6", "TABLE", "SECTION", "ARTICLE", "MAIN", "UL", "OL", "BLOCKQUOTE", "PRE"]);
const LINE = new Set(["BR", "DIV", "LI", "TR", "CAPTION", "DT", "DD", "FIGURE", "FIGCAPTION", "HR"]);
const CELL = new Set(["TD", "TH"]);

const collapse = (text: string) => text.replace(/[ \t\r\f\v\u00a0]+/g, " ").replace(/ ?\n ?/g, "\n").replace(/\n{3,}/g, "\n\n").trim();

function walk(node: Node, out: string[]): void {
  if (node.nodeType === NodeType.TEXT_NODE) {
    out.push(node.text);
    return;
  }
  if (node.nodeType !== NodeType.ELEMENT_NODE) return;
  const tag = (node as HTMLElement).tagName ?? "";
  if (NOISE.has(tag)) return;
  const gap = PARAGRAPH.has(tag) ? "\n\n" : LINE.has(tag) ? "\n" : CELL.has(tag) ? " " : "";
  out.push(gap);
  for (const child of node.childNodes) walk(child, out);
  out.push(gap);
}

function textOf(root: Node): string {
  const out: string[] = [];
  walk(root, out);
  return collapse(out.join(""));
}

const parseHtml = (html: string) => parse(html, { comment: false });

/** Parse an HTML fragment and return its visible text on one line. */
export const inlineText = (html: string) => textOf(parseHtml(html)).replace(/\s+/g, " ");

export function extractTitle(html: string): string {
  const title = parseHtml(html).querySelector("title");
  return title ? title.text.replace(/\s+/g, " ").trim() : "";
}

/** Readable body text: boilerplate removed, preferring <article> or <main>. */
export function readableText(html: string): string {
  const root = parseHtml(html);
  return textOf(root.querySelector("main") ?? root.querySelector("article") ?? root.querySelector("body") ?? root);
}
