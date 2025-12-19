import type { PoseLandmarkerResult } from "@mediapipe/tasks-vision";
import type { PostureIssue } from "./poseMath";

type Line = [number, number];

const LINES: Line[] = [
  [11,13],[13,15], [12,14],[14,16],
  [11,12], [11,23], [12,24], [23,24],
  [23,25],[25,27], [24,26],[26,28]
];

const colorForSeverity = (s?: string) =>
  s === "HIGH" ? "#fb7185" : s === "MILD" ? "#fbbf24" : "#4ade80";

export function drawPoseOverlay(
  canvas: HTMLCanvasElement,
  result: PoseLandmarkerResult | null,
  angles: Record<string, number> | null,
  issues: PostureIssue[] | null,
  score?: number,
  risk?: string
) {
  const ctx = canvas.getContext("2d");
  if (!ctx || !result?.landmarks?.[0]) return;

  const lm = result.landmarks[0];
  const w = canvas.width;
  const h = canvas.height;

  ctx.clearRect(0, 0, w, h);

  // === Skeleton ===
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#60a5fa";

  for (const [a, b] of LINES) {
    ctx.beginPath();
    ctx.moveTo(lm[a].x * w, lm[a].y * h);
    ctx.lineTo(lm[b].x * w, lm[b].y * h);
    ctx.stroke();
  }

  for (const p of lm) {
    ctx.beginPath();
    ctx.arc(p.x * w, p.y * h, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
  }

  // === Angle labels near joints ===
  ctx.font = "14px ui-sans-serif";
  ctx.fillStyle = "#ffffff";

  if (angles?.neckFlexionDeg && lm[11] && lm[12]) {
    const x = ((lm[11].x + lm[12].x) / 2) * w;
    const y = ((lm[11].y + lm[12].y) / 2) * h - 12;
    ctx.fillText(`Neck ${angles.neckFlexionDeg.toFixed(0)}°`, x, y);
  }

  if (angles?.trunkLeanDeg && lm[23] && lm[24]) {
    const x = ((lm[23].x + lm[24].x) / 2) * w;
    const y = ((lm[23].y + lm[24].y) / 2) * h - 12;
    ctx.fillText(`Trunk ${angles.trunkLeanDeg.toFixed(0)}°`, x, y);
  }

  // === Top summary ===
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(10, 10, 240, 80);

  ctx.fillStyle = "#ffffff";
  ctx.font = "16px ui-sans-serif";
  ctx.fillText(`ErgoScore: ${score ?? "-"}`, 20, 36);
  ctx.fillText(`Risk: ${risk ?? "-"}`, 20, 60);

  // === Issue callouts (right side) ===
  if (issues?.length) {
    let y = 100;
    for (const issue of issues) {
      ctx.fillStyle = colorForSeverity(issue.severity);
      ctx.fillRect(w - 300, y, 280, 50);

      ctx.fillStyle = "#000";
      ctx.font = "13px ui-sans-serif";
      ctx.fillText(issue.title, w - 290, y + 20);
      ctx.fillText(issue.measured, w - 290, y + 38);

      y += 60;
    }
  }
}
