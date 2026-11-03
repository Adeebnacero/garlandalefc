// Supabase Edge Function: manage-player-guardians
//
// Lets staff see and remove the Player Portal logins linked to a player.
//
//   { action: "list",   playerId }              -> { accounts: [...] }
//   { action: "remove", playerId, authUserId }  -> { success: true }
//
// "remove" only deletes the guardian_players link for THIS player. It never
// deletes the login itself, because the same login may also be linked to a
// sibling, or belong to a staff member.
//
// Scoped 3 November 2026:
//   - Listing: Admin, Chairman and Treasurer for any player; a Coach only
//     for players in their own team(s).
//   - Removing: Admin and Chairman for any player; a Coach only for players
//     in their own team(s).
//   - Every removal is written to the audit log.
//
// Deploy with:
//   supabase functions deploy manage-player-guardians

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_ORIGINS = ["https://garlandalefc.vercel.app", "http://localhost:5173", "http://127.0.0.1:5173"];
const PREVIEW_ORIGIN_RE = /^https:\/\/garlandalefc-[a-z0-9-]+\.vercel\.app$/;

function corsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  const ok = ALLOWED_ORIGINS.includes(origin) || PREVIEW_ORIGIN_RE.test(origin);
  return {
    "Access-Control-Allow-Origin": ok ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

// deno-lint-ignore no-explicit-any
async function coachCoversPlayer(admin: any, staffId: string, player: any) {
  const [teams, group] = await Promise.all([
    admin.from("staff_teams").select("age_group").eq("staff_id", staffId),
    admin.rpc("club_age_group", { p_dob: player.dob, p_override: player.age_group_override ?? "" }),
  ]);
  if (teams.error || group.error) throw teams.error || group.error;
  const g = String(group.data || "").trim().toLowerCase();
  // deno-lint-ignore no-explicit-any
  return !!g && (teams.data || []).some((t: any) => String(t.age_group || "").trim().toLowerCase() === g);
}

Deno.serve(async (req) => {
  const CORS = corsHeaders(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Use POST" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const callerClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: callerData, error: callerErr } = await callerClient.auth.getUser();
    if (callerErr || !callerData?.user) return json({ error: "Not authenticated." }, 401);

    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: me } = await admin.from("staff").select("id, role, email").eq("user_id", callerData.user.id).maybeSingle();
    if (!me) return json({ error: "Staff access required." }, 403);

    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return json({ error: "Invalid request." }, 400); }
    const action = body.action;
    const playerId = typeof body.playerId === "string" ? body.playerId : "";
    if (!UUID_RE.test(playerId)) return json({ error: "Missing 'playerId'." }, 400);

    const { data: player } = await admin.from("players").select("id, name, dob, age_group_override").eq("id", playerId).maybeSingle();
    if (!player) return json({ error: "Player not found." }, 404);

    const isAdmin = ["admin", "chairman"].includes(me.role);
    const isCoach = me.role === "coach";
    const coachOk = isCoach ? await coachCoversPlayer(admin, me.id, player) : false;

    if (action === "list") {
      if (!(isAdmin || me.role === "treasurer" || coachOk)) {
        return json({ error: isCoach ? "You can only see app access for players in your own team(s)." : "You don't have access to player records." }, 403);
      }
      const { data: links, error } = await admin.from("guardian_players")
        .select("auth_user_id, invited_email, created_at").eq("player_id", playerId).order("created_at", { ascending: true });
      if (error) throw error;

      // deno-lint-ignore no-explicit-any
      const accounts = await Promise.all((links || []).map(async (l: any) => {
        const { data } = await admin.auth.admin.getUserById(l.auth_user_id);
        const u = data?.user;
        return {
          authUserId: l.auth_user_id,
          email: u?.email || l.invited_email || "(unknown)",
          linkedAt: l.created_at,
          activated: !!(u?.email_confirmed_at || u?.last_sign_in_at),
          lastSignInAt: u?.last_sign_in_at || null,
        };
      }));
      return json({ accounts });
    }

    if (action === "remove") {
      if (!(isAdmin || coachOk)) {
        return json({ error: isCoach ? "You can only remove app access for players in your own team(s)." : "Only an Admin, Chairman or Coach can remove app access." }, 403);
      }
      const authUserId = typeof body.authUserId === "string" ? body.authUserId : "";
      if (!UUID_RE.test(authUserId)) return json({ error: "Missing 'authUserId'." }, 400);

      const { data: removed, error: delErr } = await admin.from("guardian_players")
        .delete().eq("player_id", playerId).eq("auth_user_id", authUserId).select("invited_email");
      if (delErr) throw delErr;

      // Clear the legacy 1:1 column too, so a re-run of the old backfill can't restore the link.
      await admin.from("players").update({ user_id: null }).eq("id", playerId).eq("user_id", authUserId);

      if (removed && removed.length > 0) {
        const { data: u } = await admin.auth.admin.getUserById(authUserId);
        const { error: auditErr } = await admin.from("audit_log").insert({
          table_name: "guardian_players",
          record_id: playerId,
          action: "DELETE",
          old_data: { player_id: playerId, auth_user_id: authUserId, email: u?.user?.email || removed[0].invited_email || null },
          changed_by: callerData.user.id,
          changed_by_email: me.email,
        });
        if (auditErr) console.error("manage-player-guardians: audit log write failed", auditErr);
      }
      return json({ success: true });
    }

    return json({ error: "Unknown action." }, 400);
  } catch (err) {
    console.error("manage-player-guardians: unexpected error", err);
    return json({ error: "Something went wrong - please try again." }, 500);
  }
});
