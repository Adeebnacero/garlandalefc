import React, { useState, useEffect } from "react";
import { T } from "../theme.js";

export function SettingsView({ clubSettings, onSave }) {
  const [form, setForm] = useState(clubSettings);
  const [saved, setSaved] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { setForm(clubSettings); }, [clubSettings]);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    setSaved("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    const err = await onSave(form);
    setSaving(false);
    setSaved(err ? `Error: ${err}` : "Saved.");
  }

  return (
    <div>
      <div className="gfc-topbar">
        <div>
          <div className="gfc-page-title gfc-display">Settings</div>
          <div className="gfc-page-sub">Email sender details and invoice/statement defaults</div>
        </div>
      </div>

      <div style={{ background: T.amberSoft, border: `1px solid ${T.gold}`, borderRadius: 10, padding: "12px 16px", fontSize: 12.5, color: "#7a5410", marginBottom: 20 }}>
        <strong>About email sending:</strong> the Gmail address and app password used to actually send emails are configured separately as secure server-side secrets (via the Supabase CLI) — they never live in this database, since anyone with the app's URL and key can read what's stored here. This page only controls how outgoing emails are labelled and what they include. See the README's "Email statements" section for the one-time server setup steps.
      </div>

      <form onSubmit={handleSubmit}>
        <div className="gfc-panel" style={{ padding: 20, marginBottom: 18 }}>
          <div className="gfc-panel-title" style={{ marginBottom: 14 }}>Sending identity</div>
          <div className="gfc-row2">
            <div className="gfc-field">
              <label className="gfc-label">Sending Gmail address</label>
              <input className="gfc-input" placeholder="club@gmail.com" value={form.senderEmail} onChange={(e) => update("senderEmail", e.target.value)} />
              <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 4 }}>For your reference only — must match the SMTP_USERNAME secret set on the server.</div>
            </div>
            <div className="gfc-field">
              <label className="gfc-label">Display name on outgoing emails</label>
              <input className="gfc-input" value={form.senderDisplayName} onChange={(e) => update("senderDisplayName", e.target.value)} />
            </div>
          </div>
          <div className="gfc-field">
            <label className="gfc-label">Reply-to address (optional)</label>
            <input className="gfc-input" placeholder="Leave blank to use the sending Gmail address" value={form.replyToEmail} onChange={(e) => update("replyToEmail", e.target.value)} />
          </div>
        </div>

        <div className="gfc-panel" style={{ padding: 20, marginBottom: 18 }}>
          <div className="gfc-panel-title" style={{ marginBottom: 14 }}>Statement / invoice content</div>
          <div className="gfc-field">
            <label className="gfc-label">Banking details (shown on statements, for EFT payments)</label>
            <textarea className="gfc-textarea" rows={3} placeholder="Bank: ...&#10;Account name: ...&#10;Account no: ...&#10;Branch code: ..." value={form.bankDetails} onChange={(e) => update("bankDetails", e.target.value)} />
          </div>
          <div className="gfc-field">
            <label className="gfc-label">Footer note (optional, shown at the bottom of every statement)</label>
            <textarea className="gfc-textarea" rows={2} placeholder="e.g. Thank you for your support this season!" value={form.invoiceFooterNote} onChange={(e) => update("invoiceFooterNote", e.target.value)} />
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button type="submit" className="gfc-btn gfc-btn-primary" disabled={saving}>{saving ? "Saving…" : "Save settings"}</button>
          {saved && <span style={{ fontSize: 12.5, color: saved.startsWith("Error") ? T.danger : T.green, fontWeight: 600 }}>{saved}</span>}
        </div>
      </form>
    </div>
  );
}
