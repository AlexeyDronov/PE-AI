// Builds a one-page PDF (Helvetica, valid xref) holding the given lines: node make-pdf.mjs out.pdf "line 1" "line 2"
import { writeFileSync } from "node:fs";

const lines = process.argv.slice(3);
const esc = (s) => s.replace(/[\\()]/g, (c) => `\\${c}`);
const stream = `BT /F1 12 Tf 72 720 Td 16 TL ${lines.map((l) => `(${esc(l)}) Tj T*`).join(" ")} ET`;
const objs = [
  "<< /Type /Catalog /Pages 2 0 R >>",
  "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
  "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
  `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
];
let out = "%PDF-1.4\n";
const offsets = objs.map((o, i) => {
  const at = out.length;
  out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  return at;
});
const xref = out.length;
out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
writeFileSync(process.argv[2], out, "latin1");
