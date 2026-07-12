import React, { useState, useEffect, useMemo } from "react";
import html2canvas from "html2canvas";
import { T } from "../theme.js";
import { todayISO } from "../lib/format.js";
import BADGE_SRC from "../assets/badge.png";
import {
  parseFederationWorkbook,
  extractGarlandaleFixtures,
  findUnmappedDivisions,
  buildFixtureTextFromImport,
} from "../lib/fixtureImport.js";
import { downloadFixturesPdf } from "../lib/fixturePdf.js";

export const FIXTURE_TEXT_PLACEHOLDER = `29 April 2026
GFC Reserves vs Barmsley Spurs | 19h00 | Hickory Rd
GFC 1st Team vs Barmsley Spurs | 20h30 | Hickory Rd

01 May 2026
GFC Over 40 vs Sunningdale | 19h00 | Sunningdale

02 May 2026 - Fish Hoek
GFC Under 7 vs Fish Hoek | 08h30 | Minis 1
GFC Under 8 vs Fish Hoek | 08h30 | Minis 2`;

export function parseFixtureText(text) {
  const lines = text.split("\n").map((l) => l.trim());
  const groups = [];
  let current = null;
  for (const line of lines) {
    if (!line) continue;
    if (line.includes("|")) {
      if (!current) {
        current = { headerRaw: "Fixtures", rows: [] };
        groups.push(current);
      }
      const parts = line.split("|").map((p) => p.trim());
      const matchup = parts[0] || "";
      const time = parts[1] || "";
      const venue = parts[2] || "";
      let team = matchup;
      let vs = "";
      const vsMatch = matchup.match(/^(.*?)\s+vs\.?\s+(.*)$/i);
      if (vsMatch) {
        team = vsMatch[1].trim();
        vs = vsMatch[2].trim();
      }
      current.rows.push({ team, vs, time, venue });
    } else {
      current = { headerRaw: line, rows: [] };
      groups.push(current);
    }
  }
  return groups;
}

export function formatFixtureHeader(headerRaw) {
  let datePart = headerRaw;
  let suffix = "";
  const dashSplit = headerRaw.split(/\s+-\s+/);
  if (dashSplit.length === 2) {
    datePart = dashSplit[0].trim();
    suffix = dashSplit[1].trim();
  }
  const parsed = new Date(datePart);
  let label;
  if (!isNaN(parsed)) {
    label = parsed
      .toLocaleDateString("en-ZA", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })
      .toUpperCase();
  } else {
    label = headerRaw.toUpperCase();
  }
  return suffix ? `${label} – ${suffix.toUpperCase()}` : label;
}

function cleanDivisionGuess(text) {
  return String(text || "").replace(/^[A-Za-z0-9]+\s*-\s*/, "").trim();
}

export function FixturesPostView({ divisionLabels, onSaveDivisionLabel }) {
  const [rawText, setRawText] = useState(FIXTURE_TEXT_PLACEHOLDER);
  const [dateRangeLabel, setDateRangeLabel] = useState("29 APRIL – 02 MAY 2026");
  const [handle, setHandle] = useState("@GARLANDALEFC");
  const [hashtag, setHashtag] = useState("#WEAREGARLANDALE");
  const [downloading, setDownloading] = useState(false);
  const posterRef = React.useRef(null);
  const fileInputRef = React.useRef(null);

  const [importBusy, setImportBusy] = useState(false);
  const [importMessage, setImportMessage] = useState("");
  const [pendingUnmapped, setPendingUnmapped] = useState([]); // divisions awaiting a label
  const [pendingLabels, setPendingLabels] = useState({}); // division -> typed label, while confirming
  const [importedFixtures, setImportedFixtures] = useState(null); // last successfully parsed import

  const divisionLabelMap = useMemo(() => {
    const map = {};
    (divisionLabels || []).forEach((d) => { map[d.divisionKey] = d.teamLabel; });
    return map;
  }, [divisionLabels]);

  const groups = useMemo(() => parseFixtureText(rawText), [rawText]);

  async function handleFileSelected(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImportBusy(true);
    setImportMessage("");
    setPendingUnmapped([]);
    try {
      const buffer = await file.arrayBuffer();
      const rows = parseFederationWorkbook(buffer);
      const fixtures = extractGarlandaleFixtures(rows);
      if (fixtures.length === 0) {
        setImportMessage("No Garlandale fixtures found in that file — double check it's the right spreadsheet.");
        setImportBusy(false);
        return;
      }
      const unmapped = findUnmappedDivisions(fixtures, divisionLabelMap);
      setImportedFixtures(fixtures);
      if (unmapped.length > 0) {
        setPendingUnmapped(unmapped);
        const guesses = {};
        unmapped.forEach((d) => { guesses[d] = cleanDivisionGuess(d); });
        setPendingLabels(guesses);
        setImportMessage(`Found ${fixtures.length} fixture${fixtures.length === 1 ? "" : "s"}. A few divisions need a friendly name before continuing.`);
      } else {
        setImportMessage(`Found ${fixtures.length} fixture${fixtures.length === 1 ? "" : "s"}. Applied to the fixture list below.`);
        setRawText(buildFixtureTextFromImport(fixtures, divisionLabelMap));
      }
    } catch (err) {
      setImportMessage("Could not read that file — make sure it's the federation's .xls/.xlsx fixture sheet.");
    } finally {
      setImportBusy(false);
    }
  }

  async function handleConfirmUnmapped() {
    setImportBusy(true);
    try {
      for (const division of pendingUnmapped) {
        const label = (pendingLabels[division] || "").trim();
        if (label) await onSaveDivisionLabel(division, label);
      }
      const newMap = { ...divisionLabelMap, ...pendingLabels };
      setRawText(buildFixtureTextFromImport(importedFixtures, newMap));
      setPendingUnmapped([]);
      setImportMessage(`Applied ${importedFixtures.length} fixture${importedFixtures.length === 1 ? "" : "s"} to the list below.`);
    } finally {
      setImportBusy(false);
    }
  }

  function handleDownloadPdf() {
    if (!importedFixtures) return;
    downloadFixturesPdf(importedFixtures, divisionLabelMap, `garlandale-fixtures-${todayISO()}.pdf`);
  }

  async function handleDownload() {
    if (!posterRef.current) return;
    setDownloading(true);
    try {
      const canvas = await html2canvas(posterRef.current, { scale: 2, backgroundColor: null, useCORS: true });
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `garlandale-fixtures-${todayISO()}.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      }, "image/png");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div>
      <div className="gfc-topbar">
        <div>
          <div className="gfc-page-title gfc-display">Fixtures Post</div>
          <div className="gfc-page-sub">Import this week's fixtures, preview the poster, download for Instagram</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {importedFixtures && (
            <button className="gfc-btn gfc-btn-outline" onClick={handleDownloadPdf}>Download PDF</button>
          )}
          <button className="gfc-btn gfc-btn-primary" onClick={handleDownload} disabled={downloading}>
            {downloading ? "Preparing…" : "Download image"}
          </button>
        </div>
      </div>

      <div className="gfc-panel" style={{ padding: 16, marginBottom: 18 }}>
        <div className="gfc-panel-title" style={{ marginBottom: 10 }}>Import from federation spreadsheet</div>
        <div style={{ fontSize: 11.5, color: T.inkSoft, marginBottom: 10 }}>
          Upload the federation's fixture spreadsheet (.xls or .xlsx) — every Garlandale match across every division gets pulled out automatically and applied to the fixture list below.
        </div>
        <input ref={fileInputRef} type="file" accept=".xls,.xlsx" onChange={handleFileSelected} style={{ display: "none" }} />
        <button className="gfc-btn gfc-btn-outline" onClick={() => fileInputRef.current?.click()} disabled={importBusy}>
          {importBusy ? "Working…" : "Choose spreadsheet…"}
        </button>
        {importMessage && (
          <div style={{ marginTop: 10, fontSize: 12.5, color: T.inkSoft, fontWeight: 600 }}>{importMessage}</div>
        )}

        {pendingUnmapped.length > 0 && (
          <div style={{ marginTop: 14, background: T.amberSoft, border: `1px solid ${T.gold}`, borderRadius: 8, padding: 14 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: "#7a5410", marginBottom: 10 }}>
              New division{pendingUnmapped.length === 1 ? "" : "s"} found — what should {pendingUnmapped.length === 1 ? "this show as" : "these show as"}? (remembered for next time)
            </div>
            {pendingUnmapped.map((division) => (
              <div key={division} className="gfc-field" style={{ marginBottom: 8 }}>
                <label className="gfc-label" style={{ fontWeight: 400, textTransform: "none", fontSize: 11.5 }}>{division}</label>
                <input
                  className="gfc-input"
                  value={pendingLabels[division] || ""}
                  onChange={(e) => setPendingLabels((prev) => ({ ...prev, [division]: e.target.value }))}
                />
              </div>
            ))}
            <button className="gfc-btn gfc-btn-primary gfc-btn-sm" onClick={handleConfirmUnmapped} disabled={importBusy}>
              Save &amp; apply to fixture list
            </button>
          </div>
        )}
      </div>

      <div className="gfc-row2" style={{ gridTemplateColumns: "380px 1fr", alignItems: "flex-start" }}>
        <div className="gfc-panel" style={{ padding: 16 }}>
          <div className="gfc-panel-title" style={{ marginBottom: 10 }}>Fixture list</div>
          <div style={{ fontSize: 11.5, color: T.inkSoft, marginBottom: 8 }}>
            One line per date (starts a new green banner), then fixture lines under it as:
            <br /><code className="gfc-mono">Team vs Opponent | Time | Venue</code>
            <br />Add "- Location" after a date to show a location suffix, e.g. <code className="gfc-mono">02 May 2026 - Fish Hoek</code>.
          </div>
          <textarea
            className="gfc-textarea"
            style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, minHeight: 260 }}
            rows={16}
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
          />

          <div className="gfc-field" style={{ marginTop: 14 }}>
            <label className="gfc-label">Date range subtitle</label>
            <input className="gfc-input" value={dateRangeLabel} onChange={(e) => setDateRangeLabel(e.target.value)} />
          </div>
          <div className="gfc-row2">
            <div className="gfc-field">
              <label className="gfc-label">Social handle</label>
              <input className="gfc-input" value={handle} onChange={(e) => setHandle(e.target.value)} />
            </div>
            <div className="gfc-field">
              <label className="gfc-label">Hashtag</label>
              <input className="gfc-input" value={hashtag} onChange={(e) => setHashtag(e.target.value)} />
            </div>
          </div>
        </div>

        <PosterPreviewFrame>
          <div ref={posterRef}>
            <FixturePoster groups={groups} dateRangeLabel={dateRangeLabel} handle={handle} hashtag={hashtag} />
          </div>
        </PosterPreviewFrame>
      </div>
    </div>
  );
}

function PosterPreviewFrame({ children }) {
  const outerRef = React.useRef(null);
  const innerRef = React.useRef(null);
  const [scale, setScale] = useState(1);
  const [innerHeight, setInnerHeight] = useState(0);

  useEffect(() => {
    function recompute() {
      if (!outerRef.current || !innerRef.current) return;
      const availableWidth = outerRef.current.clientWidth;
      const naturalWidth = 1080;
      const s = Math.min(1, availableWidth / naturalWidth);
      setScale(s);
      setInnerHeight(innerRef.current.scrollHeight);
    }
    recompute();
    const ro = new ResizeObserver(recompute);
    if (outerRef.current) ro.observe(outerRef.current);
    const mo = new MutationObserver(recompute);
    if (innerRef.current) mo.observe(innerRef.current, { childList: true, subtree: true, characterData: true });
    return () => { ro.disconnect(); mo.disconnect(); };
  }, []);

  return (
    <div ref={outerRef} className="gfc-panel" style={{ padding: 12, overflow: "hidden" }}>
      <div style={{ height: innerHeight * scale || "auto" }}>
        <div ref={innerRef} style={{ transform: `scale(${scale})`, transformOrigin: "top left", width: 1080 }}>
          {children}
        </div>
      </div>
    </div>
  );
}

function FixturePoster({ groups, dateRangeLabel, handle, hashtag }) {
  return (
    <div
      style={{
        width: 1080,
        background: "linear-gradient(155deg, #0d0a1f 0%, #1a1338 45%, #123322 100%)",
        padding: 48,
        display: "flex",
        gap: 40,
        fontFamily: "'Karla', sans-serif",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div style={{ position: "absolute", top: -120, left: -120, width: 400, height: 400, background: "radial-gradient(circle, rgba(232,172,46,0.18), transparent 70%)" }} />
      <div style={{ position: "absolute", bottom: -140, right: -140, width: 460, height: 460, background: "radial-gradient(circle, rgba(30,122,65,0.28), transparent 70%)" }} />

      {/* LEFT: branding */}
      <div style={{ width: 380, flexShrink: 0, position: "relative", zIndex: 1, display: "flex", flexDirection: "column" }}>
        <div style={{ color: T.gold, fontFamily: "'Anton', sans-serif", fontSize: 26, letterSpacing: 2 }}>GARLANDALE FC</div>
        <div style={{ color: "#fff", fontFamily: "'Anton', sans-serif", fontSize: 84, lineHeight: 0.95, marginTop: 4, textTransform: "uppercase" }}>Fixtures</div>
        <div style={{ display: "inline-block", marginTop: 18, background: T.green, color: "#fff", fontWeight: 800, fontSize: 20, padding: "8px 16px", borderRadius: 4, alignSelf: "flex-start" }}>
          {dateRangeLabel}
        </div>

        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "flex-start", padding: "30px 0" }}>
          <img src={BADGE_SRC} alt="Garlandale FC crest" style={{ width: 260, height: 260 }} />
        </div>

        <div style={{ display: "flex", gap: 14, color: "#fff", fontSize: 13, fontWeight: 700, flexWrap: "wrap" }}>
          <span>👥 TOGETHER</span>
          <span style={{ color: T.gold }}>|</span>
          <span>❤️ PASSION</span>
          <span style={{ color: T.gold }}>|</span>
          <span>📈 PROGRESS</span>
        </div>
        <div style={{ marginTop: 10, color: "#fff", fontSize: 14, fontWeight: 700 }}>
          📷 📘 {handle}
        </div>
        <div style={{ marginTop: 14, fontFamily: "'Anton', sans-serif", fontSize: 30 }}>
          <span style={{ color: "#fff" }}>{hashtag.replace(/garlandale/i, "").toUpperCase() === hashtag.toUpperCase() ? hashtag : hashtag}</span>
        </div>
      </div>

      {/* RIGHT: fixture groups */}
      <div style={{ flex: 1, position: "relative", zIndex: 1, display: "flex", flexDirection: "column", gap: 22 }}>
        {groups.length === 0 && (
          <div style={{ color: "#fff", opacity: 0.6, fontSize: 16, padding: 20 }}>
            Paste fixtures on the left to see them appear here.
          </div>
        )}
        {groups.map((g, gi) => (
          <div key={gi} style={{ borderRadius: 6, overflow: "hidden", border: "1px solid rgba(232,172,46,0.4)" }}>
            <div style={{ background: T.green, color: "#fff", fontWeight: 800, fontSize: 19, padding: "10px 16px", textTransform: "uppercase", letterSpacing: 0.5 }}>
              📅 {formatFixtureHeader(g.headerRaw)}
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#0d0a1f" }}>
                  {["Team", "Vs", "Time", "Venue"].map((h) => (
                    <th key={h} style={{ color: T.gold, textTransform: "uppercase", fontSize: 12, fontWeight: 800, padding: "8px 12px", textAlign: "left", borderBottom: "1px solid rgba(232,172,46,0.3)" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {g.rows.map((r, ri) => (
                  <tr key={ri} style={{ background: ri % 2 === 0 ? "#161029" : "#1c1738" }}>
                    <td style={{ color: "#fff", fontWeight: 700, fontSize: 14, padding: "9px 12px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>{r.team}</td>
                    <td style={{ color: "#fff", fontSize: 14, padding: "9px 12px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>{r.vs}</td>
                    <td style={{ color: T.gold, fontWeight: 800, fontSize: 14, padding: "9px 12px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>{r.time}</td>
                    <td style={{ color: "#fff", fontSize: 14, padding: "9px 12px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>{r.venue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}
