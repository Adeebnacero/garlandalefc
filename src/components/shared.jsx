import React, { useState, useEffect } from "react";
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

/**
 * Client-side pagination for an already-filtered array. `resetKey` should be
 * anything that changes when the caller's filters change (e.g. a template
 * string of the active filter values) so the page snaps back to 1 instead of
 * landing on an empty page after the filtered set shrinks.
 */
export function usePagination(items, { pageSize = 15, resetKey } = {}) {
  const [page, setPage] = useState(1);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setPage(1); }, [resetKey]);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [totalPages, page]);

  const start = (page - 1) * pageSize;
  const pageItems = items.slice(start, start + pageSize);

  return { page, setPage, totalPages, pageItems, pageSize };
}

export function Pagination({ page, setPage, totalPages, totalItems, pageSize }) {
  if (totalPages <= 1) return null;
  const start = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(totalItems, page * pageSize);
  return (
    <div className="gfc-pagination">
      <span className="gfc-pagination-range">
        {totalItems ? `${start}–${end} of ${totalItems}` : ""}
      </span>
      <div className="gfc-pagination-controls">
        <button className="gfc-btn gfc-btn-outline gfc-btn-sm" disabled={page <= 1} onClick={() => setPage(1)}>«</button>
        <button className="gfc-btn gfc-btn-outline gfc-btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>‹ Prev</button>
        <span className="gfc-pagination-label">Page {page} of {totalPages}</span>
        <button className="gfc-btn gfc-btn-outline gfc-btn-sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next ›</button>
        <button className="gfc-btn gfc-btn-outline gfc-btn-sm" disabled={page >= totalPages} onClick={() => setPage(totalPages)}>»</button>
      </div>
    </div>
  );
}
