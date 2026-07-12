// Supabase Edge Function: invite-player
//
// Invites a SPECIFIC player (by playerId) to create their own account for
// the future player-facing app, and links the resulting auth user to that
// exact player row via players.user_id. This is the deliberate alternative
// to open self-signup: only a player row that already exists in the club's
// records - and that an Admin/Coach explicitly triggers from that player's
// profile - can ever end up with a claimable account.
//
// Only an Admin or Coach can call this successfully - re-checked server-side
// using the service role key, mirroring invite-user's pattern.
//
// Deploy with:
//   supabase functions deploy invite-player

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const callerToken = authHeader.replace("Bearer ", "");

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    const callerClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY"), {
      global: { headers: { Authorization: `Bearer ${callerToken}` } },
    });
    const { data: callerData, error: callerErr } = await callerClient.auth.getUser();
    if (callerErr || !callerData?.user) {
      return new Response(JSON.stringify({ error: "Not authenticated." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: callerStaff, error: staffErr } = await adminClient
      .from("staff")
      .select("role")
      .eq("user_id", callerData.user.id)
      .single();

    if (staffErr || !callerStaff || !["admin", "coach"].includes(callerStaff.role)) {
      return new Response(JSON.stringify({ error: "Only an Admin or Coach can invite a player." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { playerId, email, redirectTo } = await req.json();
    if (!playerId || !email) {
      return new Response(JSON.stringify({ error: "Missing 'playerId' or 'email'." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: playerRow, error: playerErr } = await adminClient
      .from("players")
      .select("id, name")
      .eq("id", playerId)
      .single();
    if (playerErr || !playerRow) {
      return new Response(JSON.stringify({ error: "Player not found." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Try to invite. If this email is already registered (e.g. a parent who
    // is also staff, or re-inviting after a lost link), fall back to
    // looking them up so we can still link the account to this player.
    let userId;
    const { data: inviteData, error: inviteErr } = await adminClient.auth.admin.inviteUserByEmail(email, {
      redirectTo: redirectTo || undefined,
    });

    if (inviteErr) {
      const isAlreadyRegistered = (inviteErr.message || "").toLowerCase().includes("already registered") ||
        (inviteErr.message || "").toLowerCase().includes("already been registered");
      if (!isAlreadyRegistered) {
        return new Response(JSON.stringify({ error: inviteErr.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: list, error: listErr } = await adminClient.auth.admin.listUsers();
      if (listErr) throw listErr;
      const existing = list.users.find((u) => (u.email || "").toLowerCase() === email.toLowerCase());
      if (!existing) throw new Error("User already registered but could not be found.");
      userId = existing.id;
    } else {
      userId = inviteData.user.id;
    }

    const { error: linkErr } = await adminClient
      .from("players")
      .update({ user_id: userId })
      .eq("id", playerId);
    if (linkErr) throw linkErr;

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || "Unknown error inviting player." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
