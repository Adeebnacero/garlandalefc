import React from "react";
import { T } from "../theme.js";
import { STATUS_LABEL } from "../lib/billing.js";

export function Badge({ status, reason }) {
  const cls = status === "green" ? "gfc-badge-green" : status === "amber" ? "gfc-badge-amber" : status === "red" ? "gfc-badge-red" : "gfc-badge-neutral";
  return (
    <span className={`gfc-badge ${cls}`} title={reason || undefined} style={reason ? { cursor: "help" } : undefined}>
      <span className="gfc-dot" />
      {STATUS_LABEL[status] || "—"}
    </span>
  );
}

export function InactiveToggle({ includeInactive, setIncludeInactive }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, fontWeight: 600, color: T.inkSoft, cursor: "pointer", whiteSpace: "nowrap" }}>
      <input type="checkbox" checked={includeInactive} onChange={(e) => setIncludeInactive(e.target.checked)} />
      Show inactive players
    </label>
  );
}
