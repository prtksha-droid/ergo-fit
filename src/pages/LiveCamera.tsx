import { useEffect, useRef, useState } from "react";
import { initPoseLandmarker, setRunningMode, detectOnVideo } from "../lib/poseEngine";
import { buildReport, type PostureReport } from "../lib/poseMath";
import { drawPoseOverlay } from "../lib/draw";
import { downloadCanvasPng, downloadJson } from "../lib/exporters";

export default function LiveCamera() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [ready, setReady] = useState(false);
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<PostureReport | null>(null);

  useEffect(() => {
    (async () => {
      await initPoseLandmarker();
      setReady(true);
    })();
  }, []);

  useEffect(() => {
    let raf = 0;
    let lastTs = 0;

    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      if (!running) return;
      if (!videoRef.current || !canvasRef.current) return;

      // limit ~15 fps analysis
      if (t - lastTs < 66) return;
      lastTs = t;

      const v = videoRef.current;
      const c = canvasRef.current;

      // match canvas to video resolution
      const vw = v.videoWidth || 1280;
      const vh = v.videoHeight || 720;
      if (c.width !== vw || c.height !== vh) {
        c.width = vw; c.height = vh;
      }

      setRunningMode("VIDEO");
      const res = detectOnVideo(v, performance.now());
      const rep = buildReport(res);
      setReport(rep);

      drawPoseOverlay(
  c,
  res,
  rep?.angles ?? null,
  rep?.issues ?? null,
  rep?.score,
  rep?.risk
);

    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [running]);

  async function startCamera() {
    if (!videoRef.current) return;
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" },
      audio: false
    });
    videoRef.current.srcObject = stream;
    await videoRef.current.play();
    setRunning(true);
  }

  function stopCamera() {
    setRunning(false);
    const v = videoRef.current;
    if (v?.srcObject) {
      const tracks = (v.srcObject as MediaStream).getTracks();
      tracks.forEach(t => t.stop());
      v.srcObject = null;
    }
  }

  const badgeClass =
    report?.risk === "Low" ? "badge badgeGood" :
    report?.risk === "Medium" ? "badge badgeWarn" :
    report?.risk === "High" ? "badge badgeBad" : "badge";

  return (
    <div className="grid">
      <div className="card">
        <div className="cardHeader">
          <div className="cardTitle">Live camera analysis</div>
          <div style={{display:"flex", gap:8}}>
            <button className="btn btnPrimary" disabled={!ready || running} onClick={startCamera}>
              {ready ? "Start" : "Loading AI…"}
            </button>
            <button className="btn" disabled={!running} onClick={stopCamera}>Stop</button>
          </div>
        </div>

        <div className="cardBody">
          <div className="stageWrap">
            <video ref={videoRef} className="stageVideo" playsInline muted />
            <canvas ref={canvasRef} className="stageCanvas" />
          </div>

          <div className="hint">
            Works offline after first load (PWA caches model + WASM). For best results: keep full upper-body in frame and good lighting.
          </div>

          <div style={{display:"flex", gap:10, marginTop:12, flexWrap:"wrap"}}>
            <button
              className="btn"
              disabled={!canvasRef.current}
              onClick={() => canvasRef.current && downloadCanvasPng(canvasRef.current)}
            >
              Export annotated PNG
            </button>
            <button
              className="btn"
              disabled={!report}
              onClick={() => report && downloadJson(report)}
            >
              Export JSON report
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="cardHeader">
          <div className="cardTitle">Score & issues</div>
          <span className={badgeClass}>{report?.risk ?? "—"}</span>
        </div>

        <div className="cardBody">
          <div className="kpiRow">
            <div className="kpi">
              <div className="kpiLabel">ErgoScore</div>
              <div className="kpiValue">{report ? report.score : "—"}</div>
            </div>
            <div className="kpi">
              <div className="kpiLabel">Neck</div>
              <div className="kpiValue">{report ? `${report.angles.neckFlexionDeg?.toFixed(0) ?? "—"}°` : "—"}</div>
            </div>
            <div className="kpi">
              <div className="kpiLabel">Trunk</div>
              <div className="kpiValue">{report ? `${report.angles.trunkLeanDeg?.toFixed(0) ?? "—"}°` : "—"}</div>
            </div>
          </div>

          <div style={{height:12}} />

          {!report?.issues?.length ? (
            <div className="small">No major issues detected right now. Keep shoulders relaxed, screen at eye level, elbows ~90–110°.</div>
          ) : (
            <div className="list">
              {report.issues.map(i => (
                <div className="item" key={i.id}>
                  <div className="itemTop">
                    <div className="itemTitle">{i.title}</div>
                    <span className={
                      i.severity === "HIGH" ? "badge badgeBad" :
                      i.severity === "MILD" ? "badge badgeWarn" :
                      "badge badgeGood"
                    }>
                      {i.severity}
                    </span>
                  </div>
                  <div className="itemText"><b>Measured:</b> {i.measured}</div>
                  <div className="itemText"><b>Risk:</b> {i.whyItMatters}</div>
                  <div className="itemText"><b>Fix:</b> {i.fix}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
