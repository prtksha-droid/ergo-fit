import { useEffect, useRef, useState } from "react";
import { initPoseLandmarker, setRunningMode, detectOnVideo } from "../lib/poseEngine";
import { buildReport, type PostureReport } from "../lib/poseMath";
import { drawPoseOverlay } from "../lib/draw";
import { downloadJson } from "../lib/exporters";

type Sample = { t: number; score: number; risk: "Low"|"Medium"|"High" };

export default function VideoAnalyze() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [ready, setReady] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<PostureReport | null>(null);
  const [samples, setSamples] = useState<Sample[]>([]);
  const fileRef = useRef<HTMLInputElement | null>(null);


  useEffect(() => {
    (async () => {
      await initPoseLandmarker();
      setReady(true);
    })();
  }, []);

  useEffect(() => {
    let raf = 0;
    let last = 0;

    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      if (!running) return;
      if (!videoRef.current || !canvasRef.current) return;

      // sample ~5 fps
      if (t - last < 200) return;
      last = t;

      const v = videoRef.current;
      const c = canvasRef.current;

      const vw = v.videoWidth || 1280;
      const vh = v.videoHeight || 720;
      if (c.width !== vw || c.height !== vh) { c.width = vw; c.height = vh; }

      setRunningMode("VIDEO");
      const res = detectOnVideo(v, performance.now());
      const rep = buildReport(res);
      if (rep) {
        setReport(rep);
        setSamples(prev => [...prev, { t: v.currentTime, score: rep.score, risk: rep.risk }].slice(-240));
      }
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

  async function onLoadVideo() {
    const v = videoRef.current;
    if (!v) return;
    await v.play();
    v.pause();
    setSamples([]);
    setReport(null);
  }

  function start() { setRunning(true); videoRef.current?.play(); }
  function stop() { setRunning(false); videoRef.current?.pause(); }

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
          <div style={{display:"flex", gap:8, flexWrap:"wrap"}}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
  <button
    className="btn btnPrimary"
    disabled={!false}
    onClick={() => fileRef.current?.click()}
    type="button"
  >
    Upload photo
  </button>

  <input
    ref={fileRef}
    type="file"
    accept="image/*"
    style={{ display: "none" }}
    onChange={(e) => {
      const f = e.target.files?.[0];
      if (!f) return;
      setReport(null);
      // allow re-uploading same file again
      e.currentTarget.value = "";
    }}
  />
</div>

            <button className="btn" disabled={!videoUrl || running} onClick={start}>Start</button>
            <button className="btn" disabled={!running} onClick={stop}>Stop</button>
          </div>
        </div>

        <div className="cardBody">
          <div className="stageWrap">
            {videoUrl ? (
              <video
                ref={videoRef}
                className="stageVideo"
                src={videoUrl}
                controls
                playsInline
                onLoadedData={onLoadVideo}
              />
            ) : null}
            <canvas ref={canvasRef} className="stageCanvas" />
          </div>

          <div className="hint">
            This samples frames (~5 fps) and builds a timeline of risk. Works offline after first load.
          </div>

          <div style={{display:"flex", gap:10, marginTop:12, flexWrap:"wrap"}}>
            <button className="btn" disabled={!report} onClick={() => report && downloadJson(report)}>
              Export latest frame JSON
            </button>
            <button className="btn" disabled={!samples.length} onClick={exportTimeline}>
              Export timeline JSON
            </button>
          </div>

          {samples.length ? (
            <div className="hint">
              Timeline samples: {samples.length} (latest time: {samples[samples.length-1].t.toFixed(1)}s)
            </div>
          ) : null}
        </div>
      </div>

      <div className="card">
        <div className="cardHeader">
          <div className="cardTitle">Current score & issues</div>
          <span className={
            report?.risk === "Low" ? "badge badgeGood" :
            report?.risk === "Medium" ? "badge badgeWarn" :
            report?.risk === "High" ? "badge badgeBad" : "badge"
          }>
            {report?.risk ?? "—"}
          </span>
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
            <div className="small">Upload and press Start to see detected issues + fixes.</div>
          ) : (
            <div className="list">
              {report.issues.map(i => (
                <div className="item" key={i.id}>
                  <div className="itemTop">
                    <div className="itemTitle">{i.title}</div>
                    <span className={i.severity==="HIGH" ? "badge badgeBad" : i.severity==="MILD" ? "badge badgeWarn" : "badge badgeGood"}>
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
