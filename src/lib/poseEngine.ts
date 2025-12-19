import {
  FilesetResolver,
  PoseLandmarker,
  type PoseLandmarkerResult,
} from "@mediapipe/tasks-vision";

export type PoseMode = "IMAGE" | "VIDEO";

let landmarker: PoseLandmarker | null = null;

export async function initPoseLandmarker() {
  if (landmarker) return landmarker;

  const vision = await FilesetResolver.forVisionTasks("/wasm");

  // ✅ Fetch model explicitly so we can validate it
  const resp = await fetch("/models/pose_landmarker_lite.task");
  if (!resp.ok) throw new Error(`Model fetch failed: ${resp.status} ${resp.statusText}`);
  const buf = await resp.arrayBuffer();
const bytes = new Uint8Array(buf);
  if (buf.byteLength < 500_000) throw new Error(`Model file too small (${buf.byteLength} bytes). Wrong file/404 saved?`);

  landmarker = await PoseLandmarker.createFromOptions(vision, {
    baseOptions: {
  modelAssetBuffer: bytes,
  delegate: "GPU",
},
    runningMode: "VIDEO",
    numPoses: 1,
  });

  return landmarker;
}


export function setRunningMode(mode: PoseMode) {
  if (!landmarker) return;
  landmarker.setOptions({ runningMode: mode === "IMAGE" ? "IMAGE" : "VIDEO" });
}

export function detectOnImage(img: CanvasImageSource): PoseLandmarkerResult | null {
  if (!landmarker) return null;
  return landmarker.detect(img);
}

export function detectOnVideo(video: HTMLVideoElement, timestampMs: number): PoseLandmarkerResult | null {
  if (!landmarker) return null;
  return landmarker.detectForVideo(video, timestampMs);
}
