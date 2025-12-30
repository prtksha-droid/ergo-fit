import type { PoseLandmarkerResult } from "@mediapipe/tasks-vision";
import { buildLeverReport } from "./leverAnalysis";


type Pt = { x: number; y: number; z?: number; visibility?: number };

export type IssueSeverity = "OK" | "MILD" | "HIGH";

export type PostureIssue = {
  id: string;
  title: string;
  severity: IssueSeverity;
  measured: string;
  whyItMatters: string;
  fix: string;
};

export type StrainLevel = "Low" | "Medium" | "High";

export type LeverMetrics = {
  shoulderMomentIndex: number;
  lowBackMomentIndex: number;
  strainIndex: number;
  strainLevel: StrainLevel;
  // Optional extras added by other pages (live/photo/video)
  force?: { level: StrainLevel; value: number };
  points?: any;
  action?: any;
};

export type PostureReport = {
  score: number;              // 0–100
  risk: StrainLevel;
  angles: Record<string, number>;
  issues: PostureIssue[];
  lever?: LeverMetrics;
};

function toStrainLevel(x: any): StrainLevel {
  return x === "Low" || x === "Medium" || x === "High" ? x : "Medium";
}


// MediaPipe Pose landmark indices
const KP = {
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
  LEFT_EAR: 7,
  RIGHT_EAR: 8,
};

function mid(a: Pt, b: Pt): Pt {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function getKp(result: PoseLandmarkerResult, idx: number): Pt | null {
  const lm = result.landmarks?.[0];
  if (!lm || !lm[idx]) return null;
  return { x: lm[idx].x, y: lm[idx].y, z: lm[idx].z, visibility: lm[idx].visibility };
}

function dist(a: Pt, b: Pt) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

function angleDeg(a: Pt, b: Pt, c: Pt) {
  // angle at b between BA and BC
  const abx = a.x - b.x;
  const aby = a.y - b.y;
  const cbx = c.x - b.x;
  const cby = c.y - b.y;
  const dot = abx * cbx + aby * cby;
  const mag = Math.hypot(abx, aby) * Math.hypot(cbx, cby);
  if (!mag) return 0;
  const v = Math.max(-1, Math.min(1, dot / mag));
  return (Math.acos(v) * 180) / Math.PI;
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

export function buildReport(result: PoseLandmarkerResult | null): PostureReport | null {
  if (!result?.landmarks?.[0]?.length) return null;

  const ls = getKp(result, KP.LEFT_SHOULDER);
  const rs = getKp(result, KP.RIGHT_SHOULDER);
  const le = getKp(result, KP.LEFT_ELBOW);
  const re = getKp(result, KP.RIGHT_ELBOW);
  const lw = getKp(result, KP.LEFT_WRIST);
  const rw = getKp(result, KP.RIGHT_WRIST);
  const lh = getKp(result, KP.LEFT_HIP);
  const rh = getKp(result, KP.RIGHT_HIP);
  const lk = getKp(result, KP.LEFT_KNEE);
  const rk = getKp(result, KP.RIGHT_KNEE);
  const la = getKp(result, KP.LEFT_ANKLE);
  const ra = getKp(result, KP.RIGHT_ANKLE);
  const lear = getKp(result, KP.LEFT_EAR);
  const rear = getKp(result, KP.RIGHT_EAR);

  if (!ls || !rs || !lh || !rh) return null;

  const shoulderMid = mid(ls, rs);
  const hipMid = mid(lh, rh);

  const angles: Record<string, number> = {};

  // Elbow angles
  if (ls && le && lw) angles.leftElbow = angleDeg(ls, le, lw);
  if (rs && re && rw) angles.rightElbow = angleDeg(rs, re, rw);

  // Knee angles
  if (lh && lk && la) angles.leftKnee = angleDeg(lh, lk, la);
  if (rh && rk && ra) angles.rightKnee = angleDeg(rh, rk, ra);

  // Trunk/neck heuristics
  // Approx "neck tilt" based on ears vs shoulder mid
  if (lear && rear) {
    const earMid = mid(lear, rear);
    const dy = shoulderMid.y - earMid.y;
    const dx = earMid.x - shoulderMid.x;
    const neckTilt = Math.atan2(dx, dy) * (180 / Math.PI);
    angles.neckTilt = Math.abs(neckTilt);
  }

  // Shoulder elevation asymmetry
  angles.shoulderSlope = Math.abs(ls.y - rs.y) * 100;

  // Forward reach estimate (hands forward relative to shoulder)
  if (lw && rw) {
    const wristMid = mid(lw, rw);
    angles.reach = Math.abs(wristMid.x - shoulderMid.x) * 100;
  }

  const issues: PostureIssue[] = [];

  if (angles.neckTilt !== undefined && angles.neckTilt > 18) {
    issues.push({
      id: "neck-tilt",
      title: "Neck bent / forward head posture",
      severity: angles.neckTilt > 28 ? "HIGH" : "MILD",
      measured: `Neck tilt ~ ${Math.round(angles.neckTilt)}°`,
      whyItMatters: "Increases load on cervical spine and can cause neck/shoulder pain.",
      fix: "Bring screen to eye level, tuck chin slightly, keep ears over shoulders."
    });
  }

  if (angles.shoulderSlope !== undefined && angles.shoulderSlope > 4.5) {
    issues.push({
      id: "shoulder-slope",
      title: "Uneven shoulders",
      severity: angles.shoulderSlope > 8 ? "HIGH" : "MILD",
      measured: `Height difference ~ ${angles.shoulderSlope.toFixed(1)}%`,
      whyItMatters: "Asymmetry may increase strain on neck and upper back.",
      fix: "Relax shoulders, adjust chair/armrests, center your posture."
    });
  }

  if (angles.reach !== undefined && angles.reach > 18) {
    issues.push({
      id: "reach",
      title: "Hands reaching away from body",
      severity: angles.reach > 30 ? "HIGH" : "MILD",
      measured: `Reach offset ~ ${angles.reach.toFixed(0)}%`,
      whyItMatters: "Longer reach increases lever arm and shoulder/low-back load.",
      fix: "Bring work closer, keep elbows near body, reduce forward reach."
    });
  }

  // Knee extension warnings
  if (angles.leftKnee !== undefined && angles.leftKnee < 155) {
    issues.push({
      id: "left-knee",
      title: "Left knee bent (sustained)",
      severity: angles.leftKnee < 130 ? "HIGH" : "MILD",
      measured: `Left knee angle ~ ${Math.round(angles.leftKnee)}°`,
      whyItMatters: "Sustained knee bend can increase fatigue and discomfort.",
      fix: "Adjust seat height/foot placement so knees are closer to neutral."
    });
  }
  if (angles.rightKnee !== undefined && angles.rightKnee < 155) {
    issues.push({
      id: "right-knee",
      title: "Right knee bent (sustained)",
      severity: angles.rightKnee < 130 ? "HIGH" : "MILD",
      measured: `Right knee angle ~ ${Math.round(angles.rightKnee)}°`,
      whyItMatters: "Sustained knee bend can increase fatigue and discomfort.",
      fix: "Adjust seat height/foot placement so knees are closer to neutral."
    });
  }

  // Score heuristic
  let score = 100;
  for (const i of issues) score -= i.severity === "HIGH" ? 18 : 9;
  score = clamp(score, 0, 100);

  const risk = score >= 80 ? "Low" : score >= 55 ? "Medium" : "High";
  const lever = buildLeverReport(result, angles);


  return { score, risk, angles, issues, lever: lever ? {
  shoulderMomentIndex: lever.shoulderMomentIndex,
  lowBackMomentIndex: lever.lowBackMomentIndex,
  strainIndex: lever.strainIndex,
  strainLevel: toStrainLevel(lever.strainLevel)
} : undefined };

  
}
