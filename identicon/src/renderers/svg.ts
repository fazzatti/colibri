import type { IdenticonColor, IdenticonData } from "@/core/types.ts";
import type { RenderSettings } from "@/core/options.ts";
import { filledCells } from "@/renderers/geometry.ts";

const cssColor = ({ r, g, b }: IdenticonColor): string => `rgb(${r},${g},${b})`;

/** Renders validated data and options without DOM APIs or external resources. */
export const renderSvg = (
  data: IdenticonData,
  settings: RenderSettings,
): string => {
  const { size, background, foreground } = settings;
  const backdrop = background === null
    ? ""
    : `<rect width="${size}" height="${size}" fill="${cssColor(background)}"/>`;
  const cells = filledCells(data.matrix, settings).map((cell) =>
    `<rect x="${cell.x}" y="${cell.y}" width="${cell.width}" height="${cell.height}"/>`
  ).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges">${backdrop}<g fill="${
    cssColor(foreground)
  }">${cells}</g></svg>`;
};
