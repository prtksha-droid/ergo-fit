import { useEffect, useRef, useState } from "react";
import { initPoseLandmarker, setRunningMode, detectOnVideo } from "../lib/poseEngine";
import { buildReport } from "../lib/poseMath";
import { buildLeverReport } from "../lib/leverAnalysis";
import { estimateForceLevel } from "../lib/forceEstimator";
import { drawPoseOverlay } from "../lib/draw";
import { detectActionVideo, resetActionState } from "../lib/actionDetector";

export default function LiveCamera() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [ready, setReady] = useState(false);
  const [running, setRunning] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [report, setReport] = useState<any>(null);

  // Init AI
  useEffect(() => {
    (async () => {
      try {
        await initPoseLandmarker();
        setRunningMode("VIDEO");
        setReady(true);
        setErr(null);
      } catch (e: any) {
        setErr(e?.message ?? String(e));
        setReady(false);
      }
    })();
  }, []);

  const start = async () => {
    try {
      setErr(null);
      resetActionState(); // IMPORTANT: fresh action state each time

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });

      streamRef.current = stream;

      const v = videoRef.current;
      if (!v) return;

      v.srcObject = stream;
      await v.play();
      setRunning(true);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
      setRunning(false);
    }
  };

  const stop = () => {
    setRunning(false);

    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    const s = streamRef.current;
    s?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    const v = videoRef.current;
    if (v) v.srcObject = null;

    const c = canvasRef.current;
    if (c) {
      const ctx = c.getContext("2d");
      ctx?.clearRect(0, 0, c.width, c.height);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Main loop
  useEffect(() => {
    if (!running) return;

    const loop = () => {
      const v = videoRef.current;
      const c = canvasRef.current;

      if (!v || !c) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      // Wait for video metadata
      if (v.videoWidth === 0 || v.videoHeight === 0) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      // Match canvas to video
      if (c.width !== v.videoWidth) c.width = v.videoWidth;
      if (c.height !== v.videoHeight) c.height = v.videoHeight;

      // Draw camera frame
      const ctx = c.getContext("2d");
      if (ctx) ctx.drawImage(v, 0, 0, c.width, c.height);

      // Inference
      const t = performance.now();
      const res = detectOnVideo(v, t);

      // Build reports
      const rep = buildReport(res);
      const lever = buildLeverReport(res, rep?.angles);

      // ✅ Correct export name
      const action = detectActionVideo(res);

      // Force
      const force = estimateForceLevel(
        lever?.points?.wristMid ?? null,
        lever?.lowBackMomentIndex ?? 0
      );

      const leverWithExtras = lever ? { ...lever, force } : undefined;

      // Update UI data
      setReport({
        ...rep,
        action,
        lever: leverWithExtras,
      });

      // Overlay
      drawPoseOverlay(
        c,
        res,
        rep?.angles ?? null,
        rep?.issues ?? null,
        rep?.score,
        rep?.risk,
        leverWithExtras
      );

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [running]);

  return (
    <div className="card">
      <div className="cardHeader">
        <div className="cardTitle">Live Camera</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button disabled={!ready || running} onClick={start}>
            Start
          </button>
          <button disabled={!running} onClick={stop}>
            Stop
          </button>
        </div>
      </div>

      <div className="cardBody">
        <video ref={videoRef} playsInline muted style={{ display: "none" }} />

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.6fr 1fr",
            gap: 16,
          }}
        >
          {/* LEFT — LIVE CANVAS */}
          <div style={{ position: "relative" }}>
            <canvas ref={canvasRef} style={{ width: "100%", background: "#000" }} />
          </div>

          {/* RIGHT — DETAILS */}
          <div
            style={{
              background: "#0f172a",
              color: "#fff",
              padding: 12,
              borderRadius: 8,
              fontSize: 13,
            }}
          >
            <h3 style={{ marginBottom: 8 }}>Posture Details</h3>

            <div>
              <strong>ErgoScore:</strong> {report?.score ?? "-"}
            </div>
            <div>
              <strong>Risk:</strong>{" "}
              {typeof report?.risk === "string" ? report.risk : report?.risk?.level ?? "-"}
            </div>

            <hr style={{ margin: "8px 0", opacity: 0.3 }} />

            <strong>Action</strong>
            <div style={{ marginTop: 4 }}>
              {report?.action
                ? `${report.action.label} (${Math.round((report.action.confidence ?? 0) * 100)}%)`
                : "—"}
            </div>

            <hr style={{ margin: "8px 0", opacity: 0.3 }} />

            <strong>Estimated Force</strong>
            <div style={{ marginTop: 4 }}>
              {report?.lever?.force
                ? `${report.lever.force.level} (${report.lever.force.value}/100)`
                : "—"}
            </div>

            <hr style={{ margin: "8px 0", opacity: 0.3 }} />

            <strong>Angles</strong>
            {report?.angles ? (
              Object.entries(report.angles).map(([k, v]) => (
                <div key={k}>
                  {k}: {Number(v).toFixed(0)}°
                </div>
              ))
            ) : (
              <div style={{ opacity: 0.6 }}>No angles yet</div>
            )}

            <hr style={{ margin: "8px 0", opacity: 0.3 }} />

            <strong>Issues</strong>
            {report?.issues?.length ? (
              report.issues.map((it: any) => (
                <div key={it.id} style={{ marginTop: 6 }}>
                  ⚠ {it.title}
                </div>
              ))
            ) : (
              <div style={{ opacity: 0.6 }}>No issues detected</div>
            )}
          </div>
        </div>

        <div className="hint" style={{ marginTop: 8 }}>
          {ready ? "AI ready" : "Loading AI"} {err ? `— ${err}` : ""}
        </div>
      </div>
    </div>
  );
}
