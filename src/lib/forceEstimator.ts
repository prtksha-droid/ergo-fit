type Point = { x: number; y: number };

let prevPoint: Point | null = null;
let prevTime = 0;

export function estimateForceLevel(
  curr: Point | null,
  leverScore: number
): { level: "Low" | "Medium" | "High"; value: number } {
  const now = performance.now();

  if (!curr) {
    prevPoint = null;
    prevTime = now;
    return { level: "Low", value: 0 };
  }

  // First frame
  if (!prevPoint || prevTime === 0) {
    prevPoint = curr;
    prevTime = now;
    return { level: "Low", value: Math.round(leverScore * 10) };
  }

  const dt = Math.max((now - prevTime) / 1000, 0.016);

  const dx = curr.x - prevPoint.x;
  const dy = curr.y - prevPoint.y;

  // Normalized movement speed (0–1 typical)
  const rawSpeed = Math.sqrt(dx * dx + dy * dy) / dt;
  const speedNorm = Math.min(rawSpeed * 0.6, 1);

  // Normalize lever (expected ~0–2)
  const leverNorm = Math.min(leverScore / 2, 1);

  // Final force score (0–100)
  const value = Math.round(
    leverNorm * 50 + speedNorm * 50
  );

  let level: "Low" | "Medium" | "High" = "Low";
  if (value >= 70) level = "High";
  else if (value >= 35) level = "Medium";

  prevPoint = curr;
  prevTime = now;

  return { level, value };
}
