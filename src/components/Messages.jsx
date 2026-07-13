import React, { useState, useMemo } from "react";
import { T } from "../theme.js";
import { waLink, smsLink, fillTemplate, TEMPLATES } from "../lib/messaging.js";
import { Badge } from "./shared.jsx";

export function MessagesView({ enriched, ageGroups, selectedIds, setSelectedIds, templateId, setTemplateId, customText, setCustomText, onEmailStatement, onBulkEmailStatements, emailBusy, emailMessage, pendingReminderBatch, onDismissReminderBatch }) {
  const [msgAgeFilter, setMsgAgeFilter] = useState("All");
  const [msgStatusFilter, setMsgStatusFilter] = useState("All");

  const owingPlayers = useMemo(() => enriched.filter((p) => p.balance > 0), [enriched]);

  function handleReviewReminders() {
    setMsgAgeFilter("All");
    setMsgStatusFilter("All");
    setTemplateId("payment_reminder");
    setSelectedIds(owingPlayers.map((p) => p.id));
  }

  const pool = useMemo(() => {
    return enriched.filter((p) => {
      if (msgAgeFilter !== "All" && p.ageGroup !== msgAgeFilter) return false;
      if (msgStatusFilter !== "All" && p.status !== msgStatusFilter) return false;
      return true;
    });
  }, [enriched, msgAgeFilter, msgStatusFilter]);

  const template = TEMPLATES.find((t) => t.id === templateId) || TEMPLATES[0];
  const rawText = templateId === "custom" ? customText : template.text;

  function toggleOne(id) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }
  function toggleAll() {
    const poolIds = pool.map((p) => p.id);
    const allSelected = poolIds.every((id) => selectedIds.includes(id)) && poolIds.length > 0;
    setSelectedIds(allSelected ? selectedIds.filter((id) => !poolIds.includes(id)) : Array.from(new Set([...selectedIds, ...poolIds])));
  }

  const selectedPlayers = enriched.filter((p) => selectedIds.includes(p.id));

  return (
    <div>
      <div className="gfc-topbar">
        <div>
          <div className="gfc-page-title gfc-display">Messages</div>
          <div className="gfc-page-sub">Trigger WhatsApp or SMS messages to players / guardians</div>
        </div>
      </div>

      {pendingReminderBatch && (
        <div style={{ background: T.indigoSoft, border: `1px solid ${T.indigo}`, borderRadius: 10, padding: "12px 14px", marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ fontSize: 12.5, color: "#fff" }}>
            <strong>📅 Monthly payment reminders are due.</strong> {owingPlayers.length} player{owingPlayers.length === 1 ? "" : "s"} currently {owingPlayers.length === 1 ? "has" : "have"} an outstanding balance.
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="gfc-btn gfc-btn-primary gfc-btn-sm" onClick={handleReviewReminders}>Review &amp; select</button>
            <button className="gfc-btn gfc-btn-outline gfc-btn-sm" onClick={onDismissReminderBatch}>Dismiss</button>
          </div>
        </div>
      )}

      <div style={{ background: T.amberSoft, border: `1px solid ${T.gold}`, borderRadius: 10, padding: "10px 14px", fontSize: 12.5, color: "#7a5410", marginBottom: 18 }}>
        <strong>How sending works:</strong> there's no bulk-send API connected, so each message opens a pre-filled WhatsApp or SMS conversation for you to review and hit send on individually — nothing goes out automatically.
      </div>

      <div className="gfc-row2" style={{ alignItems: "flex-start" }}>
        <div className="gfc-panel" style={{ padding: 16 }}>
          <div className="gfc-panel-title" style={{ marginBottom: 12 }}>1. Choose recipients</div>
          <div className="gfc-filters" style={{ marginBottom: 10 }}>
            <select className="gfc-select" style={{ maxWidth: 150 }} value={msgAgeFilter} onChange={(e) => setMsgAgeFilter(e.target.value)}>
              {ageGroups.map((g) => <option key={g} value={g}>{g === "All" ? "All age groups" : g}</option>)}
            </select>
            <select className="gfc-select" style={{ maxWidth: 160 }} value={msgStatusFilter} onChange={(e) => setMsgStatusFilter(e.target.value)}>
              <option value="All">All compliance</option>
              <option value="green">Compliant</option>
              <option value="amber">Payment due</option>
              <option value="red">Non-compliant</option>
            </select>
            <button className="gfc-btn gfc-btn-ghost gfc-btn-sm" onClick={toggleAll}>Select all shown</button>
          </div>
          <div className="gfc-checklist">
            {pool.length === 0 ? (
              <div className="gfc-empty">No players match these filters.</div>
            ) : pool.map((p) => (
              <label key={p.id} className="gfc-checklist-row" style={{ cursor: "pointer" }}>
                <span className="gfc-checklist-left">
                  <input type="checkbox" checked={selectedIds.includes(p.id)} onChange={() => toggleOne(p.id)} />
                  {p.name}
                  <span className="gfc-agepill">{p.ageGroup}</span>
                </span>
                <Badge status={p.status} reason={p.reason} />
              </label>
            ))}
          </div>
        </div>

        <div className="gfc-panel" style={{ padding: 16 }}>
          <div className="gfc-panel-title" style={{ marginBottom: 12 }}>2. Write your message</div>
          <div className="gfc-field">
            <label className="gfc-label">Template</label>
            <select className="gfc-select" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
              {TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </div>
          {templateId === "custom" ? (
            <div className="gfc-field">
              <label className="gfc-label">Message</label>
              <textarea className="gfc-textarea" rows={4} value={customText} onChange={(e) => setCustomText(e.target.value)} placeholder="Type your message… use {first_name}, {age_group}, {balance}, {club}" />
            </div>
          ) : (
            <div className="gfc-field">
              <label className="gfc-label">Preview (placeholders fill per player)</label>
              <div className="gfc-msg-preview">{template.text}</div>
            </div>
          )}
          <div style={{ fontSize: 11, color: T.inkSoft }}>
            Placeholders: <code className="gfc-mono">{"{first_name}"}</code>, <code className="gfc-mono">{"{age_group}"}</code>, <code className="gfc-mono">{"{balance}"}</code>, <code className="gfc-mono">{"{club}"}</code>
          </div>
        </div>
      </div>

      <div className="gfc-panel" style={{ marginTop: 16 }}>
        <div className="gfc-panel-head">
          <div className="gfc-panel-title">3. Send ({selectedPlayers.length} selected)</div>
          {selectedPlayers.length > 0 && (
            <button
              className="gfc-btn gfc-btn-primary gfc-btn-sm"
              onClick={() => onBulkEmailStatements(selectedPlayers.filter((p) => p.email))}
              disabled={emailBusy || selectedPlayers.every((p) => !p.email)}
            >
              {emailBusy ? "Sending…" : `Email statements to all (${selectedPlayers.filter((p) => p.email).length})`}
            </button>
          )}
        </div>
        {emailMessage && (
          <div style={{ background: T.amberSoft, border: `1px solid ${T.gold}`, borderBottom: "none", padding: "8px 16px", fontSize: 12, color: "#7a5410" }}>
            {emailMessage}
          </div>
        )}
        {selectedPlayers.length === 0 ? (
          <div className="gfc-empty">
            <div className="gfc-empty-title gfc-display">No one selected</div>
            Tick players on the left to prepare their messages here.
          </div>
        ) : (
          <div>
            {selectedPlayers.map((p) => {
              const text = fillTemplate(rawText, p);
              const phone = p.guardianPhone || p.phone;
              return (
                <div key={p.id} className="gfc-send-row">
                  <div>
                    <div style={{ fontWeight: 600 }}>{p.name}</div>
                    <div style={{ color: T.inkSoft, fontSize: 11.5 }}>{phone || "No number on file"}</div>
                  </div>
                  <div className="gfc-send-actions">
                    <a
                      className="gfc-btn gfc-btn-primary gfc-btn-sm"
                      style={{ textDecoration: "none", opacity: phone ? 1 : 0.4, pointerEvents: phone ? "auto" : "none" }}
                      href={waLink(phone, text)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      WhatsApp
                    </a>
                    <a
                      className="gfc-btn gfc-btn-outline gfc-btn-sm"
                      style={{ textDecoration: "none", opacity: phone ? 1 : 0.4, pointerEvents: phone ? "auto" : "none" }}
                      href={smsLink(phone, text)}
                    >
                      SMS
                    </a>
                    <button
                      className="gfc-btn gfc-btn-outline gfc-btn-sm"
                      onClick={() => onEmailStatement(p)}
                      disabled={emailBusy || !p.email}
                      title={!p.email ? "No email address on file" : "Email a PDF statement"}
                    >
                      Email
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
