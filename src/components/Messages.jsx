import React, { useState, useMemo } from "react";
import { T } from "../theme.js";
import { waLink, smsLink, fillTemplate, TEMPLATES } from "../lib/messaging.js";
import { Badge } from "./shared.jsx";

const CATEGORY_LABELS = { announcement: "Announcement", training: "Training", birthday: "🎂 Birthday" };

export function MessagesView({ enriched, ageGroups, selectedIds, setSelectedIds, templateId, setTemplateId, customText, setCustomText, onEmailStatement, onBulkEmailStatements, emailBusy, emailMessage, pendingReminderBatch, onDismissReminderBatch, notices, editingNotice, setEditingNotice, onSaveNotice, onDeleteNotice, role, staffId, staffTeams }) {
  // Coaches only get the Notice Board here - "Player Messages" surfaces
  // payment balances/compliance status, which the app deliberately never
  // shows a coach (see role_permissions/finance tables for the same rule).
  const canSeePlayerMessages = role !== "coach";
  const [subTab, setSubTab] = useState(canSeePlayerMessages ? "messages" : "notices"); // "messages" | "notices"
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
          <div className="gfc-page-sub">
            {subTab === "messages" ? "Trigger WhatsApp or SMS messages to players / guardians" : "Post announcements and training notices to the player app"}
          </div>
        </div>
      </div>

      {canSeePlayerMessages && (
        <div style={{ display: "flex", gap: 4, marginBottom: 18 }}>
          <button
            className="gfc-btn gfc-btn-sm"
            style={{ background: subTab === "messages" ? "#fff" : "transparent", color: T.ink, boxShadow: subTab === "messages" ? "0 1px 3px rgba(0,0,0,0.12)" : "none" }}
            onClick={() => setSubTab("messages")}
          >
            Player Messages
          </button>
          <button
            className="gfc-btn gfc-btn-sm"
            style={{ background: subTab === "notices" ? "#fff" : "transparent", color: T.ink, boxShadow: subTab === "notices" ? "0 1px 3px rgba(0,0,0,0.12)" : "none" }}
            onClick={() => setSubTab("notices")}
          >
            Notice Board
          </button>
        </div>
      )}

      {!canSeePlayerMessages || subTab === "notices" ? (
        <NoticeBoardSection notices={notices} role={role} staffId={staffId} onAdd={() => setEditingNotice("new")} onEdit={(n) => setEditingNotice(n)} />
      ) : (
      <>
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
      </>
      )}

      {editingNotice && (
        <NoticeModal
          notice={editingNotice === "new" ? null : editingNotice}
          role={role}
          staffId={staffId}
          staffTeams={staffTeams}
          ageGroups={ageGroups}
          onClose={() => setEditingNotice(null)}
          onSave={onSaveNotice}
          onDelete={onDeleteNotice}
        />
      )}
    </div>
  );
}

function NoticeBoardSection({ notices, role, staffId, onAdd, onEdit }) {
  function canEdit(n) {
    if (role === "admin" || role === "treasurer") return true;
    return n.postedBy === staffId; // a coach may only touch their own posts
  }

  return (
    <div className="gfc-panel">
      <div className="gfc-panel-head">
        <div className="gfc-panel-title">Notices ({(notices || []).length})</div>
        <button className="gfc-btn gfc-btn-primary gfc-btn-sm" onClick={onAdd}>+ Add notice</button>
      </div>
      {(!notices || notices.length === 0) ? (
        <div className="gfc-empty">
          <div className="gfc-empty-title gfc-display">No notices yet</div>
          Post an announcement or training notice for players to see in the app.
        </div>
      ) : (
        <div className="gfc-scroll-wrap">
        <table className="gfc-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Category</th>
              <th>Target</th>
              <th>Pinned</th>
              <th>Posted by</th>
              <th>Posted</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {notices.map((n) => {
              const editable = canEdit(n);
              return (
                <tr key={n.id} className={editable ? "clickable" : ""} onClick={() => editable && onEdit(n)}>
                  <td style={{ fontWeight: 600 }}>{n.title}</td>
                  <td><span className="gfc-agepill">{CATEGORY_LABELS[n.category] || n.category}</span></td>
                  <td><span className="gfc-agepill" style={{ background: T.indigoSoft }}>{n.targetAgeGroup || "ALL"}</span></td>
                  <td>{n.pinned ? "📌 Yes" : "—"}</td>
                  <td style={{ fontSize: 11.5, color: T.inkSoft }}>{n.postedByEmail || "—"}</td>
                  <td style={{ fontSize: 11.5, color: T.inkSoft }}>{n.postedAt ? new Date(n.postedAt).toLocaleDateString("en-ZA") : "—"}</td>
                  <td>
                    {editable ? (
                      <button className="gfc-btn gfc-btn-outline gfc-btn-sm" onClick={(e) => { e.stopPropagation(); onEdit(n); }}>Edit</button>
                    ) : (
                      <span style={{ fontSize: 11, color: T.inkSoft }} title="Only the original poster (or an Admin/Treasurer) can edit this">View only</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      )}
    </div>
  );
}

function NoticeModal({ notice, role, staffId, staffTeams, ageGroups, onClose, onSave, onDelete }) {
  const isAdminOrTreasurer = role === "admin" || role === "treasurer";
  const myTeams = useMemo(
    () => (staffTeams || []).filter((t) => t.staffId === staffId).map((t) => t.ageGroup),
    [staffTeams, staffId]
  );
  const targetOptions = isAdminOrTreasurer ? (ageGroups || []).filter((g) => g !== "All") : myTeams;

  const [form, setForm] = useState(() => ({
    id: notice?.id || "",
    title: notice?.title || "",
    body: notice?.body || "",
    category: notice?.category || "announcement",
    pinned: notice?.pinned || false,
    targetAgeGroup: notice?.targetAgeGroup || (isAdminOrTreasurer ? "ALL" : myTeams[0] || ""),
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.title.trim() || !form.body.trim() || !form.targetAgeGroup) return;
    setBusy(true);
    setError("");
    const result = await onSave(form);
    if (result?.error) setError(result.error);
    else onClose();
    setBusy(false);
  }

  async function handleDelete() {
    setBusy(true);
    setError("");
    const result = await onDelete(notice.id);
    if (result?.error) setError(result.error);
    else onClose();
    setBusy(false);
  }

  return (
    <div className="gfc-modal-backdrop" onClick={onClose}>
      <div className="gfc-modal" onClick={(e) => e.stopPropagation()}>
        <div className="gfc-modal-head">
          <div className="gfc-modal-title gfc-display">{notice ? "Edit notice" : "Add notice"}</div>
          <button className="gfc-modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="gfc-field">
            <label className="gfc-label">Title</label>
            <input className="gfc-input" value={form.title} onChange={(e) => update("title", e.target.value)} required />
          </div>
          <div className="gfc-field">
            <label className="gfc-label">Message</label>
            <textarea className="gfc-textarea" rows={4} value={form.body} onChange={(e) => update("body", e.target.value)} required />
          </div>
          <div className="gfc-row2">
            <div className="gfc-field">
              <label className="gfc-label">Category</label>
              <select className="gfc-select" value={form.category} onChange={(e) => update("category", e.target.value)}>
                <option value="announcement">Announcement</option>
                <option value="training">Training</option>
              </select>
            </div>
            <div className="gfc-field">
              <label className="gfc-label">Target</label>
              <select className="gfc-select" value={form.targetAgeGroup} onChange={(e) => update("targetAgeGroup", e.target.value)} disabled={targetOptions.length === 0}>
                {isAdminOrTreasurer && <option value="ALL">All players</option>}
                {targetOptions.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
          </div>
          {!isAdminOrTreasurer && targetOptions.length === 0 && (
            <div style={{ fontSize: 11.5, color: T.danger, fontWeight: 600, marginBottom: 10 }}>
              You don't have any teams assigned yet — ask an Admin to assign you one in Users before you can post.
            </div>
          )}
          <div className="gfc-field">
            <label className="gfc-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input type="checkbox" checked={form.pinned} onChange={(e) => update("pinned", e.target.checked)} />
              Pin to top
            </label>
          </div>
          {notice?.postedByEmail && (
            <div style={{ fontSize: 11, color: T.inkSoft, marginBottom: 10 }}>Posted by {notice.postedByEmail}</div>
          )}
          {error && <div style={{ fontSize: 12, color: T.danger, fontWeight: 600, marginBottom: 10 }}>{error}</div>}
          <div className="gfc-modal-actions">
            {notice && (
              <button type="button" className="gfc-btn gfc-btn-danger" style={{ marginRight: "auto" }} onClick={handleDelete} disabled={busy}>
                Delete notice
              </button>
            )}
            <button type="button" className="gfc-btn gfc-btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="gfc-btn gfc-btn-primary" disabled={busy || !form.targetAgeGroup}>{busy ? "Saving…" : "Save"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
