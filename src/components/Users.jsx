import React, { useState } from "react";
import { T } from "../theme.js";
import { fmtDate } from "../lib/format.js";

export const ROLE_LABEL = { admin: "Admin", treasurer: "Treasurer", coach: "Coach" };

export function UsersView({ staffList, onInvite, onRemove, busy, message }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("coach");

  function handleInvite(e) {
    e.preventDefault();
    if (!email.trim()) return;
    onInvite(email.trim(), role);
    setEmail("");
  }

  return (
    <div>
      <div className="gfc-topbar">
        <div>
          <div className="gfc-page-title gfc-display">Users</div>
          <div className="gfc-page-sub">Invite staff and control who can access what</div>
        </div>
      </div>

      <div className="gfc-panel" style={{ padding: 20, marginBottom: 18 }}>
        <div className="gfc-panel-title" style={{ marginBottom: 12 }}>Invite someone new</div>
        <form onSubmit={handleInvite} className="gfc-row2" style={{ gridTemplateColumns: "2fr 1fr auto", alignItems: "end", gap: 10 }}>
          <div className="gfc-field" style={{ marginBottom: 0 }}>
            <label className="gfc-label">Email address</label>
            <input type="email" className="gfc-input" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="gfc-field" style={{ marginBottom: 0 }}>
            <label className="gfc-label">Role</label>
            <select className="gfc-select" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="admin">Admin (full access)</option>
              <option value="treasurer">Treasurer (financial only)</option>
              <option value="coach">Coach (squad/matchday/kit only)</option>
            </select>
          </div>
          <button type="submit" className="gfc-btn gfc-btn-primary" disabled={busy}>{busy ? "Sending…" : "Send invite"}</button>
        </form>
        {message && (
          <div style={{ marginTop: 12, fontSize: 12.5, color: message.toLowerCase().startsWith("failed") ? T.danger : T.green, fontWeight: 600 }}>
            {message}
          </div>
        )}
      </div>

      <div className="gfc-panel">
        <div className="gfc-panel-head"><div className="gfc-panel-title">Current staff ({staffList.length})</div></div>
        {staffList.length === 0 ? (
          <div className="gfc-empty">No staff invited yet.</div>
        ) : (
          <table className="gfc-table">
            <thead><tr><th>Email</th><th>Role</th><th>Invited</th><th></th></tr></thead>
            <tbody>
              {staffList.map((s) => (
                <tr key={s.id}>
                  <td style={{ fontWeight: 600 }}>{s.email}</td>
                  <td><span className="gfc-agepill">{ROLE_LABEL[s.role] || s.role}</span></td>
                  <td>{fmtDate(s.invited_at)}</td>
                  <td><button className="gfc-btn gfc-btn-danger gfc-btn-sm" onClick={() => onRemove(s.id)} disabled={busy}>Remove access</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
