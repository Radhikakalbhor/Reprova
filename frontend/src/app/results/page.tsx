'use client';

import React, { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { analyzePaper, AnalyzeResponse, Claim, Discrepancy, MetricComparisonItem } from '@/lib/api';
import { TraceabilityGraph } from '@/components/TraceabilityGraph';
import { SimpleAnalysis } from '@/components/SimpleAnalysis';
import { InteractiveHoverButton } from '@/components/ui/interactive-hover-button';
import { FullscreenLoader } from '@/components/FullscreenLoader';
import { motion } from 'framer-motion';
import { CometCard } from '@/components/ui/comet-card';
import RubberSegment from '@/components/ui/RubberSegment';

const ROOT_CAUSE_LABELS: Record<string, { label: string; color: string }> = {
  missing_hyperparameter: {
    label: 'Missing Hyperparameter',
    color: 'bg-rose-950/60 text-rose-300 border-rose-500/40',
  },
  dataset_split_difference: {
    label: 'Dataset Split Difference',
    color: 'bg-amber-950/60 text-amber-300 border-amber-500/40',
  },
  dependency_version_drift: {
    label: 'Dependency Version Drift',
    color: 'bg-neutral-800/80 text-neutral-200 border-white/20',
  },
  seed_variance: {
    label: 'Seed / Init Variance',
    color: 'bg-neutral-800/80 text-neutral-200 border-white/20',
  },
  undocumented_default: {
    label: 'Undocumented Default',
    color: 'bg-orange-950/60 text-orange-300 border-orange-500/40',
  },
  insufficient_evidence: {
    label: 'Insufficient Evidence',
    color: 'bg-neutral-900/80 text-neutral-300 border-white/15',
  },
};

function ResultsContent() {
  const searchParams = useSearchParams();
  const mode = searchParams.get('mode') || undefined;
  const paperId = searchParams.get('paper_id') || undefined;
  const repoUrl = searchParams.get('repo_url') || undefined;
  const paperUrl = searchParams.get('paper_url') || undefined;

  const [data, setData] = useState<AnalyzeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [dataReady, setDataReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLogs, setShowLogs] = useState(false);
  const [activeTab, setActiveTab] = useState<'report' | 'graph' | 'simple'>('report');
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const handleDownloadPdf = async () => {
    if (!data) return;
    try {
      setDownloadingPdf(true);
      setDownloadError(null);
      const { generateReproducibilityReportPDF } = await import('@/lib/pdfGenerator');
      generateReproducibilityReportPDF(data, mode === 'custom');
    } catch (err: unknown) {
      if (err instanceof Error) {
        setDownloadError(`PDF generation failed: ${err.message}`);
      } else {
        setDownloadError('Failed to generate PDF report.');
      }
    } finally {
      setDownloadingPdf(false);
    }
  };

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setDataReady(false);

        if (mode === 'custom') {
          if (typeof window !== 'undefined') {
            const cached = sessionStorage.getItem('custom_analysis_result');
            if (cached) {
              try {
                const parsed = JSON.parse(cached);
                if (parsed && typeof parsed === 'object') {
                  setData(parsed);
                  setDataReady(true);
                  return;
                }
              } catch {
                // Ignore parse error
              }
            }
          }
          setError('Custom analysis result is unavailable. Please run the upload again.');
          setLoading(false);
          return;
        }

        const selectedId = paperId || 'paper-llama2';
        const res = await analyzePaper({ paper_id: selectedId });
        setData(res);
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('latest_reprova_analysis', JSON.stringify(res));
        }
        setDataReady(true);
      } catch (err: unknown) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('Failed to load reproducibility report.');
        }
        setLoading(false);
      }
    }
    fetchData();
  }, [mode, paperId, repoUrl, paperUrl]);

  if (loading) {
    return (
      <FullscreenLoader
        isComplete={dataReady}
        onFinished={() => setLoading(false)}
        initialMessage="Loading reproducibility evidence and benchmark data..."
      />
    );
  }

  if (error) {
    return (
      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="bg-black/60 backdrop-blur-xl border border-rose-500/30 text-rose-300 p-6 rounded-2xl space-y-4 shadow-2xl">
          <h2 className="text-lg font-bold text-white">Analysis Execution Failed</h2>
          <p className="text-sm text-neutral-300">{error}</p>
          <InteractiveHoverButton
            href="/"
            text="← Return to Homepage"
            className="py-2 px-4 text-xs font-semibold"
          />
        </div>
      </main>
    );
  }

  if (!data) return null;

  if (data.status === 'analysis_unavailable' || data.execution_status === 'analysis_unavailable') {
    const reasonText = data.reason || 'LLM provider unavailable; grounded claim generation was not performed.';
    return (
      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="bg-black/55 backdrop-blur-xl border border-amber-500/30 rounded-2xl p-8 space-y-6 shadow-2xl text-neutral-100">
          <div className="flex items-center space-x-3 text-amber-400 border-b border-white/10 pb-4">
            <span className="text-3xl">⚠️</span>
            <div>
              <h2 className="text-2xl font-bold text-white">Claim Analysis Unavailable</h2>
              <p className="text-xs text-amber-300/80 font-mono mt-0.5">Fake claims are forbidden: grounded claim generation was skipped.</p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-semibold text-neutral-300">Reason:</p>
            <div className="bg-black/60 border border-white/15 p-4 rounded-lg font-mono text-sm text-amber-200">
              {reasonText}
            </div>
          </div>

          <div className="pt-4 border-t border-white/10 flex items-center justify-between">
            <span className="text-xs text-neutral-400 font-mono">Paper: {data.paper_title || 'Custom Uploaded Paper'}</span>
            <InteractiveHoverButton
              href="/analyze"
              text="← Return to Analyze Page"
              className="py-2.5 px-5 text-sm font-semibold"
            />
          </div>
        </div>
      </main>
    );
  }

  if (data.execution_status === 'repo_analysis_failed' || data.repo_analysis?.error) {
    const errorReason = data.repo_analysis?.error || data.repo_analysis?.warnings?.[0] || 'Unable to clone or inspect specified repository.';
    return (
      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="bg-black/55 backdrop-blur-xl border border-rose-500/30 rounded-2xl p-8 space-y-6 shadow-2xl text-neutral-100">
          <div className="flex items-center space-x-3 text-rose-400 border-b border-white/10 pb-4">
            <span className="text-3xl">⚠️</span>
            <div>
              <h2 className="text-2xl font-bold text-white">Repository Analysis Failed</h2>
              <p className="text-xs text-rose-300/80 font-mono mt-0.5">The system was unable to access or inspect the specified GitHub repository.</p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-semibold text-neutral-300">Failure Reason:</p>
            <div className="bg-black/60 border border-white/15 p-4 rounded-lg font-mono text-sm text-rose-300">
              {errorReason}
            </div>
          </div>

          <div className="pt-4 border-t border-white/10 flex items-center justify-between">
            <span className="text-xs text-neutral-400 font-mono">Submitted Repo URL: {data.repo_url || 'N/A'}</span>
            <InteractiveHoverButton
              href="/"
              text="← Return to New Analysis"
              className="py-2.5 px-5 text-sm font-semibold"
            />
          </div>
        </div>
      </main>
    );
  }

  const claimsList: Claim[] = Array.isArray(data.claims) ? data.claims : [];
  const discrepanciesList: Discrepancy[] = Array.isArray(data.discrepancies) ? data.discrepancies : [];
  const scoreDisplay = data.reproducibility_score !== null && data.reproducibility_score !== undefined ? data.reproducibility_score : null;
  const execRes = data.execution_result;
  const comparisons: MetricComparisonItem[] = execRes?.comparison?.comparisons || [];

  return (
    <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-10 space-y-8 relative z-10">
      {/* Download Error Alert */}
      {downloadError && (
        <div className="bg-rose-950/70 border border-rose-500/40 text-rose-200 px-4 py-3 rounded-xl text-sm font-bold flex items-center justify-between shadow-lg">
          <span>⚠️ {downloadError}</span>
          <button onClick={() => setDownloadError(null)} className="text-rose-400 hover:text-white font-bold ml-4">✕</button>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-white/15 pb-6 gap-4">
        <div className="space-y-2.5 max-w-2xl">
          <div>
            <span className="inline-block text-xs uppercase tracking-wider font-mono font-bold text-white bg-white/10 px-3 py-1 rounded-full border border-white/20 shadow-xs">
              Report
            </span>
          </div>
          <div className="inline-flex items-center px-4 py-2 rounded-xl bg-black/60 backdrop-blur-md border border-white/15 shadow-md">
            <h1 className="text-sm sm:text-base font-semibold text-neutral-100 leading-snug">
              {data.paper_title || 'Reproducibility Analysis'}
            </h1>
          </div>
        </div>
        <div className="flex items-center space-x-3 self-start md:self-auto">
          <InteractiveHoverButton
            type="button"
            onClick={handleDownloadPdf}
            disabled={downloadingPdf}
            text={downloadingPdf ? 'Generating Report...' : 'Download Report'}
            className="min-w-40 py-2.5 px-4 text-xs font-bold"
          />
          <InteractiveHoverButton
            href="/analyze"
            text="← New Analysis"
            className="min-w-36 py-2.5 px-4 text-xs font-bold"
          />
        </div>
      </div>

      {/* Swappable Sectioned Segmented Button with RubberSegment */}
      <div className="flex flex-wrap items-center overflow-x-auto pb-1">
        <RubberSegment
          value={activeTab}
          onChange={(val) => setActiveTab(val as 'report' | 'graph' | 'simple')}
          items={[
            {
              value: 'report',
              label: 'Structured Report',
            },
            {
              value: 'graph',
              label: (
                <span className="flex items-center space-x-2">
                  <span>Visual Traceability Map</span>
                  {data.graph_data?.nodes && (
                    <span className="rubber-segment-badge">
                      {data.graph_data.nodes.length} Nodes
                    </span>
                  )}
                </span>
              ),
            },
            {
              value: 'simple',
              label: 'Simple Analysis',
            },
          ]}
          trackColor="rgba(0, 0, 0, 0.65)"
          thumbColor="#ffffff"
          textColor="#e4e4e7"
          activeTextColor="#000000"
          size="lg"
          radius={9999}
          inset={4}
          equalSlots={false}
          stretch={85}
          squash={4}
          speed={1}
          glide={75}
          draggable
          className="backdrop-blur-xl border border-white/15 shadow-2xl"
          aria-label="Reproducibility analysis view switch"
        />
      </div>

      {data.execution_status === 'unable_to_extract_text' && (
        <div className="bg-amber-950/60 border border-amber-500/40 text-amber-200 p-4 rounded-xl text-sm shadow-lg font-semibold">
          ⚠️ <strong>Notice:</strong> Unable to extract selectable text from the uploaded PDF. Analysis relied on repository structure and default metadata.
        </div>
      )}

      {activeTab === 'graph' ? (
        <TraceabilityGraph graphData={data.graph_data} paperTitle={data.paper_title} repoUrl={data.repo_url} />
      ) : activeTab === 'simple' ? (
        <SimpleAnalysis data={data} mode={mode} />
      ) : (
        <>
          {/* Overview Metric Bar & Score Card */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Score Display */}
            <CometCard className="h-full">
              <div className="bg-black/45 backdrop-blur-md border border-white/15 rounded-2xl p-6 shadow-2xl flex flex-col justify-between text-neutral-100 h-full">
                <div>
                  <h3 className="text-xs font-bold uppercase text-neutral-400 tracking-wider mb-2">
                    Weighted Reproducibility Score
                  </h3>
                  <div className="flex items-baseline space-x-2">
                    <span className="text-5xl sm:text-6xl font-black text-white">
                      {scoreDisplay !== null ? scoreDisplay : 'N/A'}
                    </span>
                    {scoreDisplay !== null && <span className="text-neutral-400 text-xl font-bold">/ 100</span>}
                  </div>
                  {scoreDisplay !== null && (
                    <div className="w-full bg-white/10 rounded-full h-3 mt-4 overflow-hidden shadow-inner">
                      <div
                        className={`h-full rounded-full transition-all ${
                          scoreDisplay >= 80 ? 'bg-emerald-400' : scoreDisplay >= 50 ? 'bg-amber-400' : 'bg-rose-400'
                        }`}
                        style={{ width: `${scoreDisplay}%` }}
                      />
                    </div>
                  )}
                </div>
                <p className="text-xs font-semibold text-neutral-400 mt-4 pt-4 border-t border-white/10 leading-relaxed">
                  Core experimental claims contribute more to the score than minor implementation details.
                </p>
              </div>
            </CometCard>

            {/* Claims Summary */}
            <CometCard className="h-full">
              <div className="bg-black/45 backdrop-blur-md border border-white/15 rounded-2xl p-6 shadow-2xl flex flex-col justify-between space-y-3 text-neutral-100 h-full">
                <h3 className="text-xs font-bold uppercase text-neutral-400 tracking-wider mb-1">
                  Claim Matching Metrics
                </h3>
                <div className="space-y-2.5 text-sm">
                  <div className="flex justify-between items-center text-neutral-300 font-semibold">
                    <span>Total Extracted Claims:</span>
                    <span className="font-extrabold text-base text-white">{claimsList.length}</span>
                  </div>
                  <div className="flex justify-between items-center text-neutral-300 font-semibold">
                    <span>Verified / Matched Claims:</span>
                    <span className="font-extrabold text-base text-emerald-400">
                      {claimsList.filter((c) => ['matched', 'verified'].includes(c.status)).length}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-neutral-300 font-semibold">
                    <span>Partial / Disputed Claims:</span>
                    <span className="font-extrabold text-base text-amber-400">
                      {claimsList.filter((c) => ['partial_match', 'unverified'].includes(c.status)).length}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-neutral-300 font-semibold">
                    <span>Conflicting / Unmatched:</span>
                    <span className="font-extrabold text-base text-rose-400">
                      {claimsList.filter((c) => ['conflicting', 'not_found'].includes(c.status)).length}
                    </span>
                  </div>
                </div>
              </div>
            </CometCard>

            {/* Sandboxed Execution Verdict */}
            <CometCard className="h-full">
              <div className="bg-black/45 backdrop-blur-md border border-white/15 rounded-2xl p-6 shadow-2xl flex flex-col justify-between text-neutral-100 h-full">
                <div>
                  <h3 className="text-xs font-bold uppercase text-neutral-400 tracking-wider mb-2">
                    Sandboxed Execution Verdict
                  </h3>
                  {execRes ? (
                    <div className="space-y-2 mt-2">
                      <span
                        className={`inline-block text-xs uppercase px-3 py-1 rounded-md font-mono font-extrabold border shadow-xs ${
                          execRes.status === 'success'
                            ? 'bg-emerald-950/70 text-emerald-300 border-emerald-500/40'
                            : execRes.status === 'skipped'
                            ? 'bg-neutral-800 text-neutral-300 border-white/20'
                            : 'bg-rose-950/70 text-rose-300 border-rose-500/40'
                        }`}
                      >
                        Status: {execRes.status}
                      </span>
                      {execRes.comparison?.overall_verdict && (
                        <p className="text-sm font-semibold text-neutral-200 mt-1">
                          Reproduction:{' '}
                          <span className="text-white font-bold uppercase font-mono">
                            {execRes.comparison.overall_verdict.replace('_', ' ')}
                          </span>
                        </p>
                      )}
                      {execRes.execution_time_seconds && (
                        <p className="text-xs font-semibold text-neutral-400">Execution time: {execRes.execution_time_seconds}s</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs font-semibold text-neutral-400 mt-2">Execution unavailable</p>
                  )}
                </div>
                <p className="text-xs font-semibold text-neutral-400 mt-4 pt-4 border-t border-white/10 leading-relaxed">
                  Ran in isolated Docker CPU container with locked dependencies.
                </p>
              </div>
            </CometCard>
          </div>

          {/* SECTION 1: EXTRACTED CLAIMS & CODE MATCH RESULTS */}
          <CometCard>
            <div className="bg-black/45 backdrop-blur-md border border-white/15 rounded-2xl p-6 space-y-6 shadow-2xl text-neutral-100">
              <div className="flex items-center justify-between border-b border-white/15 pb-4">
              <div>
                <h2 className="text-xl font-bold text-white">1. Extracted Claims & Code Match Results</h2>
                <p className="text-xs text-neutral-400 mt-0.5">Weighted scoring formula: Matched = 1.0×wt, Partial = 0.5×wt, Unmatched = 0.0×wt.</p>
              </div>
              <span className="text-xs bg-white/10 text-white px-3 py-1 rounded-full font-mono border border-white/20 font-bold">
                {claimsList.length} Claims Identified
              </span>
            </div>

            {claimsList.length === 0 ? (
              <p className="text-sm text-neutral-400 italic">No extracted methodology claims found.</p>
            ) : (
              <div className="space-y-4">
                {claimsList.map((claim) => {
                  const statusBadges: Record<string, string> = {
                    matched: 'bg-emerald-950/70 text-emerald-300 border-emerald-500/40 font-extrabold',
                    verified: 'bg-emerald-950/70 text-emerald-300 border-emerald-500/40 font-extrabold',
                    partial_match: 'bg-amber-950/70 text-amber-300 border-amber-500/40 font-extrabold',
                    unverified: 'bg-amber-950/70 text-amber-300 border-amber-500/40 font-extrabold',
                    conflicting: 'bg-rose-950/70 text-rose-300 border-rose-500/40 font-extrabold',
                    not_found: 'bg-neutral-900 text-neutral-400 border-white/15 font-extrabold',
                  };
                  const badgeClass = statusBadges[claim.status] || 'bg-neutral-900 text-neutral-300 border-white/20 font-bold';

                  const conf = (claim.confidence || 'high').toLowerCase();
                  const confBadges: Record<string, { label: string; fullText: string; color: string }> = {
                    high: {
                      label: 'High',
                      fullText: 'High Confidence (Table / Explicit Config)',
                      color: 'bg-emerald-950/70 text-emerald-300 border-emerald-500/40',
                    },
                    medium: {
                      label: 'Medium',
                      fullText: 'Medium Confidence (Stated in Prose)',
                      color: 'bg-amber-950/70 text-amber-300 border-amber-500/40',
                    },
                    low: {
                      label: 'Low',
                      fullText: 'Low Confidence (Inferred / Ambiguous)',
                      color: 'bg-rose-950/70 text-rose-300 border-rose-500/40',
                    },
                  };
                  const confInfo = confBadges[conf] || confBadges.high;

                  const imp = (claim.importance || 'medium').toLowerCase();
                  const impWeight = claim.weight ?? (imp === 'high' ? 3.0 : imp === 'low' ? 1.0 : 2.0);
                  const earnedPts =
                    claim.earned_points ??
                    (['matched', 'verified'].includes(claim.status)
                      ? impWeight
                      : ['partial_match', 'unverified'].includes(claim.status)
                      ? impWeight * 0.5
                      : 0.0);

                  const impBadges: Record<string, { label: string; color: string }> = {
                    high: { label: 'High Importance', color: 'bg-white/15 text-white border-white/30' },
                    medium: { label: 'Medium Importance', color: 'bg-white/10 text-neutral-200 border-white/20' },
                    low: { label: 'Low Importance', color: 'bg-neutral-900 text-neutral-400 border-white/10' },
                  };
                  const impInfo = impBadges[imp] || impBadges.medium;

                  return (
                    <div key={claim.id} className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-3.5 shadow-lg">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div className="space-y-2 flex-1">
                          <p className="text-base sm:text-lg font-bold text-white leading-snug">{claim.description}</p>

                          {/* Explicit Importance, Weight & Contribution Line */}
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className="font-semibold text-neutral-400">Importance:</span>
                            <span
                              className={`text-[11px] px-2.5 py-0.5 rounded font-mono font-extrabold uppercase border shadow-xs ${impInfo.color}`}
                            >
                              ● {impInfo.label} ({impWeight.toFixed(1)} wt)
                            </span>

                            <span className="font-semibold text-neutral-400 ml-1">Contribution:</span>
                            <span className="text-[11px] px-2.5 py-0.5 rounded font-mono font-extrabold uppercase border border-white/20 bg-black/60 text-white shadow-xs">
                              {earnedPts.toFixed(1)} / {impWeight.toFixed(1)} pts
                            </span>

                            <div className="relative inline-flex items-center group">
                              <span className="font-semibold text-neutral-400 ml-1 flex items-center gap-1 cursor-help">
                                Extraction Confidence:
                                <svg
                                  width="14"
                                  height="14"
                                  style={{ width: 14, height: 14, flexShrink: 0 }}
                                  className="w-3.5 h-3.5 text-neutral-400 group-hover:text-white transition-colors"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  aria-hidden="true"
                                >
                                  <circle cx="12" cy="12" r="10" />
                                  <path d="M12 16v-4" />
                                  <path d="M12 8h.01" />
                                </svg>
                              </span>
                              <div
                                role="tooltip"
                                className="absolute bottom-full left-0 sm:left-1/2 sm:-translate-x-1/2 mb-1.5 hidden group-hover:block group-focus-within:block z-30 w-64 sm:w-72 p-2.5 bg-neutral-950 text-neutral-200 text-[11px] font-normal normal-case leading-relaxed rounded-lg shadow-2xl border border-white/20 pointer-events-none"
                              >
                                Extraction confidence indicates how certain Reprova is that the claim was correctly identified and interpreted from the paper. It does not indicate whether the claim is scientifically true or false.
                              </div>
                            </div>
                            <span
                              className={`text-[11px] px-2.5 py-0.5 rounded font-mono font-extrabold uppercase border shadow-xs ${confInfo.color}`}
                            >
                              ● {confInfo.label}
                            </span>
                          </div>

                          {claim.paper_reference && (
                            <p className="text-xs text-neutral-300 leading-relaxed pt-1">
                              <span className="font-semibold text-neutral-200">Paper Evidence:</span>{' '}
                              <span className="text-neutral-300 font-medium italic">"{claim.paper_reference}"</span>
                            </p>
                          )}

                          {(claim.citation || claim.page_number) && (
                            <div className="flex items-center gap-1.5 text-xs pt-1">
                              <span className="font-semibold text-neutral-300">Citation:</span>
                              <span className="bg-white/10 text-white px-2 py-0.5 rounded border border-white/20 font-mono font-semibold text-[11px]">
                                {claim.citation || `Page ${claim.page_number}${claim.section ? `, Section: ${claim.section}` : ''}`}
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-row sm:flex-col items-end gap-2 self-start">
                          <span
                            className={`text-xs px-3.5 py-1.5 rounded-md font-mono font-extrabold uppercase border whitespace-nowrap shadow-xs ${badgeClass}`}
                          >
                            {claim.status.replace('_', ' ')}
                          </span>
                        </div>
                      </div>

                      {claim.status === 'not_found' ? (
                        <div className="mt-3.5 pt-3.5 border-t border-white/10 space-y-2 text-xs">
                          <p className="text-neutral-300 flex items-center gap-2">
                            <span className="font-semibold text-white">Supporting Code Evidence:</span>{' '}
                            <span className="text-neutral-500 italic">No supporting repository evidence found above the configured threshold.</span>
                          </p>

                          {claim.rejected_candidate && (
                            <div className="bg-amber-950/30 border border-amber-500/30 rounded-lg p-2.5 space-y-1 text-neutral-300">
                              <p className="font-bold text-amber-300 flex items-center gap-1.5 text-[11px] uppercase tracking-wide">
                                <span>⚠️ Rejected Retrieval Candidate</span>
                              </p>
                              <p className="text-[11px]">
                                <span className="font-semibold text-neutral-200">File:</span>{' '}
                                <code className="bg-black/60 px-1.5 py-0.5 rounded border border-white/15 font-mono text-white font-semibold">
                                  {claim.rejected_candidate.file_path}
                                </code>
                                {claim.rejected_candidate.similarity_score !== undefined && claim.rejected_candidate.similarity_score !== null && (
                                  <span className="ml-2 font-mono text-neutral-400">(Similarity: {claim.rejected_candidate.similarity_score})</span>
                                )}
                              </p>
                              <p className="text-[11px]">
                                <span className="font-semibold text-neutral-200">Reason:</span>{' '}
                                <span className="text-neutral-300">{claim.rejected_candidate.reason}</span>
                              </p>
                            </div>
                          )}

                          {claim.reasoning && (
                            <div className="text-neutral-200 bg-black/60 p-3 rounded-lg border border-white/15 text-xs leading-relaxed space-y-0.5">
                              <p className="font-bold text-white">Audit Reasoning:</p>
                              <p className="text-neutral-300 font-normal">{claim.reasoning}</p>
                            </div>
                          )}
                        </div>
                      ) : (
                        (claim.matched_file || claim.matched_value || claim.reasoning) && (
                          <div className="mt-3.5 pt-3.5 border-t border-white/10 space-y-2 text-xs">
                            {claim.matched_file && (
                              <p className="text-neutral-300 flex flex-wrap items-center gap-1.5">
                                <span className="font-semibold text-white">Code Location:</span>{' '}
                                <code className="text-white font-mono font-semibold bg-white/10 px-2.5 py-0.5 rounded border border-white/20">
                                  {claim.matched_file}
                                  {claim.start_line ? `:L${claim.start_line}` : ''}
                                  {claim.end_line && claim.end_line !== claim.start_line ? `-L${claim.end_line}` : ''}
                                  {claim.symbol_name ? ` (${claim.symbol_name})` : ''}
                                </code>
                                {claim.similarity_score !== undefined && claim.similarity_score !== null && (
                                  <span className="text-[11px] font-mono font-semibold text-neutral-400">
                                    (Similarity: {claim.similarity_score})
                                  </span>
                                )}
                              </p>
                            )}
                            {claim.matched_value && (
                              <p className="text-neutral-300">
                                <span className="font-semibold text-white">Code Value:</span>{' '}
                                <code className="text-emerald-300 font-mono font-semibold bg-emerald-950/60 px-2.5 py-0.5 rounded border border-emerald-500/40">
                                  {claim.matched_value}
                                </code>
                              </p>
                            )}
                            {claim.reasoning && (
                              <div className="text-neutral-200 bg-black/60 p-3 rounded-lg border border-white/15 text-xs leading-relaxed space-y-0.5">
                                <p className="font-bold text-white">Match Reasoning:</p>
                                <p className="text-neutral-300 font-normal">{claim.reasoning}</p>
                              </div>
                            )}
                          </div>
                        )
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            </div>
          </CometCard>

          {/* SECTION 2: EXECUTION & REPRODUCIBILITY */}
          <CometCard>
            <div className="bg-black/45 backdrop-blur-md border border-white/15 rounded-2xl p-6 space-y-6 shadow-2xl text-neutral-100">
              <div className="flex items-center justify-between border-b border-white/15 pb-4">
              <h2 className="text-xl font-bold text-white">2. Sandboxed Execution & Metric Comparison</h2>
              <span className="text-xs bg-emerald-950/70 text-emerald-300 px-3 py-1 rounded-full font-mono border border-emerald-500/40 font-bold">
                {execRes?.status === 'success' ? 'Deterministic evaluation simulation' : execRes?.status || 'Skipped'}
              </span>
            </div>

            {execRes?.status === 'skipped' ? (
              <p className="text-sm text-neutral-400 italic">
                Automated benchmark execution is currently available for curated papers with pre-configured Docker containers.
              </p>
            ) : comparisons.length > 0 ? (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-white">Claimed vs Reproduced Metric Comparison</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border border-white/15 rounded-lg overflow-hidden">
                    <thead className="bg-white/10 text-xs text-neutral-300 uppercase font-mono border-b border-white/15 font-bold">
                      <tr>
                        <th className="p-3">Metric</th>
                        <th className="p-3">Claimed Value</th>
                        <th className="p-3">Reproduced Value</th>
                        <th className="p-3">Difference</th>
                        <th className="p-3">Verdict</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10 bg-transparent">
                      {comparisons.map((c, idx) => (
                        <tr key={idx} className="hover:bg-white/5 transition-colors">
                          <td className="p-3 font-mono font-bold text-white">{c.metric}</td>
                          <td className="p-3 font-mono text-neutral-200 font-semibold">{c.claimed}</td>
                          <td className="p-3 font-mono text-emerald-300 font-bold">{c.reproduced !== null ? c.reproduced : 'N/A'}</td>
                          <td className="p-3 font-mono text-amber-300 font-bold">{c.difference_pct !== null ? `${c.difference_pct}%` : 'N/A'}</td>
                          <td className="p-3">
                            <span
                              className={`text-xs px-2.5 py-0.5 rounded font-mono font-extrabold uppercase border shadow-xs ${
                                c.verdict === 'match'
                                  ? 'bg-emerald-950/70 text-emerald-300 border-emerald-500/40'
                                  : c.verdict === 'partial'
                                  ? 'bg-amber-950/70 text-amber-300 border-amber-500/40'
                                  : 'bg-rose-950/70 text-rose-300 border-rose-500/40'
                              }`}
                            >
                              {c.verdict}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {execRes?.raw_output && (
                  <div className="pt-3">
                    <InteractiveHoverButton
                      type="button"
                      onClick={() => setShowLogs(!showLogs)}
                      text={showLogs ? 'Hide Raw Execution Logs' : 'View Raw Container Logs (stdout/stderr)'}
                      className="py-2 px-5 text-xs font-mono font-bold border-white/20 bg-white/5"
                    />
                    {showLogs && (
                      <pre className="mt-3 bg-black/80 border border-white/15 p-4 rounded-lg text-xs font-mono text-emerald-400 overflow-x-auto whitespace-pre-wrap shadow-inner">
                        {execRes.raw_output}
                      </pre>
                    )}
                  </div>
                )}

                {/* Multi-Seed Variance Section */}
                {execRes?.multi_seed_execution && (
                  <div className="mt-8 pt-6 border-t border-white/15 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                        <span>Multi-Seed Variance Analysis</span>
                        <span className="text-[11px] font-mono text-neutral-400 font-normal">(Deterministic Seed Simulation)</span>
                      </h3>
                      {execRes.multi_seed_execution.supports_multi_seed ? (
                        <span className="text-xs bg-white/10 text-white border border-white/20 font-mono font-bold px-2.5 py-0.5 rounded-full">
                          {execRes.multi_seed_execution.seeds_used?.length || 3} Seeds Evaluated [{execRes.multi_seed_execution.seeds_used?.join(', ') || '42, 123, 456'}]
                        </span>
                      ) : (
                        <span className="text-xs bg-white/5 text-neutral-400 border border-white/10 font-mono font-bold px-2.5 py-0.5 rounded-full">
                          Seed Control Unavailable
                        </span>
                      )}
                    </div>

                    {!execRes.multi_seed_execution.supports_multi_seed ? (
                      <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-xs font-medium text-neutral-300 leading-relaxed">
                        <p className="font-bold text-white mb-1">Seed Control Unavailable for this Experiment:</p>
                        <p>{execRes.multi_seed_execution.reason || 'This experiment definition does not expose configurable random seeds. Multi-seed variance testing was skipped to preserve authentic single-run benchmark metrics.'}</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {execRes.multi_seed_execution.metrics_summary?.map((stat, sIdx) => {
                          const codeBadges: Record<string, { label: string; color: string }> = {
                            reproduced_consistently: {
                              label: 'Reproduced Consistently',
                              color: 'bg-emerald-950/70 text-emerald-300 border-emerald-500/40 font-bold',
                            },
                            reproduced_within_variance: {
                              label: 'Within Natural Variance',
                              color: 'bg-white/15 text-white border-white/25 font-bold',
                            },
                            outside_variance: {
                              label: 'Outside Natural Variance',
                              color: 'bg-amber-950/70 text-amber-300 border-amber-500/40 font-bold',
                            },
                            failed_consistently: {
                              label: 'Failed Consistently',
                              color: 'bg-rose-950/70 text-rose-300 border-rose-500/40 font-bold',
                            },
                          };
                          const badge = codeBadges[stat.interpretation_code] || {
                            label: stat.interpretation_code.replace('_', ' '),
                            color: 'bg-white/10 text-neutral-300 border-white/15 font-bold',
                          };

                          return (
                            <div key={sIdx} className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="font-mono font-bold text-white text-sm">{stat.metric}</span>
                                <span className={`text-xs px-2.5 py-0.5 rounded font-mono uppercase border shadow-2xs ${badge.color}`}>
                                  ● {badge.label}
                                </span>
                              </div>

                              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs pt-1">
                                <div className="bg-black/40 p-2.5 rounded border border-white/10">
                                  <span className="text-neutral-400 block font-semibold text-[10px] uppercase font-mono">Claimed Value</span>
                                  <span className="font-mono font-bold text-white text-sm">{stat.claimed_value}</span>
                                </div>
                                <div className="bg-black/40 p-2.5 rounded border border-white/10">
                                  <span className="text-neutral-400 block font-semibold text-[10px] uppercase font-mono">Observed Mean</span>
                                  <span className="font-mono font-bold text-emerald-300 text-sm">{stat.mean_val !== null && stat.mean_val !== undefined ? stat.mean_val : 'N/A'}</span>
                                </div>
                                <div className="bg-black/40 p-2.5 rounded border border-white/10">
                                  <span className="text-neutral-400 block font-semibold text-[10px] uppercase font-mono">Observed Range</span>
                                  <span className="font-mono font-bold text-white text-sm">{stat.range_str || 'N/A'}</span>
                                </div>
                                <div className="bg-black/40 p-2.5 rounded border border-white/10">
                                  <span className="text-neutral-400 block font-semibold text-[10px] uppercase font-mono">Std Dev</span>
                                  <span className="font-mono font-bold text-white text-sm">{stat.std_dev !== null && stat.std_dev !== undefined ? stat.std_dev : 'N/A'}</span>
                                </div>
                                <div className="bg-black/40 p-2.5 rounded border border-white/10">
                                  <span className="text-neutral-400 block font-semibold text-[10px] uppercase font-mono">Variance Level</span>
                                  <span className="font-mono font-bold text-white text-sm uppercase">{stat.variance_level || 'N/A'}</span>
                                </div>
                              </div>

                              {execRes.multi_seed_execution?.runs && execRes.multi_seed_execution.runs.length > 0 && (
                                <div className="pt-2">
                                  <span className="text-[11px] font-bold text-neutral-300 block mb-1">Individual Seed Runs:</span>
                                  <div className="flex flex-wrap gap-2 text-xs font-mono">
                                    {execRes.multi_seed_execution.runs.map((r, rIdx) => {
                                      const val = r.parsed_metrics?.[stat.metric];
                                      return (
                                        <span key={rIdx} className="bg-black/50 border border-white/15 px-2.5 py-1 rounded text-neutral-200 font-semibold">
                                          Seed {r.seed}: <strong className="text-white">{val !== undefined ? val : 'N/A'}</strong> ({r.execution_time_seconds}s)
                                        </span>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                              <p className="text-xs text-neutral-300 font-medium leading-relaxed pt-1 italic">
                                "{stat.interpretation_summary}"
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-neutral-400 font-medium">Execution completed with no parsed numeric metrics.</p>
            )}
            </div>
          </CometCard>

          {/* SECTION 3: DISCREPANCIES & ROOT-CAUSE ANALYSIS */}
          <CometCard>
            <div className="bg-black/45 backdrop-blur-md border border-white/15 rounded-2xl p-6 space-y-6 shadow-2xl text-neutral-100">
              <div className="flex items-center justify-between border-b border-white/15 pb-4">
              <h2 className="text-xl font-bold text-white">3. Discrepancies & Root-Cause Tagging</h2>
              <span className="text-xs bg-amber-950/70 text-amber-300 px-3 py-1 rounded-full font-mono border border-amber-500/40 font-bold">
                {discrepanciesList.length} Discrepancies Flagged
              </span>
            </div>

            {discrepanciesList.length === 0 ? (
              <p className="text-sm text-neutral-400 italic">No discrepancies flagged for this repository.</p>
            ) : (
              <div className="space-y-4">
                {discrepanciesList.map((disc) => {
                  const rcInfo = ROOT_CAUSE_LABELS[disc.root_cause || 'insufficient_evidence'] || ROOT_CAUSE_LABELS.insufficient_evidence;

                  return (
                    <div key={disc.id} className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-3 shadow-lg">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center space-x-2">
                          <span className="text-xs uppercase font-extrabold font-mono px-2.5 py-0.5 rounded bg-amber-950/70 text-amber-300 border border-amber-500/40">
                            {disc.severity} Severity
                          </span>
                          {disc.location && (
                            <code className="text-xs text-white bg-white/10 px-2.5 py-0.5 rounded border border-white/20 font-mono font-semibold">
                              {disc.location}
                            </code>
                          )}
                        </div>
                        {/* Root Cause Tag Chip */}
                        <span className={`text-xs px-2.5 py-1 rounded font-mono font-extrabold border shadow-xs ${rcInfo.color}`}>
                          Tag: {rcInfo.label}
                        </span>
                      </div>

                      <p className="text-sm text-white font-bold">{disc.description}</p>

                      {disc.dependency_evidence && (
                        <div className="bg-black/50 border border-white/15 rounded-lg p-3.5 space-y-2 text-xs shadow-inner">
                          <div className="flex flex-wrap items-center justify-between border-b border-white/10 pb-2 gap-2">
                            <span className="font-bold text-white font-mono flex items-center space-x-1.5">
                              <span>Deterministic Dependency Evidence:</span>
                              <code className="text-white font-extrabold bg-white/10 px-2 py-0.5 rounded border border-white/20">
                                {disc.dependency_evidence.package_name}
                              </code>
                            </span>
                            <span className="text-[11px] font-mono font-extrabold px-2.5 py-0.5 rounded uppercase border bg-rose-950/70 text-rose-300 border-rose-500/40">
                              {disc.dependency_evidence.comparison_status.replace('_', ' ')}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1 text-xs">
                            <div className="bg-white/5 p-2 rounded border border-white/10">
                              <span className="text-[10px] uppercase font-mono font-bold text-neutral-400 block">Paper Expected</span>
                              <span className="font-mono font-bold text-white">
                                {disc.dependency_evidence.expected_version || 'No verified version'}
                              </span>
                            </div>
                            <div className="bg-white/5 p-2 rounded border border-white/10">
                              <span className="text-[10px] uppercase font-mono font-bold text-neutral-400 block">Repo Declared</span>
                              <span className="font-mono font-bold text-amber-300">
                                {disc.dependency_evidence.declared_version || 'Declared version unavailable'}
                              </span>
                            </div>
                            <div className="bg-white/5 p-2 rounded border border-white/10">
                              <span className="text-[10px] uppercase font-mono font-bold text-neutral-400 block">Installed Env</span>
                              <span className="font-mono font-bold text-neutral-200">
                                {disc.dependency_evidence.installed_version || 'Installed version unavailable'}
                              </span>
                            </div>
                            <div className="bg-white/5 p-2 rounded border border-white/10">
                              <span className="text-[10px] uppercase font-mono font-bold text-neutral-400 block">Evidence Source</span>
                              <span className="font-mono font-semibold text-neutral-200 truncate block" title={disc.dependency_evidence.source_file || ''}>
                                {disc.dependency_evidence.source_file || 'Repository Codebase'}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      {disc.root_cause_explanation && (
                        <div className="bg-black/50 border border-white/15 p-3 rounded-lg text-xs space-y-1">
                          <p className="text-white font-bold font-mono">Root Cause Explanation:</p>
                          <p className="text-neutral-300 font-medium">{disc.root_cause_explanation}</p>
                        </div>
                      )}

                      {disc.fix_suggestion && (
                        <div className="bg-white/5 border border-white/15 p-3 rounded-lg text-xs space-y-1">
                          <p className="text-white font-bold font-mono flex items-center space-x-1">
                            <span>How to Fix / Recommended Action:</span>
                          </p>
                          <p className="text-neutral-200 font-medium leading-relaxed">{disc.fix_suggestion}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Deterministic Repository Dependency Audit Matrix */}
            <div className="mt-8 pt-6 border-t border-white/15 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                  <span>Deterministic Repository Dependency Matrix</span>
                  <span className="text-[11px] font-mono text-neutral-400 font-normal">(Code & Manifest Parse)</span>
                </h3>
                {data.dependency_diff && data.dependency_diff.length > 0 ? (
                  <span className="text-xs bg-white/10 text-white font-mono font-bold px-2.5 py-0.5 rounded-full border border-white/20">
                    {data.dependency_diff.length} Packages Tracked
                  </span>
                ) : (
                  <span className="text-xs bg-amber-950/60 text-amber-300 font-mono font-semibold px-2.5 py-0.5 rounded-full border border-amber-500/40">
                    No Manifest Found
                  </span>
                )}
              </div>

              {data.dependency_diff && data.dependency_diff.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border border-white/15 rounded-lg overflow-hidden">
                    <thead className="bg-white/10 font-mono text-neutral-300 uppercase">
                      <tr>
                        <th className="p-2.5 border-b border-white/15 font-bold">Package Name</th>
                        <th className="p-2.5 border-b border-white/15 font-bold">Paper Expected</th>
                        <th className="p-2.5 border-b border-white/15 font-bold">Repo Declared</th>
                        <th className="p-2.5 border-b border-white/15 font-bold">Installed Env</th>
                        <th className="p-2.5 border-b border-white/15 font-bold">Source File</th>
                        <th className="p-2.5 border-b border-white/15 font-bold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10 bg-transparent font-mono">
                      {data.dependency_diff.map((dep, dIdx) => (
                        <tr key={dIdx} className="hover:bg-white/5 transition-colors">
                          <td className="p-2.5 font-bold text-white">{dep.package_name}</td>
                          <td className="p-2.5 font-semibold text-neutral-300">{dep.expected_version || 'No verified version'}</td>
                          <td className="p-2.5 font-semibold text-amber-300">{dep.declared_version || 'Declared version unavailable'}</td>
                          <td className="p-2.5 font-semibold text-neutral-200">{dep.installed_version || 'Installed version unavailable'}</td>
                          <td className="p-2.5 text-neutral-400">{dep.source_file || 'Codebase'}</td>
                          <td className="p-2.5 font-bold uppercase text-[11px]">
                            <span
                              className={`px-2 py-0.5 rounded border ${
                                dep.comparison_status === 'VERIFIED_DRIFT'
                                  ? 'bg-rose-950/70 text-rose-300 border-rose-500/40'
                                  : dep.comparison_status === 'MATCHED'
                                  ? 'bg-emerald-950/70 text-emerald-300 border-emerald-500/40'
                                  : 'bg-white/10 text-neutral-300 border-white/20'
                              }`}
                            >
                              {dep.comparison_status.replace('_', ' ')}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="bg-white/5 border border-white/10 rounded-lg p-4 text-xs text-neutral-400 font-mono">
                  <p className="font-semibold text-neutral-200">Package Matrix: No verified package/version information available.</p>
                  <p className="text-neutral-500 mt-1">No verified dependency manifest (e.g. requirements.txt, environment.yml, pyproject.toml) found in this repository.</p>
                </div>
              )}
            </div>
          </div>
        </CometCard>
      </>
      )}
    </main>
  );
}

export default function ResultsPage() {
  return (
    <div className="min-h-screen flex flex-col bg-transparent text-neutral-100 relative">
      <Header />
      <Suspense
        fallback={
          <div className="py-24 text-center">
            <div className="inline-block w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-neutral-400 text-sm">Loading report...</p>
          </div>
        }
      >
        <ResultsContent />
      </Suspense>
      <Footer />
    </div>
  );
}
