/**
 * Shared PDF generation utility for low-level PDF 1.4 construction.
 * Used by reportService, telemetryPdfService, and other services needing PDF output.
 */

export function generatePdfFromLines(lines: string[]): Buffer {
  const wrappedLines = wrapPdfLines(lines);
  const pageLineLimit = 48;
  const pages = chunk(wrappedLines, pageLineLimit);
  const pageCount = Math.max(1, pages.length);
  const objects: string[] = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    ""
  ];
  const pageObjectIds: number[] = [];
  const fontObjectId = 3 + pageCount * 2;

  for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
    const pageObjectId = 3 + pageIndex * 2;
    const contentObjectId = pageObjectId + 1;
    pageObjectIds.push(pageObjectId);
    const stream = buildPdfPageStream(pages[pageIndex] ?? []);
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontObjectId} 0 R >> >> /Contents ${contentObjectId} 0 R >>`);
    objects.push(`<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`);
  }

  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  objects[1] = `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageCount} >>`;

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, "latin1");
}

function buildPdfPageStream(lines: string[]): string {
  const escapedLines = lines.map((line) => `(${escapePdfText(line)}) Tj`);
  return `BT /F1 10 Tf 50 760 Td 13 TL ${escapedLines.join(" T* ")} ET`;
}

function escapePdfText(value: string): string {
  return toWinAnsi(value).replace(/[()\\]/g, "\\$&");
}

function toWinAnsi(value: string): string {
  return value
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "?");
}

function wrapPdfLines(lines: string[]): string[] {
  const wrapped: string[] = [];
  for (const line of lines) {
    const normalized = toWinAnsi(line);
    if (normalized.length <= 92) {
      wrapped.push(normalized);
      continue;
    }
    const words = normalized.split(/\s+/);
    let current = "";
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (next.length > 92) {
        if (current) wrapped.push(current);
        current = word;
      } else {
        current = next;
      }
    }
    if (current) wrapped.push(current);
  }
  return wrapped;
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks.length > 0 ? chunks : [[]];
}
