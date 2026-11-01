// ---------------------------------------------------------------------------
// In-app player messages: reading and writing in Supabase, as the logged-in
// staff member. The database decides who may do what (Admin, Chairman and
// Treasurer only; see migrations/2026-10-player-messages.sql).
// ---------------------------------------------------------------------------

import { supabase } from "../supabaseClient";

/** Of these players, the ids that have a Player Portal login. */
export async function loadReach(playerIds) {
  if (!playerIds.length) return new Set();
  const { data, error } = await supabase.rpc("player_message_reach", { p_player_ids: playerIds });
  if (error) throw error;
  // A setof uuid comes back as plain strings.
  return new Set((data || []).map((r) => (typeof r === "string" ? r : r.player_message_reach)));
}

/** Sends one batch; all or nothing. Returns the new batch id. */
export async function sendInApp(templateId, templateText, messages) {
  const { data, error } = await supabase.rpc("send_player_messages", {
    p_template_id: templateId,
    p_template_text: templateText,
    p_messages: messages,
  });
  if (error) throw error;
  return data;
}

/** The last 90 days of sends, newest first, with who has read each one. */
export async function loadSentHistory() {
  const { data, error } = await supabase
    .from("player_message_batches")
    .select("id, template_id, template_text, recipient_count, sent_by_email, created_at, player_messages(player_id, read_at)")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return data || [];
}

/** Withdraws a send: it disappears from every recipient's Messages. */
export async function withdrawSend(batchId) {
  const { error } = await supabase.from("player_message_batches").delete().eq("id", batchId);
  if (error) throw error;
}
