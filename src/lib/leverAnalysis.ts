import type { PoseLandmarkerResult } from "@mediapipe/tasks-vision";

export function buildLeverReport(
  res: PoseLandmarkerResult | null,
  angles?: Record<string, number> | null
) {
  const lm = res?.landmarks?.[0];
  if (!lm) return null;

  const L_SHOULDER = lm[11];
  const R_SHOULDER = lm[12];
  const L_HIP = lm[23];
  const R_HIP = lm[24];
  const L_WRIST = lm[15];
  const R_WRIST = lm[16];

  const shoulderMid = {
    x: (L_SHOULDER.x + R_SHOULDER.x) / 2,
    y: (L_SHOULDER.y + R_SHOULDER.y) / 2,
  };

  const hipMid = {
    x: (L_HIP.x + R_HIP.x) / 2,
    y: (L_HIP.y + R_HIP.y) / 2,
  };

  const wristMid = {
    x: (L_WRIST.x + R_WRIST.x) / 2,
    y: (L_WRIST.y + R_WRIST.y) / 2,
  };

  const shoulderReach = Math.hypot(
    wristMid.x - shoulderMid.x,
    wristMid.y - shoulderMid.y
  );

  const trunkLean = Math.hypot(
    shoulderMid.x - hipMid.x,
    shoulderMid.y - hipMid.y
  );

  return {
    shoulderMomentIndex: shoulderReach * 10,
    lowBackMomentIndex: trunkLean * 12,
    strainIndex: Math.min(100, (shoulderReach + trunkLean) * 60),
    strainLevel:
      shoulderReach + trunkLean > 1 ? "High" : shoulderReach > 0.4 ? "Medium" : "Low",
    points: {
      shoulderMid,
      hipMid,
      wristMid,
    },
  };
}
