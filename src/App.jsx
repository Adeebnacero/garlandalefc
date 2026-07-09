import React, { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "./supabaseClient";

const BADGE_SRC = "data:image/png;base64,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";
/* ---------- DESIGN TOKENS ----------
  Palette drawn from the Garlandale FC crest:
  ink-indigo  #241a45  (crest left panel, deepened for text/surfaces)
  pitch-green #1e7a41  (crest right panel)
  gold        #e8ac2e  (crest border / eagle)
  gold-deep   #c98a12  (hover/active states)
  paper       #f6f2e9  (warm neutral background, not pure white)
  ink         #1c1730  (body text)
  danger      #c1443c
  amber       #d68f1e (reuses gold family for "partial" status)
------------------------------------- */

const T = {
  indigo: "#241a45",
  indigoSoft: "#342763",
  green: "#1e7a41",
  greenSoft: "#e6f3ea",
  gold: "#e8ac2e",
  goldDeep: "#c98a12",
  paper: "#f6f2e9",
  paperDim: "#efe9da",
  ink: "#1c1730",
  inkSoft: "#5b5470",
  danger: "#c1443c",
  dangerSoft: "#fbe9e7",
  amber: "#d68f1e",
  amberSoft: "#fbf1de",
  line: "#e2dbc9",
};

const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Anton&family=Karla:ital,wght@0,400;0,500;0,600;0,700;1,400&family=JetBrains+Mono:wght@400;600&display=swap');`;

const GLOBAL_CSS = `
${FONT_IMPORT}

* { box-sizing: border-box; }

.gfc-app {
  font-family: 'Karla', sans-serif;
  background: ${T.paper};
  color: ${T.ink};
  min-height: 100vh;
  display: flex;
  width: 100%;
}

.gfc-display {
  font-family: 'Anton', sans-serif;
  font-weight: 400;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}

.gfc-mono {
  font-family: 'JetBrains Mono', monospace;
}

/* -------- Sidebar -------- */
.gfc-sidebar {
  width: 220px;
  min-width: 220px;
  background: ${T.indigo};
  color: #fff;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
}
.gfc-sidebar::after {
  content: "";
  position: absolute;
  top: 0; right: 0; bottom: 0;
  width: 60%;
  background: linear-gradient(135deg, transparent 48%, ${T.green} 48.5%);
  opacity: 0.35;
  pointer-events: none;
}
.gfc-crest-wrap {
  padding: 28px 20px 18px;
  text-align: center;
  position: relative;
  z-index: 1;
  border-bottom: 1px solid rgba(255,255,255,0.12);
}
.gfc-crest-wrap img {
  width: 72px;
  height: 72px;
  display: block;
  margin: 0 auto 10px;
  filter: drop-shadow(0 4px 10px rgba(0,0,0,0.35));
}
.gfc-club-name {
  color: ${T.gold};
  font-size: 18px;
  line-height: 1.15;
}
.gfc-club-sub {
  color: rgba(255,255,255,0.55);
  font-size: 10.5px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  margin-top: 4px;
}
.gfc-nav {
  flex: 1;
  padding: 16px 12px;
  position: relative;
  z-index: 1;
}
.gfc-nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  border-radius: 8px;
  background: transparent;
  border: none;
  color: rgba(255,255,255,0.72);
  font-family: 'Karla', sans-serif;
  font-weight: 600;
  font-size: 13.5px;
  text-align: left;
  cursor: pointer;
  margin-bottom: 4px;
  transition: background 0.15s ease, color 0.15s ease;
}
.gfc-nav-item:hover {
  background: rgba(255,255,255,0.08);
  color: #fff;
}
.gfc-nav-item.active {
  background: ${T.gold};
  color: ${T.indigo};
}
.gfc-nav-icon { font-size: 15px; width: 18px; text-align: center; }

.gfc-sidebar-foot {
  padding: 14px 20px 20px;
  position: relative;
  z-index: 1;
  font-size: 10.5px;
  color: rgba(255,255,255,0.4);
  border-top: 1px solid rgba(255,255,255,0.1);
}

/* -------- Main -------- */
.gfc-main {
  flex: 1;
  min-width: 0;
  padding: 28px 34px 60px;
}
.gfc-topbar {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 22px;
  flex-wrap: wrap;
  gap: 10px;
}
.gfc-page-title {
  font-size: 26px;
  color: ${T.indigo};
}
.gfc-page-sub {
  color: ${T.inkSoft};
  font-size: 13px;
  margin-top: 2px;
}

.gfc-btn {
  font-family: 'Karla', sans-serif;
  font-weight: 700;
  font-size: 12.5px;
  letter-spacing: 0.02em;
  border-radius: 7px;
  padding: 9px 16px;
  border: none;
  cursor: pointer;
  transition: transform 0.1s ease, box-shadow 0.15s ease, background 0.15s ease;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.gfc-btn:active { transform: translateY(1px); }
.gfc-btn-primary { background: ${T.gold}; color: ${T.indigo}; }
.gfc-btn-primary:hover { background: ${T.goldDeep}; }
.gfc-btn-outline { background: transparent; color: ${T.indigo}; border: 1.5px solid ${T.indigo}; }
.gfc-btn-outline:hover { background: ${T.indigo}; color: #fff; }
.gfc-btn-ghost { background: transparent; color: ${T.inkSoft}; padding: 8px 10px; }
.gfc-btn-ghost:hover { color: ${T.ink}; }
.gfc-btn-danger { background: ${T.danger}; color: #fff; }
.gfc-btn-sm { padding: 6px 11px; font-size: 11.5px; }
.gfc-btn:disabled { opacity: 0.4; cursor: not-allowed; }

/* -------- Cards / stats -------- */
.gfc-stat-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 14px;
  margin-bottom: 26px;
}
.gfc-stat {
  background: #fff;
  border: 1px solid ${T.line};
  border-radius: 10px;
  padding: 16px 18px;
  position: relative;
  overflow: hidden;
}
.gfc-stat-label {
  font-size: 10.5px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: ${T.inkSoft};
  font-weight: 700;
}
.gfc-stat-value {
  font-family: 'JetBrains Mono', monospace;
  font-size: 26px;
  font-weight: 600;
  margin-top: 6px;
  color: ${T.indigo};
}
.gfc-stat-accent {
  position: absolute;
  left: 0; top: 0; bottom: 0;
  width: 4px;
}

/* -------- Table -------- */
.gfc-panel {
  background: #fff;
  border: 1px solid ${T.line};
  border-radius: 12px;
  overflow: hidden;
}
.gfc-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 18px;
  border-bottom: 1px solid ${T.line};
  flex-wrap: wrap;
  gap: 10px;
}
.gfc-panel-title {
  font-size: 14px;
  font-weight: 700;
  color: ${T.indigo};
}
table.gfc-table { width: 100%; border-collapse: collapse; font-size: 13px; }
table.gfc-table th {
  text-align: left;
  font-size: 10.5px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: ${T.inkSoft};
  padding: 10px 14px;
  background: ${T.paperDim};
  border-bottom: 1px solid ${T.line};
  white-space: nowrap;
}
table.gfc-table td {
  padding: 11px 14px;
  border-bottom: 1px solid ${T.line};
  vertical-align: middle;
}
table.gfc-table tr:last-child td { border-bottom: none; }
table.gfc-table tr.clickable { cursor: pointer; }
table.gfc-table tr.clickable:hover td { background: ${T.paperDim}; }

.gfc-empty {
  padding: 40px 20px;
  text-align: center;
  color: ${T.inkSoft};
  font-size: 13px;
}
.gfc-empty-title {
  font-family: 'Anton', sans-serif;
  text-transform: uppercase;
  color: ${T.indigo};
  font-size: 17px;
  margin-bottom: 6px;
}

/* -------- Badges -------- */
.gfc-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 9px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
}
.gfc-dot { width: 7px; height: 7px; border-radius: 50%; }
.gfc-badge-green { background: ${T.greenSoft}; color: ${T.green}; }
.gfc-badge-green .gfc-dot { background: ${T.green}; }
.gfc-badge-amber { background: ${T.amberSoft}; color: ${T.amberSoft === T.amberSoft ? "#8a5c0f" : ""}; }
.gfc-badge-amber .gfc-dot { background: ${T.amber}; }
.gfc-badge-red { background: ${T.dangerSoft}; color: ${T.danger}; }
.gfc-badge-red .gfc-dot { background: ${T.danger}; }
.gfc-badge-neutral { background: ${T.paperDim}; color: ${T.inkSoft}; }
.gfc-badge-neutral .gfc-dot { background: ${T.inkSoft}; }

.gfc-agepill {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 6px;
  background: ${T.indigoSoft};
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  font-family: 'JetBrains Mono', monospace;
}

/* -------- Forms -------- */
.gfc-field { margin-bottom: 14px; }
.gfc-label {
  display: block;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: ${T.inkSoft};
  margin-bottom: 5px;
}
.gfc-input, .gfc-select, .gfc-textarea {
  width: 100%;
  padding: 9px 11px;
  border: 1.5px solid ${T.line};
  border-radius: 7px;
  font-family: 'Karla', sans-serif;
  font-size: 13.5px;
  background: #fff;
  color: ${T.ink};
}
.gfc-input:focus, .gfc-select:focus, .gfc-textarea:focus {
  outline: none;
  border-color: ${T.gold};
  box-shadow: 0 0 0 3px rgba(232,172,46,0.25);
}
.gfc-row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.gfc-check-row { display: flex; align-items: center; gap: 8px; font-size: 13px; }

/* -------- Modal -------- */
.gfc-modal-backdrop {
  position: fixed; inset: 0; background: rgba(28,23,48,0.55);
  display: flex; align-items: flex-start; justify-content: center;
  padding: 40px 16px; overflow-y: auto; z-index: 50;
}
.gfc-modal {
  background: #fff; border-radius: 14px; width: 100%; max-width: 520px;
  padding: 26px 26px 22px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.3);
}
.gfc-modal-head {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 18px;
}
.gfc-modal-title { font-size: 18px; color: ${T.indigo}; }
.gfc-modal-close {
  background: none; border: none; font-size: 20px; color: ${T.inkSoft};
  cursor: pointer; line-height: 1;
}
.gfc-modal-actions {
  display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;
  padding-top: 16px; border-top: 1px solid ${T.line};
}

/* -------- Player card (squad view signature element) -------- */
.gfc-squad-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
  gap: 14px;
}
.gfc-card {
  position: relative;
  background: #fff;
  border: 1px solid ${T.line};
  border-radius: 12px;
  padding: 16px 16px 14px;
  cursor: pointer;
  transition: box-shadow 0.15s ease, transform 0.15s ease;
  overflow: hidden;
}
.gfc-card:hover { box-shadow: 0 8px 22px rgba(36,26,69,0.14); transform: translateY(-2px); }
.gfc-card-ribbon {
  position: absolute;
  top: 0; right: 0;
  width: 0; height: 0;
  border-style: solid;
  border-width: 0 46px 46px 0;
}
.gfc-card-name { font-weight: 700; font-size: 14.5px; color: ${T.ink}; padding-right: 30px; }
.gfc-card-meta { font-size: 12px; color: ${T.inkSoft}; margin-top: 3px; }
.gfc-card-foot {
  display: flex; align-items: center; justify-content: space-between;
  margin-top: 12px; padding-top: 10px; border-top: 1px dashed ${T.line};
}
.gfc-card-balance { font-family: 'JetBrains Mono', monospace; font-weight: 700; font-size: 13px; }

.gfc-filters { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }

.gfc-msg-preview {
  background: ${T.paperDim};
  border: 1px solid ${T.line};
  border-radius: 8px;
  padding: 12px 14px;
  font-size: 13px;
  white-space: pre-wrap;
  color: ${T.ink};
}

.gfc-checklist {
  max-height: 260px;
  overflow-y: auto;
  border: 1px solid ${T.line};
  border-radius: 8px;
}
.gfc-checklist-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 12px; border-bottom: 1px solid ${T.line}; font-size: 12.5px;
}
.gfc-checklist-row:last-child { border-bottom: none; }
.gfc-checklist-left { display: flex; align-items: center; gap: 8px; }

.gfc-send-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 9px 12px; border-bottom: 1px solid ${T.line}; font-size: 12.5px;
  gap: 10px;
}
.gfc-send-row:last-child { border-bottom: none; }
.gfc-send-actions { display: flex; gap: 6px; }

::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-thumb { background: ${T.line}; border-radius: 8px; }

@media (max-width: 720px) {
  .gfc-app { flex-direction: column; }
  .gfc-sidebar { width: 100%; min-width: 0; }
  .gfc-nav { display: flex; overflow-x: auto; padding: 10px 12px; }
  .gfc-nav-item { white-space: nowrap; margin-bottom: 0; }
  .gfc-main { padding: 20px 16px 40px; }
  .gfc-row2 { grid-template-columns: 1fr; }
}
`;

/* ---------- HELPERS ---------- */

const todayISO = () => new Date().toISOString().slice(0, 10);

function fmtMoney(n) {
  const v = Number(n) || 0;
  return (v < 0 ? "-" : "") + "R" + Math.abs(v).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d) {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt)) return "—";
  return dt.toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric" });
}

function computeAgeGroup(dob) {
  if (!dob) return "Unassigned";
  const birth = new Date(dob);
  if (isNaN(birth)) return "Unassigned";
  const today = new Date();
  // English/SA grassroots convention: age-group cutoff is 31 Aug.
  const cutoffYear = today.getMonth() >= 8 ? today.getFullYear() + 1 : today.getFullYear();
  const age = cutoffYear - birth.getFullYear();
  if (age >= 18 && age < 40) return "Senior";
  if (age >= 40) return "Over 40";
  if (age <= 0) return "Unassigned";
  return "U" + age;
}

function computeExactAge(dob) {
  if (!dob) return null;
  const birth = new Date(dob);
  if (isNaN(birth)) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const hasHadBirthdayThisYear =
    today.getMonth() > birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() >= birth.getDate());
  if (!hasHadBirthdayThisYear) age -= 1;
  return age;
}

function isOver40(dob) {
  const age = computeExactAge(dob);
  return age !== null && age >= 40;
}

const SEASON_START_MONTH = 0; // January (0-indexed)
const SEASON_END_MONTH = 9;   // October (0-indexed) - last billable month of the season

/**
 * Season runs January (0) through October (9). November/December accrue
 * nothing. A player's very first season is pro-rated from their join month;
 * every season after that bills the full Jan-Oct run. Balances are one
 * continuous running total across every season a player has been a member
 * (unpaid amounts carry forward rather than resetting each year).
 */
function seasonMonthsDueForYear(year, joinDate, today) {
  const join = new Date(joinDate);
  if (isNaN(join)) return 0;
  const joinYear = join.getFullYear();
  const joinMonth = join.getMonth();
  if (year < joinYear) return 0;

  const startMonth = year === joinYear ? Math.min(joinMonth, SEASON_END_MONTH + 1) : SEASON_START_MONTH;
  // If they joined in Nov/Dec, that's effectively joining ahead of next season - no months due this year.
  if (year === joinYear && joinMonth > SEASON_END_MONTH) return 0;

  let endMonthExclusive;
  if (year < today.getFullYear()) {
    endMonthExclusive = SEASON_END_MONTH + 1; // past season, fully elapsed
  } else if (year === today.getFullYear()) {
    const currentMonth = today.getMonth();
    endMonthExclusive = currentMonth > SEASON_END_MONTH ? SEASON_END_MONTH + 1 : currentMonth + 1;
  } else {
    endMonthExclusive = 0; // future year, shouldn't happen
  }

  return Math.max(0, endMonthExclusive - startMonth);
}

function totalSeasonMonthsDue(joinDate, today = new Date()) {
  const join = new Date(joinDate);
  if (isNaN(join)) return 0;
  let total = 0;
  for (let y = join.getFullYear(); y <= today.getFullYear(); y++) {
    total += seasonMonthsDueForYear(y, joinDate, today);
  }
  return total;
}

function playerFinance(player, tiers) {
  const tier = (tiers || []).find((t) => t.id === player.tierId);
  const fee = tier ? Number(tier.monthlyFee) || 0 : 0;
  const monthsDue = totalSeasonMonthsDue(player.joinDate);
  const due = monthsDue * fee;
  const paid = (player.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const balance = due - paid;
  return { due, paid, balance, fee, tierName: tier ? tier.name : "" };
}

function complianceStatus(player, tiers) {
  const { balance, fee } = playerFinance(player, tiers);
  if (!player.documentsComplete) return "red";
  if (!player.tierId) return "amber";
  if (balance <= 0) return "green";
  if (fee > 0 && balance <= fee) return "amber";
  if (balance > 0) return "red";
  return "green";
}

const STATUS_LABEL = { green: "Compliant", amber: "Payment due", red: "Non-compliant" };
const STATUS_COLOR = { green: T.green, amber: T.amber, red: T.danger };


function Badge({ status }) {
  const cls = status === "green" ? "gfc-badge-green" : status === "amber" ? "gfc-badge-amber" : status === "red" ? "gfc-badge-red" : "gfc-badge-neutral";
  return (
    <span className={`gfc-badge ${cls}`}>
      <span className="gfc-dot" />
      {STATUS_LABEL[status] || "—"}
    </span>
  );
}

function digitsOnly(phone) {
  return (phone || "").replace(/[^\d]/g, "");
}

function waLink(phone, text) {
  const p = digitsOnly(phone);
  return `https://wa.me/${p}?text=${encodeURIComponent(text)}`;
}

function smsLink(phone, text) {
  return `sms:${phone || ""}?body=${encodeURIComponent(text)}`;
}

function fillTemplate(tpl, player) {
  const { balance } = playerFinance(player);
  return tpl
    .replaceAll("{first_name}", (player.name || "").split(" ")[0] || "Player")
    .replaceAll("{name}", player.name || "")
    .replaceAll("{age_group}", player.ageGroupOverride || computeAgeGroup(player.dob))
    .replaceAll("{balance}", fmtMoney(balance))
    .replaceAll("{club}", "Garlandale FC");
}

const TEMPLATES = [
  {
    id: "payment_reminder",
    label: "Payment reminder",
    text: "Hi {first_name}, this is Garlandale FC. Our records show an outstanding subscription balance of {balance} for {age_group}'s. Please settle this at your earliest convenience. Thank you!",
  },
  {
    id: "welcome",
    label: "Welcome message",
    text: "Welcome to Garlandale FC, {first_name}! We're excited to have you in our {age_group}'s. Training details will follow shortly.",
  },
  {
    id: "compliance",
    label: "Compliance reminder",
    text: "Hi {first_name}, we're missing some outstanding paperwork for your registration at Garlandale FC ({age_group})'s. Please reach out to the club office so we can get this sorted.",
  },
  {
    id: "training",
    label: "Training update",
    text: "Hi {first_name}, a quick note from Garlandale FC re: {age_group}'s training this week — please check the club noticeboard for the latest schedule.",
  },
  {
    id: "custom",
    label: "Blank / custom",
    text: "",
  },
];


/* ---------- SUPABASE ROW MAPPING ----------
   Postgres columns are snake_case; the rest of this app works in camelCase.
   These two functions are the only place that translates between them. */

function fromDbPlayer(row) {
  return {
    id: row.id,
    name: row.name || "",
    dob: row.dob || "",
    ageGroupOverride: row.age_group_override || "",
    phone: row.phone || "",
    email: row.email || "",
    guardianName: row.guardian_name || "",
    guardianPhone: row.guardian_phone || "",
    joinDate: row.join_date || "",
    monthlyFee: row.monthly_fee ?? 0,
    documentsComplete: !!row.documents_complete,
    notes: row.notes || "",
    regNo: row.reg_no || "",
    squadNumber: row.squad_number === null || row.squad_number === undefined ? "" : row.squad_number,
    tierId: row.tier_id || "",
    payments: (row.payments || [])
      .map((p) => ({ id: p.id, amount: Number(p.amount), date: p.date, method: p.method }))
      .sort((a, b) => new Date(b.date) - new Date(a.date)),
  };
}

function toDbPlayer(form) {
  return {
    name: form.name,
    dob: form.dob || null,
    age_group_override: form.ageGroupOverride || "",
    phone: form.phone || "",
    email: form.email || "",
    guardian_name: form.guardianName || "",
    guardian_phone: form.guardianPhone || "",
    join_date: form.joinDate || null,
    documents_complete: !!form.documentsComplete,
    notes: form.notes || "",
    reg_no: form.regNo && form.regNo.trim() ? form.regNo.trim() : null,
    squad_number: form.squadNumber === "" || form.squadNumber === null || form.squadNumber === undefined ? null : Number(form.squadNumber),
    tier_id: form.tierId || null,
  };
}

function fromDbTier(row) {
  return {
    id: row.id,
    name: row.name || "",
    monthlyFee: Number(row.monthly_fee) || 0,
    description: row.description || "",
  };
}

function toDbTier(form) {
  return {
    name: form.name || "",
    monthly_fee: Number(form.monthlyFee) || 0,
    description: form.description || "",
  };
}

function fromDbMatch(row) {
  return {
    id: row.id,
    leagueName: row.league_name || "",
    homeTeam: row.home_team || "",
    opponent: row.opponent || "",
    homeAway: row.home_away || "H",
    venue: row.venue || "",
    matchDate: row.match_date || "",
    kickoffTime: row.kickoff_time || "",
    division: row.division || "",
    competition: row.competition || "",
    ageGroup: row.age_group || "",
    cornerFlags: row.corner_flags || "",
    fieldConditions: row.field_conditions || "",
    fieldMarking: row.field_marking || "",
    firstAidPresent: row.first_aid_present || "",
    refereeName: row.referee_name || "",
    assistantRef1: row.assistant_ref_1 || "",
    assistantRef2: row.assistant_ref_2 || "",
    halfTimeScoreHome: row.half_time_score_home || "",
    fullTimeScoreHome: row.full_time_score_home || "",
    halfTimeScoreAway: row.half_time_score_away || "",
    fullTimeScoreAway: row.full_time_score_away || "",
    coachName: row.coach_name || "",
    coachRegNo: row.coach_reg_no || "",
    managerName: row.manager_name || "",
    managerRegNo: row.manager_reg_no || "",
    captainPlayerId: row.captain_player_id || "",
    physioName: row.physio_name || "",
    physioRegNo: row.physio_reg_no || "",
    comments: row.comments || "",
  };
}

function toDbMatch(form) {
  return {
    league_name: form.leagueName || "Cape Town Tygerberg LFA",
    home_team: form.homeTeam || "Garlandale FC",
    opponent: form.opponent || "",
    home_away: form.homeAway || "H",
    venue: form.venue || "",
    match_date: form.matchDate || null,
    kickoff_time: form.kickoffTime || null,
    division: form.division || "",
    competition: form.competition || "",
    age_group: form.ageGroup || "",
    corner_flags: form.cornerFlags || "",
    field_conditions: form.fieldConditions || "",
    field_marking: form.fieldMarking || "",
    first_aid_present: form.firstAidPresent || "",
    referee_name: form.refereeName || "",
    assistant_ref_1: form.assistantRef1 || "",
    assistant_ref_2: form.assistantRef2 || "",
    half_time_score_home: form.halfTimeScoreHome || "",
    full_time_score_home: form.fullTimeScoreHome || "",
    half_time_score_away: form.halfTimeScoreAway || "",
    full_time_score_away: form.fullTimeScoreAway || "",
    coach_name: form.coachName || "",
    coach_reg_no: form.coachRegNo || "",
    manager_name: form.managerName || "",
    manager_reg_no: form.managerRegNo || "",
    captain_player_id: form.captainPlayerId || null,
    physio_name: form.physioName || "",
    physio_reg_no: form.physioRegNo || "",
    comments: form.comments || "",
  };
}

function fromDbItem(row) {
  return {
    id: row.id,
    name: row.name || "",
    category: row.category || "",
    size: row.size || "",
    quantityOnHand: row.quantity_on_hand ?? 0,
  };
}

function toDbItem(form) {
  return {
    name: form.name || "",
    category: form.category || "",
    size: form.size || "",
    quantity_on_hand: Number(form.quantityOnHand) || 0,
  };
}
/* ---------- MAIN APP ---------- */

const CLUB_NAME = "Garlandale FC";

export default function App() {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState(false);
  const [tab, setTab] = useState("dashboard");
  const [ageFilter, setAgeFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [editingPlayer, setEditingPlayer] = useState(null); // player object or "new" or null
  const [ledgerPlayerId, setLedgerPlayerId] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [templateId, setTemplateId] = useState(TEMPLATES[0].id);
  const [customText, setCustomText] = useState("");

  const [matches, setMatches] = useState([]);
  const [matchSquads, setMatchSquads] = useState({}); // matchId -> array of squad rows (with player joined)
  const [activeMatchId, setActiveMatchId] = useState(null);
  const [editingMatch, setEditingMatch] = useState(null); // match object or "new" or null

  const [inventory, setInventory] = useState([]);
  const [issuedItems, setIssuedItems] = useState([]);
  const [editingItem, setEditingItem] = useState(null); // inventory item or "new" or null

  const [tiers, setTiers] = useState([]);
  const [editingTier, setEditingTier] = useState(null); // tier object or "new" or null
  const [managingTiers, setManagingTiers] = useState(false);

  const [backupsList, setBackupsList] = useState([]);
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupMessage, setBackupMessage] = useState("");

  const loadTiers = useCallback(async () => {
    try {
      const { data: rows, error } = await supabase.from("tiers").select("*").order("monthly_fee", { ascending: false });
      if (error) throw error;
      setTiers((rows || []).map(fromDbTier));
    } catch (e) {
      setLoadError((prev) => prev || e.message || "Could not load subscription tiers.");
    }
  }, []);

  const loadBackups = useCallback(async () => {
    try {
      const { data: rows, error } = await supabase
        .from("backups")
        .select("id, created_at, kind")
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      setBackupsList(rows || []);
    } catch (e) {
      // Non-fatal - the rest of the app still works without backups visible.
      setBackupMessage("Could not load backup history: " + (e.message || "unknown error"));
    }
  }, []);

  const loadPlayers = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const { data: rows, error } = await supabase
        .from("players")
        .select("*, payments(*)")
        .order("name", { ascending: true });
      if (error) throw error;
      setPlayers((rows || []).map(fromDbPlayer));
    } catch (e) {
      setLoadError(e.message || "Could not reach the database.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMatches = useCallback(async () => {
    try {
      const { data: rows, error } = await supabase
        .from("matches")
        .select("*")
        .order("match_date", { ascending: false });
      if (error) throw error;
      setMatches((rows || []).map(fromDbMatch));
    } catch (e) {
      setLoadError((prev) => prev || e.message || "Could not load fixtures.");
    }
  }, []);

  const loadMatchSquad = useCallback(async (matchId) => {
    if (!matchId) return;
    try {
      const { data: rows, error } = await supabase
        .from("match_squad")
        .select("*, players(*)")
        .eq("match_id", matchId)
        .order("slot_no", { ascending: true });
      if (error) throw error;
      setMatchSquads((prev) => ({
        ...prev,
        [matchId]: (rows || []).map((r) => ({
          id: r.id,
          matchId: r.match_id,
          playerId: r.player_id,
          slotNo: r.slot_no,
          jerseyNo: r.jersey_no || "",
          role: r.role || "starting",
          player: r.players ? fromDbPlayer({ ...r.players, payments: [] }) : null,
        })),
      }));
    } catch (e) {
      setSaveError(true);
    }
  }, []);

  const loadKit = useCallback(async () => {
    try {
      const { data: items, error: itemsErr } = await supabase.from("inventory_items").select("*").order("name");
      if (itemsErr) throw itemsErr;
      setInventory((items || []).map(fromDbItem));

      const { data: issued, error: issuedErr } = await supabase
        .from("issued_items")
        .select("*, players(*), inventory_items(*)")
        .order("date_issued", { ascending: false });
      if (issuedErr) throw issuedErr;
      setIssuedItems(
        (issued || []).map((r) => ({
          id: r.id,
          playerId: r.player_id,
          itemId: r.item_id,
          size: r.size || "",
          quantity: r.quantity || 1,
          dateIssued: r.date_issued || "",
          dateReturned: r.date_returned || "",
          notes: r.notes || "",
          playerName: r.players ? r.players.name : "Unknown player",
          itemName: r.inventory_items ? r.inventory_items.name : "Unknown item",
        }))
      );
    } catch (e) {
      setLoadError((prev) => prev || e.message || "Could not load kit records.");
    }
  }, []);

  useEffect(() => {
    loadPlayers();
    loadMatches();
    loadKit();
    loadTiers();
    loadBackups();
  }, [loadPlayers, loadMatches, loadKit, loadTiers, loadBackups]);

  useEffect(() => {
    if (activeMatchId) loadMatchSquad(activeMatchId);
  }, [activeMatchId, loadMatchSquad]);

  const ageGroups = useMemo(() => {
    const set = new Set();
    players.forEach((p) => set.add(p.ageGroupOverride || computeAgeGroup(p.dob)));
    return ["All", ...Array.from(set).sort()];
  }, [players]);

  const enriched = useMemo(() => {
    return players.map((p) => {
      const fin = playerFinance(p, tiers);
      const status = complianceStatus(p, tiers);
      const ageGroup = p.ageGroupOverride || computeAgeGroup(p.dob);
      const over40 = isOver40(p.dob);
      return { ...p, ...fin, status, ageGroup, over40 };
    });
  }, [players, tiers]);

  const filtered = useMemo(() => {
    return enriched.filter((p) => {
      if (ageFilter !== "All" && p.ageGroup !== ageFilter) return false;
      if (statusFilter !== "All" && p.status !== statusFilter) return false;
      if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [enriched, ageFilter, statusFilter, search]);

  const stats = useMemo(() => {
    const totalOwed = enriched.reduce((s, p) => s + Math.max(0, p.balance), 0);
    const compliant = enriched.filter((p) => p.status === "green").length;
    const nonCompliant = enriched.filter((p) => p.status === "red").length;
    const dueSoon = enriched.filter((p) => p.status === "amber").length;
    return { total: enriched.length, totalOwed, compliant, nonCompliant, dueSoon };
  }, [enriched]);

  async function savePlayer(form) {
    setSaveError(false);
    const payload = toDbPlayer(form);
    try {
      if (form.id) {
        const { error } = await supabase.from("players").update(payload).eq("id", form.id);
        if (error) throw error;
        setPlayers((prev) => prev.map((p) => (p.id === form.id ? { ...p, ...form } : p)));
      } else {
        const { data: inserted, error } = await supabase.from("players").insert(payload).select().single();
        if (error) throw error;
        setPlayers((prev) => [...prev, fromDbPlayer({ ...inserted, payments: [] })]);
      }
      setEditingPlayer(null);
      return null;
    } catch (e) {
      setSaveError(true);
      if ((e.message || "").toLowerCase().includes("reg_no")) {
        return "That federation number is already assigned to another player.";
      }
      return e.message || "Something went wrong saving this player.";
    }
  }

  async function deletePlayer(id) {
    setSaveError(false);
    try {
      const { error } = await supabase.from("players").delete().eq("id", id);
      if (error) throw error;
      setPlayers((prev) => prev.filter((p) => p.id !== id));
    } catch (e) {
      setSaveError(true);
    }
    setEditingPlayer(null);
    setLedgerPlayerId(null);
  }

  async function addPayment(playerId, payment) {
    setSaveError(false);
    try {
      const { data: inserted, error } = await supabase
        .from("payments")
        .insert({ player_id: playerId, amount: payment.amount, date: payment.date, method: payment.method })
        .select()
        .single();
      if (error) throw error;
      setPlayers((prev) =>
        prev.map((p) =>
          p.id === playerId
            ? { ...p, payments: [{ id: inserted.id, amount: Number(inserted.amount), date: inserted.date, method: inserted.method }, ...(p.payments || [])] }
            : p
        )
      );
    } catch (e) {
      setSaveError(true);
    }
  }

  async function removePayment(playerId, paymentId) {
    setSaveError(false);
    try {
      const { error } = await supabase.from("payments").delete().eq("id", paymentId);
      if (error) throw error;
      setPlayers((prev) =>
        prev.map((p) =>
          p.id === playerId ? { ...p, payments: (p.payments || []).filter((pm) => pm.id !== paymentId) } : p
        )
      );
    } catch (e) {
      setSaveError(true);
    }
  }

  /* ----- Matchday CRUD ----- */

  async function saveMatch(form) {
    setSaveError(false);
    const payload = toDbMatch(form);
    try {
      if (form.id) {
        const { error } = await supabase.from("matches").update(payload).eq("id", form.id);
        if (error) throw error;
        setMatches((prev) => prev.map((m) => (m.id === form.id ? { ...m, ...form } : m)));
      } else {
        const { data: inserted, error } = await supabase.from("matches").insert(payload).select().single();
        if (error) throw error;
        const newMatch = fromDbMatch(inserted);
        setMatches((prev) => [newMatch, ...prev]);
        setActiveMatchId(newMatch.id);
      }
      setEditingMatch(null);
    } catch (e) {
      setSaveError(true);
    }
  }

  async function deleteMatch(id) {
    setSaveError(false);
    try {
      const { error } = await supabase.from("matches").delete().eq("id", id);
      if (error) throw error;
      setMatches((prev) => prev.filter((m) => m.id !== id));
      if (activeMatchId === id) setActiveMatchId(null);
    } catch (e) {
      setSaveError(true);
    }
    setEditingMatch(null);
  }

  async function setSquadSlot(matchId, slotNo, role, player) {
    setSaveError(false);
    try {
      const existing = (matchSquads[matchId] || []).find((r) => r.slotNo === slotNo);
      if (!player) {
        if (existing) {
          const { error } = await supabase.from("match_squad").delete().eq("id", existing.id);
          if (error) throw error;
        }
      } else if (existing) {
        const { error } = await supabase
          .from("match_squad")
          .update({ player_id: player.id, jersey_no: String(player.squadNumber ?? "") })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("match_squad").insert({
          match_id: matchId,
          player_id: player.id,
          slot_no: slotNo,
          role,
          jersey_no: String(player.squadNumber ?? ""),
        });
        if (error) throw error;
      }
      await loadMatchSquad(matchId);
    } catch (e) {
      setSaveError(true);
    }
  }

  async function updateSquadJersey(matchId, rowId, jerseyNo) {
    setSaveError(false);
    try {
      const { error } = await supabase.from("match_squad").update({ jersey_no: jerseyNo }).eq("id", rowId);
      if (error) throw error;
      setMatchSquads((prev) => ({
        ...prev,
        [matchId]: (prev[matchId] || []).map((r) => (r.id === rowId ? { ...r, jerseyNo } : r)),
      }));
    } catch (e) {
      setSaveError(true);
    }
  }

  /* ----- Tier CRUD ----- */

  async function saveTier(form) {
    setSaveError(false);
    const payload = toDbTier(form);
    try {
      if (form.id) {
        const { error } = await supabase.from("tiers").update(payload).eq("id", form.id);
        if (error) throw error;
        setTiers((prev) => prev.map((t) => (t.id === form.id ? { ...t, ...form, monthlyFee: Number(form.monthlyFee) } : t)));
      } else {
        const { data: inserted, error } = await supabase.from("tiers").insert(payload).select().single();
        if (error) throw error;
        setTiers((prev) => [...prev, fromDbTier(inserted)]);
      }
      setEditingTier(null);
    } catch (e) {
      setSaveError(true);
    }
  }

  async function deleteTier(id) {
    setSaveError(false);
    try {
      const { error } = await supabase.from("tiers").delete().eq("id", id);
      if (error) throw error;
      setTiers((prev) => prev.filter((t) => t.id !== id));
      setPlayers((prev) => prev.map((p) => (p.tierId === id ? { ...p, tierId: "" } : p)));
    } catch (e) {
      setSaveError(true);
    }
    setEditingTier(null);
  }

  /* ----- Kit CRUD ----- */

  async function saveItem(form) {
    setSaveError(false);
    const payload = toDbItem(form);
    try {
      if (form.id) {
        const { error } = await supabase.from("inventory_items").update(payload).eq("id", form.id);
        if (error) throw error;
        setInventory((prev) => prev.map((i) => (i.id === form.id ? { ...i, ...form, quantityOnHand: Number(form.quantityOnHand) } : i)));
      } else {
        const { data: inserted, error } = await supabase.from("inventory_items").insert(payload).select().single();
        if (error) throw error;
        setInventory((prev) => [...prev, fromDbItem(inserted)]);
      }
      setEditingItem(null);
    } catch (e) {
      setSaveError(true);
    }
  }

  async function deleteItem(id) {
    setSaveError(false);
    try {
      const { error } = await supabase.from("inventory_items").delete().eq("id", id);
      if (error) throw error;
      setInventory((prev) => prev.filter((i) => i.id !== id));
    } catch (e) {
      setSaveError(true);
    }
    setEditingItem(null);
  }

  async function issueItem({ playerId, itemId, size, quantity, dateIssued, notes }) {
    setSaveError(false);
    try {
      const item = inventory.find((i) => i.id === itemId);
      const { data: inserted, error } = await supabase
        .from("issued_items")
        .insert({ player_id: playerId, item_id: itemId, size, quantity, date_issued: dateIssued, notes })
        .select()
        .single();
      if (error) throw error;
      const { error: updErr } = await supabase
        .from("inventory_items")
        .update({ quantity_on_hand: Math.max(0, (item?.quantityOnHand || 0) - Number(quantity)) })
        .eq("id", itemId);
      if (updErr) throw updErr;
      await Promise.all([loadKit()]);
    } catch (e) {
      setSaveError(true);
    }
  }

  async function returnItem(issuedId) {
    setSaveError(false);
    try {
      const row = issuedItems.find((r) => r.id === issuedId);
      const { error } = await supabase.from("issued_items").update({ date_returned: todayISO() }).eq("id", issuedId);
      if (error) throw error;
      if (row) {
        const item = inventory.find((i) => i.id === row.itemId);
        if (item) {
          await supabase.from("inventory_items").update({ quantity_on_hand: (item.quantityOnHand || 0) + row.quantity }).eq("id", item.id);
        }
      }
      await loadKit();
    } catch (e) {
      setSaveError(true);
    }
  }

  /* ----- Backups ----- */

  async function reloadEverything() {
    await Promise.all([loadPlayers(), loadMatches(), loadKit(), loadTiers()]);
  }

  async function runManualBackup() {
    setBackupBusy(true);
    setBackupMessage("");
    try {
      const { error } = await supabase.rpc("create_backup_snapshot", { p_kind: "manual" });
      if (error) throw error;
      await loadBackups();
      setBackupMessage("Backup created successfully.");
    } catch (e) {
      setBackupMessage("Backup failed: " + (e.message || "unknown error"));
    } finally {
      setBackupBusy(false);
    }
  }

  async function downloadSnapshot(backupId) {
    try {
      const { data, error } = await supabase.from("backups").select("*").eq("id", backupId).single();
      if (error) throw error;
      const blob = new Blob([JSON.stringify(data.snapshot, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `garlandale-backup-${(data.created_at || "").slice(0, 19).replace(/[:T]/g, "-")}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setBackupMessage("Could not download backup: " + (e.message || "unknown error"));
    }
  }

  async function applySnapshot(snapshot) {
    // Children first, then parents, to respect foreign keys on delete;
    // reverse order on insert (parents first, then children).
    const del = (table) => supabase.from(table).delete().neq("id", "00000000-0000-0000-0000-000000000000");

    await del("issued_items");
    await del("match_squad");
    await del("payments");
    await del("matches");
    await del("inventory_items");
    await del("players");
    await del("tiers");

    if (snapshot.tiers?.length) await supabase.from("tiers").insert(snapshot.tiers);
    if (snapshot.players?.length) await supabase.from("players").insert(snapshot.players);
    if (snapshot.inventory_items?.length) await supabase.from("inventory_items").insert(snapshot.inventory_items);
    if (snapshot.matches?.length) await supabase.from("matches").insert(snapshot.matches);
    if (snapshot.payments?.length) await supabase.from("payments").insert(snapshot.payments);
    if (snapshot.match_squad?.length) await supabase.from("match_squad").insert(snapshot.match_squad);
    if (snapshot.issued_items?.length) await supabase.from("issued_items").insert(snapshot.issued_items);
  }

  async function restoreFromSnapshot(backupId) {
    const confirmed = window.confirm(
      "This will replace ALL current data with this backup. This cannot be undone. Are you sure you want to continue?"
    );
    if (!confirmed) return;
    setBackupBusy(true);
    setBackupMessage("");
    try {
      const { data, error } = await supabase.from("backups").select("*").eq("id", backupId).single();
      if (error) throw error;
      await applySnapshot(data.snapshot);
      await reloadEverything();
      await loadBackups();
      setBackupMessage("Restore complete.");
    } catch (e) {
      setBackupMessage("Restore failed: " + (e.message || "unknown error"));
    } finally {
      setBackupBusy(false);
    }
  }

  async function restoreFromUploadedFile(file) {
    const confirmed = window.confirm(
      "This will replace ALL current data with the contents of this file. This cannot be undone. Are you sure you want to continue?"
    );
    if (!confirmed) return;
    setBackupBusy(true);
    setBackupMessage("");
    try {
      const text = await file.text();
      const snapshot = JSON.parse(text);
      await applySnapshot(snapshot);
      await reloadEverything();
      await loadBackups();
      setBackupMessage("Restore from file complete.");
    } catch (e) {
      setBackupMessage("Restore failed: " + (e.message || "invalid backup file"));
    } finally {
      setBackupBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="gfc-app" style={{ alignItems: "center", justifyContent: "center" }}>
        <style>{GLOBAL_CSS}</style>
        <div style={{ color: T.indigo, fontFamily: "'Anton', sans-serif" }}>LOADING SQUAD…</div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="gfc-app" style={{ alignItems: "center", justifyContent: "center" }}>
        <style>{GLOBAL_CSS}</style>
        <div style={{ maxWidth: 420, textAlign: "center", padding: 24 }}>
          <div className="gfc-display" style={{ color: T.danger, fontSize: 20, marginBottom: 10 }}>Couldn't reach the database</div>
          <div style={{ color: T.inkSoft, fontSize: 13, marginBottom: 16 }}>{loadError}</div>
          <div style={{ color: T.inkSoft, fontSize: 12, marginBottom: 16 }}>
            Check that VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set correctly in your .env file, and that schema.sql has been run in your Supabase project.
          </div>
          <button className="gfc-btn gfc-btn-primary" onClick={loadPlayers}>Try again</button>
        </div>
      </div>
    );
  }

  const ledgerPlayer = ledgerPlayerId ? enriched.find((p) => p.id === ledgerPlayerId) : null;

  return (
    <div className="gfc-app">
      <style>{GLOBAL_CSS}</style>

      {/* SIDEBAR */}
      <aside className="gfc-sidebar">
        <div className="gfc-crest-wrap">
          <img src={BADGE_SRC} alt={`${CLUB_NAME} crest`} />
          <div className="gfc-club-name gfc-display">{CLUB_NAME}</div>
          <div className="gfc-club-sub">Club Management</div>
        </div>
        <nav className="gfc-nav">
          {[
            { id: "dashboard", label: "Dashboard", icon: "◆" },
            { id: "squad", label: "Squad", icon: "▤" },
            { id: "subscriptions", label: "Subscriptions", icon: "$" },
            { id: "matchday", label: "Matchday", icon: "⚽" },
            { id: "kit", label: "Kit", icon: "▦" },
            { id: "backups", label: "Backups", icon: "⟳" },
            { id: "messages", label: "Messages", icon: "✉" },
          ].map((n) => (
            <button
              key={n.id}
              className={`gfc-nav-item ${tab === n.id ? "active" : ""}`}
              onClick={() => setTab(n.id)}
            >
              <span className="gfc-nav-icon">{n.icon}</span>
              {n.label}
            </button>
          ))}
        </nav>
        <div className="gfc-sidebar-foot">
          {saveError ? "⚠ Last change didn't save — check connection" : "Connected to Supabase"}
        </div>
      </aside>

      {/* MAIN */}
      <main className="gfc-main">
        {tab === "dashboard" && (
          <DashboardView stats={stats} enriched={enriched} onGoSquad={(status) => { setTab("squad"); setStatusFilter(status); setAgeFilter("All"); }} />
        )}

        {tab === "squad" && (
          <SquadView
            filtered={filtered}
            ageGroups={ageGroups}
            ageFilter={ageFilter}
            setAgeFilter={setAgeFilter}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            search={search}
            setSearch={setSearch}
            onAdd={() => setEditingPlayer("new")}
            onEdit={(p) => setEditingPlayer(p)}
            onOpenLedger={(p) => setLedgerPlayerId(p.id)}
          />
        )}

        {tab === "subscriptions" && (
          <SubscriptionsView
            enriched={enriched}
            tiers={tiers}
            onOpenLedger={(p) => setLedgerPlayerId(p.id)}
            onManageTiers={() => setManagingTiers(true)}
          />
        )}

        {tab === "matchday" && (
          <MatchdayView
            matches={matches}
            enriched={enriched}
            ageGroups={ageGroups}
            activeMatchId={activeMatchId}
            setActiveMatchId={setActiveMatchId}
            squad={matchSquads[activeMatchId] || []}
            onAddMatch={() => setEditingMatch("new")}
            onEditMatch={(m) => setEditingMatch(m)}
            onSetSlot={setSquadSlot}
            onUpdateJersey={updateSquadJersey}
          />
        )}

        {tab === "kit" && (
          <KitView
            inventory={inventory}
            issuedItems={issuedItems}
            enriched={enriched}
            onAddItem={() => setEditingItem("new")}
            onEditItem={(i) => setEditingItem(i)}
            onIssue={issueItem}
            onReturn={returnItem}
          />
        )}

        {tab === "backups" && (
          <BackupsView
            backups={backupsList}
            onRefresh={loadBackups}
            onBackupNow={runManualBackup}
            onRestore={restoreFromSnapshot}
            onDownload={downloadSnapshot}
            onRestoreFromFile={restoreFromUploadedFile}
            busy={backupBusy}
            lastMessage={backupMessage}
          />
        )}

        {tab === "messages" && (
          <MessagesView
            enriched={enriched}
            ageGroups={ageGroups}
            selectedIds={selectedIds}
            setSelectedIds={setSelectedIds}
            templateId={templateId}
            setTemplateId={setTemplateId}
            customText={customText}
            setCustomText={setCustomText}
          />
        )}
      </main>

      {/* MODALS */}
      {editingPlayer && (
        <PlayerModal
          player={editingPlayer === "new" ? null : editingPlayer}
          tiers={tiers}
          onClose={() => setEditingPlayer(null)}
          onSave={savePlayer}
          onDelete={deletePlayer}
          onManageTiers={() => setManagingTiers(true)}
        />
      )}

      {ledgerPlayer && (
        <LedgerModal
          player={ledgerPlayer}
          onClose={() => setLedgerPlayerId(null)}
          onAddPayment={(payment) => addPayment(ledgerPlayer.id, payment)}
          onRemovePayment={(paymentId) => removePayment(ledgerPlayer.id, paymentId)}
        />
      )}

      {managingTiers && (
        <TierManagerModal
          tiers={tiers}
          onClose={() => setManagingTiers(false)}
          onAdd={() => setEditingTier("new")}
          onEdit={(t) => setEditingTier(t)}
        />
      )}

      {editingTier && (
        <TierModal
          tier={editingTier === "new" ? null : editingTier}
          onClose={() => setEditingTier(null)}
          onSave={saveTier}
          onDelete={deleteTier}
        />
      )}

      {editingMatch && (
        <MatchModal
          match={editingMatch === "new" ? null : editingMatch}
          players={players}
          ageGroups={ageGroups}
          onClose={() => setEditingMatch(null)}
          onSave={saveMatch}
          onDelete={deleteMatch}
        />
      )}

      {editingItem && (
        <ItemModal
          item={editingItem === "new" ? null : editingItem}
          onClose={() => setEditingItem(null)}
          onSave={saveItem}
          onDelete={deleteItem}
        />
      )}
    </div>
  );
}
/* ---------- DASHBOARD ---------- */

function DashboardView({ stats, enriched, onGoSquad }) {
  const worstOwed = [...enriched].filter((p) => p.balance > 0).sort((a, b) => b.balance - a.balance).slice(0, 5);

  return (
    <div>
      <div className="gfc-topbar">
        <div>
          <div className="gfc-page-title gfc-display">Dashboard</div>
          <div className="gfc-page-sub">Club snapshot, {fmtDate(todayISO())}</div>
        </div>
      </div>

      <div className="gfc-stat-row">
        <div className="gfc-stat">
          <div className="gfc-stat-accent" style={{ background: T.indigo }} />
          <div className="gfc-stat-label">Registered players</div>
          <div className="gfc-stat-value gfc-mono">{stats.total}</div>
        </div>
        <div className="gfc-stat">
          <div className="gfc-stat-accent" style={{ background: T.danger }} />
          <div className="gfc-stat-label">Total owed</div>
          <div className="gfc-stat-value gfc-mono">{fmtMoney(stats.totalOwed)}</div>
        </div>
        <div className="gfc-stat" style={{ cursor: "pointer" }} onClick={() => onGoSquad("green")}>
          <div className="gfc-stat-accent" style={{ background: T.green }} />
          <div className="gfc-stat-label">Compliant</div>
          <div className="gfc-stat-value gfc-mono">{stats.compliant}</div>
        </div>
        <div className="gfc-stat" style={{ cursor: "pointer" }} onClick={() => onGoSquad("amber")}>
          <div className="gfc-stat-accent" style={{ background: T.amber }} />
          <div className="gfc-stat-label">Payment due</div>
          <div className="gfc-stat-value gfc-mono">{stats.dueSoon}</div>
        </div>
        <div className="gfc-stat" style={{ cursor: "pointer" }} onClick={() => onGoSquad("red")}>
          <div className="gfc-stat-accent" style={{ background: T.danger }} />
          <div className="gfc-stat-label">Non-compliant</div>
          <div className="gfc-stat-value gfc-mono">{stats.nonCompliant}</div>
        </div>
      </div>

      <div className="gfc-panel">
        <div className="gfc-panel-head">
          <div className="gfc-panel-title">Biggest outstanding balances</div>
        </div>
        {worstOwed.length === 0 ? (
          <div className="gfc-empty">
            <div className="gfc-empty-title gfc-display">All settled up</div>
            No players currently owe a subscription balance.
          </div>
        ) : (
          <table className="gfc-table">
            <thead>
              <tr>
                <th>Player</th>
                <th>Age group</th>
                <th>Owed</th>
                <th>Compliance</th>
              </tr>
            </thead>
            <tbody>
              {worstOwed.map((p) => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 600 }}>{p.name}</td>
                  <td><span className="gfc-agepill">{p.ageGroup}</span></td>
                  <td className="gfc-mono" style={{ color: T.danger, fontWeight: 700 }}>{fmtMoney(p.balance)}</td>
                  <td><Badge status={p.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
/* ---------- SQUAD (ROSTER + AGE GROUPS) ---------- */

function SquadView({ filtered, ageGroups, ageFilter, setAgeFilter, statusFilter, setStatusFilter, search, setSearch, onAdd, onEdit, onOpenLedger }) {
  const [viewMode, setViewMode] = useState("cards"); // 'cards' or 'list'

  return (
    <div>
      <div className="gfc-topbar">
        <div>
          <div className="gfc-page-title gfc-display">Squad</div>
          <div className="gfc-page-sub">{filtered.length} player{filtered.length === 1 ? "" : "s"} shown</div>
        </div>
        <button className="gfc-btn gfc-btn-primary" onClick={onAdd}>+ Add player</button>
      </div>

      <div className="gfc-filters" style={{ marginBottom: 16, justifyContent: "space-between" }}>
        <div className="gfc-filters">
          <input
            className="gfc-input"
            style={{ maxWidth: 220 }}
            placeholder="Search by name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select className="gfc-select" style={{ maxWidth: 160 }} value={ageFilter} onChange={(e) => setAgeFilter(e.target.value)}>
            {ageGroups.map((g) => <option key={g} value={g}>{g === "All" ? "All age groups" : g}</option>)}
          </select>
          <select className="gfc-select" style={{ maxWidth: 170 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="All">All compliance</option>
            <option value="green">Compliant</option>
            <option value="amber">Payment due</option>
            <option value="red">Non-compliant</option>
          </select>
        </div>
        <div style={{ display: "flex", gap: 4, background: T.paperDim, borderRadius: 8, padding: 3 }}>
          <button
            className="gfc-btn gfc-btn-sm"
            style={{ background: viewMode === "cards" ? "#fff" : "transparent", color: T.ink, boxShadow: viewMode === "cards" ? "0 1px 3px rgba(0,0,0,0.12)" : "none" }}
            onClick={() => setViewMode("cards")}
          >
            ▤ Cards
          </button>
          <button
            className="gfc-btn gfc-btn-sm"
            style={{ background: viewMode === "list" ? "#fff" : "transparent", color: T.ink, boxShadow: viewMode === "list" ? "0 1px 3px rgba(0,0,0,0.12)" : "none" }}
            onClick={() => setViewMode("list")}
          >
            ☰ List
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="gfc-panel">
          <div className="gfc-empty">
            <div className="gfc-empty-title gfc-display">No players found</div>
            Try adjusting the filters, or add a new player to the squad.
          </div>
        </div>
      ) : viewMode === "cards" ? (
        <div className="gfc-squad-grid">
          {filtered.map((p) => (
            <div key={p.id} className="gfc-card" onClick={() => onEdit(p)}>
              <div className="gfc-card-ribbon" style={{ borderColor: `${STATUS_COLOR[p.status]} transparent transparent ${STATUS_COLOR[p.status]}` }} />
              <div className="gfc-card-name">{p.name}</div>
              <div className="gfc-card-meta">{p.phone || "No contact number"}</div>
              <div className="gfc-card-meta" style={{ marginTop: 2 }}>Joined {fmtDate(p.joinDate)}</div>
              <div className="gfc-card-meta" style={{ marginTop: 2, color: p.regNo ? T.inkSoft : T.amber, fontWeight: p.regNo ? 400 : 700 }}>
                {p.regNo ? `Reg No: ${p.regNo}` : "Pending federation number"}
              </div>
              <div className="gfc-card-foot">
                <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <span className="gfc-agepill">{p.ageGroup}</span>
                  {p.over40 && <span className="gfc-agepill" style={{ background: T.goldDeep }}>Over 40</span>}
                </span>
                <span className="gfc-card-balance" style={{ color: p.balance > 0 ? T.danger : T.green }}>
                  {p.balance > 0 ? fmtMoney(p.balance) + " due" : "Paid up"}
                </span>
              </div>
              <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Badge status={p.status} />
                <button
                  className="gfc-btn gfc-btn-ghost gfc-btn-sm"
                  onClick={(e) => { e.stopPropagation(); onOpenLedger(p); }}
                >
                  View ledger →
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="gfc-panel">
          <table className="gfc-table">
            <thead>
              <tr>
                <th>Player</th>
                <th>Age group</th>
                <th>Reg no</th>
                <th>Phone</th>
                <th>Tier</th>
                <th>Balance</th>
                <th>Compliance</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="clickable" onClick={() => onEdit(p)}>
                  <td style={{ fontWeight: 600 }}>{p.name}</td>
                  <td>
                    <span style={{ display: "flex", gap: 5, alignItems: "center" }}>
                      <span className="gfc-agepill">{p.ageGroup}</span>
                      {p.over40 && <span className="gfc-agepill" style={{ background: T.goldDeep }}>O40</span>}
                    </span>
                  </td>
                  <td style={{ color: p.regNo ? T.ink : T.amber, fontWeight: p.regNo ? 400 : 700 }}>{p.regNo || "Pending"}</td>
                  <td>{p.phone || "—"}</td>
                  <td>{p.tierName || <span style={{ color: T.amber, fontWeight: 700 }}>No tier</span>}</td>
                  <td className="gfc-mono" style={{ fontWeight: 700, color: p.balance > 0 ? T.danger : T.green }}>{fmtMoney(p.balance)}</td>
                  <td><Badge status={p.status} /></td>
                  <td>
                    <button className="gfc-btn gfc-btn-outline gfc-btn-sm" onClick={(e) => { e.stopPropagation(); onOpenLedger(p); }}>Ledger</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
/* ---------- SUBSCRIPTIONS ---------- */

function SubscriptionsView({ enriched, tiers, onOpenLedger, onManageTiers }) {
  const sorted = [...enriched].sort((a, b) => b.balance - a.balance);
  const totalDue = enriched.reduce((s, p) => s + p.due, 0);
  const totalPaid = enriched.reduce((s, p) => s + p.paid, 0);
  const totalOutstanding = enriched.reduce((s, p) => s + Math.max(0, p.balance), 0);

  return (
    <div>
      <div className="gfc-topbar">
        <div>
          <div className="gfc-page-title gfc-display">Subscriptions</div>
          <div className="gfc-page-sub">Season runs January–October · fees, payments, and running balances</div>
        </div>
        <button className="gfc-btn gfc-btn-outline" onClick={onManageTiers}>Manage tiers</button>
      </div>

      <div className="gfc-stat-row">
        <div className="gfc-stat">
          <div className="gfc-stat-accent" style={{ background: T.indigo }} />
          <div className="gfc-stat-label">Total billed to date</div>
          <div className="gfc-stat-value gfc-mono">{fmtMoney(totalDue)}</div>
        </div>
        <div className="gfc-stat">
          <div className="gfc-stat-accent" style={{ background: T.green }} />
          <div className="gfc-stat-label">Total collected</div>
          <div className="gfc-stat-value gfc-mono">{fmtMoney(totalPaid)}</div>
        </div>
        <div className="gfc-stat">
          <div className="gfc-stat-accent" style={{ background: T.danger }} />
          <div className="gfc-stat-label">Outstanding</div>
          <div className="gfc-stat-value gfc-mono">{fmtMoney(totalOutstanding)}</div>
        </div>
      </div>

      <div className="gfc-panel">
        <div className="gfc-panel-head">
          <div className="gfc-panel-title">Player balances</div>
        </div>
        {sorted.length === 0 ? (
          <div className="gfc-empty">
            <div className="gfc-empty-title gfc-display">No players yet</div>
            Add players from the Squad tab to start tracking subscriptions.
          </div>
        ) : (
          <table className="gfc-table">
            <thead>
              <tr>
                <th>Player</th>
                <th>Age group</th>
                <th>Tier</th>
                <th>Billed to date</th>
                <th>Paid</th>
                <th>Balance</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((p) => (
                <tr key={p.id} className="clickable" onClick={() => onOpenLedger(p)}>
                  <td style={{ fontWeight: 600 }}>{p.name}</td>
                  <td><span className="gfc-agepill">{p.ageGroup}</span></td>
                  <td>{p.tierName ? `${p.tierName} (${fmtMoney(p.fee)}/mo)` : <span style={{ color: T.amber, fontWeight: 700 }}>No tier set</span>}</td>
                  <td className="gfc-mono">{fmtMoney(p.due)}</td>
                  <td className="gfc-mono">{fmtMoney(p.paid)}</td>
                  <td className="gfc-mono" style={{ fontWeight: 700, color: p.balance > 0 ? T.danger : T.green }}>
                    {fmtMoney(p.balance)}
                  </td>
                  <td><Badge status={p.status} /></td>
                  <td><button className="gfc-btn gfc-btn-outline gfc-btn-sm" onClick={(e) => { e.stopPropagation(); onOpenLedger(p); }}>Ledger</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
/* ---------- MESSAGES ---------- */

function MessagesView({ enriched, ageGroups, selectedIds, setSelectedIds, templateId, setTemplateId, customText, setCustomText }) {
  const [msgAgeFilter, setMsgAgeFilter] = useState("All");
  const [msgStatusFilter, setMsgStatusFilter] = useState("All");

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
                <Badge status={p.status} />
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
        </div>
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
/* ---------- PLAYER MODAL (add/edit) ---------- */

function PlayerModal({ player, tiers, onClose, onSave, onDelete, onManageTiers }) {
  const [form, setForm] = useState(() => ({
    id: player?.id || "",
    name: player?.name || "",
    dob: player?.dob || "",
    ageGroupOverride: player?.ageGroupOverride || "",
    phone: player?.phone || "",
    email: player?.email || "",
    guardianName: player?.guardianName || "",
    guardianPhone: player?.guardianPhone || "",
    joinDate: player?.joinDate || todayISO(),
    tierId: player?.tierId || "",
    documentsComplete: player?.documentsComplete ?? false,
    notes: player?.notes || "",
    regNo: player?.regNo || "",
    squadNumber: player?.squadNumber ?? "",
  }));
  const [regNoError, setRegNoError] = useState("");

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setRegNoError("");
    const err = await onSave(form);
    if (err) setRegNoError(err);
  }

  const previewAgeGroup = form.ageGroupOverride || computeAgeGroup(form.dob);

  return (
    <div className="gfc-modal-backdrop" onClick={onClose}>
      <div className="gfc-modal" onClick={(e) => e.stopPropagation()}>
        <div className="gfc-modal-head">
          <div className="gfc-modal-title gfc-display">{player ? "Edit player" : "Add player"}</div>
          <button className="gfc-modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="gfc-field">
            <label className="gfc-label">Full name</label>
            <input className="gfc-input" value={form.name} onChange={(e) => update("name", e.target.value)} required />
          </div>

          <div className="gfc-row2">
            <div className="gfc-field">
              <label className="gfc-label">Date of birth</label>
              <input type="date" className="gfc-input" value={form.dob} onChange={(e) => update("dob", e.target.value)} />
            </div>
            <div className="gfc-field">
              <label className="gfc-label">Age group {form.dob && <span style={{ color: T.inkSoft, fontWeight: 400, textTransform: "none" }}>(auto: {computeAgeGroup(form.dob)})</span>}</label>
              <input className="gfc-input" placeholder="Override e.g. U11" value={form.ageGroupOverride} onChange={(e) => update("ageGroupOverride", e.target.value)} />
            </div>
          </div>

          <div className="gfc-row2">
            <div className="gfc-field">
              <label className="gfc-label">Player phone</label>
              <input className="gfc-input" placeholder="+27 82 000 0000" value={form.phone} onChange={(e) => update("phone", e.target.value)} />
            </div>
            <div className="gfc-field">
              <label className="gfc-label">Email</label>
              <input type="email" className="gfc-input" value={form.email} onChange={(e) => update("email", e.target.value)} />
            </div>
          </div>

          <div className="gfc-row2">
            <div className="gfc-field">
              <label className="gfc-label">Guardian name</label>
              <input className="gfc-input" value={form.guardianName} onChange={(e) => update("guardianName", e.target.value)} />
            </div>
            <div className="gfc-field">
              <label className="gfc-label">Guardian phone</label>
              <input className="gfc-input" placeholder="Used for messages if set" value={form.guardianPhone} onChange={(e) => update("guardianPhone", e.target.value)} />
            </div>
          </div>

          <div className="gfc-row2">
            <div className="gfc-field">
              <label className="gfc-label">Club join date <span style={{ fontWeight: 400, textTransform: "none", color: T.inkSoft }}>(tenure/service record — also sets first season's pro-rated start)</span></label>
              <input type="date" className="gfc-input" value={form.joinDate} onChange={(e) => update("joinDate", e.target.value)} />
            </div>
            <div className="gfc-field">
              <label className="gfc-label">Subscription tier</label>
              <select className="gfc-select" value={form.tierId} onChange={(e) => update("tierId", e.target.value)}>
                <option value="">No tier assigned</option>
                {tiers.map((t) => <option key={t.id} value={t.id}>{t.name} — {fmtMoney(t.monthlyFee)}/mo</option>)}
              </select>
              <button type="button" className="gfc-btn gfc-btn-ghost gfc-btn-sm" style={{ paddingLeft: 0, marginTop: 4 }} onClick={onManageTiers}>Manage tiers →</button>
            </div>
          </div>

          <div className="gfc-row2">
            <div className="gfc-field">
              <label className="gfc-label">Federation reg. no</label>
              <input
                className="gfc-input"
                placeholder="Assigned once federation registers player"
                value={form.regNo}
                onChange={(e) => { update("regNo", e.target.value); setRegNoError(""); }}
              />
              {regNoError && <div style={{ color: T.danger, fontSize: 11.5, marginTop: 4 }}>{regNoError}</div>}
              {!form.regNo && !regNoError && (
                <div style={{ color: T.amber, fontSize: 11.5, marginTop: 4 }}>Pending federation number</div>
              )}
            </div>
            <div className="gfc-field">
              <label className="gfc-label">Usual squad number</label>
              <input type="number" min="0" className="gfc-input" placeholder="e.g. 9" value={form.squadNumber} onChange={(e) => update("squadNumber", e.target.value)} />
            </div>
          </div>

          <div className="gfc-field gfc-check-row">
            <input type="checkbox" id="docs" checked={form.documentsComplete} onChange={(e) => update("documentsComplete", e.target.checked)} />
            <label htmlFor="docs">Registration paperwork / medical form complete</label>
          </div>

          <div className="gfc-field">
            <label className="gfc-label">Notes</label>
            <textarea className="gfc-textarea" rows={2} value={form.notes} onChange={(e) => update("notes", e.target.value)} />
          </div>

          <div style={{ fontSize: 11.5, color: T.inkSoft }}>
            Will appear under <span className="gfc-agepill" style={{ marginLeft: 4 }}>{previewAgeGroup}</span>
          </div>

          <div className="gfc-modal-actions">
            {player && (
              <button type="button" className="gfc-btn gfc-btn-danger" style={{ marginRight: "auto" }} onClick={() => onDelete(player.id)}>
                Remove player
              </button>
            )}
            <button type="button" className="gfc-btn gfc-btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="gfc-btn gfc-btn-primary">Save player</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ---------- LEDGER MODAL (payments) ---------- */

function LedgerModal({ player, onClose, onAddPayment, onRemovePayment }) {
  const [amount, setAmount] = useState(player.fee || "");
  const [date, setDate] = useState(todayISO());
  const [method, setMethod] = useState("EFT");

  function handleAdd(e) {
    e.preventDefault();
    const amt = Number(amount);
    if (!amt || amt <= 0) return;
    onAddPayment({ amount: amt, date, method });
    setAmount(player.fee || "");
  }

  const payments = [...(player.payments || [])].sort((a, b) => new Date(b.date) - new Date(a.date));

  return (
    <div className="gfc-modal-backdrop" onClick={onClose}>
      <div className="gfc-modal" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
        <div className="gfc-modal-head">
          <div>
            <div className="gfc-modal-title gfc-display">{player.name}</div>
            <div style={{ fontSize: 12, color: T.inkSoft }}>{player.ageGroup} · {player.tierName ? `${player.tierName} · ${fmtMoney(player.fee)}/month` : "No tier assigned"}</div>
          </div>
          <button className="gfc-modal-close" onClick={onClose}>×</button>
        </div>

        <div className="gfc-stat-row" style={{ marginBottom: 18, gridTemplateColumns: "repeat(3, 1fr)" }}>
          <div className="gfc-stat" style={{ padding: "12px 14px" }}>
            <div className="gfc-stat-label">Billed</div>
            <div className="gfc-stat-value gfc-mono" style={{ fontSize: 18 }}>{fmtMoney(player.due)}</div>
          </div>
          <div className="gfc-stat" style={{ padding: "12px 14px" }}>
            <div className="gfc-stat-label">Paid</div>
            <div className="gfc-stat-value gfc-mono" style={{ fontSize: 18 }}>{fmtMoney(player.paid)}</div>
          </div>
          <div className="gfc-stat" style={{ padding: "12px 14px" }}>
            <div className="gfc-stat-label">Balance</div>
            <div className="gfc-stat-value gfc-mono" style={{ fontSize: 18, color: player.balance > 0 ? T.danger : T.green }}>{fmtMoney(player.balance)}</div>
          </div>
        </div>

        <form onSubmit={handleAdd} className="gfc-row2" style={{ gridTemplateColumns: "1fr 1fr 1fr auto", alignItems: "end", gap: 8, marginBottom: 16 }}>
          <div className="gfc-field" style={{ marginBottom: 0 }}>
            <label className="gfc-label">Amount (R)</label>
            <input type="number" min="0" step="10" className="gfc-input" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="gfc-field" style={{ marginBottom: 0 }}>
            <label className="gfc-label">Date</label>
            <input type="date" className="gfc-input" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="gfc-field" style={{ marginBottom: 0 }}>
            <label className="gfc-label">Method</label>
            <select className="gfc-select" value={method} onChange={(e) => setMethod(e.target.value)}>
              <option>EFT</option>
              <option>Cash</option>
              <option>Card</option>
              <option>Other</option>
            </select>
          </div>
          <button type="submit" className="gfc-btn gfc-btn-primary">Log payment</button>
        </form>

        <div className="gfc-panel-title" style={{ marginBottom: 8 }}>Payment history</div>
        {payments.length === 0 ? (
          <div className="gfc-empty">No payments logged yet.</div>
        ) : (
          <table className="gfc-table">
            <thead>
              <tr><th>Date</th><th>Method</th><th>Amount</th><th></th></tr>
            </thead>
            <tbody>
              {payments.map((pm) => (
                <tr key={pm.id}>
                  <td>{fmtDate(pm.date)}</td>
                  <td>{pm.method}</td>
                  <td className="gfc-mono">{fmtMoney(pm.amount)}</td>
                  <td><button className="gfc-btn gfc-btn-ghost gfc-btn-sm" onClick={() => onRemovePayment(pm.id)}>Remove</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="gfc-modal-actions">
          <button className="gfc-btn gfc-btn-outline" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

/* ---------- OFFICIAL TEAM SHEET GENERATOR ---------- */

function splitName(fullName) {
  const parts = (fullName || "").trim().split(/\s+/);
  if (parts.length === 1) return { first: "", surname: parts[0] || "" };
  const surname = parts[parts.length - 1];
  const first = parts.slice(0, -1).join(" ");
  return { first, surname };
}

function fmtDDMMYY(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d)) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear());
  return `${dd}/${mm}/${yy}`;
}

function buildTeamSheetHTML(match, squadRows, players) {
  const captain = players.find((p) => p.id === match.captainPlayerId);

  // The printed form always labels the HOME side "TEAM SHEET OF" and the
  // AWAY side "OPPONENTS", regardless of which club is filling it in.
  const homeName = match.homeAway === "H" ? match.homeTeam : match.opponent;
  const awayName = match.homeAway === "H" ? match.opponent : match.homeTeam;

  const starters = Array.from({ length: 11 }, (_, i) => squadRows.find((r) => r.slotNo === i + 1) || null);
  const subs = Array.from({ length: 9 }, (_, i) => squadRows.find((r) => r.slotNo === i + 12) || null);

  function playerRow(rowNum, squadRow) {
    const p = squadRow?.player;
    const { first, surname } = splitName(p?.name);
    const regNo = p?.regNo || "";
    return `
      <tr>
        <td class="num">${rowNum}</td>
        <td class="jersey">${squadRow?.jerseyNo || ""}</td>
        <td class="name-cell">${surname}</td>
        <td class="name-cell">${first}</td>
        <td class="reg-cell">${regNo}</td>
        <td class="small"></td>
        <td class="small"></td>
        <td class="small"></td>
        <td class="small"></td>
      </tr>`;
  }

  const starterRows = starters.map((r, i) => playerRow(i + 1, r)).join("");
  const subRows = subs.map((r, i) => playerRow(i + 12, r)).join("");

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Team Sheet - ${match.opponent || "Fixture"}</title>
<style>
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #111; font-size: 12px; }
  table { border-collapse: collapse; width: 100%; }
  td, th { border: 1.5px solid #111; padding: 4px 6px; vertical-align: middle; }
  .title-row td { text-align: center; font-weight: bold; font-size: 16px; background: #e5e5e5; padding: 8px; }
  .label { font-weight: bold; font-size: 10.5px; text-transform: uppercase; white-space: nowrap; }
  .side-letter { font-weight: bold; font-size: 15px; text-align: center; width: 22px; }
  .value-cell { font-size: 13px; }
  .header-table td { height: 26px; }
  .player-table th { background: #e5e5e5; text-transform: uppercase; font-size: 10.5px; text-align: center; }
  .player-table td.num { text-align: center; font-weight: bold; width: 26px; }
  .player-table td.jersey { text-align: center; width: 40px; }
  .player-table td.reg-cell { width: 80px; }
  .player-table td.small { width: 30px; }
  .name-cell { min-width: 120px; }
  .sub-header td { text-align: center; font-weight: bold; background: #e5e5e5; text-transform: uppercase; }
  .footer-table td { padding: 8px 6px; }
  .sig-line { display: inline-block; border-bottom: 1px solid #111; min-width: 160px; height: 18px; }
  .print-btn { margin: 14px 0; padding: 8px 16px; font-weight: bold; cursor: pointer; }
  @media print { .print-btn { display: none; } }
</style>
</head>
<body>

<button class="print-btn" onclick="window.print()">Print this sheet</button>

<table>
  <tr class="title-row"><td colspan="4">${match.leagueName || "Official Team Sheet"} &ndash; Official Team Sheet</td></tr>
</table>

<table class="header-table" style="margin-top:-1.5px;">
  <tr>
    <td class="side-letter">H</td>
    <td class="label" style="width:130px;">Team Sheet Of:</td>
    <td class="value-cell" colspan="2">${homeName}</td>
    <td class="label" style="width:110px;">Half Time Score</td>
    <td style="width:60px;"></td>
    <td class="label" style="width:110px;">Full Time Score</td>
    <td style="width:60px;"></td>
  </tr>
  <tr>
    <td class="side-letter">A</td>
    <td class="label">Opponents:</td>
    <td class="value-cell" colspan="2">${awayName}</td>
    <td class="label">Half Time Score</td>
    <td></td>
    <td class="label">Full Time Score</td>
    <td></td>
  </tr>
  <tr>
    <td colspan="2" class="label">Venue &amp; Field:</td>
    <td class="value-cell" colspan="2">${match.venue || ""}</td>
    <td class="label" colspan="2">Referee</td>
    <td class="value-cell" colspan="2">${match.refereeName || ""}</td>
  </tr>
  <tr>
    <td colspan="2" class="label">Date (DD/MM/YY):</td>
    <td class="value-cell" colspan="2">${fmtDDMMYY(match.matchDate)}</td>
    <td class="label" colspan="2">Assistant Ref (1)</td>
    <td class="value-cell" colspan="2">${match.assistantRef1 || ""}</td>
  </tr>
  <tr>
    <td colspan="2" class="label">Time:</td>
    <td class="value-cell" colspan="2">${match.kickoffTime || ""}</td>
    <td class="label" colspan="2">Assistant Ref (2)</td>
    <td class="value-cell" colspan="2">${match.assistantRef2 || ""}</td>
  </tr>
  <tr>
    <td colspan="2" class="label">Division:</td>
    <td class="value-cell" colspan="2">${match.division || ""}</td>
    <td class="label" colspan="2">Competition</td>
    <td class="value-cell" colspan="2">${match.competition || ""}</td>
  </tr>
  <tr>
    <td class="label" colspan="2">Corner Flags (Yes/No)</td>
    <td class="value-cell">${match.cornerFlags || ""}</td>
    <td class="label">Field Conditions</td>
    <td class="value-cell">${match.fieldConditions || ""}</td>
    <td class="label">Field Marking</td>
    <td class="value-cell" colspan="2">${match.fieldMarking || ""} &nbsp;|&nbsp; First Aid: ${match.firstAidPresent || ""}</td>
  </tr>
</table>

<table class="player-table" style="margin-top:10px;">
  <tr>
    <th style="width:26px;">No</th>
    <th style="width:40px;">Jersey No</th>
    <th>Surname</th>
    <th>First Name</th>
    <th style="width:80px;">Reg No</th>
    <th style="width:30px;">GS</th>
    <th style="width:30px;">YC</th>
    <th style="width:30px;">RC</th>
    <th style="width:30px;">INJ</th>
  </tr>
  ${starterRows}
  <tr class="sub-header"><td colspan="9">Substitutes</td></tr>
  ${subRows}
</table>

<table class="footer-table" style="margin-top:10px;">
  <tr>
    <td class="label" style="width:25%;">Coach Name / Surname &amp; Reg No:</td>
    <td style="width:25%;">${match.coachName || ""} ${match.coachRegNo ? "(" + match.coachRegNo + ")" : ""}</td>
    <td class="label" style="width:25%;">Captain Name &amp; Surname &amp; Reg No:</td>
    <td style="width:25%;">${captain ? captain.name : ""} ${captain?.regNo ? "(" + captain.regNo + ")" : ""}</td>
  </tr>
  <tr>
    <td class="label">Manager Name / Surname &amp; Reg No:</td>
    <td>${match.managerName || ""} ${match.managerRegNo ? "(" + match.managerRegNo + ")" : ""}</td>
    <td class="label">Physio / First Aider Name &amp; Reg No:</td>
    <td>${match.physioName || ""} ${match.physioRegNo ? "(" + match.physioRegNo + ")" : ""}</td>
  </tr>
  <tr>
    <td class="label">Signature of Coach/Manager:</td>
    <td><span class="sig-line"></span></td>
    <td class="label">Signature of Referee:</td>
    <td><span class="sig-line"></span></td>
  </tr>
</table>

<table class="footer-table" style="margin-top:10px;">
  <tr><td class="label" style="width:20%;">Substitutions</td><td>1- No In: _______  No Out: _______ &nbsp;&nbsp; 2- No In: _______  No Out: _______ &nbsp;&nbsp; 3- No In: _______  No Out: _______</td></tr>
  <tr><td></td><td>4- No In: _______  No Out: _______ &nbsp;&nbsp; 5- No In: _______  No Out: _______ &nbsp;&nbsp; C- No In: _______  No Out: _______</td></tr>
  <tr><td class="label">Comments:</td><td>${match.comments || ""}</td></tr>
</table>

</body>
</html>`;
}

function printTeamSheet(match, squadRows, players) {
  const html = buildTeamSheetHTML(match, squadRows, players);
  const w = window.open("", "_blank");
  if (!w) {
    alert("Please allow pop-ups for this site to print the team sheet.");
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
}

/* ---------- MATCHDAY ---------- */

function MatchdayView({ matches, enriched, ageGroups, activeMatchId, setActiveMatchId, squad, onAddMatch, onEditMatch, onSetSlot, onUpdateJersey }) {
  const activeMatch = matches.find((m) => m.id === activeMatchId) || null;
  const [rosterAgeFilter, setRosterAgeFilter] = useState("All");

  const rosterPool = useMemo(() => {
    return enriched.filter((p) => rosterAgeFilter === "All" || p.ageGroup === rosterAgeFilter);
  }, [enriched, rosterAgeFilter]);

  const takenPlayerIds = new Set(squad.map((r) => r.playerId));

  function slotRow(slotNo, role) {
    const row = squad.find((r) => r.slotNo === slotNo);
    return (
      <div key={slotNo} className="gfc-send-row" style={{ gap: 8 }}>
        <div style={{ width: 22, fontWeight: 700, color: T.inkSoft }}>{slotNo}</div>
        <select
          className="gfc-select"
          style={{ flex: 1 }}
          value={row?.playerId || ""}
          onChange={(e) => {
            const player = enriched.find((p) => p.id === e.target.value) || null;
            onSetSlot(activeMatch.id, slotNo, role, player);
          }}
        >
          <option value="">— empty —</option>
          {rosterPool
            .filter((p) => p.id === row?.playerId || !takenPlayerIds.has(p.id))
            .map((p) => (
              <option key={p.id} value={p.id}>{p.name}{p.regNo ? "" : " (no reg no)"}</option>
            ))}
        </select>
        <input
          className="gfc-input"
          style={{ width: 60, textAlign: "center" }}
          placeholder="No."
          value={row?.jerseyNo || ""}
          disabled={!row}
          onChange={(e) => row && onUpdateJersey(activeMatch.id, row.id, e.target.value)}
        />
      </div>
    );
  }

  return (
    <div>
      <div className="gfc-topbar">
        <div>
          <div className="gfc-page-title gfc-display">Matchday</div>
          <div className="gfc-page-sub">Build your squad and print the official team sheet</div>
        </div>
        <button className="gfc-btn gfc-btn-primary" onClick={onAddMatch}>+ New fixture</button>
      </div>

      <div className="gfc-row2" style={{ alignItems: "flex-start", gridTemplateColumns: "260px 1fr" }}>
        <div className="gfc-panel" style={{ padding: 0 }}>
          <div className="gfc-panel-head"><div className="gfc-panel-title">Fixtures</div></div>
          {matches.length === 0 ? (
            <div className="gfc-empty">No fixtures yet. Add one to get started.</div>
          ) : (
            <div>
              {matches.map((m) => (
                <div
                  key={m.id}
                  onClick={() => setActiveMatchId(m.id)}
                  style={{
                    padding: "10px 14px",
                    borderBottom: `1px solid ${T.line}`,
                    cursor: "pointer",
                    background: activeMatchId === m.id ? T.paperDim : "transparent",
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: 13 }}>vs {m.opponent || "TBC"}</div>
                  <div style={{ fontSize: 11.5, color: T.inkSoft }}>{fmtDate(m.matchDate)} · {m.homeAway === "H" ? "Home" : "Away"}</div>
                  {m.ageGroup && <span className="gfc-agepill" style={{ marginTop: 4, display: "inline-block" }}>{m.ageGroup}</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        {!activeMatch ? (
          <div className="gfc-panel">
            <div className="gfc-empty">
              <div className="gfc-empty-title gfc-display">No fixture selected</div>
              Choose a fixture on the left, or create a new one, to build a squad.
            </div>
          </div>
        ) : (
          <div>
            <div className="gfc-panel" style={{ marginBottom: 14 }}>
              <div className="gfc-panel-head">
                <div>
                  <div className="gfc-panel-title">{activeMatch.homeAway === "H" ? "Garlandale FC (H)" : `${activeMatch.opponent || "Opponent"} (H)`} vs {activeMatch.homeAway === "H" ? (activeMatch.opponent || "Opponent") : "Garlandale FC"} (A)</div>
                  <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 2 }}>
                    {fmtDate(activeMatch.matchDate)} {activeMatch.kickoffTime ? `· ${activeMatch.kickoffTime}` : ""} · {activeMatch.division || "Division TBC"} · {activeMatch.competition || "Competition TBC"}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="gfc-btn gfc-btn-outline gfc-btn-sm" onClick={() => onEditMatch(activeMatch)}>Edit fixture</button>
                  <button className="gfc-btn gfc-btn-primary gfc-btn-sm" onClick={() => printTeamSheet(activeMatch, squad, enriched)}>Print team sheet</button>
                </div>
              </div>
            </div>

            <div className="gfc-row2">
              <div className="gfc-panel" style={{ padding: 16 }}>
                <div className="gfc-panel-title" style={{ marginBottom: 10 }}>Starting XI</div>
                <div className="gfc-filters" style={{ marginBottom: 10 }}>
                  <select className="gfc-select" style={{ maxWidth: 160 }} value={rosterAgeFilter} onChange={(e) => setRosterAgeFilter(e.target.value)}>
                    {ageGroups.map((g) => <option key={g} value={g}>{g === "All" ? "All age groups" : g}</option>)}
                  </select>
                </div>
                <div className="gfc-checklist" style={{ maxHeight: "none" }}>
                  {Array.from({ length: 11 }, (_, i) => slotRow(i + 1, "starting"))}
                </div>
              </div>
              <div className="gfc-panel" style={{ padding: 16 }}>
                <div className="gfc-panel-title" style={{ marginBottom: 10 }}>Substitutes</div>
                <div style={{ height: 38 }} />
                <div className="gfc-checklist" style={{ maxHeight: "none" }}>
                  {Array.from({ length: 9 }, (_, i) => slotRow(i + 12, "sub"))}
                </div>
              </div>
            </div>

            {squad.some((r) => r.player && !r.player.regNo) && (
              <div style={{ background: T.amberSoft, border: `1px solid ${T.gold}`, borderRadius: 10, padding: "10px 14px", fontSize: 12.5, color: "#7a5410", marginTop: 14 }}>
                <strong>Heads up:</strong> at least one selected player doesn't have a federation registration number on file yet — worth confirming eligibility before matchday.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function MatchModal({ match, players, ageGroups, onClose, onSave, onDelete }) {
  const [form, setForm] = useState(() => ({
    id: match?.id || "",
    leagueName: match?.leagueName || "Cape Town Tygerberg LFA",
    homeTeam: match?.homeTeam || "Garlandale FC",
    opponent: match?.opponent || "",
    homeAway: match?.homeAway || "H",
    venue: match?.venue || "",
    matchDate: match?.matchDate || todayISO(),
    kickoffTime: match?.kickoffTime || "",
    division: match?.division || "",
    competition: match?.competition || "",
    ageGroup: match?.ageGroup || "",
    cornerFlags: match?.cornerFlags || "",
    fieldConditions: match?.fieldConditions || "",
    fieldMarking: match?.fieldMarking || "",
    firstAidPresent: match?.firstAidPresent || "",
    refereeName: match?.refereeName || "",
    assistantRef1: match?.assistantRef1 || "",
    assistantRef2: match?.assistantRef2 || "",
    coachName: match?.coachName || "",
    coachRegNo: match?.coachRegNo || "",
    managerName: match?.managerName || "",
    managerRegNo: match?.managerRegNo || "",
    captainPlayerId: match?.captainPlayerId || "",
    physioName: match?.physioName || "",
    physioRegNo: match?.physioRegNo || "",
    comments: match?.comments || "",
  }));

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.opponent.trim()) return;
    onSave(form);
  }

  return (
    <div className="gfc-modal-backdrop" onClick={onClose}>
      <div className="gfc-modal" style={{ maxWidth: 600 }} onClick={(e) => e.stopPropagation()}>
        <div className="gfc-modal-head">
          <div className="gfc-modal-title gfc-display">{match ? "Edit fixture" : "New fixture"}</div>
          <button className="gfc-modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="gfc-row2">
            <div className="gfc-field">
              <label className="gfc-label">Opponent</label>
              <input className="gfc-input" value={form.opponent} onChange={(e) => update("opponent", e.target.value)} required />
            </div>
            <div className="gfc-field">
              <label className="gfc-label">Home / Away</label>
              <select className="gfc-select" value={form.homeAway} onChange={(e) => update("homeAway", e.target.value)}>
                <option value="H">Home</option>
                <option value="A">Away</option>
              </select>
            </div>
          </div>

          <div className="gfc-row2">
            <div className="gfc-field">
              <label className="gfc-label">Date</label>
              <input type="date" className="gfc-input" value={form.matchDate} onChange={(e) => update("matchDate", e.target.value)} />
            </div>
            <div className="gfc-field">
              <label className="gfc-label">Kick-off time</label>
              <input type="time" className="gfc-input" value={form.kickoffTime} onChange={(e) => update("kickoffTime", e.target.value)} />
            </div>
          </div>

          <div className="gfc-row2">
            <div className="gfc-field">
              <label className="gfc-label">Venue &amp; field</label>
              <input className="gfc-input" value={form.venue} onChange={(e) => update("venue", e.target.value)} />
            </div>
            <div className="gfc-field">
              <label className="gfc-label">Age group</label>
              <select className="gfc-select" value={form.ageGroup} onChange={(e) => update("ageGroup", e.target.value)}>
                <option value="">Not set</option>
                {ageGroups.filter((g) => g !== "All").map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
          </div>

          <div className="gfc-row2">
            <div className="gfc-field">
              <label className="gfc-label">Division</label>
              <input className="gfc-input" value={form.division} onChange={(e) => update("division", e.target.value)} />
            </div>
            <div className="gfc-field">
              <label className="gfc-label">Competition</label>
              <input className="gfc-input" value={form.competition} onChange={(e) => update("competition", e.target.value)} />
            </div>
          </div>

          <div className="gfc-row2">
            <div className="gfc-field">
              <label className="gfc-label">Referee</label>
              <input className="gfc-input" value={form.refereeName} onChange={(e) => update("refereeName", e.target.value)} />
            </div>
            <div className="gfc-field">
              <label className="gfc-label">League / association name</label>
              <input className="gfc-input" value={form.leagueName} onChange={(e) => update("leagueName", e.target.value)} />
            </div>
          </div>

          <div className="gfc-row2">
            <div className="gfc-field">
              <label className="gfc-label">Coach name</label>
              <input className="gfc-input" value={form.coachName} onChange={(e) => update("coachName", e.target.value)} />
            </div>
            <div className="gfc-field">
              <label className="gfc-label">Coach reg. no</label>
              <input className="gfc-input" value={form.coachRegNo} onChange={(e) => update("coachRegNo", e.target.value)} />
            </div>
          </div>

          <div className="gfc-row2">
            <div className="gfc-field">
              <label className="gfc-label">Manager name</label>
              <input className="gfc-input" value={form.managerName} onChange={(e) => update("managerName", e.target.value)} />
            </div>
            <div className="gfc-field">
              <label className="gfc-label">Manager reg. no</label>
              <input className="gfc-input" value={form.managerRegNo} onChange={(e) => update("managerRegNo", e.target.value)} />
            </div>
          </div>

          <div className="gfc-row2">
            <div className="gfc-field">
              <label className="gfc-label">Physio / first aider</label>
              <input className="gfc-input" value={form.physioName} onChange={(e) => update("physioName", e.target.value)} />
            </div>
            <div className="gfc-field">
              <label className="gfc-label">Physio reg. no</label>
              <input className="gfc-input" value={form.physioRegNo} onChange={(e) => update("physioRegNo", e.target.value)} />
            </div>
          </div>

          <div className="gfc-field">
            <label className="gfc-label">Captain</label>
            <select className="gfc-select" value={form.captainPlayerId} onChange={(e) => update("captainPlayerId", e.target.value)}>
              <option value="">Not set</option>
              {players.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          <div className="gfc-row2">
            <div className="gfc-field">
              <label className="gfc-label">Corner flags (Yes/No)</label>
              <input className="gfc-input" value={form.cornerFlags} onChange={(e) => update("cornerFlags", e.target.value)} />
            </div>
            <div className="gfc-field">
              <label className="gfc-label">First aid present (Yes/No)</label>
              <input className="gfc-input" value={form.firstAidPresent} onChange={(e) => update("firstAidPresent", e.target.value)} />
            </div>
          </div>

          <div className="gfc-field">
            <label className="gfc-label">Comments</label>
            <textarea className="gfc-textarea" rows={2} value={form.comments} onChange={(e) => update("comments", e.target.value)} />
          </div>

          <div className="gfc-modal-actions">
            {match && (
              <button type="button" className="gfc-btn gfc-btn-danger" style={{ marginRight: "auto" }} onClick={() => onDelete(match.id)}>
                Delete fixture
              </button>
            )}
            <button type="button" className="gfc-btn gfc-btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="gfc-btn gfc-btn-primary">Save fixture</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ---------- KIT / STOCK ---------- */

function KitView({ inventory, issuedItems, enriched, onAddItem, onEditItem, onIssue, onReturn }) {
  const [issuePlayerId, setIssuePlayerId] = useState("");
  const [issueItemId, setIssueItemId] = useState("");
  const [issueSize, setIssueSize] = useState("");
  const [issueQty, setIssueQty] = useState(1);
  const [issueDate, setIssueDate] = useState(todayISO());

  const outstanding = issuedItems.filter((r) => !r.dateReturned);

  function handleIssue(e) {
    e.preventDefault();
    if (!issuePlayerId || !issueItemId) return;
    onIssue({ playerId: issuePlayerId, itemId: issueItemId, size: issueSize, quantity: Number(issueQty) || 1, dateIssued: issueDate, notes: "" });
    setIssuePlayerId("");
    setIssueItemId("");
    setIssueSize("");
    setIssueQty(1);
  }

  return (
    <div>
      <div className="gfc-topbar">
        <div>
          <div className="gfc-page-title gfc-display">Kit &amp; Stock</div>
          <div className="gfc-page-sub">Inventory levels and what's currently issued to players</div>
        </div>
        <button className="gfc-btn gfc-btn-primary" onClick={onAddItem}>+ Add stock item</button>
      </div>

      <div className="gfc-panel" style={{ marginBottom: 18 }}>
        <div className="gfc-panel-head"><div className="gfc-panel-title">Inventory</div></div>
        {inventory.length === 0 ? (
          <div className="gfc-empty">
            <div className="gfc-empty-title gfc-display">No stock items yet</div>
            Add jerseys, tracksuits, or other kit to start tracking.
          </div>
        ) : (
          <table className="gfc-table">
            <thead><tr><th>Item</th><th>Category</th><th>Size</th><th>In stock</th><th></th></tr></thead>
            <tbody>
              {inventory.map((i) => (
                <tr key={i.id} className="clickable" onClick={() => onEditItem(i)}>
                  <td style={{ fontWeight: 600 }}>{i.name}</td>
                  <td>{i.category || "—"}</td>
                  <td>{i.size || "—"}</td>
                  <td className="gfc-mono" style={{ color: i.quantityOnHand <= 2 ? T.danger : T.ink, fontWeight: i.quantityOnHand <= 2 ? 700 : 400 }}>
                    {i.quantityOnHand}
                  </td>
                  <td><button className="gfc-btn gfc-btn-outline gfc-btn-sm" onClick={(e) => { e.stopPropagation(); onEditItem(i); }}>Edit</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="gfc-panel" style={{ marginBottom: 18, padding: 16 }}>
        <div className="gfc-panel-title" style={{ marginBottom: 12 }}>Issue kit to a player</div>
        <form onSubmit={handleIssue} className="gfc-row2" style={{ gridTemplateColumns: "1.4fr 1fr 0.7fr 0.6fr 1fr auto", alignItems: "end", gap: 8 }}>
          <div className="gfc-field" style={{ marginBottom: 0 }}>
            <label className="gfc-label">Player</label>
            <select className="gfc-select" value={issuePlayerId} onChange={(e) => setIssuePlayerId(e.target.value)} required>
              <option value="">Select player</option>
              {enriched.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="gfc-field" style={{ marginBottom: 0 }}>
            <label className="gfc-label">Item</label>
            <select className="gfc-select" value={issueItemId} onChange={(e) => setIssueItemId(e.target.value)} required>
              <option value="">Select item</option>
              {inventory.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.quantityOnHand} in stock)</option>)}
            </select>
          </div>
          <div className="gfc-field" style={{ marginBottom: 0 }}>
            <label className="gfc-label">Size</label>
            <input className="gfc-input" value={issueSize} onChange={(e) => setIssueSize(e.target.value)} />
          </div>
          <div className="gfc-field" style={{ marginBottom: 0 }}>
            <label className="gfc-label">Qty</label>
            <input type="number" min="1" className="gfc-input" value={issueQty} onChange={(e) => setIssueQty(e.target.value)} />
          </div>
          <div className="gfc-field" style={{ marginBottom: 0 }}>
            <label className="gfc-label">Date</label>
            <input type="date" className="gfc-input" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
          </div>
          <button type="submit" className="gfc-btn gfc-btn-primary">Issue</button>
        </form>
      </div>

      <div className="gfc-panel">
        <div className="gfc-panel-head"><div className="gfc-panel-title">Currently issued ({outstanding.length})</div></div>
        {outstanding.length === 0 ? (
          <div className="gfc-empty">Nothing currently out with players.</div>
        ) : (
          <table className="gfc-table">
            <thead><tr><th>Player</th><th>Item</th><th>Size</th><th>Qty</th><th>Issued</th><th></th></tr></thead>
            <tbody>
              {outstanding.map((r) => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 600 }}>{r.playerName}</td>
                  <td>{r.itemName}</td>
                  <td>{r.size || "—"}</td>
                  <td className="gfc-mono">{r.quantity}</td>
                  <td>{fmtDate(r.dateIssued)}</td>
                  <td><button className="gfc-btn gfc-btn-outline gfc-btn-sm" onClick={() => onReturn(r.id)}>Mark returned</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function ItemModal({ item, onClose, onSave, onDelete }) {
  const [form, setForm] = useState(() => ({
    id: item?.id || "",
    name: item?.name || "",
    category: item?.category || "",
    size: item?.size || "",
    quantityOnHand: item?.quantityOnHand ?? 0,
  }));

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) return;
    onSave(form);
  }

  return (
    <div className="gfc-modal-backdrop" onClick={onClose}>
      <div className="gfc-modal" onClick={(e) => e.stopPropagation()}>
        <div className="gfc-modal-head">
          <div className="gfc-modal-title gfc-display">{item ? "Edit stock item" : "Add stock item"}</div>
          <button className="gfc-modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="gfc-field">
            <label className="gfc-label">Item name</label>
            <input className="gfc-input" value={form.name} onChange={(e) => update("name", e.target.value)} required />
          </div>
          <div className="gfc-row2">
            <div className="gfc-field">
              <label className="gfc-label">Category</label>
              <input className="gfc-input" placeholder="Jersey, Shorts, Tracksuit…" value={form.category} onChange={(e) => update("category", e.target.value)} />
            </div>
            <div className="gfc-field">
              <label className="gfc-label">Size</label>
              <input className="gfc-input" value={form.size} onChange={(e) => update("size", e.target.value)} />
            </div>
          </div>
          <div className="gfc-field">
            <label className="gfc-label">Quantity on hand</label>
            <input type="number" min="0" className="gfc-input" value={form.quantityOnHand} onChange={(e) => update("quantityOnHand", e.target.value)} />
          </div>
          <div className="gfc-modal-actions">
            {item && (
              <button type="button" className="gfc-btn gfc-btn-danger" style={{ marginRight: "auto" }} onClick={() => onDelete(item.id)}>
                Remove item
              </button>
            )}
            <button type="button" className="gfc-btn gfc-btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="gfc-btn gfc-btn-primary">Save item</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ---------- SUBSCRIPTION TIERS ---------- */

function TierManagerModal({ tiers, onClose, onAdd, onEdit }) {
  return (
    <div className="gfc-modal-backdrop" onClick={onClose}>
      <div className="gfc-modal" onClick={(e) => e.stopPropagation()}>
        <div className="gfc-modal-head">
          <div className="gfc-modal-title gfc-display">Subscription tiers</div>
          <button className="gfc-modal-close" onClick={onClose}>×</button>
        </div>

        <div style={{ marginBottom: 14 }}>
          <button className="gfc-btn gfc-btn-primary gfc-btn-sm" onClick={onAdd}>+ Add tier</button>
        </div>

        {tiers.length === 0 ? (
          <div className="gfc-empty">
            <div className="gfc-empty-title gfc-display">No tiers yet</div>
            Add a tier (e.g. "Standard") to start assigning fees to players.
          </div>
        ) : (
          <div className="gfc-checklist" style={{ maxHeight: 320 }}>
            {tiers.map((t) => (
              <div key={t.id} className="gfc-checklist-row">
                <div>
                  <div style={{ fontWeight: 700 }}>{t.name}</div>
                  {t.description && <div style={{ fontSize: 11.5, color: T.inkSoft }}>{t.description}</div>}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span className="gfc-mono" style={{ fontWeight: 700 }}>{fmtMoney(t.monthlyFee)}/mo</span>
                  <button className="gfc-btn gfc-btn-outline gfc-btn-sm" onClick={() => onEdit(t)}>Edit</button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="gfc-modal-actions">
          <button className="gfc-btn gfc-btn-outline" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

function TierModal({ tier, onClose, onSave, onDelete }) {
  const [form, setForm] = useState(() => ({
    id: tier?.id || "",
    name: tier?.name || "",
    monthlyFee: tier?.monthlyFee ?? 300,
    description: tier?.description || "",
  }));

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) return;
    onSave(form);
  }

  return (
    <div className="gfc-modal-backdrop" onClick={onClose}>
      <div className="gfc-modal" onClick={(e) => e.stopPropagation()}>
        <div className="gfc-modal-head">
          <div className="gfc-modal-title gfc-display">{tier ? "Edit tier" : "New tier"}</div>
          <button className="gfc-modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="gfc-field">
            <label className="gfc-label">Tier name</label>
            <input className="gfc-input" placeholder="e.g. Standard, Sibling discount" value={form.name} onChange={(e) => update("name", e.target.value)} required />
          </div>
          <div className="gfc-field">
            <label className="gfc-label">Monthly fee (R)</label>
            <input type="number" min="0" step="10" className="gfc-input" value={form.monthlyFee} onChange={(e) => update("monthlyFee", e.target.value)} />
          </div>
          <div className="gfc-field">
            <label className="gfc-label">Description (optional)</label>
            <textarea className="gfc-textarea" rows={2} value={form.description} onChange={(e) => update("description", e.target.value)} />
          </div>
          <div className="gfc-modal-actions">
            {tier && (
              <button type="button" className="gfc-btn gfc-btn-danger" style={{ marginRight: "auto" }} onClick={() => onDelete(tier.id)}>
                Delete tier
              </button>
            )}
            <button type="button" className="gfc-btn gfc-btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="gfc-btn gfc-btn-primary">Save tier</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ---------- BACKUPS ---------- */

function BackupsView({ backups, onRefresh, onBackupNow, onRestore, onDownload, onRestoreFromFile, busy, lastMessage }) {
  const fileInputRef = React.useRef(null);

  function handleFileChosen(e) {
    const file = e.target.files?.[0];
    if (file) onRestoreFromFile(file);
    e.target.value = "";
  }

  return (
    <div>
      <div className="gfc-topbar">
        <div>
          <div className="gfc-page-title gfc-display">Backups</div>
          <div className="gfc-page-sub">Automatic nightly snapshot at 11pm · last 30 days kept</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="gfc-btn gfc-btn-outline" onClick={onRefresh} disabled={busy}>Refresh list</button>
          <button className="gfc-btn gfc-btn-primary" onClick={onBackupNow} disabled={busy}>
            {busy ? "Working…" : "Back up now"}
          </button>
        </div>
      </div>

      {lastMessage && (
        <div style={{ background: T.amberSoft, border: `1px solid ${T.gold}`, borderRadius: 10, padding: "10px 14px", fontSize: 12.5, color: "#7a5410", marginBottom: 16 }}>
          {lastMessage}
        </div>
      )}

      <div style={{ background: T.paperDim, border: `1px solid ${T.line}`, borderRadius: 10, padding: "10px 14px", fontSize: 12.5, color: T.inkSoft, marginBottom: 18 }}>
        Nightly snapshots protect against mistakes (accidental deletes, bad edits) — restoring rolls the whole club's data back to that point in time. For protection against losing the Supabase project itself, occasionally use <strong>Download</strong> below and save the file somewhere off-project (Google Drive, email to yourself, etc).
      </div>

      <div className="gfc-panel" style={{ marginBottom: 18 }}>
        <div className="gfc-panel-head"><div className="gfc-panel-title">Snapshots ({backups.length})</div></div>
        {backups.length === 0 ? (
          <div className="gfc-empty">
            <div className="gfc-empty-title gfc-display">No snapshots yet</div>
            Click "Back up now" to create your first one, or wait for tonight's automatic run.
          </div>
        ) : (
          <table className="gfc-table">
            <thead><tr><th>Date &amp; time</th><th>Type</th><th></th></tr></thead>
            <tbody>
              {backups.map((b) => (
                <tr key={b.id}>
                  <td style={{ fontWeight: 600 }}>{new Date(b.created_at).toLocaleString("en-ZA")}</td>
                  <td><span className={`gfc-badge ${b.kind === "manual" ? "gfc-badge-neutral" : "gfc-badge-green"}`}><span className="gfc-dot" />{b.kind === "manual" ? "Manual" : "Automatic"}</span></td>
                  <td style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                    <button className="gfc-btn gfc-btn-outline gfc-btn-sm" onClick={() => onDownload(b.id)} disabled={busy}>Download</button>
                    <button className="gfc-btn gfc-btn-danger gfc-btn-sm" onClick={() => onRestore(b.id)} disabled={busy}>Restore</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="gfc-panel" style={{ padding: 16 }}>
        <div className="gfc-panel-title" style={{ marginBottom: 10 }}>Restore from a downloaded file</div>
        <div style={{ fontSize: 12.5, color: T.inkSoft, marginBottom: 10 }}>
          Upload a previously downloaded backup file to restore the club's data from it.
        </div>
        <input ref={fileInputRef} type="file" accept="application/json" onChange={handleFileChosen} style={{ display: "none" }} />
        <button className="gfc-btn gfc-btn-outline" onClick={() => fileInputRef.current?.click()} disabled={busy}>
          Choose backup file…
        </button>
      </div>
    </div>
  );
}
