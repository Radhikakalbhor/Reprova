'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { GraphData, GraphNode, GraphEdge } from '@/lib/api';
import { InteractiveHoverButton } from '@/components/ui/interactive-hover-button';
import { CometCard } from '@/components/ui/comet-card';

interface TraceabilityGraphProps {
  graphData?: GraphData;
  paperTitle?: string;
  repoUrl?: string;
}

export function TraceabilityGraph({ graphData, paperTitle, repoUrl }: TraceabilityGraphProps) {
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<{ sourceNode: GraphNode; targetNode: GraphNode; edge: GraphEdge } | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [showAllClaims, setShowAllClaims] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const [nodePositions, setNodePositions] = useState<Record<string, { x: number; y: number; side: 'left' | 'right' }>>({});

  const nodes = graphData?.nodes || [];
  const edges = graphData?.edges || [];

  // Separate left (claims) and right (files) nodes
  const claimNodesAll = useMemo(() => nodes.filter((n) => n.type === 'paper_claim'), [nodes]);
  const fileNodes = useMemo(() => nodes.filter((n) => n.type === 'code_file'), [nodes]);

  // Cap initial claim display to 8 for clutter-free viewing
  const MAX_INITIAL = 8;
  const claimNodes = useMemo(() => {
    if (showAllClaims || claimNodesAll.length <= MAX_INITIAL) {
      return claimNodesAll;
    }
    return claimNodesAll.slice(0, MAX_INITIAL);
  }, [claimNodesAll, showAllClaims]);

  const activeClaimIds = useMemo(() => new Set(claimNodes.map((n) => n.id)), [claimNodes]);
  const filteredEdges = useMemo(() => edges.filter((e) => activeClaimIds.has(e.source)), [edges, activeClaimIds]);

  // Calculate coordinates for SVG bezier connection curves
  useEffect(() => {
    const updatePositions = () => {
      if (!containerRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();
      const posMap: Record<string, { x: number; y: number; side: 'left' | 'right' }> = {};

      const claimEls = containerRef.current.querySelectorAll('[data-node-id]');
      claimEls.forEach((el) => {
        const id = el.getAttribute('data-node-id');
        const side = el.getAttribute('data-node-side') as 'left' | 'right';
        if (id && el) {
          const rect = el.getBoundingClientRect();
          posMap[id] = {
            x: side === 'left' ? rect.right - containerRect.left : rect.left - containerRect.left,
            y: rect.top + rect.height / 2 - containerRect.top,
            side,
          };
        }
      });
      setNodePositions(posMap);
    };

    updatePositions();
    window.addEventListener('resize', updatePositions);
    const timer = setTimeout(updatePositions, 100);
    return () => {
      window.removeEventListener('resize', updatePositions);
      clearTimeout(timer);
    };
  }, [claimNodes, fileNodes]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'matched':
      case 'verified':
        return '#34d399'; // Emerald Green
      case 'partial_match':
      case 'unverified':
        return '#fbbf24'; // Amber Yellow
      case 'conflicting':
        return '#f87171'; // Rose Red
      case 'not_found':
      default:
        return '#9ca3af'; // Muted Gray
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'matched':
      case 'verified':
        return 'bg-emerald-950/70 text-emerald-300 border-emerald-500/40 font-extrabold';
      case 'partial_match':
      case 'unverified':
        return 'bg-amber-950/70 text-amber-300 border-amber-500/40 font-extrabold';
      case 'conflicting':
        return 'bg-rose-950/70 text-rose-300 border-rose-500/40 font-extrabold';
      default:
        return 'bg-neutral-900 text-neutral-300 border-white/20 font-bold';
    }
  };

  return (
    <>
      <CometCard className="w-full">
        <div className="bg-black/45 backdrop-blur-md border border-white/15 rounded-2xl p-6 space-y-6 shadow-2xl text-neutral-100">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/15 pb-4 gap-4">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center space-x-2">
                <span>Visual Traceability Map</span>
                <span className="text-xs bg-white/10 text-white px-2.5 py-0.5 rounded-full font-mono border border-white/20 font-bold">
                  Interactive
                </span>
              </h2>
          <p className="text-xs font-medium text-neutral-400 mt-1">
            Visual connections linking paper claims (left) directly to codebase files (right). Click any node to inspect full evidence.
          </p>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 text-xs font-mono font-bold">
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            <span className="text-neutral-300">Matched</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <span className="text-neutral-300">Partial</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
            <span className="text-neutral-300">Conflicting</span>
          </div>
        </div>
      </div>

      {nodes.length === 0 ? (
        <p className="text-sm text-neutral-400 italic py-8 text-center">
          No graph data available for this paper analysis.
        </p>
      ) : (
        <div ref={containerRef} className="relative grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-24 pt-4">
          {/* SVG Connection Lines overlay on desktop */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none hidden md:block z-10" style={{ overflow: 'visible' }}>
            <defs>
              <linearGradient id="edge-grad-matched" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#34d399" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#34d399" stopOpacity="0.3" />
              </linearGradient>
              <linearGradient id="edge-grad-partial" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#fbbf24" stopOpacity="0.3" />
              </linearGradient>
              <linearGradient id="edge-grad-conflict" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#f87171" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#f87171" stopOpacity="0.3" />
              </linearGradient>
            </defs>
            {filteredEdges.map((edge) => {
              const srcPos = nodePositions[edge.source];
              const tgtPos = nodePositions[edge.target];
              if (!srcPos || !tgtPos) return null;

              const isHighlighted = hoveredNodeId === edge.source || hoveredNodeId === edge.target;
              const strokeColor = getStatusColor(edge.status);
              const dx = Math.abs(tgtPos.x - srcPos.x) * 0.45;
              const pathD = `M ${srcPos.x} ${srcPos.y} C ${srcPos.x + dx} ${srcPos.y}, ${tgtPos.x - dx} ${tgtPos.y}, ${tgtPos.x} ${tgtPos.y}`;

              return (
                <g key={edge.id || `${edge.source}-${edge.target}`}>
                  <path
                    d={pathD}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth={isHighlighted ? 3.5 : 1.5}
                    strokeOpacity={isHighlighted ? 0.95 : 0.35}
                    strokeDasharray={edge.status === 'partial_match' ? '4 3' : undefined}
                    className="transition-all duration-200"
                  />
                  {isHighlighted && (
                    <circle cx={(srcPos.x + tgtPos.x) / 2} cy={(srcPos.y + tgtPos.y) / 2} r={4} fill={strokeColor} />
                  )}
                </g>
              );
            })}
          </svg>

          {/* Left Column: Paper Claims */}
          <div className="space-y-4 z-20">
            <h3 className="text-xs font-bold uppercase text-neutral-400 font-mono tracking-wider mb-3">
              Paper Claims ({claimNodesAll.length})
            </h3>
            {claimNodes.map((node) => {
              const connectedEdge = edges.find((e) => e.source === node.id);
              const status = connectedEdge?.status || 'unverified';
              const conf = (node.confidence || 'high').toLowerCase();
              const confColors: Record<string, { label: string; style: string }> = {
                high: { label: 'High Conf', style: 'text-emerald-300 bg-emerald-950/70 border-emerald-500/40' },
                medium: { label: 'Med Conf', style: 'text-amber-300 bg-amber-950/70 border-amber-500/40' },
                low: { label: 'Low Conf', style: 'text-rose-300 bg-rose-950/70 border-rose-500/40' },
              };
              const confInfo = confColors[conf] || confColors.high;

              return (
                <div
                  key={node.id}
                  data-node-id={node.id}
                  data-node-side="left"
                  onMouseEnter={() => setHoveredNodeId(node.id)}
                  onMouseLeave={() => setHoveredNodeId(null)}
                  onClick={() => setSelectedNode(node)}
                  className={`bg-white/5 border rounded-xl p-4 cursor-pointer transition-all duration-200 hover:border-white/50 hover:shadow-lg shadow-sm ${
                    hoveredNodeId === node.id ? 'ring-2 ring-white/50 border-white' : 'border-white/10'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-white leading-snug">{node.label}</p>
                      <span className={`inline-block text-[10px] font-mono px-2 py-0.5 rounded border font-extrabold uppercase ${confInfo.style}`}>
                        ● {confInfo.label}
                      </span>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-extrabold uppercase border whitespace-nowrap shadow-2xs ${getStatusBadge(status)}`}>
                      {status.replace('_', ' ')}
                    </span>
                  </div>
                  {node.evidence && (
                    <p className="text-xs text-neutral-300 mt-2 line-clamp-2 italic font-medium">"{node.evidence}"</p>
                  )}
                </div>
              );
            })}

            {claimNodesAll.length > MAX_INITIAL && (
              <div className="pt-2 flex justify-center">
                <InteractiveHoverButton
                  type="button"
                  onClick={() => setShowAllClaims(!showAllClaims)}
                  text={showAllClaims ? 'Collapse to top claims' : `Show ${claimNodesAll.length - MAX_INITIAL} more paper claims`}
                  className="w-full py-2.5 text-xs font-mono font-bold border-white/20 bg-white/5"
                />
              </div>
            )}
          </div>

          {/* Right Column: Code Files */}
          <div className="space-y-4 z-20">
            <h3 className="text-xs font-bold uppercase text-neutral-400 font-mono tracking-wider mb-3">
              Code Base Files ({fileNodes.length})
            </h3>
            {fileNodes.map((node) => {
              return (
                <div
                  key={node.id}
                  data-node-id={node.id}
                  data-node-side="right"
                  onMouseEnter={() => setHoveredNodeId(node.id)}
                  onMouseLeave={() => setHoveredNodeId(null)}
                  onClick={() => setSelectedNode(node)}
                  className={`bg-white/5 border rounded-xl p-4 cursor-pointer transition-all duration-200 hover:border-white/50 hover:shadow-lg shadow-sm ${
                    hoveredNodeId === node.id ? 'ring-2 ring-white/50 border-white' : 'border-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <code className="text-xs font-mono font-bold text-white bg-white/10 px-2.5 py-0.5 rounded border border-white/20">
                      {node.label}
                    </code>
                    {node.category && (
                      <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-white/5 text-neutral-300 border border-white/15 font-bold">
                        {node.category}
                      </span>
                    )}
                  </div>
                  {node.excerpt && (
                    <pre className="mt-2 text-[11px] font-mono text-neutral-200 bg-black/60 p-2.5 rounded line-clamp-3 overflow-hidden border border-white/10 font-medium">
                      {node.excerpt}
                    </pre>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
        </div>
      </CometCard>

      {/* Node Detail Slide-Over Modal */}
      {selectedNode && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-neutral-950 border border-white/20 rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl relative text-neutral-100">
            <button
              type="button"
              onClick={() => setSelectedNode(null)}
              className="absolute top-4 right-4 text-neutral-400 hover:text-white text-lg font-bold p-1"
            >
              ✕
            </button>

            <div className="space-y-1 pr-6">
              <span className="text-xs uppercase font-mono font-bold text-white bg-white/10 px-2.5 py-0.5 rounded border border-white/20">
                {selectedNode.type === 'paper_claim' ? 'Paper Claim Node Detail' : 'Code File Node Detail'}
              </span>
              <h3 className="text-xl font-extrabold text-white">{selectedNode.label}</h3>
            </div>

            {selectedNode.type === 'paper_claim' ? (
              <div className="space-y-4 text-sm">
                {selectedNode.confidence && (
                  <div className="space-y-1">
                    <p className="text-xs text-neutral-400 font-bold uppercase font-mono">Extraction Confidence:</p>
                    <span className="inline-block text-xs font-mono font-bold uppercase px-2.5 py-1 rounded bg-white/10 text-white border border-white/20">
                      ● {selectedNode.confidence} confidence
                    </span>
                  </div>
                )}
                {selectedNode.evidence && (
                  <div className="space-y-1">
                    <p className="text-xs text-neutral-400 font-bold uppercase font-mono">Paper Evidence Text:</p>
                    <p className="bg-white/5 border border-white/10 p-3 rounded-lg text-neutral-200 italic text-xs font-medium">
                      "{selectedNode.evidence}"
                    </p>
                  </div>
                )}
                {selectedNode.matched_value && (
                  <div className="space-y-1">
                    <p className="text-xs text-neutral-400 font-bold uppercase font-mono">Matched Code Value:</p>
                    <code className="block bg-emerald-950/70 border border-emerald-500/40 p-3 rounded-lg text-emerald-300 font-mono text-xs font-semibold">
                      {selectedNode.matched_value}
                    </code>
                  </div>
                )}
                {selectedNode.reasoning && (
                  <div className="space-y-1">
                    <p className="text-xs text-neutral-400 font-bold uppercase font-mono">Match Reasoning:</p>
                    <p className="bg-white/5 border border-white/10 p-3 rounded-lg text-neutral-200 text-xs font-medium">
                      {selectedNode.reasoning}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4 text-sm">
                <div className="space-y-1">
                  <p className="text-xs text-neutral-400 font-bold uppercase font-mono">File Path:</p>
                  <code className="block bg-white/10 border border-white/20 p-2.5 rounded-lg text-white font-mono text-xs font-bold">
                    {selectedNode.label}
                  </code>
                </div>
                {selectedNode.excerpt && (
                  <div className="space-y-1">
                    <p className="text-xs text-neutral-400 font-bold uppercase font-mono">Extracted Code Excerpt:</p>
                    <pre className="bg-black/60 border border-white/15 p-3 rounded-lg text-neutral-200 font-mono text-xs max-h-60 overflow-y-auto whitespace-pre-wrap font-medium">
                      {selectedNode.excerpt}
                    </pre>
                  </div>
                )}
              </div>
            )}

            <div className="pt-4 border-t border-white/15 flex justify-end">
              <InteractiveHoverButton
                type="button"
                onClick={() => setSelectedNode(null)}
                text="Close Inspector"
                className="py-2 px-5 text-xs font-bold"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
