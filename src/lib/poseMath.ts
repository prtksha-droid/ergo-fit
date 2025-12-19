import type { PoseLandmarkerResult } from "@mediapipe/tasks-vision";

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

export type PostureReport = {
  score: number;              // 0–100
  risk: "Low" | "Medium" | "High";
  angles: Record<string, number>;
  issues: PostureIssue[];
};

const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));

function angleABC(a: Pt, b: Pt, c: Pt) {
  // angle at b formed by a-b-c, in degrees
  const abx = a.x - b.x, aby = a.y - b.y;
  const cbx = c.x - b.x, cby = c.y - b.y;
  const dot = abx * cbx + aby * cby;
  const ab = Math.hypot(abx, aby);
  const cb = Math.hypot(cbx, cby);
  const cos = clamp(dot / (ab * cb + 1e-9), -1, 1);
  return (Math.acos(cos) * 180) / Math.PI;
}

function mid(a: Pt, b: Pt): Pt {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function getKp(result: PoseLandmarkerResult, idx: number): Pt | null {
  const lm = result.landmarks?.[0];
  if (!lm || !lm[idx]) return null;
  return { x: lm[idx].x, y: lm[idx].y, z: lm[idx].z, visibility: lm[idx].visibility };
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
  const leAR = getKp(result, KP.LEFT_EAR);
  const reAR = getKp(result, KP.RIGHT_EAR);

  if (!ls || !rs || !lh || !rh) return null;

  const shoulderMid = mid(ls, rs);
  const hipMid = mid(lh, rh);

  const angles: Record<string, number> = {};

  // Trunk lean: angle between vertical and hip->shoulder vector (approx)
  {
    const v = { x: shoulderMid.x - hipMid.x, y: shoulderMid.y - hipMid.y };
    const vertical = { x: 0, y: -1 };
    const dot = v.x * vertical.x + v.y * vertical.y;
    const mag = Math.hypot(v.x, v.y);
    const cos = clamp(dot / (mag + 1e-9), -1, 1);
    angles.trunkLeanDeg = (Math.acos(cos) * 180) / Math.PI; // 0 upright
  }

  // Neck / forward head: ear vs shoulder horizontal offset -> pseudo angle
  if (leAR && reAR) {
    const earMid = mid(leAR, reAR);
    const dx = earMid.x - shoulderMid.x;
    angles.neckFlexionDeg = clamp(Math.abs(dx) * 120, 0, 60); // heuristic
  } else {
    angles.neckFlexionDeg = 0;
  }

  // Shoulder elevation asymmetry (vertical diff)
  angles.shoulderTiltDeg = clamp(Math.abs(ls.y - rs.y) * 180, 0, 30);

  // Elbow angles
  if (le && lw) angles.leftElbowDeg = angleABC(ls, le, lw);
  if (re && rw) angles.rightElbowDeg = angleABC(rs, re, rw);

  // Knee angles (best effort)
  if (lk && la) angles.leftKneeDeg = angleABC(lh, lk, la);
  if (rk && ra) angles.rightKneeDeg = angleABC(rh, rk, ra);

  const issues: PostureIssue[] = [];


  const neck = angles.neckFlexionDeg ?? 0;
  if (neck >= 35) {
    issues.push({
      id: "neck-forward-high",
      title: "Forward head posture (neck flexion)",
      severity: "HIGH",
      measured: `Neck flexion ~ ${neck.toFixed(0)}°`,
      whyItMatters: "Can increase neck load, causing neck strain, stiffness, and headaches over time.",
      fix: "Raise the screen to eye level, bring head back (gentle chin tuck), and sit tall with upper-back support."
    });
  } else if (neck >= 20) {
    issues.push({
      id: "neck-forward-mild",
      title: "Forward head posture (mild)",
      severity: "MILD",
      measured: `Neck flexion ~ ${neck.toFixed(0)}°`,
      whyItMatters: "May contribute to neck/upper-back fatigue during long sessions.",
      fix: "Align ears over shoulders, bring screen closer, and take micro-breaks every 30–45 minutes."
    });
  }

  const trunk = angles.trunkLeanDeg ?? 0;
  if (trunk >= 20) {
    issues.push({
      id: "trunk-lean-high",
      title: "Leaning forward (trunk)",
      severity: "HIGH",
      measured: `Trunk lean ~ ${trunk.toFixed(0)}°`,
      whyItMatters: "Can overload lower back and increase shoulder/neck tension.",
      fix: "Sit back fully, use lumbar support, and bring keyboard/mouse closer so elbows stay near your body."
    });
  } else if (trunk >= 10) {
    issues.push({
      id: "trunk-lean-mild",
      title: "Leaning forward (mild)",
      severity: "MILD",
      measured: `Trunk lean ~ ${trunk.toFixed(0)}°`,
      whyItMatters: "May cause fatigue and slouching during long work blocks.",
      fix: "Reset posture: shoulders relaxed, ribs stacked over hips, feet flat, screen slightly higher."
    });
  }

  const tilt = angles.shoulderTiltDeg ?? 0;
  if (tilt >= 12) {
    issues.push({
      id: "shoulder-tilt",
      title: "Uneven shoulders",
      severity: tilt >= 18 ? "HIGH" : "MILD",
      measured: `Shoulder tilt ~ ${tilt.toFixed(0)}°`,
      whyItMatters: "May indicate one-sided load (mouse/phone), contributing to neck and upper-trap pain.",
      fix: "Center your body to screen, keep mouse close, avoid cradling phone, and relax shoulders down."
    });
  }

  const lel = angles.leftElbowDeg ?? 100;
  const rel = angles.rightElbowDeg ?? 100;
  const elbowBad = (d: number) => d < 75 || d > 135;
  if (elbowBad(lel) || elbowBad(rel)) {
    issues.push({
      id: "elbow-angle",
      title: "Elbow angle not neutral",
      severity: "MILD",
      measured: `Elbows L ${lel.toFixed(0)}° / R ${rel.toFixed(0)}°`,
      whyItMatters: "May increase forearm and shoulder tension and contribute to wrist discomfort.",
      fix: "Adjust chair/desk height so elbows are near ~90–110°, forearms supported, and shoulders relaxed."
    });
  }

  let score = 100;
  for (const i of issues) score -= i.severity === "HIGH" ? 18 : 9;
  score = clamp(score, 0, 100);

  const risk = score >= 80 ? "Low" : score >= 55 ? "Medium" : "High";

  return { score, risk, angles, issues };
}
