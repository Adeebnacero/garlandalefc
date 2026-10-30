import React, { useState, useEffect, useCallback } from "react";
import { T } from "../theme.js";
import { planInAppSend, hasSnapshotValues, summariseSend, friendlyMessageError } from "../lib/playerMessages.js";
import { loadReach, sendInApp, loadSentHistory, withdrawSend } from "../lib/playerMessagesApi.js";

// ---------------------------------------------------------------------------
// Messages -> Player Messages: "Send in app". Private messages to the
// selected players, read by their guardians in the Player Portal (side
// panel -> Messages). Admin, Chairman and Treasurer only - the database
// enforces that too (migrations/2026-10-player-messages.sql).
// ---------------------------------------------------------------------------

function fmtWhen(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("en-ZA", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

/**
 * Which of the selected players have a Player Portal login. Re-checks a
 * moment after the selection stops changing, so ticking boxes quickly
 * doesn't fire a request per tick.
 */
export function useInAppReach(selectedIds) {
  const [state, setState] = useState({ reach: new Set(), loading: false, error: "" });
  const key = [...selectedIds].sort().join(",");
  useEffect(() => {
    if (!key) { setState({ reach: new Set(), loading: false, error: "" }); return undefined; }
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: "" }));
    const t = setTimeout(async () => {
      try {
        const reach = await loadReach(key.split(","));
        if (!cancelled) setState({ reach, loading: false, error: "" });
      } catch (err) {
        if (!cancelled) setState({ reach: new Set(), loading: false, error: friendlyMessageError(err) });
      }
    }, 400);
    return () => { cancelled = true; clearTimeout(t); };
  }, [key]);
  return state;
}

/** The small tag on each send row. */
export function InAppTag({ has, loading }) {
  if (loading) return null;
  return has
    ? <span className="gfc-agepill" style={{ background: T.greenSoft, color: T.green }} title="Has a Player Portal login - Send in app reaches them">In app</span>
    : <span className="gfc-agepill" style={{ background: "transparent", color: T.inkSoft, border: `1px solid ${T.line}` }} title="No Player Portal login yet - use WhatsApp, SMS or Email">No app</span>;
}

export function SendInAppModal({ players, rawText, templateId, reach, onClose, onSent }) {
  const plan = planInAppSend(players, rawText, reach);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const example = plan.reachable[0];
  const exampleBody = example ? plan.messages[0].body : "";

  async function handleSend() {
    setBusy(true);
    setError("");
    try {
      await sendInApp(templateId, rawText, plan.messages);
      onSent(plan.reachable.length, plan.missing.length);
    } catch (err) {
      setError(friendlyMessageError(err));
      setBusy(false);
    }
  }

  return (
    <div className="gfc-modal-backdrop" onClick={busy ? undefined : onClose}>
      <div className="gfc-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <div className="gfc-modal-head">
          <div className="gfc-modal-title gfc-display">Send in app</div>
          <button className="gfc-modal-close" onClick={onClose} disabled={busy}>×</button>
        </div>
        <div>
          <p style={{ fontSize: 13.5, margin: "0 0 12px" }}>
            <strong>{plan.reachable.length} of {players.length}</strong> selected player{players.length === 1 ? "" : "s"} will get this in the Player Portal, under <em>Messages</em> in the side panel. Only their own guardians can see it.
          </p>

          {plan.missing.length > 0 && (
            <div style={{ background: T.amberSoft, border: `1px solid ${T.gold}`, borderRadius: 8, padding: "8px 12px", fontSize: 12.5, color: "#7a5410", marginBottom: 12 }}>
              <strong>{plan.missing.length} {plan.missing.length === 1 ? "doesn’t" : "don’t"} have the app yet</strong> and won’t get it: {plan.missing.map((p) => p.name).join(", ")}. Use WhatsApp, SMS or Email for {plan.missing.length === 1 ? "them" : "those"}; they stay selected after you send.
            </div>
          )}

          {example && (
            <div className="gfc-field">
              <label className="gfc-label">What {example.name.split(" ")[0]}’s guardians will see</label>
              <div className="gfc-msg-preview" style={{ whiteSpace: "pre-wrap" }}>{exampleBody}</div>
            </div>
          )}

          {hasSnapshotValues(rawText) && (
            <div style={{ fontSize: 11.5, color: T.inkSoft, marginBottom: 8 }}>
              Balances are filled in now and won’t change if a payment comes in later.
            </div>
          )}

          {(plan.error || error) && (
            <div style={{ background: T.dangerSoft, color: T.danger, borderRadius: 8, padding: "8px 12px", fontSize: 12.5, fontWeight: 600, marginTop: 8 }}>
              {error || plan.error}
            </div>
          )}
        </div>
        <div className="gfc-modal-actions">
          <button className="gfc-btn gfc-btn-outline" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="gfc-btn gfc-btn-primary" onClick={handleSend} disabled={busy || !!plan.error}>
            {busy ? "Sending…" : `Send to ${plan.reachable.length}`}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Sent in app, last 90 days: who has read each send, and withdraw. */
export function SentInAppHistory({ nameById, refreshKey }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    try {
      setError("");
      setRows(await loadSentHistory());
    } catch (err) {
      setError(friendlyMessageError(err));
      setRows([]);
    }
  }, []);
  useEffect(() => { load(); }, [load, refreshKey]);

  async function handleWithdraw(s) {
    const ok = window.confirm(
      `Withdraw this ${s.label.toLowerCase()} sent ${fmtWhen(s.sentAt)}? It disappears from all ${s.total} player${s.total === 1 ? "’s" : "s’"} Messages straight away.`
    );
    if (!ok) return;
    setBusyId(s.id);
    try {
      await withdrawSend(s.id);
      await load();
    } catch (err) {
      setError(friendlyMessageError(err));
    } finally {
      setBusyId(null);
    }
  }

  const sends = (rows || []).map((b) => summariseSend(b, nameById));

  return (
    <div className="gfc-panel" style={{ marginTop: 16 }}>
      <div className="gfc-panel-head">
        <div className="gfc-panel-title">Sent in app</div>
        <div style={{ fontSize: 11.5, color: T.inkSoft }}>Last 90 days</div>
      </div>
      {error && (
        <div style={{ background: T.dangerSoft, color: T.danger, padding: "8px 16px", fontSize: 12.5, fontWeight: 600 }}>{error}</div>
      )}
      {rows === null ? (
        <div className="gfc-empty">Loading…</div>
      ) : sends.length === 0 ? (
        <div className="gfc-empty">Nothing sent in app yet. Messages you send with <strong>Send in app</strong> appear here, with who has read them.</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="gfc-table">
            <thead>
              <tr><th>Sent</th><th>Message</th><th>By</th><th>Read</th><th></th></tr>
            </thead>
            <tbody>
              {sends.map((s) => (
                <React.Fragment key={s.id}>
                  <tr>
                    <td style={{ whiteSpace: "nowrap", fontSize: 12 }}>{fmtWhen(s.sentAt)}</td>
                    <td style={{ maxWidth: 320 }}>
                      <div style={{ fontWeight: 600, fontSize: 12.5 }}>{s.label}</div>
                      <div style={{ fontSize: 11.5, color: T.inkSoft, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={s.text}>{s.text}</div>
                    </td>
                    <td style={{ fontSize: 11.5, color: T.inkSoft }}>{s.sentBy || "—"}</td>
                    <td style={{ whiteSpace: "nowrap", fontSize: 12.5 }}>
                      <strong>{s.readCount}</strong> of {s.total}
                    </td>
                    <td style={{ whiteSpace: "nowrap", textAlign: "right" }}>
                      <button className="gfc-btn gfc-btn-ghost gfc-btn-sm" onClick={() => setOpenId(openId === s.id ? null : s.id)} aria-expanded={openId === s.id}>
                        {openId === s.id ? "Hide" : "Who"}
                      </button>
                      <button className="gfc-btn gfc-btn-ghost gfc-btn-sm" style={{ color: T.danger }} onClick={() => handleWithdraw(s)} disabled={busyId === s.id}>
                        {busyId === s.id ? "Withdrawing…" : "Withdraw"}
                      </button>
                    </td>
                  </tr>
                  {openId === s.id && (
                    <tr>
                      <td colSpan={5} style={{ background: T.paper, fontSize: 12 }}>
                        {s.recipients.map((r) => (
                          <div key={r.playerId} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "3px 0" }}>
                            <span>{r.name}</span>
                            <span style={{ color: r.readAt ? T.green : T.inkSoft }}>{r.readAt ? `Read ${fmtWhen(r.readAt)}` : "Not read yet"}</span>
                          </div>
                        ))}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
