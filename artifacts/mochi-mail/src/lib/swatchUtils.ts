
export function getSwatchShadow(isSelected: boolean, color: string): string {
  if (isSelected) return `0 0 0 2px white, 0 0 0 3.5px ${color}`;
  if (color === "#ffffff") return "inset 0 0 0 1px rgba(0,0,0,0.12)";
  return "0 1px 4px rgba(0,0,0,0.1)";
}
