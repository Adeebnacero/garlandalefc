// Supabase Edge Function: fetch-league-tables
//
// Fetches each URL configured in league_table_sources (public standings
// pages on the federation's LeagueRepublic site), parses the HTML table,
// and replaces league_standings for that source with fresh data.
//
// IMPORTANT: this is screen-scraping a third-party website, not parsing a
// stable file format. If LeagueRepublic ever changes their page layout,
// parsing could break. Deliberately does NOT wipe out existing standings
// on a failed fetch/parse - the error is recorded on the source row, and
// the last successfully parsed data is left in place. A stale table is
// more useful than a blank one.
//
// Deliberately uses plain regex rather than a DOM-parsing library: an
// earlier version used "linkedom", which transitively pulls in a "canvas"
// package requiring a native binary Deno's edge runtime can't bundle
// ("Module not found ...canvas.node"). Since the table's exact structure
// is already known from real fetched data, regex is simpler and has zero
// external dependencies to break in this environment.
//
// Triggered weekly by pg_cron (see schema.sql) - not meant to be called
// directly by any user action in the app.
//
// Deploy with:
//   supabase functions deploy fetch-league-tables --no-verify-jwt
//
// (--no-verify-jwt is needed since this is called by a scheduled job, not
// a logged-in user - the function has no user JWT to verify. It's still
// only reachable with the project's service role key, which pg_cron's
// call includes - see the cron job definition in schema.sql.)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Same team-code-stripping convention as the fixture spreadsheet import
// (src/lib/fixtureImport.js) - e.g. "PD-01- Durbanville" -> "Durbanville".
function stripTeamCode(name) {
  return String(name || "").replace(/^[A-Za-z0-9]+-\d+-\s*/, "").trim();
}

function isGarlandale(name) {
  return stripTeamCode(name).toLowerCase().includes("garlandale");
}

/** Strips HTML tags (keeping the text between them) and decodes the small set of entities this page actually uses. */
function stripHtmlTags(html) {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function extractCells(rowHtml) {
  const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
  const cells = [];
  let m;
  while ((m = cellRegex.exec(rowHtml)) !== null) {
    cells.push(stripHtmlTags(m[1]));
  }
  return cells;
}

async function parseStandingsPage(url) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Fetch failed with status ${resp.status}`);
  const html = await resp.text();

  // The standings table is identified by its header row containing "PTS" -
  // more robust than assuming it's the first/only <table> on the page.
  const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/gi;
  let tableHtml = null;
  let tm;
  while ((tm = tableRegex.exec(html)) !== null) {
    if (/PTS/i.test(tm[1])) {
      tableHtml = tm[1];
      break;
    }
  }
  if (!tableHtml) throw new Error("Could not find a standings table on the page");

  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const rows = [];
  let rm;
  while ((rm = rowRegex.exec(tableHtml)) !== null) {
    rows.push(rm[1]);
  }

  // The table has two header rows (a grouping row: Home/Away/Overall, then
  // the actual column labels: P/W/D/L/F/A repeated) before any data rows.
  const dataRows = rows.slice(2);

  const standings = [];
  for (const rowHtml of dataRows) {
    const cells = extractCells(rowHtml);
    if (cells.length < 21) continue; // not a real data row (e.g. a stray footer row)

    const teamRaw = cells[1];
    if (!teamRaw) continue;

    const num = (i) => parseInt(cells[i], 10) || 0;

    standings.push({
      position: num(0) || null,
      team_name: stripTeamCode(teamRaw),
      played: num(2),
      won: num(13),
      drawn: num(14),
      lost: num(15),
      goals_for: num(16),
      goals_against: num(17),
      goal_difference: num(18),
      points: num(20),
      is_garlandale: isGarlandale(teamRaw),
    });
  }

  if (standings.length === 0) throw new Error("Standings table found but no data rows could be parsed");
  return standings;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: sources, error: sourcesErr } = await adminClient.from("league_table_sources").select("*");
    if (sourcesErr) throw sourcesErr;

    const results = [];
    for (const source of sources || []) {
      try {
        const standings = await parseStandingsPage(source.source_url);

        await adminClient.from("league_standings").delete().eq("source_id", source.id);
        const { error: insertErr } = await adminClient
          .from("league_standings")
          .insert(standings.map((s) => ({ ...s, source_id: source.id })));
        if (insertErr) throw insertErr;

        await adminClient
          .from("league_table_sources")
          .update({ last_fetched_at: new Date().toISOString(), last_fetch_error: null })
          .eq("id", source.id);

        results.push({ source: source.division_label, success: true, rows: standings.length });
      } catch (e) {
        // Deliberately do NOT touch league_standings here - keep whatever
        // was last successfully parsed rather than wiping it out.
        await adminClient
          .from("league_table_sources")
          .update({ last_fetch_error: e.message || "Unknown error" })
          .eq("id", source.id);
        results.push({ source: source.division_label, success: false, error: e.message || "Unknown error" });
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || "Unknown error fetching league tables." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
