// Supabase Edge Function: send-email
//
// Sends an email through the club's Gmail account using SMTP on port 465
// (port 587 is blocked on Supabase Edge Functions - 465 works fine with
// Gmail). Credentials come from Edge Function secrets, never from the
// database, since anyone with the project's anon key can read the database
// but NOT these secrets.
//
// Required secrets (set once via the Supabase CLI):
//   supabase secrets set SMTP_USERNAME="yourclub@gmail.com"
//   supabase secrets set SMTP_PASSWORD="your-16-character-app-password"
//
// Deploy with:
//   supabase functions deploy send-email

import { SMTPClient } from "https://deno.land/x/denomailer/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { to, subject, html, fromName, replyTo, pdfBase64, pdfFilename } = await req.json();

    if (!to || !subject) {
      return new Response(JSON.stringify({ error: "Missing 'to' or 'subject'" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const username = Deno.env.get("SMTP_USERNAME");
    const password = Deno.env.get("SMTP_PASSWORD");

    if (!username || !password) {
      return new Response(JSON.stringify({ error: "Email is not configured on the server (missing SMTP secrets)." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const client = new SMTPClient({
      connection: {
        hostname: "smtp.gmail.com",
        port: 465,
        tls: true,
        auth: { username, password },
      },
    });

    const attachments = [];
    if (pdfBase64) {
      attachments.push({
        filename: pdfFilename || "statement.pdf",
        content: pdfBase64,
        encoding: "base64",
        contentType: "application/pdf",
      });
    }

    await client.send({
      from: fromName ? `${fromName} <${username}>` : username,
      to,
      replyTo: replyTo || undefined,
      subject,
      content: "Please see attached." ,
      html: html || "<p>Please see attached.</p>",
      attachments,
    });

    await client.close();

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || "Unknown error sending email" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
