export function strokeOpts(size: number, isEraser: boolean, last?: boolean) {
  return {
    size: isEraser ? size * 2.5 : size,
    thinning: isEraser ? 0 : 0.5,
    smoothing: 0.5,
    streamline: 0.4,
    simulatePressure: false as const,
    ...(last !== undefined && { last }),
  };
}

export function strokeToPath2D(stroke: number[][]): Path2D {
  const path = new Path2D();
  if (stroke.length < 2) return path;
  path.moveTo(stroke[0][0], stroke[0][1]);
  for (let i = 0; i < stroke.length; i++) {
    const [x0, y0] = stroke[i];
    const [x1, y1] = stroke[(i + 1) % stroke.length];
    path.quadraticCurveTo(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
  }
  path.closePath();
  return path;
}
