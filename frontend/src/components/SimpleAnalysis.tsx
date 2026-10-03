'use client';

import React, { useState } from 'react';
import { AnalyzeResponse, Claim } from '@/lib/api';
import { CometCard } from '@/components/ui/comet-card';

interface SimpleAnalysisProps {
  data: AnalyzeResponse;
  mode?: string;
}

export function SimpleAnalysis({ data, mode }: SimpleAnalysisProps) {
  const claimsList: Claim[] = Array.isArray(data.claims) ? data.claims : [];
  const scoreDisplay =
    data.reproducibility_score !== null && data.reproducibility_score !== undefined
      ? data.reproducibility_score
      : null;

  // Dynamic claim statistics
  const totalClaims = claimsList.length;
  const matchedClaims = claimsList.filter((c) => ['matched', 'verified'].includes(c.status)).length;
  const partialClaims = claimsList.filter((c) => ['partial_match', 'unverified'].includes(c.status)).length;
  const notFoundClaims = claimsList.filter((c) => c.status === 'not_found').length;
  const conflictingClaims = claimsList.filter((c) => ['conflicting', 'disputed'].includes(c.status)).length;

  // Dynamic weighted points
  const totalEarned = claimsList.reduce(
    (sum, c) => sum + (typeof c.earned_points === 'number' ? c.earned_points : 0),
    0
  );
  const totalWeight = claimsList.reduce(
    (sum, c) => sum + (typeof c.weight === 'number' ? c.weight : 0),
    0
  );

  const formatPoints = (val: number): string => {
    return Number.isInteger(val) ? val.toString() : val.toFixed(1);
  };

  // State for Extraction Confidence info tooltip
  const [activeTooltipId, setActiveTooltipId] = useState<string | null>(null);

  // Dynamic takeaways based on actual claims
  const matchedItems = claimsList
    .filter((c) => ['matched', 'verified'].includes(c.status))
    .map((c) => c.description);

  const notFoundItems = claimsList
    .filter((c) => c.status === 'not_found')
    .map((c) => c.description);

  // Detect relevant technical terms that appear in claims or reasoning to provide simple glossary notes
  const fullText = claimsList
    .map((c) => `${c.description} ${c.reasoning || ''} ${c.matched_value || ''}`)
    .join(' ');

  const hasGqa = /\b(GQA|Grouped-Query Attention|grouped-query)\b/i.test(fullText);
  const hasSwa = /\b(SWA|Sliding Window Attention|sliding window)\b/i.test(fullText);
  const hasVit = /\b(ViT|Vision Transformer|patch size)\b/i.test(fullText);
  const hasResidual = /\b(ResNet|residual|skip connection)\b/i.test(fullText);

  // Execution information
  const execResult = data.execution_result;
  const isCuratedPaper = mode !== 'custom';
  const comparisons = execResult?.comparison?.comparisons || [];

  if (totalClaims === 0) {
    return (
      <CometCard className="w-full">
        <div className="bg-black/45 backdrop-blur-md border border-white/15 rounded-2xl p-8 text-center text-neutral-300 shadow-2xl">
          <p className="text-base font-semibold text-white">Run an analysis to see the simple explanation.</p>
          <p className="text-xs text-neutral-400 mt-1">No claims or analysis evidence are currently loaded.</p>
        </div>
      </CometCard>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Intro Banner */}
      <CometCard className="w-full">
        <div className="bg-black/45 backdrop-blur-md border border-white/15 rounded-2xl p-6 sm:p-7 shadow-2xl text-neutral-100">
          <div>
            <h2 className="text-xl font-bold text-white">Simple Analysis Guide</h2>
            <p className="text-sm text-neutral-300 mt-1 leading-relaxed">
              A clear, plain-language translation of this reproducibility evaluation designed for students and researchers.
              All insights are derived dynamically from the evidence in the repository without adding assumptions.
            </p>
          </div>
        </div>
      </CometCard>

      {/* SECTION A: What is this paper about? */}
      <CometCard className="w-full">
        <section className="bg-black/45 backdrop-blur-md border border-white/15 rounded-2xl p-6 sm:p-7 shadow-2xl text-neutral-100 space-y-3">
          <div className="border-b border-white/10 pb-3">
            <h3 className="text-lg font-bold text-white">What is this paper about?</h3>
          </div>
          <div className="text-sm text-neutral-300 leading-relaxed space-y-2.5">
            <p>
              Reprova analyzed the methodology claims and implementation evidence available for{' '}
              <strong className="text-white">{data.paper_title || 'this research paper'}</strong>
              {data.repo_url && (
                <>
                  {' '}against its official public repository{' '}
                  <a
                    href={data.repo_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-white underline font-mono text-xs font-semibold hover:text-neutral-300"
                  >
                    {data.repo_url}
                  </a>
                </>
              )}.
            </p>
            <p>
              The goal of this evaluation is to verify whether the architectural components, experimental configurations,
              and benchmark findings described in the paper can be traced directly to concrete code in the repository.
            </p>
          </div>
        </section>
      </CometCard>

      {/* SECTION C: What did Reprova find? (Summary Numbers) */}
      <CometCard className="w-full">
        <section className="bg-black/45 backdrop-blur-md border border-white/15 rounded-2xl p-6 sm:p-7 shadow-2xl text-neutral-100 space-y-4">
          <div className="border-b border-white/10 pb-3">
            <h3 className="text-lg font-bold text-white">What did Reprova find?</h3>
          </div>

          {/* Plain Language Summary */}
          <p className="text-sm text-neutral-200 font-medium leading-relaxed bg-white/5 border border-white/10 p-4 rounded-xl">
            Reprova checked <strong className="text-white">{totalClaims} claim{totalClaims === 1 ? '' : 's'}</strong>.{' '}
            <strong className="text-emerald-400">{matchedClaims} had supporting code evidence</strong>
            {partialClaims > 0 && (
              <>, <strong className="text-amber-400">{partialClaims} had partial evidence</strong></>
            )}
            {notFoundClaims > 0 && (
              <>, while <strong className="text-rose-400">{notFoundClaims} could not be verified from the available repository</strong></>
            )}
            {conflictingClaims > 0 && (
              <>, and <strong className="text-orange-400">{conflictingClaims} had differing implementation details</strong></>
            )}
            .
          </p>

          {/* Metric Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 pt-1">
            <div className="bg-white/5 border border-white/10 p-4 rounded-xl text-center">
              <span className="text-xs uppercase font-bold text-neutral-400 tracking-wider">Checked</span>
              <p className="text-2xl sm:text-3xl font-black text-white mt-1">{totalClaims}</p>
            </div>
            <div className="bg-emerald-950/40 border border-emerald-500/30 p-4 rounded-xl text-center">
              <span className="text-xs uppercase font-bold text-emerald-300 tracking-wider">Code Supported</span>
              <p className="text-2xl sm:text-3xl font-black text-emerald-400 mt-1">{matchedClaims}</p>
            </div>
            <div className="bg-amber-950/40 border border-amber-500/30 p-4 rounded-xl text-center">
              <span className="text-xs uppercase font-bold text-amber-300 tracking-wider">Partial</span>
              <p className="text-2xl sm:text-3xl font-black text-amber-400 mt-1">{partialClaims}</p>
            </div>
            <div className="bg-rose-950/40 border border-rose-500/30 p-4 rounded-xl text-center">
              <span className="text-xs uppercase font-bold text-rose-300 tracking-wider">Unverified</span>
              <p className="text-2xl sm:text-3xl font-black text-rose-400 mt-1">{notFoundClaims}</p>
            </div>
          </div>
        </section>
      </CometCard>

      {/* SECTION D: What does the score mean? */}
      <CometCard className="w-full">
        <section className="bg-black/45 backdrop-blur-md border border-white/15 rounded-2xl p-6 sm:p-7 shadow-2xl text-neutral-100 space-y-4">
          <div className="border-b border-white/10 pb-3">
            <h3 className="text-lg font-bold text-white">What does the score mean?</h3>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-white/5 border border-white/10 p-5 rounded-xl gap-4">
            <div className="space-y-1">
              <span className="text-xs uppercase tracking-wider font-bold text-neutral-400">Reproducibility Score</span>
              <div className="flex items-baseline space-x-2">
                <span className="text-4xl sm:text-5xl font-black text-white">
                  {scoreDisplay !== null ? scoreDisplay : 'N/A'}
                </span>
                {scoreDisplay !== null && <span className="text-neutral-400 text-lg font-bold">/ 100</span>}
              </div>
            </div>
            <div className="text-xs sm:text-sm text-neutral-300 max-w-md leading-relaxed border-t sm:border-t-0 sm:border-l border-white/10 pt-3 sm:pt-0 sm:pl-5">
              {totalWeight > 0 ? (
                <p>
                  Reprova gave this analysis a score of{' '}
                  <strong className="text-white">{scoreDisplay}/100</strong> because{' '}
                  <strong className="text-white">{formatPoints(totalEarned)}</strong> out of{' '}
                  <strong className="text-white">{formatPoints(totalWeight)}</strong> weighted evidence points were supported by the available repository.
                </p>
              ) : (
                <p>The score reflects the verifiable evidence points supported by the available repository.</p>
              )}
            </div>
          </div>

          <div className="bg-white/5 border border-white/15 rounded-xl p-4 text-xs sm:text-sm text-neutral-200 space-y-2 leading-relaxed">
            <p className="font-semibold text-white">Important distinction to keep in mind:</p>
            <ul className="list-disc list-inside space-y-1 text-neutral-300 pl-1">
              <li>
                <strong>It does NOT mean</strong> the paper is {scoreDisplay !== null ? `${scoreDisplay}%` : ''} correct or false.
              </li>
              <li>
                <strong>It does NOT mean</strong> the paper has {scoreDisplay !== null ? `${scoreDisplay}%` : ''} scientific reproducibility in reality.
              </li>
              <li>
                <strong>Instead, it means:</strong> The score represents how much of the checked, weighted evidence Reprova could verify from the available implementation code.
              </li>
            </ul>
            <p className="text-xs text-neutral-400 pt-1 border-t border-white/10">
              Why is it weighted? Core claims (such as network architecture or primary benchmark comparisons) carry more points than secondary configuration settings.
            </p>
          </div>
        </section>
      </CometCard>

      {/* SECTION B: What did the researchers claim? */}
      <CometCard className="w-full">
        <section className="bg-black/45 backdrop-blur-md border border-white/15 rounded-2xl p-6 sm:p-7 shadow-2xl text-neutral-100 space-y-4">
          <div className="border-b border-white/10 pb-3">
            <h3 className="text-lg font-bold text-white">What did the researchers claim?</h3>
          </div>

          <p className="text-sm text-neutral-400 leading-relaxed">
            Here is each claim evaluated by Reprova, translated into plain language:
          </p>

          <div className="space-y-4">
            {claimsList.map((claim, idx) => {
              const isMatched = ['matched', 'verified'].includes(claim.status);
              const isPartial = ['partial_match', 'unverified'].includes(claim.status);
              const isNotFound = claim.status === 'not_found';

              const statusLabel = isMatched
                ? 'Supported by Code'
                : isPartial
                ? 'Partially Supported'
                : isNotFound
                ? 'Could Not Be Verified'
                : 'Conflicting / Differing';

              const statusClass = isMatched
                ? 'bg-emerald-950/70 text-emerald-300 border-emerald-500/40'
                : isPartial
                ? 'bg-amber-950/70 text-amber-300 border-amber-500/40'
                : isNotFound
                ? 'bg-rose-950/70 text-rose-300 border-rose-500/40'
                : 'bg-orange-950/70 text-orange-300 border-orange-500/40';

              const simpleExplanation = isMatched
                ? 'Reprova found supporting implementation evidence for this claim in the repository.'
                : isPartial
                ? 'Reprova found some related evidence, but it does not fully support the complete claim.'
                : isNotFound
                ? 'Reprova could not find enough implementation evidence in the repository to verify this claim.'
                : 'The available implementation or reproduced result differs from what was reported in the paper.';

              return (
                <div
                  key={claim.id || idx}
                  className="border border-white/10 rounded-xl p-5 bg-white/5 hover:bg-white/10 transition-colors space-y-3"
                >
                  {/* Claim Header & Status */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-mono font-bold text-neutral-300 bg-white/10 border border-white/20 px-2 py-0.5 rounded">
                        Claim {idx + 1}
                      </span>
                      <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${statusClass}`}>
                        {statusLabel}
                      </span>
                    </div>

                    {/* Extraction Confidence badge with informative explanation */}
                    {claim.confidence && (
                      <div className="relative inline-flex items-center">
                        <span className="text-xs text-neutral-400 font-medium mr-1.5">Extraction Confidence:</span>
                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                            claim.confidence.toLowerCase() === 'high'
                              ? 'bg-white/15 text-white border-white/30'
                              : claim.confidence.toLowerCase() === 'medium'
                              ? 'bg-amber-950/70 text-amber-300 border-amber-500/40'
                              : 'bg-neutral-800 text-neutral-400 border-white/15'
                          }`}
                        >
                          {claim.confidence.toUpperCase()}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setActiveTooltipId(activeTooltipId === claim.id ? null : claim.id)
                          }
                          className="ml-1.5 text-xs text-neutral-400 hover:text-white focus:outline-none flex items-center"
                          title="Extraction confidence indicates how certain Reprova is that the claim was correctly identified and interpreted from the paper. It does not indicate whether the claim is scientifically true or false."
                          aria-label="Extraction confidence information"
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <path d="M12 16v-4" />
                            <path d="M12 8h.01" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Claim Statement */}
                  <p className="text-sm sm:text-base font-semibold text-white leading-snug">
                    &ldquo;{claim.description}&rdquo;
                  </p>

                  {/* Plain Language Interpretation */}
                  <div className="text-xs sm:text-sm text-neutral-200 bg-black/50 border border-white/10 rounded-lg p-3 space-y-1.5">
                    <p className="font-semibold text-white">
                      What this means:{' '}
                      <span className="font-normal text-neutral-300">{simpleExplanation}</span>
                    </p>

                    {isNotFound && (
                      <p className="text-xs text-neutral-400 italic">
                        Note: &ldquo;Could not be verified&rdquo; means the public repository does not include the relevant code or benchmark scripts. It does not mean the claim is false.
                      </p>
                    )}

                    {/* Evidence Location if Matched */}
                    {claim.matched_file && (
                      <div className="text-xs text-neutral-300 pt-1 border-t border-white/10 flex flex-wrap items-center gap-1.5">
                        <span className="font-semibold text-white">Verified in code:</span>
                        <code className="bg-white/10 text-white px-1.5 py-0.5 rounded border border-white/20 font-mono text-[11px]">
                          {claim.matched_file}
                          {claim.start_line ? ` (lines ${claim.start_line}–${claim.end_line})` : ''}
                        </code>
                      </div>
                    )}

                    {claim.matched_value && (
                      <div className="text-xs text-neutral-300 flex flex-wrap items-center gap-1.5">
                        <span className="font-semibold text-white">Implementation value:</span>
                        <code className="bg-white/10 text-emerald-300 px-1.5 py-0.5 rounded border border-white/20 font-mono text-[11px]">
                          {claim.matched_value}
                        </code>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Global Extraction Confidence Explanation Box */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-xs text-neutral-300 leading-relaxed">
            <strong className="text-white">About Extraction Confidence:</strong> Extraction confidence indicates how certain Reprova is that the claim was correctly identified and interpreted from the paper. It does not indicate whether the claim is scientifically true or false.
          </div>
        </section>
      </CometCard>

      {/* SECTION E: What should I understand from this? */}
      <CometCard className="w-full">
        <section className="bg-black/45 backdrop-blur-md border border-white/15 rounded-2xl p-6 sm:p-7 shadow-2xl text-neutral-100 space-y-4">
          <div className="border-b border-white/10 pb-3">
            <h3 className="text-lg font-bold text-white">What should I understand from this?</h3>
          </div>

          <div className="space-y-3 text-sm text-neutral-300 leading-relaxed">
            {/* Dynamic plain language conclusion */}
            {matchedItems.length > 0 && notFoundItems.length > 0 && (
              <p>
                In simple terms, Reprova found good implementation evidence for the model&apos;s core architectural features (such as{' '}
                <strong className="text-white">{matchedItems.slice(0, 2).join(' and ')}</strong>). However, the repository does not contain enough benchmark evaluation code or training scripts to verify claims like{' '}
                <strong className="text-white">&ldquo;{notFoundItems[0]}&rdquo;</strong>.
              </p>
            )}

            {matchedItems.length > 0 && notFoundItems.length === 0 && (
              <p>
                In simple terms, Reprova found supporting implementation evidence across all examined claims in the repository, demonstrating strong public code alignment with the paper&apos;s key methodology.
              </p>
            )}

            {matchedItems.length === 0 && (
              <p>
                In simple terms, Reprova could not locate supporting code evidence for the evaluated claims in the released repository files.
              </p>
            )}

            <p className="bg-white/5 border border-white/15 p-4 rounded-xl text-neutral-200 font-medium">
              <strong>Key Takeaway:</strong> The main limitation is not necessarily that the paper is wrong; it is that the released repository does not provide enough evidence for that particular claim. Machine learning authors frequently publish inference-only weights or minimal model definitions while omitting multi-GPU benchmark harnesses or private evaluation datasets.
            </p>
          </div>
        </section>
      </CometCard>

      {/* SECTION F: Execution Result Explanation (if execution data exists) */}
      {execResult && (
        <CometCard className="w-full">
          <section className="bg-black/45 backdrop-blur-md border border-white/15 rounded-2xl p-6 sm:p-7 shadow-2xl text-neutral-100 space-y-3">
            <div className="border-b border-white/10 pb-3">
              <h3 className="text-lg font-bold text-white">Execution & Evaluation Environment</h3>
            </div>

            <div className="text-sm text-neutral-300 leading-relaxed space-y-3">
              {isCuratedPaper ? (
                <div className="bg-amber-950/40 border border-amber-500/30 p-4 rounded-xl space-y-1.5 text-xs sm:text-sm text-amber-200">
                  <p className="font-semibold text-amber-300">
                    Deterministic Evaluation Simulation Notice
                  </p>
                  <p>
                    This result comes from Reprova&apos;s deterministic evaluation simulation. It is a lightweight demonstration and does not mean that the original large-scale ML experiment was fully retrained.
                  </p>
                </div>
              ) : execResult.status === 'success' ? (
                <p>
                  Reprova ran the available evaluation script in an isolated container environment.
                </p>
              ) : (
                <p>
                  Automated container execution was skipped for this repository because container evaluation is restricted to supported benchmark environments.
                </p>
              )}

              {comparisons.length > 0 && (
                <div className="space-y-2 pt-2">
                  <p className="text-xs uppercase font-bold text-neutral-400 tracking-wider">
                    Metric Comparison in Plain Words:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {comparisons.map((c, i) => (
                      <div key={i} className="bg-white/5 border border-white/10 p-3 rounded-lg text-xs">
                        <span className="font-bold text-white">{c.metric}</span>
                        <div className="flex justify-between mt-1 text-neutral-300">
                          <span>Reported in paper: <strong className="text-white">{c.claimed}</strong></span>
                          <span>Reproduced: <strong className="text-emerald-300">{c.reproduced !== null ? c.reproduced : 'N/A'}</strong></span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        </CometCard>
      )}

      {/* SECTION G: Simple Explanations for Technical Terms (Only when present) */}
      {(hasGqa || hasSwa || hasVit || hasResidual) && (
        <CometCard className="w-full">
          <section className="bg-black/45 backdrop-blur-md border border-white/15 rounded-2xl p-6 sm:p-7 shadow-2xl text-neutral-100 space-y-3">
            <div className="border-b border-white/10 pb-3">
              <h3 className="text-lg font-bold text-white">Technical Terms in Simple Words</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm text-neutral-300">
              {hasGqa && (
                <div className="bg-white/5 border border-white/10 p-3.5 rounded-xl space-y-1">
                  <span className="font-bold text-white">Grouped-Query Attention (GQA)</span>
                  <p className="text-neutral-400 leading-relaxed text-xs">
                    An attention technique that groups keys and values across multiple query heads. This significantly speeds up inference and reduces GPU memory usage.
                  </p>
                </div>
              )}

              {hasSwa && (
                <div className="bg-white/5 border border-white/10 p-3.5 rounded-xl space-y-1">
                  <span className="font-bold text-white">Sliding Window Attention (SWA)</span>
                  <p className="text-neutral-400 leading-relaxed text-xs">
                    An attention mechanism where each token only attends to a fixed window of neighboring tokens, dramatically cutting memory requirements for long documents.
                  </p>
                </div>
              )}

              {hasVit && (
                <div className="bg-white/5 border border-white/10 p-3.5 rounded-xl space-y-1">
                  <span className="font-bold text-white">Vision Transformer (ViT)</span>
                  <p className="text-neutral-400 leading-relaxed text-xs">
                    A machine learning architecture that breaks images into square patches and processes them using transformer attention rather than traditional convolution filters.
                  </p>
                </div>
              )}

              {hasResidual && (
                <div className="bg-white/5 border border-white/10 p-3.5 rounded-xl space-y-1">
                  <span className="font-bold text-white">Residual Connections (ResNet)</span>
                  <p className="text-neutral-400 leading-relaxed text-xs">
                    Shortcut connections that skip one or more layers, allowing gradients to flow backwards through very deep networks without vanishing.
                  </p>
                </div>
              )}
            </div>
          </section>
        </CometCard>
      )}
    </div>
  );
}
