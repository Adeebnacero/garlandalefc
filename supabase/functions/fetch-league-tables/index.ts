// Supabase Edge Function: fetch-league-tables
//
// Fetches each URL in league_table_sources (public standings pages on the
// federation's LeagueRepublic site), parses the table, and replaces
// league_standings for that source. If a fetch or parse fails, the error is
// recorded on the source row and the last good standings are kept.
//
// Locked down 3 November 2026:
//   - Only the weekly pg_cron job can run it: it must send the shared
//     secret from Vault (league_cron_secret) in an x-cron-secret header,
//     checked by verify_cron_secret() - see
//     migrations/2026-11-league-tables-secret.sql. Before this, anyone on
//     the internet could trigger it.
//   - Only https://*.leaguerepublic.com pages are fetched (also checked
//     after redirects), with a timeout and a size cap, so a source URL
//     can't be used to reach other servers.
//   - New standings are saved before the old ones are removed, so a failed
//     save can't leave the table empty.
//   - It identifies itself honestly in the User-Agent header. LeagueRepublic
//     currently answers 403 (bot protection); ask them for access or a
//     data feed rather than imitating a browser.
//
// Deploy with (cron can't send a login, so JWT checking stays off):
//   supabase functions deploy fetch-league-tables --no-verify-jwt

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const ALLOWED_HOST_RE = /^([a-z0-9-]+\.)*leaguerepublic\.com$/i;
const MAX_PAGE_BYTES = 2_000_000;
const FETCH_TIMEOUT_MS = 20_000;
const USER_AGENT = "GarlandaleFC-LeagueTables/1.0 (weekly club standings update; https://garlandalefc.vercel.app)";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function allowedUrl(raw: string) {
  try {
    const u = new URL(raw);
    return u.protocol === "https:" && !u.port && !u.username && !u.password && ALLOWED_HOST_RE.test(u.hostname);
  } catch {
    return false;
  }
}

// Same team-code-stripping convention as the fixture spreadsheet import
// (src/lib/fixtureImport.js) - e.g. "PD-01- Durbanville" -> "Durbanville".
function stripTeamCode(name: string) {
  return String(name || "").replace(/^[A-Za-z0-9]+-\d+-\s*/, "").trim();
}

function isGarlandale(name: string) {
  return stripTeamCode(name).toLowerCase().includes("garlandale");
}

function stripHtmlTags(html: string) {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function extractCells(rowHtml: string) {
  const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
  const cells: string[] = [];
  let m;
  while ((m = cellRegex.exec(rowHtml)) !== null) cells.push(stripHtmlTags(m[1]));
  return cells;
}

async function fetchPage(url: string) {
  if (!allowedUrl(url)) throw new Error("Source URL must be an https://…leaguerepublic.com page");
  const resp = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, "Accept": "text/html" },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!allowedUrl(resp.url)) throw new Error("Source redirected away from leaguerepublic.com");
  if (!resp.ok) throw new Error(`Fetch failed with status ${resp.status}`);
  const declared = Number(resp.headers.get("content-length") || "0");
  if (declared > MAX_PAGE_BYTES) throw new Error("Source page is too large");
  const html = await resp.text();
  if (html.length > MAX_PAGE_BYTES) throw new Error("Source page is too large");
  return html;
}

function parseStandings(html: string) {
  const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/gi;
  let tableHtml: string | null = null;
  let tm;
  while ((tm = tableRegex.exec(html)) !== null) {
    if (/PTS/i.test(tm[1])) { tableHtml = tm[1]; break; }
  }
  if (!tableHtml) throw new Error("Could not find a standings table on the page");

  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const rows: string[] = [];
  let rm;
  while ((rm = rowRegex.exec(tableHtml)) !== null) rows.push(rm[1]);

  // Locate columns by header label, not position.
  let headerIndex = -1;
  let headerCells: string[] = [];
  for (let i = 0; i < rows.length; i++) {
    const cells = extractCells(rows[i]).map((c) => c.trim().toUpperCase());
    if (cells.includes("PTS")) { headerIndex = i; headerCells = cells; break; }
  }
  if (headerIndex === -1) throw new Error("Could not find a header row with PTS in the standings table");

  const col = (label: string) => headerCells.indexOf(label);
  const idx = {
    played: col("P"), won: col("W"), drawn: col("D"), lost: col("L"),
    goalsFor: col("F"), goalsAgainst: col("A"), goalDifference: col("+-"), points: col("PTS"),
  };
  const required = ["played", "won", "drawn", "lost", "goalsFor", "goalsAgainst", "points"] as const;
  const missing = required.filter((k) => idx[k] === -1);
  if (missing.length) throw new Error(`Standings table is missing expected column(s): ${missing.join(", ")}`);

  const teamCol = 1;
  const maxColNeeded = Math.max(teamCol, ...Object.values(idx));
  const standings = [];
  for (const rowHtml of rows.slice(headerIndex + 1)) {
    const cells = extractCells(rowHtml);
    if (cells.length <= maxColNeeded) continue;
    const teamRaw = cells[teamCol];
    if (!teamRaw) continue;
    const num = (i: number) => (i === -1 ? 0 : parseInt(cells[i], 10) || 0);
    const posRaw = parseInt(cells[0], 10);
    standings.push({
      position: Number.isFinite(posRaw) ? posRaw : null,
      team_name: stripTeamCode(teamRaw).slice(0, 120),
      played: num(idx.played), won: num(idx.won), drawn: num(idx.drawn), lost: num(idx.lost),
      goals_for: num(idx.goalsFor), goals_against: num(idx.goalsAgainst),
      goal_difference: num(idx.goalDifference), points: num(idx.points),
      is_garlandale: isGarlandale(teamRaw),
    });
  }
  if (standings.length === 0) throw new Error("Standings table found but no data rows could be parsed");
  if (standings.length > 100) throw new Error("Standings table has an unexpected number of rows");
  return standings;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Use POST" }, 405);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Only the weekly job, which sends the Vault secret.
  const secret = req.headers.get("x-cron-secret") || "";
  const { data: ok, error: secretErr } = await admin.rpc("verify_cron_secret", { p_name: "league_cron_secret", p_secret: secret });
  if (secretErr) {
    console.error("fetch-league-tables: secret check failed", secretErr);
    return json({ error: "Not allowed" }, 401);
  }
  if (ok !== true) return json({ error: "Not allowed" }, 401);

  try {
    const { data: sources, error: sourcesErr } = await admin.from("league_table_sources").select("id, division_label, source_url");
    if (sourcesErr) throw sourcesErr;

    const results = [];
    for (const source of sources || []) {
      try {
        const standings = parseStandings(await fetchPage(source.source_url));

        // Save the new rows first; only then remove the previous ones.
        const { data: previous } = await admin.from("league_standings").select("id").eq("source_id", source.id);
        const { error: insertErr } = await admin.from("league_standings")
          .insert(standings.map((s) => ({ ...s, source_id: source.id })));
        if (insertErr) throw insertErr;
        const oldIds = (previous || []).map((r: { id: string }) => r.id);
        if (oldIds.length) await admin.from("league_standings").delete().in("id", oldIds);

        await admin.from("league_table_sources")
          .update({ last_fetched_at: new Date().toISOString(), last_fetch_error: null }).eq("id", source.id);
        results.push({ source: source.division_label, success: true, rows: standings.length });
      } catch (e) {
        const message = String((e as Error)?.message || "Unknown error").slice(0, 300);
        await admin.from("league_table_sources").update({ last_fetch_error: message }).eq("id", source.id);
        results.push({ source: source.division_label, success: false, error: message });
      }
    }
    return json({ results });
  } catch (err) {
    console.error("fetch-league-tables: failed", err);
    return json({ error: "Couldn't update league tables." }, 500);
  }
});
