'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { analyzePaper, fetchCuratedPapers, CuratedPaper } from '@/lib/api';
import { InteractiveHoverButton } from '@/components/ui/interactive-hover-button';
import { CardSpotlight } from '@/components/ui/card-spotlight';
import RubberSegment from '@/components/ui/RubberSegment';

const DEFAULT_CURATED_PAPERS: CuratedPaper[] = [
  {
    id: 'paper-llama2',
    title: 'Llama 2: Open Foundation and Fine-Tuned Chat Models',
    repo_url: 'https://github.com/facebookresearch/llama',
    has_execution: true,
  },
  {
    id: 'paper-mistral7b',
    title: 'Mistral 7B',
    repo_url: 'https://github.com/mistralai/mistral-src',
    has_execution: true,
  },
  {
    id: 'paper-clip',
    title: 'Learning Transferable Visual Models From Natural Language Supervision (CLIP)',
    repo_url: 'https://github.com/openai/CLIP',
    has_execution: true,
  },
];

const ANALYSIS_STEPS = [
  { id: 'extract_claims', label: 'Extracting research claims' },
  { id: 'index_paper', label: 'Indexing paper evidence' },
  { id: 'inspect_repo', label: 'Inspecting repository' },
  { id: 'match_code', label: 'Matching claims to code' },
  { id: 'validate_evidence', label: 'Validating evidence' },
  { id: 'prepare_report', label: 'Preparing reproducibility report' },
];

export default function AnalyzeClient() {
  const router = useRouter();
  const [mode, setMode] = useState<'curated' | 'custom'>('curated');
  const [curatedPapers, setCuratedPapers] = useState<CuratedPaper[]>(DEFAULT_CURATED_PAPERS);
  const [selectedPaper, setSelectedPaper] = useState(DEFAULT_CURATED_PAPERS[0].id);
  const [repoUrl, setRepoUrl] = useState('');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeStepIndex, setActiveStepIndex] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlMode = params.get('mode');
      if (urlMode === 'curated' || urlMode === 'custom') {
        setMode(urlMode);
      }
    }

    async function loadPapers() {
      const papers = await fetchCuratedPapers();
      if (papers && papers.length > 0) {
        setCuratedPapers(papers);
        setSelectedPaper(papers[0].id);
      }
    }
    loadPapers();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mode === 'curated') {
      router.push(`/results?paper_id=${encodeURIComponent(selectedPaper)}`);
    } else {
      if (!repoUrl) {
        setError('Please provide a GitHub repository URL.');
        return;
      }
      setLoading(true);

      try {
        const formData = new FormData();
        if (pdfFile) {
          formData.append('file', pdfFile);
        }
        formData.append('repo_url', repoUrl);
        formData.append('mode', 'custom');

        const result = await analyzePaper(formData);
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('custom_analysis_result', JSON.stringify(result));
        }
        router.push('/results?mode=custom');
      } catch (err: unknown) {
        setLoading(false);
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('An unexpected error occurred during analysis.');
        }
      }
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-transparent text-neutral-100 relative overflow-hidden">
      <Header />

      <main className="flex-1 max-w-4xl w-full mx-auto px-6 py-12 relative z-10">
        <CardSpotlight
          radius={450}
          color="#1e1e24"
          className="bg-black/60 backdrop-blur-xl border border-white/15 rounded-3xl p-8 sm:p-10 md:p-12 shadow-2xl"
        >
          <div className="relative z-20 space-y-8 sm:space-y-10">
            {/* Header inside the big card */}
            <div className="text-center max-w-2xl mx-auto">
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white">
                Analyze Research Paper & Repository
              </h1>
            </div>



            {/* Mode Switcher with RubberSegment */}
            <div className="mb-6 flex">
              <RubberSegment
                value={mode}
                onChange={(val) => setMode(val as 'curated' | 'custom')}
                items={[
                  { value: 'curated', label: 'Select Curated Paper (Demo)' },
                  { value: 'custom', label: 'Upload Custom Paper + Repo' },
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
                aria-label="Paper analysis mode selection"
              />
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {mode === 'curated' ? (
                <div>
                  <label className="block text-sm font-bold text-neutral-200 mb-2">
                    Curated Paper & Repository Pair
                  </label>
                  <select
                    value={selectedPaper}
                    onChange={(e) => setSelectedPaper(e.target.value)}
                    className="w-full bg-neutral-900 border border-white/15 rounded-lg px-4 py-3 text-white font-semibold focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/50 text-sm shadow-xs"
                  >
                    {curatedPapers.map((paper) => (
                      <option key={paper.id} value={paper.id} className="text-white bg-neutral-900 font-medium">
                        {paper.title} ({paper.repo_url}) {paper.has_execution ? '⚡ Docker Execution Available' : ''}
                      </option>
                    ))}
                  </select>
                  <p className="text-sm text-neutral-400 font-medium mt-2.5">
                    Curated targets include pre-tested Docker evaluation containers for sandboxed benchmark metric reproduction.
                  </p>
                </div>
              ) : (
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-bold text-neutral-200 mb-2">
                      GitHub Repository URL <span className="text-rose-500 font-bold">*</span>
                    </label>
                    <input
                      type="url"
                      value={repoUrl}
                      onChange={(e) => setRepoUrl(e.target.value)}
                      placeholder="https://github.com/organization/repository"
                      className="w-full bg-black/40 border border-white/15 rounded-lg px-4 py-3 text-white font-semibold placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/50 text-sm shadow-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-neutral-200 mb-2">
                      Paper PDF File
                    </label>
                    <div className="border-2 border-dashed border-white/20 hover:border-white/40 rounded-lg p-6 text-center bg-white/[0.03] cursor-pointer transition-colors">
                      <input
                        type="file"
                        accept=".pdf"
                        onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                        className="hidden"
                        id="pdf-upload"
                      />
                      <label htmlFor="pdf-upload" className="cursor-pointer">
                        <p className="text-sm text-white font-bold">
                          {pdfFile ? pdfFile.name : 'Click to select or drag and drop paper PDF'}
                        </p>
                        <p className="text-xs text-neutral-400 font-semibold mt-1">PDF up to 50MB</p>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm rounded-lg p-4 font-bold shadow-xs">
                  {error}
                </div>
              )}

              <InteractiveHoverButton
                type="submit"
                disabled={loading}
                text={loading ? 'Analyzing Paper...' : mode === 'curated' ? 'Run Demo Analysis' : 'Start Reproducibility Analysis'}
                className="w-full justify-center py-3.5 shadow-md shadow-white/10 border-white/25 bg-black/60"
              />
            </form>
          </div>
        </CardSpotlight>
      </main>

      <Footer />
    </div>
  );
}
