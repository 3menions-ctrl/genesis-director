import { useCallback, useState } from 'react';
import {
  ReactFlow, Background, Controls, MiniMap, ReactFlowProvider, addEdge,
  applyNodeChanges, applyEdgeChanges, type Connection, type EdgeChange, type NodeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useCanvas } from '@/hooks/useCanvas';
import { LibraryRail } from './LibraryRail';
import { InspectorRail } from './InspectorRail';
import { MiniTimeline } from './MiniTimeline';
import { NODE_TYPES } from './nodes';
import { canConnect, type CanvasNode, type CanvasNodeData, type CanvasNodeKind } from '@/lib/canvas/types';
import { compileGraphToPipeline } from '@/lib/canvas/compileGraphToPipeline';

const NODE_DEFAULTS: Record<CanvasNodeKind, () => CanvasNodeData> = {
  model: () => ({ kind: 'model', label: 'Model' }),
  avatar: () => ({ kind: 'avatar', label: 'Avatar' }),
  environment: () => ({ kind: 'environment', label: 'Environment', prompt: '' }),
  dialogue: () => ({ kind: 'dialogue', label: 'Dialogue', mode: 'storyboard', lines: [] }),
  audio: () => ({ kind: 'audio', label: 'Audio', source: 'musicgen' }),
  scene: () => ({ kind: 'scene', label: 'Scene', duration: 5 }),
  render: () => ({ kind: 'render', label: 'Render' }),
};

function Inner() {
  const { graph, setGraph, loading, saving } = useCanvas();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const navigate = useNavigate();

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setGraph((g) => ({ ...g, nodes: applyNodeChanges(changes, g.nodes) as CanvasNode[] }));
  }, [setGraph]);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setGraph((g) => ({ ...g, edges: applyEdgeChanges(changes, g.edges) }));
  }, [setGraph]);

  const onConnect = useCallback((c: Connection) => {
    setGraph((g) => {
      const src = g.nodes.find((n) => n.id === c.source);
      const tgt = g.nodes.find((n) => n.id === c.target);
      if (!src || !tgt) return g;
      if (!canConnect(src.data.kind, tgt.data.kind)) {
        toast.error(`Cannot connect ${src.data.kind} → ${tgt.data.kind}`);
        return g;
      }
      return { ...g, edges: addEdge({ ...c, animated: true, style: { stroke: '#0A84FF', strokeWidth: 2 } }, g.edges) };
    });
  }, [setGraph]);

  const addNode = useCallback((kind: CanvasNodeKind) => {
    const id = `${kind}-${Date.now()}`;
    const x = 200 + Math.random() * 400;
    const y = 120 + Math.random() * 300;
    setGraph((g) => ({
      ...g,
      nodes: [...g.nodes, { id, type: kind, position: { x, y }, data: NODE_DEFAULTS[kind]() } as CanvasNode],
    }));
    setSelectedId(id);
  }, [setGraph]);

  const addModelNode = useCallback((owner: string, name: string, label: string) => {
    const id = `model-${Date.now()}`;
    const x = 200 + Math.random() * 400;
    const y = 120 + Math.random() * 300;
    setGraph((g) => ({
      ...g,
      nodes: [...g.nodes, {
        id, type: 'model', position: { x, y },
        data: { kind: 'model', label, model: { owner, name, label }, inputs: {} },
      } as CanvasNode],
    }));
    setSelectedId(id);
  }, [setGraph]);

  const updateSelected = useCallback((data: CanvasNodeData) => {
    if (!selectedId) return;
    setGraph((g) => ({
      ...g,
      nodes: g.nodes.map((n) => (n.id === selectedId ? { ...n, data } : n)),
    }));
  }, [selectedId, setGraph]);

  const handleRender = () => {
    const compiled = compileGraphToPipeline(graph);
    if (compiled.warnings.length) compiled.warnings.forEach((w) => toast.warning(w));
    if (compiled.scenes.length === 0) {
      toast.error('Add at least one Scene node before rendering.');
      return;
    }
    sessionStorage.setItem('canvas:pendingRender', JSON.stringify(compiled));
    toast.success(`Queued ${compiled.scenes.length} scene(s).`);
  };

  const handleOpenEditor = () => {
    const compiled = compileGraphToPipeline(graph);
    sessionStorage.setItem('canvas:handoff', JSON.stringify(compiled));
    navigate('/editor');
  };

  const selected = graph.nodes.find((n) => n.id === selectedId) ?? null;

  return (
    <div className="flex flex-col h-screen bg-[hsl(220,14%,2%)] text-foreground relative overflow-hidden">
      {/* Aurora ambience */}
      <div className="pointer-events-none absolute inset-0 opacity-60">
        <div className="absolute -top-32 left-1/3 h-[420px] w-[620px] rounded-full bg-[#0A84FF]/10 blur-[140px]" />
        <div className="absolute top-1/3 -right-24 h-[360px] w-[420px] rounded-full bg-[#22d3ee]/[0.06] blur-[120px]" />
      </div>

      <header className="relative px-7 py-4 border-b border-white/[0.06] flex items-center justify-between bg-[hsl(220,14%,2%)]/60 backdrop-blur-2xl">
        <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.32em] text-white/45">
            <span className="h-1.5 w-1.5 rounded-full bg-[#0A84FF] shadow-[0_0_12px_#0A84FF]" />
            Director Canvas
          </div>
          <h1 className="font-serif text-[28px] leading-[1.05] mt-0.5 bg-gradient-to-r from-white via-white to-white/60 bg-clip-text text-transparent">
            Compose your film, end to end
          </h1>
        </motion.div>
        <div className="flex items-center gap-2">
          <span className={`h-1.5 w-1.5 rounded-full ${saving ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
          <div className="text-[10px] uppercase tracking-[0.28em] text-white/45">
            {loading ? 'Loading' : saving ? 'Saving' : 'All changes saved'}
          </div>
        </div>
      </header>
      <div className="flex-1 flex min-h-0 relative">
        <LibraryRail onAdd={addNode} onAddModel={addModelNode} />
        <main className="flex-1 relative">
          {graph.nodes.length === 0 && !loading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
              className="absolute inset-0 grid place-items-center pointer-events-none z-10">
              <div className="text-center max-w-md">
                <div className="text-[10px] uppercase tracking-[0.32em] text-white/40">Empty canvas</div>
                <h2 className="font-serif text-[44px] leading-[1.02] mt-2 bg-gradient-to-b from-white to-white/40 bg-clip-text text-transparent">
                  Drop your<br/>first scene
                </h2>
                <p className="text-[12.5px] text-white/45 mt-3 leading-relaxed">
                  Pick a primitive from the rail or a featured model. Wire them into a Scene, then a Render.
                </p>
              </div>
            </motion.div>
          )}
          <ReactFlow
            nodes={graph.nodes}
            edges={graph.edges}
            nodeTypes={NODE_TYPES as any}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_, n) => setSelectedId(n.id)}
            onPaneClick={() => setSelectedId(null)}
            fitView
            proOptions={{ hideAttribution: true }}
            defaultEdgeOptions={{ animated: true, style: { stroke: '#0A84FF', strokeWidth: 2 } }}
          >
            <Background gap={36} size={1} color="#ffffff0f" />
            <Controls className="!bg-white/5 !border-white/10" />
            <MiniMap pannable zoomable
              nodeColor={(n) => {
                const k = (n.data as any)?.kind;
                return k === 'scene' ? '#0A84FF' : k === 'avatar' ? '#7DA8FF' : k === 'environment' ? '#22d3ee' :
                  k === 'dialogue' ? '#f59e0b' : k === 'audio' ? '#10b981' : k === 'render' ? '#ef4444' : '#ffffff40';
              }}
              className="!bg-[hsl(220,14%,3%)] !border-white/10" />
          </ReactFlow>
        </main>
        <InspectorRail node={selected} onChange={updateSelected} onClose={() => setSelectedId(null)} />
      </div>
      <MiniTimeline graph={graph} onOpenEditor={handleOpenEditor} onRender={handleRender} />
    </div>
  );
}

export function CanvasShell() {
  return (
    <ReactFlowProvider>
      <Inner />
    </ReactFlowProvider>
  );
}