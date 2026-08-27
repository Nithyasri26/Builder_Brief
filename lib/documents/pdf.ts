/**
 * A very small PDF writer.
 *
 * The prototype has to hand the citizen a real file they can open, but a full
 * PDF library is a heavy dependency for four demo documents. This writes a
 * valid PDF 1.4 with the two standard Helvetica fonts, which every viewer
 * renders. Only what the demo documents need is implemented: text, rules and
 * filled rectangles.
 */

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;

export interface TextOptions {
  size?: number;
  bold?: boolean;
  color?: [number, number, number];
}

interface Op {
  render(): string;
}

export class PdfPage {
  private ops: Op[] = [];

  text(value: string, x: number, y: number, options: TextOptions = {}): this {
    const size = options.size ?? 11;
    const font = options.bold ? '/F2' : '/F1';
    const [r, g, b] = options.color ?? [0.09, 0.11, 0.15];
    const safe = escapeText(value);
    this.ops.push({
      render: () =>
        `BT ${r} ${g} ${b} rg ${font} ${size} Tf 1 0 0 1 ${x} ${flip(y)} Tm (${safe}) Tj ET`,
    });
    return this;
  }

  line(x1: number, y1: number, x2: number, y2: number, color: [number, number, number] = [0.8, 0.83, 0.88]): this {
    const [r, g, b] = color;
    this.ops.push({
      render: () => `${r} ${g} ${b} RG 0.8 w ${x1} ${flip(y1)} m ${x2} ${flip(y2)} l S`,
    });
    return this;
  }

  rect(
    x: number,
    y: number,
    width: number,
    height: number,
    color: [number, number, number],
  ): this {
    const [r, g, b] = color;
    this.ops.push({
      render: () => `${r} ${g} ${b} rg ${x} ${flip(y + height)} ${width} ${height} re f`,
    });
    return this;
  }

  content(): string {
    return this.ops.map((op) => op.render()).join('\n');
  }
}

/** PDF origin is bottom-left; the callers think top-down. */
function flip(y: number): number {
  return PAGE_HEIGHT - y;
}

function escapeText(value: string): string {
  return value
    .replace(/₹/g, 'Rs. ')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/[…]/g, '...')
    // Standard-encoding fonts only carry ASCII reliably.
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

export function renderPdf(pages: PdfPage[]): Uint8Array {
  const objects: string[] = [];
  const pageCount = Math.max(1, pages.length);
  const firstPageObj = 4;
  const contentObjOffset = firstPageObj + pageCount;

  const kids = Array.from({ length: pageCount }, (_, i) => `${firstPageObj + i} 0 R`).join(' ');

  objects.push('<< /Type /Catalog /Pages 2 0 R >>');
  objects.push(`<< /Type /Pages /Kids [${kids}] /Count ${pageCount} >>`);
  // Object 3 holds the shared font resources.
  objects.push(
    '<< /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >> /F2 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >> >> >>',
  );

  pages.forEach((_, index) => {
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources 3 0 R /Contents ${contentObjOffset + index} 0 R >>`,
    );
  });

  pages.forEach((page) => {
    const stream = page.content();
    objects.push(`<< /Length ${byteLength(stream)} >>\nstream\n${stream}\nendstream`);
  });

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((body, index) => {
    offsets.push(byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefStart = byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return new TextEncoder().encode(pdf);
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

export const PAGE = { width: PAGE_WIDTH, height: PAGE_HEIGHT };
