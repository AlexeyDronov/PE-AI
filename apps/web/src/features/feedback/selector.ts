export function getSelector(el: Element): string {
  const testId = el.getAttribute("data-testid");
  if (testId) return `[data-testid="${testId}"]`;
  if (el.id) return `#${CSS.escape(el.id)}`;
  const parts: string[] = [];
  let node: Element | null = el;
  while (node && node !== document.documentElement) {
    const tag = node.tagName.toLowerCase();
    const parent: Element | null = node.parentElement;
    const index = parent ? Array.from(parent.children).filter((c) => c.tagName === node?.tagName).indexOf(node) + 1 : 1;
    parts.unshift(`${tag}:nth-of-type(${index})`);
    node = parent;
  }
  return `html > ${parts.join(" > ")}`;
}
