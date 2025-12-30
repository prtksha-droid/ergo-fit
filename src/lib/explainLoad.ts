export function explainLoad(action?: string, lever?: any) {
  if (!action || !lever) return "Insufficient data";

  if (action === "Clapping") {
    return "Rapid hand movement without external resistance; minimal joint load.";
  }

  if (action === "Bending") {
    return "Forward trunk flexion increases the lever arm acting on the lower back.";
  }

  if (action === "Overhead reach") {
    return "Arms above shoulder height increase shoulder joint moment.";
  }

  if (action === "Reaching") {
    return "Extended arms create longer leverage, increasing joint strain.";
  }

  if (action === "Holding / Static") {
    return "Posture remains mostly neutral with minimal leverage.";
  }

  return "Load determined by posture and joint leverage.";
}
