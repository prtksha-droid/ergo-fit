import { useEffect, useMemo, useRef, useState } from "react";
import { initPoseLandmarker, setRunningMode, detectOnImage } from "../lib/poseEngine";
import { buildReport, type PostureReport } from "../lib/poseMath";
import { drawPoseOverlay } from "../lib/draw";
import { downloadCanvasPng, downloadJson } from "../lib/exporters";

export default function PhotoAnalyze() {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [ready, setReady] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [report, setReport] = useState<PostureReport | null>(null);
  const [imgUrl, setImgUrl] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
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
    if (!imgRef.current || !canvasRef.current || !imgUrl) return;

    const img = imgRef.current;
    const c = canvasRef.current;

    img.onload = () => {
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;

      // Only run AI if it loaded; otherwise just show the image
      if (!ready) return;

      setRunningMode("IMAGE");
      const res = detectOnImage(img);
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
  }, [imgUrl, ready]);

  const badgeClass = useMemo(() => {
    if (!report) return "badge";
    return report.risk === "Low"
      ? "badge badgeGood"
      : report.risk === "Medium"
      ? "badge badgeWarn"
      : "badge badgeBad";
  }, [report]);

  return (
    <div className="grid">
      <div className="card">
        <div className="cardHeader">
          <div className="cardTitle">Photo analysis</div>

          {/* ✅ Upload ALWAYS active */}
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              className="btn btnPrimary"
              type="button"
              onClick={() => fileRef.current?.click()}
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

                // reset previous overlay/report
                setReport(null);

                // clear canvas
                if (canvasRef.current) {
                  const ctx = canvasRef.current.getContext("2d");
                  if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
                }

                setImgUrl(URL.createObjectURL(f));

                // allow selecting same file again
                e.currentTarget.value = "";
              }}
            />
          </div>
        </div>

        <div className="cardBody">
          <div className="stageWrap" style={{ aspectRatio: "16/10" }}>
            {imgUrl ? <img ref={imgRef} className="stageVideo" src={imgUrl} alt="uploaded" /> : null}
            <canvas ref={canvasRef} className="stageCanvas" />
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
            <button
              className="btn"
              type="button"
              disabled={!canvasRef.current}
              onClick={() => canvasRef.current && downloadCanvasPng(canvasRef.current)}
            >
              Export annotated PNG
            </button>

            <button
              className="btn"
              type="button"
              disabled={!report}
              onClick={() => report && downloadJson(report)}
            >
              Export JSON report
            </button>
          </div>

          {/* Status text */}
          <div className="hint">
            {ready ? "AI ready (offline)." : "AI not ready yet — you can still upload photos."}
            {err ? `  Error: ${err}` : ""}
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

          <div style={{ height: 12 }} />

          {!ready ? (
            <div className="small">
              AI isn’t loaded, so analysis won’t run yet. Upload still works. Fix the model/WASM error above and refresh.
            </div>
          ) : !report?.issues?.length ? (
            <div className="small">Upload a photo to get issues, risks, and fixes.</div>
          ) : (
            <div className="list">
              {report.issues.map((i) => (
                <div className="item" key={i.id}>
                  <div className="itemTop">
                    <div className="itemTitle">{i.title}</div>
                    <span className={i.severity === "HIGH" ? "badge badgeBad" : i.severity === "MILD" ? "badge badgeWarn" : "badge badgeGood"}>
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
