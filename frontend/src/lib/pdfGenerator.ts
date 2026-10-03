import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AnalyzeResponse, Claim, Discrepancy, MetricComparisonItem } from './api';

const ROOT_CAUSE_LABELS: Record<string, string> = {
  missing_hyperparameter: 'Missing Hyperparameter',
  dataset_split_difference: 'Dataset Split Difference',
  dependency_version_drift: 'Dependency Version Drift',
  seed_variance: 'Seed / Init Variance',
  undocumented_default: 'Undocumented Default',
  insufficient_evidence: 'Insufficient Evidence',
};

export function sanitizeFilename(title?: string): string {
  if (!title) return 'reprova-reproducibility-report.pdf';
  const clean = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `reprova-${clean || 'analysis'}-reproducibility-report.pdf`;
}

export function generateReproducibilityReportPDF(data: AnalyzeResponse, isCustom: boolean = false): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;

  // Reprova Color Palette (RGB arrays)
  const colors = {
    navyDark: [15, 23, 42],      // slate-900 / dark navy
    slateDark: [51, 65, 85],     // slate-700
    slateMuted: [100, 116, 139], // slate-500
    slateLight: [248, 250, 252], // slate-50
    skyPrimary: [14, 165, 233],  // sky-500
    skyDark: [3, 105, 161],      // sky-700
    skyLight: [240, 249, 255],   // sky-50
    emerald: [16, 185, 129],     // emerald-500
    emeraldDark: [6, 95, 70],    // emerald-900
    emeraldBg: [236, 253, 245],  // emerald-50
    amber: [245, 158, 11],       // amber-500
    amberDark: [120, 53, 15],    // amber-900
    amberBg: [254, 243, 199],    // amber-100
    rose: [244, 63, 94],         // rose-500
    roseDark: [136, 19, 55],     // rose-900
    roseBg: [255, 228, 230],     // rose-100
    borderGray: [226, 232, 240], // slate-200
  };

  let cursorY = margin;

  // --- HEADER BANNER ---
  doc.setFillColor(colors.skyDark[0], colors.skyDark[1], colors.skyDark[2]);
  doc.rect(margin, cursorY, contentWidth, 48, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('REPROVA', margin + 14, cursorY + 24);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('AUTOMATED RESEARCH REPRODUCIBILITY AUDIT REPORT', margin + 14, cursorY + 38);

  const reportDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  doc.setFontSize(8);
  doc.text(`Generated: ${reportDate}`, pageWidth - margin - 14, cursorY + 30, { align: 'right' });

  cursorY += 60;

  // --- PAPER METADATA CARD ---
  doc.setFillColor(colors.slateLight[0], colors.slateLight[1], colors.slateLight[2]);
  doc.setDrawColor(colors.borderGray[0], colors.borderGray[1], colors.borderGray[2]);
  doc.roundedRect(margin, cursorY, contentWidth, 68, 4, 4, 'FD');

  const titleText = data.paper_title || 'Reproducibility Analysis Report';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(colors.navyDark[0], colors.navyDark[1], colors.navyDark[2]);

  // Wrap title text if long
  const titleLines = doc.splitTextToSize(titleText, contentWidth - 28);
  doc.text(titleLines, margin + 14, cursorY + 20);

  const titleHeightOffset = titleLines.length * 13;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(colors.slateDark[0], colors.slateDark[1], colors.slateDark[2]);

  const repoText = data.repo_url ? `Repository: ${data.repo_url}` : 'Repository: Unspecified';
  const typeText = `Analysis Type: ${isCustom ? 'Custom Upload & Repository Inspection' : 'Curated Paper Benchmark Target'}`;

  doc.text(typeText, margin + 14, cursorY + 22 + titleHeightOffset);
  doc.text(repoText, margin + 14, cursorY + 35 + titleHeightOffset);

  cursorY += Math.max(78, 45 + titleHeightOffset + 25);

  // --- REPRODUCIBILITY SCORE & SUMMARY CARDS ---
  const cardWidth = (contentWidth - 20) / 3;
  const summaryCardHeight = 72;

  // Card 1: Score
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(colors.borderGray[0], colors.borderGray[1], colors.borderGray[2]);
  doc.roundedRect(margin, cursorY, cardWidth, summaryCardHeight, 4, 4, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(colors.slateMuted[0], colors.slateMuted[1], colors.slateMuted[2]);
  doc.text('REPRODUCIBILITY SCORE', margin + 10, cursorY + 16);

  const scoreVal = data.reproducibility_score !== null && data.reproducibility_score !== undefined ? `${data.reproducibility_score}` : 'N/A';
  doc.setFontSize(26);

  if (data.reproducibility_score !== null && data.reproducibility_score !== undefined) {
    if (data.reproducibility_score >= 80) {
      doc.setTextColor(colors.emeraldDark[0], colors.emeraldDark[1], colors.emeraldDark[2]);
    } else if (data.reproducibility_score >= 50) {
      doc.setTextColor(colors.amberDark[0], colors.amberDark[1], colors.amberDark[2]);
    } else {
      doc.setTextColor(colors.roseDark[0], colors.roseDark[1], colors.roseDark[2]);
    }
  } else {
    doc.setTextColor(colors.navyDark[0], colors.navyDark[1], colors.navyDark[2]);
  }
  doc.text(scoreVal, margin + 10, cursorY + 46);

  if (scoreVal !== 'N/A') {
    doc.setFontSize(10);
    doc.setTextColor(colors.slateMuted[0], colors.slateMuted[1], colors.slateMuted[2]);
    doc.text('/ 100', margin + 75, cursorY + 46);
  }

  doc.setFontSize(7);
  doc.setTextColor(colors.slateMuted[0], colors.slateMuted[1], colors.slateMuted[2]);
  doc.text('Deterministic score formula', margin + 10, cursorY + 62);

  // Card 2: Claims Breakdown
  const claimsList: Claim[] = Array.isArray(data.claims) ? data.claims : [];
  const matchedCount = claimsList.filter((c) => ['matched', 'verified'].includes(c.status)).length;
  const partialCount = claimsList.filter((c) => ['partial_match', 'unverified'].includes(c.status)).length;
  const conflictCount = claimsList.filter((c) => ['conflicting', 'not_found'].includes(c.status)).length;

  doc.setFillColor(255, 255, 255);
  doc.roundedRect(margin + cardWidth + 10, cursorY, cardWidth, summaryCardHeight, 4, 4, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(colors.slateMuted[0], colors.slateMuted[1], colors.slateMuted[2]);
  doc.text('CLAIM MATCHING METRICS', margin + cardWidth + 20, cursorY + 16);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(colors.navyDark[0], colors.navyDark[1], colors.navyDark[2]);
  doc.text(`Total Extracted Claims: ${claimsList.length}`, margin + cardWidth + 20, cursorY + 30);
  doc.text(`Matched / Verified: ${matchedCount}`, margin + cardWidth + 20, cursorY + 42);
  doc.text(`Partial Mismatches: ${partialCount}`, margin + cardWidth + 20, cursorY + 54);
  doc.text(`Conflicting / Missing: ${conflictCount}`, margin + cardWidth + 20, cursorY + 66);

  // Card 3: Execution Status
  const execRes = data.execution_result;
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(margin + (cardWidth + 10) * 2, cursorY, cardWidth, summaryCardHeight, 4, 4, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(colors.slateMuted[0], colors.slateMuted[1], colors.slateMuted[2]);
  doc.text('SANDBOXED EXECUTION', margin + (cardWidth + 10) * 2 + 10, cursorY + 16);

  doc.setFontSize(9);
  const statusStr = execRes?.status ? execRes.status.toUpperCase() : 'SKIPPED';
  doc.setTextColor(
    statusStr === 'SUCCESS' ? colors.emeraldDark[0] : statusStr === 'SKIPPED' ? colors.slateDark[0] : colors.roseDark[0],
    statusStr === 'SUCCESS' ? colors.emeraldDark[1] : statusStr === 'SKIPPED' ? colors.slateDark[1] : colors.roseDark[1],
    statusStr === 'SUCCESS' ? colors.emeraldDark[2] : statusStr === 'SKIPPED' ? colors.slateDark[2] : colors.roseDark[2]
  );
  doc.text(`Status: ${statusStr}`, margin + (cardWidth + 10) * 2 + 10, cursorY + 32);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(colors.slateDark[0], colors.slateDark[1], colors.slateDark[2]);
  const execTimeStr = execRes?.execution_time_seconds ? `${execRes.execution_time_seconds}s` : 'N/A';
  doc.text(`Execution Time: ${execTimeStr}`, margin + (cardWidth + 10) * 2 + 10, cursorY + 46);

  const verdictStr = execRes?.comparison?.overall_verdict
    ? execRes.comparison.overall_verdict.replace('_', ' ').toUpperCase()
    : 'N/A';
  doc.text(`Verdict: ${verdictStr}`, margin + (cardWidth + 10) * 2 + 10, cursorY + 58);

  cursorY += summaryCardHeight + 20;

  // --- SECTION 1: EXTRACTED CLAIMS & CODE MATCHING TABLE ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(colors.navyDark[0], colors.navyDark[1], colors.navyDark[2]);
  doc.text('1. Extracted Methodology Claims & Code Match Audit', margin, cursorY);
  cursorY += 10;

  const claimsTableRows = claimsList.map((claim, idx) => {
    const statusText = (claim.status || 'unverified').replace('_', ' ').toUpperCase();
    const confText = (claim.confidence || 'high').toUpperCase();
    const impText = (claim.importance || 'medium').toUpperCase();
    const impWeight = claim.weight ?? (impText === 'HIGH' ? 3.0 : impText === 'LOW' ? 1.0 : 2.0);
    const earnedPts = claim.earned_points ?? (['matched', 'verified'].includes(claim.status) ? impWeight : ['partial_match', 'unverified'].includes(claim.status) ? impWeight * 0.5 : 0.0);
    
    const citationStr = claim.citation ? `\n[${claim.citation}]` : claim.page_number ? `\n[Page ${claim.page_number}]` : '';
    const paperEvStr = claim.paper_reference ? `"${claim.paper_reference}"${citationStr}` : 'N/A';

    const lineStr = claim.start_line ? `:L${claim.start_line}${claim.end_line && claim.end_line !== claim.start_line ? `-L${claim.end_line}` : ''}` : '';
    const symStr = claim.symbol_name ? ` (${claim.symbol_name})` : '';
    const simStr = claim.similarity_score !== undefined && claim.similarity_score !== null ? ` (Sim: ${claim.similarity_score})` : '';
    let codeLocStr = 'No supporting repository evidence found.';
    if (claim.status !== 'not_found' && claim.matched_file) {
      codeLocStr = `${claim.matched_file}${lineStr}${symStr}\n${claim.matched_value || ''}${simStr}`;
    } else if (claim.rejected_candidate) {
      codeLocStr = `No supporting evidence found.\n[Rejected candidate: ${claim.rejected_candidate.file_path} (Sim: ${claim.rejected_candidate.similarity_score})]`;
    }

    return [
      `${idx + 1}. ${claim.description}\nImp: ${impText} (${impWeight.toFixed(1)} wt) | Pts: ${earnedPts.toFixed(1)}/${impWeight.toFixed(1)}`,
      paperEvStr,
      codeLocStr,
      `${statusText}\n${claim.reasoning || ''}`,
    ];
  });

  autoTable(doc, {
    startY: cursorY,
    head: [['Claim, Importance & Points', 'Paper Evidence', 'Code Location & Value', 'Status & Reasoning']],
    body: claimsTableRows.length > 0 ? claimsTableRows : [['No claims extracted.', '-', '-', '-']],
    margin: { left: margin, right: margin },
    styles: { fontSize: 8, cellPadding: 6, font: 'helvetica', textColor: [51, 65, 85] },
    headStyles: { fillColor: [14, 165, 233], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 145 },
      1: { cellWidth: 120 },
      2: { cellWidth: 110 },
      3: { cellWidth: 140 },
    },
    didParseCell: (dataCell) => {
      if (dataCell.section === 'body' && dataCell.column.index === 3) {
        const text = dataCell.cell.raw as string;
        if (text.startsWith('MATCHED') || text.startsWith('VERIFIED')) {
          dataCell.cell.styles.textColor = [6, 95, 70];
          dataCell.cell.styles.fontStyle = 'bold';
        } else if (text.startsWith('PARTIAL')) {
          dataCell.cell.styles.textColor = [120, 53, 15];
          dataCell.cell.styles.fontStyle = 'bold';
        } else if (text.startsWith('CONFLICTING') || text.startsWith('NOT FOUND')) {
          dataCell.cell.styles.textColor = [136, 19, 55];
          dataCell.cell.styles.fontStyle = 'bold';
        }
      }
    },
  });

  // @ts-expect-error autoTable adds lastAutoTable property to doc
  cursorY = doc.lastAutoTable.finalY + 20;

  // --- SECTION 2: SANDBOXED EXECUTION & METRIC COMPARISON TABLE ---
  const comparisons: MetricComparisonItem[] = execRes?.comparison?.comparisons || [];

  if (cursorY + 100 > pageHeight - margin) {
    doc.addPage();
    cursorY = margin;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(colors.navyDark[0], colors.navyDark[1], colors.navyDark[2]);
  doc.text('2. Sandboxed Container Benchmark Metric Comparison (Deterministic Simulation)', margin, cursorY);
  cursorY += 10;

  const metricTableRows = comparisons.map((c) => [
    c.metric,
    `${c.claimed}`,
    c.reproduced !== null ? `${c.reproduced}` : 'N/A',
    c.difference_pct !== null ? `${c.difference_pct}%` : 'N/A',
    c.verdict.toUpperCase(),
  ]);

  autoTable(doc, {
    startY: cursorY,
    head: [['Metric', 'Claimed Value', 'Reproduced Value', 'Difference %', 'Verdict']],
    body:
      metricTableRows.length > 0
        ? metricTableRows
        : [[execRes?.status === 'skipped' ? 'Benchmark execution skipped for non-curated repo' : 'No numeric metrics parsed', '-', '-', '-', '-']],
    margin: { left: margin, right: margin },
    styles: { fontSize: 8, cellPadding: 6, font: 'helvetica', textColor: [51, 65, 85] },
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 120 },
      1: { cellWidth: 100 },
      2: { cellWidth: 100 },
      3: { cellWidth: 95 },
      4: { cellWidth: 100 },
    },
    didParseCell: (dataCell) => {
      if (dataCell.section === 'body' && dataCell.column.index === 4) {
        const text = dataCell.cell.raw as string;
        if (text === 'MATCH') {
          dataCell.cell.styles.textColor = [6, 95, 70];
          dataCell.cell.styles.fontStyle = 'bold';
        } else if (text === 'PARTIAL') {
          dataCell.cell.styles.textColor = [120, 53, 15];
          dataCell.cell.styles.fontStyle = 'bold';
        } else if (text === 'MISMATCH') {
          dataCell.cell.styles.textColor = [136, 19, 55];
          dataCell.cell.styles.fontStyle = 'bold';
        }
      }
    },
  });

  // @ts-expect-error autoTable adds lastAutoTable property to doc
  cursorY = doc.lastAutoTable.finalY + 16;

  // --- SECTION 2.1: MULTI-SEED VARIANCE ANALYSIS ---
  const multiSeedExec = execRes?.multi_seed_execution;
  if (multiSeedExec) {
    if (cursorY + 90 > pageHeight - margin) {
      doc.addPage();
      cursorY = margin;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(colors.navyDark[0], colors.navyDark[1], colors.navyDark[2]);
    doc.text('2.1 Multi-Seed Variance Analysis (Deterministic Seed Simulation)', margin, cursorY);
    cursorY += 10;

    if (!multiSeedExec.supports_multi_seed) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(colors.slateDark[0], colors.slateDark[1], colors.slateDark[2]);
      const reasonText = multiSeedExec.reason || 'Seed control unavailable for this experiment. Single-run metrics preserved.';
      doc.text(`Status: Seed Control Unavailable. (${reasonText})`, margin, cursorY);
      cursorY += 18;
    } else {
      const multiSeedRows = (multiSeedExec.metrics_summary || []).map((m) => [
        m.metric,
        `${m.claimed_value}`,
        m.mean_val !== null && m.mean_val !== undefined ? `${m.mean_val}` : 'N/A',
        m.range_str || 'N/A',
        m.std_dev !== null && m.std_dev !== undefined ? `${m.std_dev}` : 'N/A',
        m.interpretation_code.replace('_', ' ').toUpperCase(),
      ]);

      autoTable(doc, {
        startY: cursorY,
        head: [['Metric', 'Claimed', 'Observed Mean', 'Observed Range', 'Std Dev', 'Interpretation']],
        body: multiSeedRows.length > 0 ? multiSeedRows : [['No metrics evaluated.', '-', '-', '-', '-', '-']],
        margin: { left: margin, right: margin },
        styles: { fontSize: 8, cellPadding: 5, font: 'helvetica', textColor: [51, 65, 85] },
        headStyles: { fillColor: [3, 105, 161], textColor: [255, 255, 255], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
          0: { cellWidth: 100 },
          1: { cellWidth: 65 },
          2: { cellWidth: 80 },
          3: { cellWidth: 90 },
          4: { cellWidth: 60 },
          5: { cellWidth: 120 },
        },
      });

      // @ts-expect-error autoTable adds lastAutoTable property to doc
      cursorY = doc.lastAutoTable.finalY + 16;
    }
  }

  // --- SECTION 3: DISCREPANCIES & ROOT CAUSE ANALYSIS ---
  const discrepanciesList: Discrepancy[] = Array.isArray(data.discrepancies) ? data.discrepancies : [];

  if (cursorY + 100 > pageHeight - margin) {
    doc.addPage();
    cursorY = margin;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(colors.navyDark[0], colors.navyDark[1], colors.navyDark[2]);
  doc.text('3. Flagged Discrepancies & Root Cause Diagnoses', margin, cursorY);
  cursorY += 10;

  const discTableRows = discrepanciesList.map((disc) => {
    const rcLabel = ROOT_CAUSE_LABELS[disc.root_cause || 'insufficient_evidence'] || 'Insufficient Evidence';
    const fixText = disc.fix_suggestion ? `\n\nHow to fix:\n${disc.fix_suggestion}` : '';
    return [
      (disc.severity || 'medium').toUpperCase(),
      disc.location || 'Repository Codebase',
      disc.description,
      `${rcLabel}\n${disc.root_cause_explanation || ''}${fixText}`,
    ];
  });

  autoTable(doc, {
    startY: cursorY,
    head: [['Severity', 'Location', 'Description', 'Root Cause Tag, Explanation & Fix']],
    body: discTableRows.length > 0 ? discTableRows : [['-','-','No discrepancies flagged for this repository.','-']],
    margin: { left: margin, right: margin },
    styles: { fontSize: 8, cellPadding: 6, font: 'helvetica', textColor: [51, 65, 85] },
    headStyles: { fillColor: [245, 158, 11], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 55 },
      1: { cellWidth: 105 },
      2: { cellWidth: 160 },
      3: { cellWidth: 195 },
    },
  });

  // @ts-expect-error autoTable adds lastAutoTable property to doc
  cursorY = doc.lastAutoTable.finalY + 20;

  // --- SECTION 4: TRACEABILITY SUMMARY ---
  if (cursorY + 100 > pageHeight - margin) {
    doc.addPage();
    cursorY = margin;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(colors.navyDark[0], colors.navyDark[1], colors.navyDark[2]);
  doc.text('4. Claim-to-Code Traceability Map Summary', margin, cursorY);
  cursorY += 10;

  const traceTableRows = claimsList.map((c) => {
    const lineStr = c.start_line ? `:L${c.start_line}${c.end_line && c.end_line !== c.start_line ? `-L${c.end_line}` : ''}` : '';
    const fileWithLine = (c.status !== 'not_found' && c.matched_file) ? `${c.matched_file}${lineStr}` : 'No supporting evidence';
    return [
      c.description,
      fileWithLine,
      (c.status || 'not_found').replace('_', ' ').toUpperCase(),
    ];
  });

  autoTable(doc, {
    startY: cursorY,
    head: [['Paper Claim', 'Target Code File', 'Match Status']],
    body: traceTableRows.length > 0 ? traceTableRows : [['-', '-', '-']],
    margin: { left: margin, right: margin },
    styles: { fontSize: 8, cellPadding: 6, font: 'helvetica', textColor: [51, 65, 85] },
    headStyles: { fillColor: [14, 165, 233], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 250 },
      1: { cellWidth: 165 },
      2: { cellWidth: 100 },
    },
  });

  // --- ADD PAGE NUMBERS & FOOTERS TO ALL PAGES ---
  const totalPages = (doc.internal as unknown as { getNumberOfPages: () => number }).getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // Footer divider line
    doc.setDrawColor(colors.borderGray[0], colors.borderGray[1], colors.borderGray[2]);
    doc.line(margin, pageHeight - 30, pageWidth - margin, pageHeight - 30);

    // Footer branding & page numbering
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(colors.slateMuted[0], colors.slateMuted[1], colors.slateMuted[2]);

    doc.text('REPROVA — AI Research Claim Verification Platform', margin, pageHeight - 16);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 16, { align: 'right' });
  }

  // --- TRIGGER BROWSER DOWNLOAD ---
  const filename = sanitizeFilename(data.paper_title);
  doc.save(filename);
}
