import jsPDF from "jspdf";
import LETTERHEAD_SRC from "../assets/letterhead.jpg";
import { groupFixturesByDate, fmtImportDateHeader } from "./fixtureImport.js";

// ---------------------------------------------------------------------------
// Produces a PDF matching the club's own weekly fixture sheet format:
// letterhead, "Weekly Fixtures for {date}" heading per date, and a table of
// Division/Team | Opponents | Time | Field (no referee column, per the
// club's preference - that's filled in on the printed matchday sheet
// instead, not this weekly overview).
// ---------------------------------------------------------------------------

export function generateFixturesPdf(fixtures, divisionLabelMap) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 48;

  const letterheadAspect = 1600 / 277;
  const letterheadHeight = pageWidth / letterheadAspect;

  function drawLetterhead() {
    try {
      doc.addImage(LETTERHEAD_SRC, "JPEG", 0, 0, pageWidth, letterheadHeight);
    } catch (e) {
      // ignore if the image fails to embed - the document still generates without it
    }
  }

  const groups = groupFixturesByDate(fixtures);
  let y = letterheadHeight + 40;
  let firstPage = true;

  for (const group of groups) {
    // Rough estimate of how much vertical space this group needs; start a
    // fresh page if it won't fit rather than splitting a table awkwardly.
    const neededHeight = 70 + group.rows.length * 20;
    if (!firstPage && y + neededHeight > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
    firstPage = false;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(36, 26, 69); // T.indigo
    doc.text(`Weekly Fixtures for ${fmtImportDateHeader(group.date)}`, margin, y);
    y += 20;

    const colX = { team: margin, opp: margin + 160, time: margin + 320, field: margin + 380 };
    const tableWidth = pageWidth - margin * 2;

    doc.setFillColor(239, 233, 218); // T.paperDim
    doc.rect(margin, y, tableWidth, 20, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(91, 84, 112);
    doc.text("DIVISION / TEAM", colX.team + 6, y + 14);
    doc.text("OPPONENTS", colX.opp + 6, y + 14);
    doc.text("TIME", colX.time + 6, y + 14);
    doc.text("FIELD", colX.field + 6, y + 14);
    y += 20;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(28, 23, 48);
    doc.setDrawColor(226, 219, 201);

    for (const f of group.rows) {
      if (y > pageHeight - margin - 20) {
        doc.addPage();
        y = margin;
      }
      const label = divisionLabelMap[f.division] || f.division || "Garlandale FC";
      doc.text(label, colX.team + 6, y + 14, { maxWidth: 150 });
      doc.text(f.opponent || "", colX.opp + 6, y + 14, { maxWidth: 155 });
      doc.text(f.time || "", colX.time + 6, y + 14);
      doc.text(f.venue || "", colX.field + 6, y + 14, { maxWidth: tableWidth - (colX.field - margin) - 6 });
      doc.line(margin, y + 20, margin + tableWidth, y + 20);
      y += 20;
    }

    y += 30;
  }

  return doc;
}

export function downloadFixturesPdf(fixtures, divisionLabelMap, filename) {
  const doc = generateFixturesPdf(fixtures, divisionLabelMap);
  doc.save(filename || "garlandale-fixtures.pdf");
}
