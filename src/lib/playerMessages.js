// ---------------------------------------------------------------------------
// In-app player messages: the pure parts (no Supabase), so they can be
// tested on their own. Messages -> Player Messages -> "Send in app".
//
// Each selected player who has a Player Portal login gets their own copy,
// with the placeholders filled in for them exactly as for WhatsApp/SMS.
// Players without a login are listed so they can be messaged another way.
// Database side: migrations/2026-10-player-messages.sql.
// ---------------------------------------------------------------------------

import { fillTemplate, TEMPLATES } from "./messaging.js";

// Must match the checks in send_player_messages().
export const MAX_RECIPIENTS = 500;
export const MAX_LENGTH = 1000;

/**
 * Works out what "Send in app" would send.
 *   players     - the selected (enriched) players
 *   rawText     - the template text, with {placeholders}
 *   reachableIds - Set of player ids that have a Player Portal login
 * Returns { messages: [{ player_id, body }], reachable: [players],
 *           missing: [players], error: "" }
 */
export function planInAppSend(players, rawText, reachableIds) {
  const reachable = players.filter((p) => reachableIds.has(p.id));
  const missing = players.filter((p) => !reachableIds.has(p.id));
  const messages = reachable.map((p) => ({ player_id: p.id, body: fillTemplate(rawText || "", p).trim() }));

  let error = "";
  if (!String(rawText || "").trim()) error = "Write a message first.";
  else if (reachable.length === 0) error = players.length ? "None of the selected players have the Player Portal yet." : "Choose at least one player.";
  else if (reachable.length > MAX_RECIPIENTS) error = `That’s more than ${MAX_RECIPIENTS} players in one go. Send it in smaller groups.`;
  else {
    const tooLong = messages.find((m) => m.body.length > MAX_LENGTH);
    if (tooLong) error = `Messages can be up to ${MAX_LENGTH} characters (this one is ${tooLong.body.length} once filled in).`;
  }
  return { messages, reachable, missing, error };
}

/** True if the text includes figures that are fixed at the moment of sending. */
export function hasSnapshotValues(rawText) {
  return /\{balance\}/.test(rawText || "");
}

export function templateLabel(templateId) {
  const t = TEMPLATES.find((x) => x.id === templateId);
  return t && t.id !== "custom" ? t.label : "Custom message";
}

/**
 * One row of the sent history, from a player_message_batches row with its
 * player_messages embedded. nameById: Map of player id -> name.
 */
export function summariseSend(batch, nameById) {
  const recipients = (batch.player_messages || [])
    .map((m) => ({ playerId: m.player_id, name: nameById.get(m.player_id) || "Unknown player", readAt: m.read_at || null }))
    .sort((a, b) => (a.readAt ? 1 : 0) - (b.readAt ? 1 : 0) || a.name.localeCompare(b.name));
  return {
    id: batch.id,
    sentAt: batch.created_at,
    sentBy: batch.sent_by_email || "",
    label: templateLabel(batch.template_id),
    text: batch.template_text || "",
    total: recipients.length,
    readCount: recipients.filter((r) => r.readAt).length,
    recipients,
  };
}

export function friendlyMessageError(err) {
  const msg = String(err?.message || err || "");
  if (/row-level security|permission denied/i.test(msg)) return "Only an Admin, Chairman or Treasurer can send player messages.";
  if (/Failed to fetch|NetworkError/i.test(msg)) return "Couldn’t reach the server. Check your connection and try again.";
  if (/send_player_messages|player_message_reach|player_message_batches/.test(msg) && /does not exist|Could not find/i.test(msg)) {
    return "In-app messages aren’t set up yet. Run migrations/2026-10-player-messages.sql in Supabase.";
  }
  return msg || "Something went wrong. Please try again.";
}
