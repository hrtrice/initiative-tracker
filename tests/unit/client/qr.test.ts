import { describe, it, expect } from "vitest";
import jsQR from "jsqr";
import { qrMatrix, qrSvg, QUIET_ZONE } from "../../../src/client/lib/qr";

/** Paints the matrix as an RGBA image, quiet zone included, the way a phone camera would see it. */
function rasterize(matrix: boolean[][], scale = 4) {
  const size = (matrix.length + QUIET_ZONE * 2) * scale;
  const data = new Uint8ClampedArray(size * size * 4).fill(255);
  matrix.forEach((cells, row) =>
    cells.forEach((dark, col) => {
      if (!dark) return;
      for (let y = 0; y < scale; y++) {
        for (let x = 0; x < scale; x++) {
          const px = ((row + QUIET_ZONE) * scale + y) * size + (col + QUIET_ZONE) * scale + x;
          data.fill(0, px * 4, px * 4 + 3);
        }
      }
    })
  );
  return { data, size };
}

describe("qr", () => {
  it("encodes a table link that a scanner reads back exactly", () => {
    const link = "https://easyinitiative.up.railway.app/?table=6326";
    const { data, size } = rasterize(qrMatrix(link));
    expect(jsQR(data, size, size)?.data).toBe(link);
  });

  it("draws one square per dark module inside the quiet zone", () => {
    const link = "https://easyinitiative.up.railway.app/?table=6326";
    const matrix = qrMatrix(link);
    const { size, path } = qrSvg(link);
    expect(size).toBe(matrix.length + QUIET_ZONE * 2);
    const squares = path.match(/M\d+ \d+h1v1h-1z/g) ?? [];
    expect(squares.length).toBe(matrix.flat().filter(Boolean).length);
    expect(path.startsWith(`M${QUIET_ZONE}`)).toBe(true);
  });
});
