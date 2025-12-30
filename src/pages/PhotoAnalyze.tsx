import { useEffect, useMemo, useRef, useState } from "react";
import { initPoseLandmarker, setRunningMode, detectOnImage } from "../lib/poseEngine";
import { buildReport, type PostureReport } from "../lib/poseMath";
import { drawPoseOverlay } from "../lib/draw";
import { downloadCanvasPng, downloadJson } from "../lib/exporters";
import { buildLeverReport } from "../lib/leverAnalysis";
import { detectActionImage } from "../lib/actionDetector";
import { estimateForceLevel } from "../lib/forceEstimator";
import RightPanel from "../components/RightPanel";

export default function PhotoAnalyze() {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [ready, setReady] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [report, setReport] = useState<PostureReport | any | null>(null);
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
      c.width = img.naturalWidth || 1280;
      c.height = img.naturalHeight || 720;

      // If AI not ready, just show the image (no overlay)
      if (!ready) return;

      setRunningMode("IMAGE");
      const res = detectOnImage(img);
      const rep = buildReport(res);

      const leverBase = buildLeverReport(res, rep?.angles);
      const action = detectActionImage(res);

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

                setReport(null);

                if (canvasRef.current) {
                  const ctx = canvasRef.current.getContext("2d");
                  if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
                }

                setImgUrl(URL.createObjectURL(f));
                e.currentTarget.value = "";
              }}
            />
          </div>
        </div>

        <div className="cardBody">
          {/* Match LiveCamera layout: LEFT stage + RIGHT panel */}
          <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 14 }}>
            {/* LEFT */}
            <div>
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

                <span className={badgeClass}>{report?.risk ?? "—"}</span>
              </div>

              <div className="hint" style={{ marginTop: 10 }}>
                {ready ? "AI ready (offline)." : "AI not ready yet — you can still upload photos."}
                {err ? `  Error: ${err}` : ""}
              </div>
            </div>

            {/* RIGHT */}
            <RightPanel report={report} title="Details" />
          </div>
        </div>
      </div>
    </div>
  );
}
