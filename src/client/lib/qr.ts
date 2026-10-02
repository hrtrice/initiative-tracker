import qrcode from "qrcode-generator";

export interface QrSvg {
  /** Width and height in modules, including the quiet zone. */
  size: number;
  /** One path covering every dark module, for a single <path d>. */
  path: string;
}

/** The blank border scanners need around a code (the spec asks for 4 modules). */
export const QUIET_ZONE = 4;

/**
 * The dark/light grid for some text. Error correction "M" survives a little glare or a
 * smudged screen while keeping the code coarse enough to scan from across a table.
 */
export function qrMatrix(text: string): boolean[][] {
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();
  const count = qr.getModuleCount();
  return Array.from({ length: count }, (_, row) =>
    Array.from({ length: count }, (_, col) => qr.isDark(row, col))
  );
}

/** The QR code as one SVG path, so the page can style it like the rest of the app. */
export function qrSvg(text: string): QrSvg {
  const matrix = qrMatrix(text);
  let path = "";
  matrix.forEach((cells, row) =>
    cells.forEach((dark, col) => {
      if (dark) path += `M${col + QUIET_ZONE} ${row + QUIET_ZONE}h1v1h-1z`;
    })
  );
  return { size: matrix.length + QUIET_ZONE * 2, path };
}
