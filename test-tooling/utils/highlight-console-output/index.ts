import { HighlightColor } from "./types.ts";

export function highlightText(
  text: string,
  color: HighlightColor = HighlightColor.CYAN
): string {
  const colors: Record<string, string> = {
    [HighlightColor.RED]: "\x1b[31m",
    [HighlightColor.GREEN]: "\x1b[32m",
    [HighlightColor.YELLOW]: "\x1b[33m",
    [HighlightColor.BLUE]: "\x1b[34m",
    [HighlightColor.MAGENTA]: "\x1b[35m",
    [HighlightColor.CYAN]: "\x1b[36m",
    [HighlightColor.WHITE]: "\x1b[37m",
  };

  const reset = "\x1b[0m";
  return `${colors[color]}${text}${reset}`;
}
