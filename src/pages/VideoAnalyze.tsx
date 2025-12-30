import { useEffect, useRef, useState } from "react";
import { initPoseLandmarker, setRunningMode, detectOnVideo } from "../lib/poseEngine";
import { buildReport, type PostureReport } from "../lib/poseMath";
import { drawPoseOverlay } from "../lib/draw";
import { downloadJson } from "../lib/exporters";
import { buildLeverReport } from "../lib/leverAnalysis";
import { detectActionVideo, resetActionState } from "../lib/actionDetector";
import { estimateForceLevel } from "../lib/forceEstimator";
import RightPanel from "../components/RightPanel";

type Sample = { t: number; score: number; risk: "Low" | "Medium" | "High" };

export default function VideoAnalyze() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [ready, setReady] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<PostureReport | any | null>(null);
  const [samples, setSamples] = useState<Sample[]>([]);

  useEffect(() => {
    (async () => {
      try {
        resetActionState();
        await initPoseLandmarker();
        setReady(true);
        setErr(null);
      } catch (e: any) {
        console.error(e);
        setReady(false);
        setErr(e?.message ?? String(e));
      }
    })();
  }, []);

  useEffect(() => {
    let raf = 0;
    let lastSampleMs = 0;

    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      if (!running) return;

      const v = videoRef.current;
      const c = canvasRef.current;
      if (!v || !c) return;
      if (v.videoWidth === 0 || v.videoHeight === 0) return;

      // sample ~5 fps
      if (t - lastSampleMs < 200) return;
      lastSampleMs = t;

      if (c.width !== v.videoWidth) c.width = v.videoWidth;
      if (c.height !== v.videoHeight) c.height = v.videoHeight;

      setRunningMode("VIDEO");
      const res = detectOnVideo(v, performance.now());
      const rep = buildReport(res);

      const leverBase = buildLeverReport(res, rep?.angles);
      const action = detectActionVideo(res);

      const force = estimateForceLevel(
        leverBase?.points?.wristMid ?? null,
        leverBase?.lowBackMomentIndex ?? 0
      );

      const lever = leverBase ? { ...leverBase, force, action } : undefined;

      const next = {
        ...rep,
        action,
        lever,
      };

      setReport(next);

      drawPoseOverlay(
        c,
        res,
        rep?.angles ?? null,
        rep?.issues ?? null,
        rep?.score,
        rep?.risk,
        lever
      );

      // timeline
      const timeSec = v.currentTime ?? 0;
      setSamples((prev) => {
        const risk = (rep?.risk ?? "Low") as any;
        const score = Number(rep?.score ?? 0);
        const nextSample: Sample = { t: timeSec, score, risk };
        return prev.length > 500 ? [...prev.slice(-499), nextSample] : [...prev, nextSample];
      });
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [running]);

  async function onLoadedData() {
    setSamples([]);
    setReport(null);
    resetActionState();

    // Prime play/pause so dimensions are ready
    const v = videoRef.current;
    if (!v) return;
    try {
      await v.play();
      v.pause();
    } catch {
      // ignore autoplay restrictions; user will click Start
    }
  }

  function start() {
    if (!videoRef.current) return;
    setRunning(true);
    videoRef.current.play();
  }

  function stop() {
    setRunning(false);
    videoRef.current?.pause();
  }

  const exportTimeline = () => {
    if (!report) return;
    const payload = {
      latest: report,
      samples,
      generatedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ergofit-video-report-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="grid">
      <div className="card">
        <div className="cardHeader">
          <div className="cardTitle">Video analysis</div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <button className="btn btnPrimary" type="button" onClick={() => fileRef.current?.click()}>
              Upload video
            </button>

            <input
              ref={fileRef}
              type="file"
              accept="video/*"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;

                stop();
                setReport(null);
                setSamples([]);

                const url = URL.createObjectURL(f);
                setVideoUrl(url);

                e.currentTarget.value = "";
              }}
            />

            <button className="btn" disabled={!videoUrl || !ready || running} onClick={start} type="button">
              Start
            </button>
            <button className="btn" disabled={!running} onClick={stop} type="button">
              Stop
            </button>

            <button className="btn" disabled={!report} onClick={() => report && downloadJson(report)} type="button">
              Export latest frame JSON
            </button>
            <button className="btn" disabled={!samples.length} onClick={exportTimeline} type="button">
              Export timeline JSON
            </button>
          </div>
        </div>

        <div className="cardBody">
          {/* Match LiveCamera layout: LEFT stage + RIGHT panel */}
          <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 14 }}>
            {/* LEFT */}
            <div>
              <div className="stageWrap" style={{ aspectRatio: "16/10" }}>
                {videoUrl ? (
                  <video
                    ref={videoRef}
                    className="stageVideo"
                    src={videoUrl}
                    controls
                    playsInline
                    onLoadedData={onLoadedData}
                  />
                ) : null}
                <canvas ref={canvasRef} className="stageCanvas" />
              </div>

              <div className="hint" style={{ marginTop: 10 }}>
                {ready ? "AI ready (offline)." : "AI not ready yet."}
                {err ? `  Error: ${err}` : ""}
              </div>

              {samples.length ? (
                <div className="hint" style={{ marginTop: 8 }}>
                  Timeline samples: {samples.length} (latest time: {samples[samples.length - 1].t.toFixed(1)}s)
                </div>
              ) : null}
            </div>

            {/* RIGHT */}
            <RightPanel report={report} title="Details" />
          </div>
        </div>
      </div>
    </div>
  );
}
