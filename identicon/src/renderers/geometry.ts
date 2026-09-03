import type { IdenticonMatrix } from "@/core/types.ts";
import type { RenderSettings } from "@/core/options.ts";

/** One integer-aligned foreground rectangle. */
export interface Cell {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Shares exact pixel boundaries across SVG and PNG, including uneven sizes. */
export const filledCells = (
  matrix: IdenticonMatrix,
  { size, padding }: RenderSettings,
): Cell[] => {
  const edges = Array.from(
    { length: 8 },
    (_, i) => padding + Math.round(i * (size - padding * 2) / 7),
  );
  const cells: Cell[] = [];
  for (let row = 0; row < 7; row++) {
    for (let column = 0; column < 7; column++) {
      if (matrix[row][column]) {
        cells.push({
          x: edges[column],
          y: edges[row],
          width: edges[column + 1] - edges[column],
          height: edges[row + 1] - edges[row],
        });
      }
    }
  }
  return cells;
};
