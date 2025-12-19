import { useMemo, useState } from "react";
import LiveCamera from "./pages/LiveCamera";
import PhotoAnalyze from "./pages/PhotoAnalyze";
import VideoAnalyze from "./pages/VideoAnalyze";

type Tab = "LIVE" | "PHOTO" | "VIDEO";

export default function App() {
  const [tab, setTab] = useState<Tab>("LIVE");

  const subtitle = useMemo(() => {
    if (tab === "LIVE") return "Real-time posture feedback (offline)";
    if (tab === "PHOTO") return "Upload a photo for posture issues + angles";
    return "Upload a video for timeline + summary (offline)";
  }, [tab]);

  return (
    <div className="container">
      <div className="header">
        <div className="brand">
          <div className="logo" />
          <div>
            <div className="title">ErgoFit</div>
            <div className="sub">{subtitle}</div>
          </div>
        </div>

        <div className="tabs">
          <button className={`tab ${tab==="LIVE" ? "tabActive":""}`} onClick={() => setTab("LIVE")}>Live</button>
          <button className={`tab ${tab==="PHOTO" ? "tabActive":""}`} onClick={() => setTab("PHOTO")}>Photo</button>
          <button className={`tab ${tab==="VIDEO" ? "tabActive":""}`} onClick={() => setTab("VIDEO")}>Video</button>
        </div>
      </div>

      {tab === "LIVE" && <LiveCamera />}
      {tab === "PHOTO" && <PhotoAnalyze />}
      {tab === "VIDEO" && <VideoAnalyze />}
    </div>
  );
}
