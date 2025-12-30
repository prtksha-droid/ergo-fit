import type { PoseLandmarkerResult } from "@mediapipe/tasks-vision";

export type ActionLabel =
  | "No person"
  | "Holding / Static"
  | "Reaching"
  | "Overhead reach"
  | "Bending"
  | "Twisting"
  | "Lifting motion"
  | "Clapping";

export type ActionResult = {
  label: ActionLabel;
  confidence: number; // 0..1
  notes?: string;
};

type Pt = { x: number; y: number };

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

function mid(a: Pt, b: Pt): Pt {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function dist(a: Pt, b: Pt) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/** --------- STATE (video/live only) ---------- */
let prevTime = 0;
let prevHipY: number | null = null;

let prevHandsDistNorm = 1;
let lastClapMs = 0;
let clapEvents: number[] = [];

let stableLabel: ActionLabel = "Holding / Static";
let stableScore = 0;
let lastStableMs = 0;

export function resetActionState() {
  const now = performance.now();
  prevTime = now;
  prevHipY = null;
  prevHandsDistNorm = 1;
  lastClapMs = 0;
  clapEvents = [];
  stableLabel = "Holding / Static";
  stableScore = 0;
  lastStableMs = now;
}

/** --------- STATIC IMAGE ACTION (no clap/lift dynamics) ---------- */
export function detectActionImage(res: PoseLandmarkerResult | null): ActionResult {
  const lm = res?.landmarks?.[0];
  if (!lm) return { label: "No person", confidence: 0 };

  const Ls = lm[11], Rs = lm[12];
  const Lh = lm[23], Rh = lm[24];
  const Lw = lm[15], Rw = lm[16];

  if (!Ls || !Rs || !Lh || !Rh || !Lw || !Rw) {
    return { label: "Holding / Static", confidence: 0.35, notes: "Landmarks incomplete" };
  }

  const shoulderWidth = Math.max(Math.abs(Rs.x - Ls.x), 1e-4);

  const shoulderMid = mid(Ls, Rs);
  const hipMid = mid(Lh, Rh);
  const wristMid = mid(Lw, Rw);

  const reachNorm = dist(wristMid, shoulderMid) / shoulderWidth;
  const trunkLeanNorm = dist(shoulderMid, hipMid) / shoulderWidth;
  const overhead = wristMid.y < shoulderMid.y - 0.05;

  const hipWidth = Math.max(Math.abs(Rh.x - Lh.x), 1e-4);
  const twistNorm = Math.abs(shoulderWidth - hipWidth) / shoulderWidth;

  const scoreOverhead = overhead ? clamp01((reachNorm - 1.3) / 1.2) : 0;
  const scoreBend = clamp01((trunkLeanNorm - 2.2) / 1.0);
  const scoreTwist = clamp01((twistNorm - 0.12) / 0.20);
  const scoreReach = clamp01((reachNorm - 1.6) / 1.2);
  const scoreStatic = clamp01(0.7 * (1 - scoreReach) + 0.3);

  const candidates = [
    { label: "Overhead reach" as const, score: scoreOverhead, notes: "Hands above shoulders + reach" },
    { label: "Bending" as const, score: scoreBend, notes: "Trunk lean high" },
    { label: "Twisting" as const, score: scoreTwist, notes: "Shoulder/hip mismatch" },
    { label: "Reaching" as const, score: scoreReach, notes: "Arms extended" },
    { label: "Holding / Static" as const, score: scoreStatic, notes: "Static posture" },
  ].sort((a, b) => b.score - a.score);

  const best = candidates[0];
  return {
    label: best.score < 0.35 ? "Holding / Static" : best.label,
    confidence: best.score < 0.35 ? 0.6 : best.score,
    notes: best.notes,
  };
}

/** --------- VIDEO/LIVE ACTION (includes clapping + lift motion) ---------- */
export function detectActionVideo(res: PoseLandmarkerResult | null): ActionResult {
  const lm = res?.landmarks?.[0];
  const now = performance.now();

  if (!lm) {
    resetActionState();
    return { label: "No person", confidence: 0 };
  }

  const Ls = lm[11], Rs = lm[12];
  const Lh = lm[23], Rh = lm[24];
  const Lw = lm[15], Rw = lm[16];

  if (!Ls || !Rs || !Lh || !Rh || !Lw || !Rw) {
    return stabilize({ label: "Holding / Static", confidence: 0.35, notes: "Landmarks incomplete" }, now);
  }

  const shoulderWidth = Math.max(Math.abs(Rs.x - Ls.x), 1e-4);

  const shoulderMid = mid(Ls, Rs);
  const hipMid = mid(Lh, Rh);
  const wristMid = mid(Lw, Rw);

  const reachNorm = dist(wristMid, shoulderMid) / shoulderWidth;
  const handsDistNorm = dist(Lw, Rw) / shoulderWidth;
  const trunkLeanNorm = dist(shoulderMid, hipMid) / shoulderWidth;
  const overhead = wristMid.y < shoulderMid.y - 0.05;

  const hipWidth = Math.max(Math.abs(Rh.x - Lh.x), 1e-4);
  const twistNorm = Math.abs(shoulderWidth - hipWidth) / shoulderWidth;

  // dynamics
  const dt = Math.max((now - prevTime) / 1000, 0.016);
  const hipVel = prevHipY === null ? 0 : (prevHipY - hipMid.y) / dt;
  prevHipY = hipMid.y;
  prevTime = now;

  // clap (event-based)
  const dHands = (prevHandsDistNorm - handsDistNorm) / dt;
  prevHandsDistNorm = handsDistNorm;

  const CONTACT_T = 0.65;
  const APPROACH_V = 1.8;

  const contact = handsDistNorm < CONTACT_T;
  const fastApproach = dHands > APPROACH_V;

  if (contact && fastApproach && now - lastClapMs > 180) {
    lastClapMs = now;
    clapEvents.push(now);
  }
  clapEvents = clapEvents.filter((t) => now - t < 1200);

  const scoreClap = clapEvents.length >= 2 ? clamp01(0.65 + (clapEvents.length - 2) * 0.15) : 0;

  // scores
  const scoreOverhead = overhead ? clamp01((reachNorm - 1.3) / 1.2) : 0;
  const scoreBend = clamp01((trunkLeanNorm - 2.2) / 1.0);
  const scoreTwist = clamp01((twistNorm - 0.12) / 0.20);
  const scoreReach = clamp01((reachNorm - 1.6) / 1.2);
  const scoreLift = clamp01((hipVel - 0.25) / 0.6) * clamp01((trunkLeanNorm - 1.7) / 1.2);

  const scoreStatic = clamp01(0.55 * (1 - scoreReach) + 0.45 * clamp01(1 - Math.abs(hipVel) / 0.35));

  const candidates = [
    { label: "Clapping" as const, score: scoreClap, notes: "Hands approach + contact pattern" },
    { label: "Overhead reach" as const, score: scoreOverhead, notes: "Hands above shoulders + reach" },
    { label: "Bending" as const, score: scoreBend, notes: "Trunk lean high" },
    { label: "Twisting" as const, score: scoreTwist, notes: "Shoulder/hip mismatch" },
    { label: "Lifting motion" as const, score: scoreLift, notes: "Rising movement while bent" },
    { label: "Reaching" as const, score: scoreReach, notes: "Arms extended" },
    { label: "Holding / Static" as const, score: scoreStatic, notes: "Low movement" },
  ].sort((a, b) => b.score - a.score);

  const best = candidates[0];
  const out: ActionResult = {
    label: best.score < 0.35 ? "Holding / Static" : best.label,
    confidence: best.score < 0.35 ? 0.6 : best.score,
    notes: best.notes,
  };

  return stabilize(out, now);
}

function stabilize(next: ActionResult, now: number): ActionResult {
  const HOLD_MS = 300;
  const SWITCH_MARGIN = 0.12;

  if (now - lastStableMs < HOLD_MS) {
    if (next.label === stableLabel) {
      stableScore = 0.7 * stableScore + 0.3 * next.confidence;
      return { ...next, confidence: Math.max(next.confidence, stableScore) };
    }
    if (next.confidence > stableScore + SWITCH_MARGIN) {
      stableLabel = next.label;
      stableScore = next.confidence;
      lastStableMs = now;
      return next;
    }
    return { label: stableLabel, confidence: stableScore, notes: "Stabilized" };
  }

  stableLabel = next.label;
  stableScore = next.confidence;
  lastStableMs = now;
  return next;
}
