import PDFDocument from "pdfkit";
import type { Response } from "express";

/**
 * Generates a tabular PDF report and sends it as a download response.
 * Handles column auto-sizing, page breaks, header repetition, and AgroRed branding.
 */
export function sendPdf(
  res: Response,
  data: Record<string, unknown>[],
  filename: string,
  title: string,
): void {
  if (data.length === 0) {
    res.status(204).end();
    return;
  }

  const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 40 });
  const chunks: Buffer[] = [];

  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  doc.on("end", () => {
    const pdf = Buffer.concat(chunks);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", pdf.length);
    res.status(200).end(pdf);
  });

  const headers = Object.keys(data[0]);
  const pageWidth = doc.page.width - 80; // margins

  // ── Title ──
  doc.fontSize(16).font("Helvetica-Bold").text("AgroRed", { align: "center" });
  doc.fontSize(12).font("Helvetica").text(title, { align: "center" });
  doc.fontSize(8).text(`Generado: ${new Date().toISOString().slice(0, 19).replace("T", " ")}`, { align: "center" });
  doc.moveDown(0.8);

  // ── Column widths ──
  const colWidths = headers.map((h) => {
    const headerLen = h.length;
    let maxDataLen = 0;
    for (const row of data.slice(0, 50)) {
      const val = row[h];
      const len = val === null || val === undefined ? 0 : String(val).length;
      if (len > maxDataLen) maxDataLen = len;
    }
    return Math.max(headerLen, Math.min(maxDataLen, 30));
  });
  const totalCharWidth = colWidths.reduce((a, b) => a + b, 0) || 1;
  const colPx = colWidths.map((w) => (w / totalCharWidth) * pageWidth);

  const tableTop = doc.y;
  const rowHeight = 18;
  const fontSize = 7;

  const drawHeaderRow = (y: number) => {
    doc.font("Helvetica-Bold").fontSize(fontSize);
    let x = 40;
    doc.rect(40, y, pageWidth, rowHeight).fill("#2e7d32");
    for (let i = 0; i < headers.length; i++) {
      doc.fillColor("#ffffff").text(headers[i], x + 2, y + 4, { width: colPx[i] - 4, ellipsis: true });
      x += colPx[i];
    }
    doc.fillColor("#000000");
    return y + rowHeight;
  };

  let y = drawHeaderRow(tableTop);

  // ── Data rows ──
  doc.font("Helvetica").fontSize(fontSize);
  for (let rowIdx = 0; rowIdx < data.length; rowIdx++) {
    if (y + rowHeight > doc.page.height - 50) {
      doc.addPage();
      y = drawHeaderRow(40);
      doc.font("Helvetica").fontSize(fontSize);
    }

    const bgColor = rowIdx % 2 === 0 ? "#f5f5f5" : "#ffffff";
    doc.rect(40, y, pageWidth, rowHeight).fill(bgColor);
    doc.fillColor("#000000");

    let x = 40;
    const row = data[rowIdx];
    for (let i = 0; i < headers.length; i++) {
      const val = row[headers[i]];
      const text = val === null || val === undefined ? "" : String(val);
      doc.text(text, x + 2, y + 4, { width: colPx[i] - 4, ellipsis: true });
      x += colPx[i];
    }
    y += rowHeight;
  }

  // ── Footer ──
  doc.moveDown(0.5);
  doc.fontSize(7).fillColor("#666666")
    .text(`Total registros: ${data.length}`, 40, y + 5);

  doc.end();
}
