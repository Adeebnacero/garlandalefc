// Supabase Edge Function: send-email
//
// Sends an email through the club's Gmail account (SMTP, port 465).
// Credentials come from Edge Function secrets, never from the database:
//   supabase secrets set SMTP_USERNAME="yourclub@gmail.com"
//   supabase secrets set SMTP_PASSWORD="your-16-character-app-password"
//
// Locked down 3 November 2026. Before this, any staff member (including
// referees) could send any HTML to any address from the club's account,
// with their own choice of sender name and reply-to - a ready-made
// phishing tool aimed at parents. Now:
//   - Only Admin, Chairman and Treasurer can send.
//   - One recipient per email, and it must already be on file as a
//     player's or supporter's email address.
//   - Sender name and reply-to come from Club Settings, not the request.
//   - The body is reduced to basic formatting (p, br, strong, b, em) and
//     links to the Player Portal only. Anything else is shown as text.
//   - Attachments must be PDFs under ~2 MB.
//   - At most 250 emails per staff member per hour (fails closed).
//   - Every send is written to the audit log.
//
// Deploy with:
//   supabase functions deploy send-email

import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const SENDER_ROLES = ["admin", "chairman", "treasurer"];
const MAX_PER_HOUR = 250;
const MAX_BODY_BYTES = 4_000_000;
const MAX_PDF_BASE64 = 3_000_000; // about 2.2 MB of PDF
const MAX_HTML = 20_000;
const EMAIL_RE = /^[^\s@,;<>"'()\\]+@[^\s@,;<>"'()\\]+\.[^\s@,;<>"'()\\]+$/;

// ---------- CORS: the Club Management app only ----------
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

// ---------- Content safety ----------
function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// Undo the handful of entities the app itself uses, so already-escaped
// names (e.g. O&#39;Brien) don't end up double-escaped.
function decodeBasic(s: string) {
  return s.replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&quot;/gi, '"')
    .replace(/&#0?39;/g, "'").replace(/&amp;/gi, "&");
}

// Escape everything, then let back in only exact, attribute-free basic
// tags and links to the Player Portal.
export function safeHtml(input: string) {
  let s = escapeHtml(decodeBasic(input));
  s = s.replace(/&lt;(\/?)(p|strong|b|em|br)\s*\/?&gt;/gi, (_m, slash, tag) => `<${slash}${tag.toLowerCase()}>`);
  s = s.replace(
    /&lt;a href=&quot;(https:\/\/(?:www\.)?gfcplayers\.co\.za(?:\/[^\s&<>"]*)?)&quot;&gt;/gi,
    (_m, url) => `<a href="${url}">`,
  );
  s = s.replace(/&lt;\/a&gt;/gi, "</a>");
  return s;
}

function plainText(html: string) {
  return decodeBasic(html.replace(/<br>/g, "\n").replace(/<\/p>/g, "\n\n").replace(/<[^>]+>/g, "")).trim();
}

function oneLine(s: string, max: number) {
  return s.replace(/[\r\n\t]+/g, " ").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, max);
}

function displayName(s: string) {
  return oneLine(s, 80).replace(/["<>\\]/g, "") || "Garlandale FC";
}

function pdfFilename(s: unknown) {
  const base = String(s || "statement").replace(/\.pdf$/i, "").replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 100) || "statement";
  return `${base}.pdf`;
}

function likeExact(s: string) {
  return s.replace(/[\\%_]/g, (c) => "\\" + c);
}

Deno.serve(async (req) => {
  const CORS = corsHeaders(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Use POST" }, 405);

  try {
    // 1. Who is asking?
    const caller = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: userData, error: userErr } = await caller.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Not authenticated." }, 401);
    const userId = userData.user.id;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: me } = await admin.from("staff").select("email, role").eq("user_id", userId).maybeSingle();
    if (!me || !SENDER_ROLES.includes(me.role)) {
      return json({ error: "Only an Admin, Chairman or Treasurer can send email from the club's account." }, 403);
    }

    // 2. Rate limit - fails closed.
    const since = new Date(Date.now() - 3600_000).toISOString();
    const { count: recent, error: rlErr } = await admin
      .from("api_rate_limits")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId).eq("endpoint", "send-email").gte("requested_at", since);
    if (rlErr) {
      console.error("send-email: rate-limit check failed", rlErr);
      return json({ error: "Couldn't send right now - please try again in a minute." }, 503);
    }
    if ((recent ?? 0) >= MAX_PER_HOUR) {
      return json({ error: `That's ${MAX_PER_HOUR} emails in the last hour - please wait a while before sending more.` }, 429);
    }

    // 3. Check the request.
    const len = Number(req.headers.get("content-length") || "0");
    if (len > MAX_BODY_BYTES) return json({ error: "That email is too large to send." }, 413);
    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return json({ error: "Invalid request." }, 400); }

    const to = typeof body.to === "string" ? body.to.trim().toLowerCase() : "";
    if (!EMAIL_RE.test(to) || to.length > 254) return json({ error: "That isn't a valid single email address." }, 400);

    const subject = typeof body.subject === "string" ? oneLine(body.subject, 200) : "";
    if (!subject) return json({ error: "Missing subject." }, 400);

    const rawHtml = typeof body.html === "string" ? body.html : "";
    if (rawHtml.length > MAX_HTML) return json({ error: "That message is too long." }, 400);
    const html = safeHtml(rawHtml || "<p>Please see attached.</p>");

    let attachments: { filename: string; content: string; encoding: "base64"; contentType: string }[] = [];
    if (body.pdfBase64 != null && body.pdfBase64 !== "") {
      const pdf = String(body.pdfBase64);
      if (pdf.length > MAX_PDF_BASE64) return json({ error: "The attachment is too large." }, 400);
      if (!/^[A-Za-z0-9+/]+={0,2}$/.test(pdf) || !pdf.startsWith("JVBER")) {
        return json({ error: "The attachment must be a PDF." }, 400);
      }
      attachments = [{ filename: pdfFilename(body.pdfFilename), content: pdf, encoding: "base64", contentType: "application/pdf" }];
    }

    // 4. Only to people the club already has on file.
    const pattern = likeExact(to);
    const [players, supporters] = await Promise.all([
      admin.from("players").select("id", { count: "exact", head: true }).ilike("email", pattern),
      admin.from("supporters").select("auth_user_id", { count: "exact", head: true }).ilike("email", pattern),
    ]);
    if (players.error || supporters.error) {
      console.error("send-email: recipient check failed", players.error || supporters.error);
      return json({ error: "Couldn't send right now - please try again in a minute." }, 503);
    }
    if (!players.count && !supporters.count) {
      return json({ error: "Email can only be sent to a player's or supporter's address that's on file." }, 403);
    }

    // 5. Sender details from Club Settings.
    const username = Deno.env.get("SMTP_USERNAME");
    const password = Deno.env.get("SMTP_PASSWORD");
    if (!username || !password) return json({ error: "Email is not set up on the server yet." }, 500);

    const { data: settings } = await admin.from("club_settings")
      .select("sender_display_name, reply_to_email").eq("id", 1).maybeSingle();
    const fromName = displayName(settings?.sender_display_name || "Garlandale FC");
    const replyTo = EMAIL_RE.test(settings?.reply_to_email || "") ? settings!.reply_to_email : undefined;

    // 6. Send.
    const client = new SMTPClient({
      connection: { hostname: "smtp.gmail.com", port: 465, tls: true, auth: { username, password } },
    });
    try {
      await client.send({
        from: `${fromName} <${username}>`,
        to,
        replyTo,
        subject,
        content: plainText(html) || "Please see attached.",
        html,
        attachments,
      });
    } finally {
      await client.close().catch(() => {});
    }

    // 7. Count it and record it.
    await admin.from("api_rate_limits").insert({ user_id: userId, endpoint: "send-email" });
    const { error: auditErr } = await admin.from("audit_log").insert({
      table_name: "email_sent",
      action: "INSERT",
      new_data: { to, subject, attachment: attachments[0]?.filename ?? null },
      changed_by: userId,
      changed_by_email: me.email,
    });
    if (auditErr) console.error("send-email: audit log write failed", auditErr);

    return json({ success: true });
  } catch (err) {
    console.error("send-email: failed", err);
    return json({ error: "The email couldn't be sent - please try again." }, 500);
  }
});
