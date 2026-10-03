'use client';

import React, { useEffect, useState } from 'react';
import { AnalyzeResponse, Claim } from '@/lib/api';

export function HeroVisual() {
  const [analysisData, setAnalysisData] = useState<AnalyzeResponse | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem('latest_reprova_analysis');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed && typeof parsed === 'object') {
            setAnalysisData(parsed);
          }
        } catch {
          // Ignore invalid JSON
        }
      }
    }
  }, []);

  // Compute dynamic fields safely without fallback placeholders
  const paperTitle = analysisData?.paper_title || analysisData?.paper_id || 'Research Paper';
  const paperSubtext = analysisData
    ? analysisData.claims && Array.isArray(analysisData.claims) && analysisData.claims.length > 0
      ? `${analysisData.claims.length} extracted methodology claims`
      : 'Methodology claims parsed'
    : 'No analysis run yet';

  // Claims dynamic text & confidence
  const firstClaim: Claim | undefined = Array.isArray(analysisData?.claims) ? analysisData?.claims[0] : undefined;
  const claimsSubtext = analysisData
    ? firstClaim
      ? firstClaim.matched_value
        ? `${firstClaim.description.slice(0, 22)}: ${firstClaim.matched_value}`
        : firstClaim.description.slice(0, 42)
      : 'No claims extracted'
    : 'Waiting for paper analysis';

  const claimConfidence = firstClaim?.confidence || (analysisData?.claims?.length ? 'high' : null);

  // Repository dynamic text
  const matchedFile = Array.isArray(analysisData?.claims)
    ? analysisData?.claims.find((c) => c.matched_file)?.matched_file
    : undefined;

  const repoSubtext = analysisData
    ? matchedFile
      ? matchedFile
      : analysisData.repo_url
      ? analysisData.repo_url.replace('https://github.com/', '')
      : 'No repository provided'
    : 'No repository linked';

  // Evidence dynamic text & status
  const matchedValue = Array.isArray(analysisData?.claims)
    ? analysisData?.claims.find((c) => c.matched_value)?.matched_value ||
      analysisData?.claims.find((c) => c.paper_reference)?.paper_reference
    : undefined;

  const evidenceSubtext = analysisData
    ? matchedValue
      ? matchedValue
      : Array.isArray(analysisData.claims) && analysisData.claims.length > 0
      ? 'Code inspection completed'
      : 'No matching code evidence'
    : 'Waiting for claim-to-code matching';

  const hasMatched = Array.isArray(analysisData?.claims) && analysisData.claims.some((c) => c.status === 'matched' || c.status === 'verified');
  const hasPartial = Array.isArray(analysisData?.claims) && analysisData.claims.some((c) => c.status === 'partial_match' || c.status === 'disputed');
  const hasConflicting = Array.isArray(analysisData?.claims) && analysisData.claims.some((c) => c.status === 'conflicting' || c.status === 'not_found');

  // Reproduction dynamic text & score
  const executionComp = analysisData?.execution_result?.comparison?.comparisons?.[0];
  const reproductionSubtext = analysisData
    ? executionComp
      ? `${executionComp.metric}: ${executionComp.reproduced !== null && executionComp.reproduced !== undefined ? executionComp.reproduced : 'N/A'} vs ${executionComp.claimed} claimed`
      : analysisData.execution_result?.status === 'success'
      ? 'Benchmark execution completed'
      : analysisData.execution_result?.status === 'skipped' || analysisData.execution_status === 'skipped'
      ? 'Execution skipped / unavailable'
      : 'Execution not available'
    : 'No experiment executed yet';

  const scoreDisplay =
    analysisData && analysisData.reproducibility_score !== null && analysisData.reproducibility_score !== undefined
      ? `Score: ${analysisData.reproducibility_score}/100`
      : analysisData
      ? 'Score: Pending'
      : 'Score: —';

  return (
    <div className="relative w-full max-w-lg mx-auto lg:max-w-none">
      {/* Main Container Card */}
      <div className="relative bg-black/30 backdrop-blur-md border border-white/20 rounded-2xl p-6 shadow-2xl space-y-4 font-sans overflow-hidden">
        {/* Header Bar */}
        <div className="flex items-center justify-between border-b border-white/15 pb-3">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
            <span className="text-xs sm:text-sm font-mono font-semibold text-gray-200 ml-2">reprova_pipeline.py</span>
          </div>
          <span className="text-xs uppercase font-mono font-bold text-white bg-white/10 border border-white/25 px-2.5 py-0.5 rounded shadow-sm">
            Live Flow
          </span>
        </div>

        {/* Workflow Diagram Nodes */}
        <div className="space-y-3 relative">
          {/* Node 1: Paper */}
          <div className="flex items-center justify-between bg-black/50 backdrop-blur-sm border border-white/15 rounded-lg p-3 text-xs">
            <div className="flex items-center space-x-3 overflow-hidden pr-2">
              <span className="px-2 py-1 rounded bg-white/10 text-white border border-white/20 font-mono text-xs font-bold shrink-0">
                PDF
              </span>
              <div className="truncate">
                <p className="font-bold text-sm text-white truncate" title={paperTitle}>
                  {paperTitle}
                </p>
                <p className="text-xs text-gray-300 font-medium truncate">{paperSubtext}</p>
              </div>
            </div>
            <span className="text-xs text-gray-300 font-mono font-semibold shrink-0">01 Input</span>
          </div>

          <div className="flex justify-center -my-1 text-gray-300">
            <span className="text-xs font-mono font-bold">↓</span>
          </div>

          {/* Node 2: Claims */}
          <div className="flex items-center justify-between bg-black/50 backdrop-blur-sm border border-white/15 rounded-lg p-3 text-xs">
            <div className="flex items-center space-x-3 overflow-hidden pr-2">
              <span className="px-2 py-1 rounded bg-amber-950/80 text-amber-300 border border-amber-700/80 font-mono text-xs font-bold shrink-0">
                CLM
              </span>
              <div className="truncate">
                <p className="font-bold text-sm text-white">Extracted Claims</p>
                <p className="text-xs text-gray-300 font-medium truncate" title={claimsSubtext}>
                  {claimsSubtext}
                </p>
              </div>
            </div>
            {claimConfidence === 'high' ? (
              <span className="text-xs text-emerald-300 font-mono font-bold bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-700/80 shadow-sm shrink-0">
                High Conf
              </span>
            ) : claimConfidence === 'medium' ? (
              <span className="text-xs text-amber-300 font-mono font-bold bg-amber-950/60 px-2 py-0.5 rounded border border-amber-700/80 shadow-sm shrink-0">
                Med Conf
              </span>
            ) : claimConfidence === 'low' ? (
              <span className="text-xs text-rose-300 font-mono font-bold bg-rose-950/60 px-2 py-0.5 rounded border border-rose-700/80 shadow-sm shrink-0">
                Low Conf
              </span>
            ) : (
              <span className="text-xs text-gray-400 font-mono font-semibold shrink-0">Pending</span>
            )}
          </div>

          <div className="flex justify-center -my-1 text-gray-300">
            <span className="text-xs font-mono font-bold">↓</span>
          </div>

          {/* Node 3: Code Repository */}
          <div className="flex items-center justify-between bg-black/50 backdrop-blur-sm border border-white/15 rounded-lg p-3 text-xs">
            <div className="flex items-center space-x-3 overflow-hidden pr-2">
              <span className="px-2 py-1 rounded bg-white/10 text-white border border-white/20 font-mono text-xs font-bold shrink-0">
                GIT
              </span>
              <div className="truncate">
                <p className="font-bold text-sm text-white">Repository Codebase</p>
                <code className="text-xs text-neutral-300 font-mono font-medium truncate block" title={repoSubtext}>
                  {repoSubtext}
                </code>
              </div>
            </div>
            <span className="text-xs text-gray-300 font-mono font-semibold shrink-0">03 Inspection</span>
          </div>

          <div className="flex justify-center -my-1 text-gray-300">
            <span className="text-xs font-mono font-bold">↓</span>
          </div>

          {/* Node 4: Implementation Evidence */}
          <div className="flex items-center justify-between bg-black/50 backdrop-blur-sm border border-emerald-500/50 rounded-lg p-3 text-xs">
            <div className="flex items-center space-x-3 overflow-hidden pr-2">
              <span className="px-2 py-1 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-700/80 font-mono text-xs font-bold shrink-0">
                EVD
              </span>
              <div className="truncate">
                <p className="font-bold text-sm text-emerald-300">Implementation Evidence</p>
                <code className="text-xs text-gray-200 font-mono block font-medium truncate" title={evidenceSubtext}>
                  {evidenceSubtext}
                </code>
              </div>
            </div>
            {hasMatched ? (
              <span className="text-xs text-emerald-300 font-mono font-bold uppercase tracking-wider shrink-0">
                Matched
              </span>
            ) : hasPartial ? (
              <span className="text-xs text-amber-300 font-mono font-bold uppercase tracking-wider shrink-0">
                Partial
              </span>
            ) : hasConflicting ? (
              <span className="text-xs text-rose-300 font-mono font-bold uppercase tracking-wider shrink-0">
                Discrepancy
              </span>
            ) : (
              <span className="text-xs text-gray-400 font-mono font-semibold shrink-0">Pending</span>
            )}
          </div>

          <div className="flex justify-center -my-1 text-gray-300">
            <span className="text-xs font-mono font-bold">↓</span>
          </div>

          {/* Node 5: Reproduced Results */}
          <div className="flex items-center justify-between bg-black/50 backdrop-blur-sm border border-white/15 rounded-lg p-3 text-xs">
            <div className="flex items-center space-x-3 overflow-hidden pr-2">
              <span className="px-2 py-1 rounded bg-white/10 text-white border border-white/20 font-mono text-xs font-bold shrink-0">
                RUN
              </span>
              <div className="truncate">
                <p className="font-bold text-sm text-white">Sandboxed Reproduction</p>
                <p className="text-xs text-gray-300 font-medium truncate" title={reproductionSubtext}>
                  {reproductionSubtext}
                </p>
              </div>
            </div>
            <span
              className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded shadow-sm shrink-0 ${
                analysisData && analysisData.reproducibility_score !== null && analysisData.reproducibility_score !== undefined
                  ? 'text-black bg-white'
                  : 'text-gray-300 bg-neutral-800'
              }`}
            >
              {scoreDisplay}
            </span>
          </div>
        </div>

        {/* Footer info note with strong contrast */}
        <div className="pt-2 border-t border-white/15 flex items-center justify-between text-xs font-mono">
          <span className="text-gray-200 font-bold drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]">Continuous Traceability</span>
          <span className="text-white font-bold drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]">
            {analysisData?.paper_id ? `Paper: ${analysisData.paper_id}` : 'Reprova Pipeline'}
          </span>
        </div>
      </div>
    </div>
  );
}
