// Supabase Edge Function: invite-player
//
// Invites a guardian (or an adult player) to the Player Portal and links
// their login to a SPECIFIC player via guardian_players. Linking is
// many-to-many (siblings; both parents), up to MAX_ACCOUNTS_PER_PLAYER -
// also enforced in the database (migrations/2026-11-guardian-link-limit.sql).
//
// Restricted 3 November 2026. Before this, a coach could link ANY email -
// including their own - to ANY child in the club, silently, gaining that
// child's details, balance and private messages. Now:
//   - Admin / Chairman: any player, any email.
//   - Coach: only players in their own team(s) (staff_teams), and only the
//     email on that player's record. Anything else needs an Admin.
//   - Treasurer / Referee: can't invite.
//   - When a login is added to a child who already has one, the existing
//     guardians get an in-app message (Messages in the Player Portal).
//   - Every new link is written to the audit log.
//   - The invite link always goes to the Player Portal (not caller-chosen).
//
// THIS IS THE ONLY COPY OF THIS FUNCTION. Deploy from this repo only:
//   supabase functions deploy invite-player
//
// Response: { success, emailSent, emailError, alreadyRegistered, alreadyLinked, guardiansNotified }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const MAX_ACCOUNTS_PER_PLAYER = 2;
const PORTAL_INVITE_URL = "https://www.gfcplayers.co.za/accept-invite.html";
const ADMIN_ROLES = ["admin", "chairman"];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@,;<>"'()\\]+@[^\s@,;<>"'()\\]+\.[^\s@,;<>"'()\\]+$/;

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

function maskEmail(email: string) {
  const [user, domain] = email.split("@");
  return `${user.slice(0, 1)}•••@${domain}`;
}

// listUsers() is paginated, so walk every page.
// deno-lint-ignore no-explicit-any
async function findUserByEmail(admin: any, email: string) {
  const target = email.toLowerCase();
  const perPage = 1000;
  for (let page = 1; page < 100; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const users = data?.users || [];
    // deno-lint-ignore no-explicit-any
    const hit = users.find((u: any) => (u.email || "").toLowerCase() === target);
    if (hit) return hit;
    if (users.length < perPage) return null;
  }
  return null;
}

// Is this player in one of the coach's own teams? Uses the same age-group
// rules as the rest of the database (club_age_group).
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
    const isAdmin = !!me && ADMIN_ROLES.includes(me.role);
    const isCoach = !!me && me.role === "coach";
    if (!isAdmin && !isCoach) return json({ error: "Only an Admin, Chairman or Coach can invite a player." }, 403);

    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return json({ error: "Invalid request." }, 400); }
    const playerId = typeof body.playerId === "string" ? body.playerId : "";
    const email = String(body.email || "").trim().toLowerCase();
    if (!UUID_RE.test(playerId) || !email) return json({ error: "Missing 'playerId' or 'email'." }, 400);
    if (!EMAIL_RE.test(email) || email.length > 254) return json({ error: "That doesn't look like a valid email address." }, 400);

    const { data: player } = await admin.from("players")
      .select("id, name, dob, age_group_override, email").eq("id", playerId).maybeSingle();
    if (!player) return json({ error: "Player not found." }, 404);

    // Coaches: own teams, email on file.
    if (isCoach) {
      if (!(await coachCoversPlayer(admin, me!.id, player))) {
        return json({ error: "You can only give app access for players in your own team(s). Ask an Admin for anyone else." }, 403);
      }
      if (email !== String(player.email || "").trim().toLowerCase()) {
        return json({
          error: `A coach can only send the app invite to the email on ${player.name}'s record. To use a different email (for example a second parent), ask an Admin or Chairman.`,
        }, 403);
      }
    }

    let existing = await findUserByEmail(admin, email);

    const { data: links, error: linksErr } = await admin.from("guardian_players").select("auth_user_id").eq("player_id", playerId);
    if (linksErr) throw linksErr;
    // deno-lint-ignore no-explicit-any
    const linkedIds = new Set<string>((links || []).map((l: any) => l.auth_user_id));
    const alreadyLinked = !!existing && linkedIds.has(existing.id);

    if (!alreadyLinked && linkedIds.size >= MAX_ACCOUNTS_PER_PLAYER) {
      return json({
        error: `${player.name} already has ${linkedIds.size} linked app accounts (the maximum). Remove one before adding another.`,
      }, 409);
    }

    // Invite brand-new or never-activated logins; just link active ones.
    let userId: string | null = existing?.id ?? null;
    let emailSent = false;
    let emailError: string | null = null;
    const isActive = !!existing && !!(existing.email_confirmed_at || existing.last_sign_in_at);

    if (!isActive) {
      const { data: inviteData, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo: PORTAL_INVITE_URL });
      if (!inviteErr) {
        userId = inviteData.user.id;
        emailSent = true;
      } else {
        console.error("invite-player: inviteUserByEmail failed", inviteErr);
        existing = existing || (await findUserByEmail(admin, email));
        if (!existing) return json({ error: "Could not send invite - please try again." }, 500);
        userId = existing.id;
        const msg = (inviteErr.message || "").toLowerCase();
        if (!msg.includes("already")) emailError = inviteErr.message || "unknown reason";
      }
    }

    const { error: linkErr } = await admin.from("guardian_players").upsert(
      { auth_user_id: userId, player_id: playerId, invited_email: email, invited_by: callerData.user.id },
      { onConflict: "auth_user_id,player_id" },
    );
    if (linkErr) {
      if (linkErr.code === "P0001") return json({ error: linkErr.message }, 409);
      throw linkErr;
    }

    let guardiansNotified = false;
    if (!alreadyLinked) {
      const { error: auditErr } = await admin.from("audit_log").insert({
        table_name: "guardian_players",
        record_id: playerId,
        action: "INSERT",
        new_data: { player_id: playerId, auth_user_id: userId, email, invited_by_role: me!.role, invite_email_sent: emailSent },
        changed_by: callerData.user.id,
        changed_by_email: me!.email,
      });
      if (auditErr) console.error("invite-player: audit log write failed", auditErr);

      // Tell the guardians who already have access.
      const others = [...linkedIds].filter((id) => id !== userId);
      if (others.length > 0) {
        const first = String(player.name || "").trim().split(/\s+/)[0] || "your child";
        const when = new Date().toLocaleDateString("en-ZA", {
          day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Johannesburg",
        });
        const text = `A new Player Portal login (${maskEmail(email)}) was given access to ${first}'s account on ${when}. ` +
          `If you don't recognise this, please contact the club straight away.`;
        const { data: batch, error: bErr } = await admin.from("player_message_batches").insert({
          template_id: "access_added", template_text: text, recipient_count: 1, sent_by: me!.id, sent_by_email: me!.email,
        }).select("id").single();
        if (!bErr && batch) {
          const { error: mErr } = await admin.from("player_messages").insert({ batch_id: batch.id, player_id: playerId, body: text });
          guardiansNotified = !mErr;
          if (mErr) console.error("invite-player: guardian notice failed", mErr);
        } else if (bErr) {
          console.error("invite-player: guardian notice batch failed", bErr);
        }
      }
    }

    return json({ success: true, emailSent, emailError, alreadyRegistered: !!existing, alreadyLinked, guardiansNotified });
  } catch (err) {
    console.error("invite-player: unexpected error", err);
    return json({ error: "Could not send invite - please try again." }, 500);
  }
});
