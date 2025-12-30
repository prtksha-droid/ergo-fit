import type { PoseLandmarkerResult } from "@mediapipe/tasks-vision";

export function drawPoseOverlay(
  canvas: HTMLCanvasElement,
  result: PoseLandmarkerResult | null,
  angles: Record<string, number> | null,
  issues: any[] | null,
  score?: number,
  risk?: any,
  lever?: any
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;

  // Skeleton dots
  if (result?.landmarks?.[0]) {
    ctx.fillStyle = "#fff";
    for (const p of result.landmarks[0]) {
      ctx.beginPath();
      ctx.arc(p.x * w, p.y * h, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Header
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(10, 10, 260, 60);
  ctx.fillStyle = "#fff";
  ctx.font = "12px system-ui";
  ctx.fillText(`ErgoScore: ${score ?? "-"}`, 18, 30);

  const riskText =
    typeof risk === "string" ? risk : risk?.level ?? risk?.label ?? "-";
  ctx.fillText(`Risk: ${riskText}`, 18, 48);
   if (lever?.action) {
  ctx.fillText(
    `Action: ${lever.action.label} (${Math.round((lever.action.confidence ?? 0) * 100)}%)`,
    18,
    66
  );
}

  // Lever + force
  if (lever?.points) {
    const { shoulderMid, hipMid, wristMid } = lever.points;

    ctx.strokeStyle = "#facc15";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(shoulderMid.x * w, shoulderMid.y * h);
    ctx.lineTo(wristMid.x * w, wristMid.y * h);
    ctx.stroke();

    ctx.strokeStyle = "#fb7185";
    ctx.beginPath();
    ctx.moveTo(hipMid.x * w, hipMid.y * h);
    ctx.lineTo(shoulderMid.x * w, shoulderMid.y * h);
    ctx.stroke();
  }

  if (lever?.force) {
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(10, h - 50, 300, 30);
    ctx.fillStyle = "#fff";
    ctx.fillText(
      `Estimated force: ${lever.force.level} (${lever.force.value}/100)`,
      18,
      h - 30
    );
  }
}
