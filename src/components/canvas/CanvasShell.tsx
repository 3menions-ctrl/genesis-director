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
    <div className="flex flex-col h-screen bg-[hsl(220,14%,2%)] text-foreground">
      <header className="px-6 py-3 border-b border-white/10 flex items-center justify-between">
        <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}>
          <div className="text-xs uppercase tracking-[0.22em] text-white/50">Director Canvas</div>
          <h1 className="font-serif text-2xl leading-tight">Compose your film, end to end</h1>
        </motion.div>
        <div className="text-[11px] uppercase tracking-wider text-white/40">
          {loading ? 'Loading…' : saving ? 'Saving…' : 'Saved'}
        </div>
      </header>
      <div className="flex-1 flex min-h-0">
        <LibraryRail onAdd={addNode} />
        <main className="flex-1 relative">
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
            <Background gap={32} size={1} color="#ffffff10" />
            <Controls className="!bg-white/5 !border-white/10" />
            <MiniMap pannable zoomable
              nodeColor={(n) => {
                const k = (n.data as any)?.kind;
                return k === 'scene' ? '#0A84FF' : k === 'avatar' ? '#a855f7' : k === 'environment' ? '#22d3ee' :
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