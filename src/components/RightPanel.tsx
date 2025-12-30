import React from "react";

type AnyReport = any;

function riskText(report: AnyReport) {
  if (!report) return "—";
  if (typeof report.risk === "string") return report.risk;
  return report?.risk?.level || report?.risk?.label || "—";
}

function fmtNum(v: any, digits = 2) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(digits);
}

export default function RightPanel({
  report,
  title = "Details",
}: {
  report: AnyReport | null;
  title?: string;
}) {
  const angles = report?.angles ?? null;
  const issues = report?.issues ?? null;
  const lever = report?.lever ?? null;

  return (
    <div className="panel">
      <div className="panelTitle">{title}</div>

      <div className="panelRow">
        <div className="label">ErgoScore</div>
        <div className="value">{report?.score ?? "—"}</div>
      </div>

      <div className="panelRow">
        <div className="label">Risk</div>
        <div className="value">{riskText(report)}</div>
      </div>

      {/* Action */}
      <div className="panelSection">
        <div className="panelSubTitle">Action</div>
        <div className="panelRow">
          <div className="label">Detected</div>
          <div className="value">
            {report?.action
              ? `${report.action.label ?? "—"} (${Math.round(
                  (report.action.confidence ?? 0) * 100
                )}%)`
              : "—"}
          </div>
        </div>
      </div>

      {/* Estimated Force */}
      <div className="panelSection">
        <div className="panelSubTitle">Estimated force</div>
        <div className="panelRow">
          <div className="label">Level</div>
          <div className="value">{lever?.force?.level ?? "—"}</div>
        </div>
        <div className="panelRow">
          <div className="label">Value</div>
          <div className="value">
            {Number.isFinite(Number(lever?.force?.value)) ? `${lever.force.value}/100` : "—"}
          </div>
        </div>
      </div>

      {/* Angles */}
      <div className="panelSection">
        <div className="panelSubTitle">Angles</div>
        {angles ? (
          Object.entries(angles).map(([k, v]) => (
            <div className="panelRow" key={k}>
              <div className="label">{k}</div>
              <div className="value">
                {Number.isFinite(Number(v)) ? `${Number(v).toFixed(0)}°` : "—"}
              </div>
            </div>
          ))
        ) : (
          <div className="muted">No angles yet</div>
        )}
      </div>

      {/* Issues */}
      <div className="panelSection">
        <div className="panelSubTitle">Issues</div>
        {issues?.length ? (
          issues.map((it: any) => (
            <div className="issueCard" key={it.id ?? it.title}>
              <div className="issueTitle">{it.title ?? "Issue"}</div>
              {it.measured ? <div className="issueMeta">{it.measured}</div> : null}
              {it.whyItMatters ? <div className="issueMeta">{it.whyItMatters}</div> : null}
              {it.fix ? <div className="issueFix">Fix: {it.fix}</div> : null}
            </div>
          ))
        ) : (
          <div className="muted">No issues detected</div>
        )}
      </div>

      {/* Biomechanical load */}
      <div className="panelSection">
        <div className="panelSubTitle">Biomechanical load</div>
        {lever ? (
          <>
            <div className="panelRow">
              <div className="label">Shoulder moment</div>
              <div className="value">{fmtNum(lever.shoulderMomentIndex, 2)}</div>
            </div>
            <div className="panelRow">
              <div className="label">Low-back moment</div>
              <div className="value">{fmtNum(lever.lowBackMomentIndex, 2)}</div>
            </div>
            <div className="panelRow">
              <div className="label">Internal strain</div>
              <div className="value">{fmtNum(lever.strainIndex, 2)}</div>
            </div>
            <div className="panelRow">
              <div className="label">Strain level</div>
              <div className="value">{lever.strainLevel ?? "—"}</div>
            </div>
          </>
        ) : (
          <div className="muted">No lever metrics yet</div>
        )}
      </div>
    </div>
  );
}
