import { Handle, Position, type NodeProps } from '@xyflow/react';
import { motion } from 'framer-motion';
import { Bot, Film, Image as ImageIcon, MessageSquare, Music, Sparkles, Wand2, Layers } from 'lucide-react';
import type {
  AvatarNodeData, AudioNodeData, DialogueNodeData,
  EnvironmentNodeData, ModelNodeData, RenderNodeData, SceneNodeData,
} from '@/lib/canvas/types';

const SHELL =
  'rounded-2xl border border-white/10 bg-gradient-to-br from-[hsl(220,14%,6%)] to-[hsl(220,14%,3%)] ' +
  'shadow-[0_0_0_1px_rgba(10,132,255,0.0),0_24px_60px_-30px_rgba(10,132,255,0.5)] ' +
  'backdrop-blur-xl text-foreground min-w-[200px]';

const HEADER = 'flex items-center gap-2 px-4 pt-3 pb-2 text-[11px] uppercase tracking-[0.18em] text-white/60';
const BODY = 'px-4 pb-4 pt-1 text-sm text-white/90 font-serif';

function H({ side }: { side: 'l' | 'r' }) {
  return (
    <Handle
      type={side === 'l' ? 'target' : 'source'}
      position={side === 'l' ? Position.Left : Position.Right}
      className="!w-3 !h-3 !bg-[#0A84FF] !border-2 !border-background"
    />
  );
}

function NodeFrame({ children, accent = '#0A84FF' }: { children: React.ReactNode; accent?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
      className={SHELL}
      style={{ boxShadow: `0 0 0 1px ${accent}22, 0 24px 60px -30px ${accent}66` }}
    >
      {children}
    </motion.div>
  );
}

export function ModelNode({ data }: NodeProps) {
  const d = data as ModelNodeData;
  return (
    <NodeFrame>
      <H side="l" />
      <div className={HEADER}><Wand2 className="h-3 w-3" /> Model</div>
      <div className={BODY}>
        <div className="font-medium">{d.model?.label ?? 'No model selected'}</div>
        {d.model && (
          <div className="font-mono text-[10px] text-white/40 mt-1">{d.model.owner}/{d.model.name}</div>
        )}
      </div>
      <H side="r" />
    </NodeFrame>
  );
}

export function AvatarNode({ data }: NodeProps) {
  const d = data as AvatarNodeData;
  return (
    <NodeFrame accent="#a855f7">
      <H side="l" />
      <div className={HEADER}><Bot className="h-3 w-3" /> Avatar</div>
      <div className={BODY + ' flex items-center gap-3'}>
        {d.imageUrl ? (
          <img src={d.imageUrl} alt="" className="h-12 w-12 rounded-xl object-cover" />
        ) : (
          <div className="h-12 w-12 rounded-xl bg-white/5 flex items-center justify-center">
            <Bot className="h-5 w-5 text-white/40" />
          </div>
        )}
        <div className="font-medium">{d.name ?? d.label}</div>
      </div>
      <H side="r" />
    </NodeFrame>
  );
}

export function EnvironmentNode({ data }: NodeProps) {
  const d = data as EnvironmentNodeData;
  return (
    <NodeFrame accent="#22d3ee">
      <H side="l" />
      <div className={HEADER}><ImageIcon className="h-3 w-3" /> Environment</div>
      <div className={BODY}>
        {d.imageUrl && <img src={d.imageUrl} alt="" className="rounded-lg mb-2 w-full max-h-32 object-cover" />}
        <div className="text-xs text-white/70 line-clamp-3">{d.prompt ?? 'No prompt'}</div>
      </div>
      <H side="r" />
    </NodeFrame>
  );
}

export function DialogueNode({ data }: NodeProps) {
  const d = data as DialogueNodeData;
  return (
    <NodeFrame accent="#f59e0b">
      <H side="l" />
      <div className={HEADER}><MessageSquare className="h-3 w-3" /> Dialogue · {d.mode}</div>
      <div className={BODY + ' max-w-[280px]'}>
        {d.lines.length === 0 && <div className="text-white/40 text-xs">No lines yet</div>}
        {d.lines.slice(0, 3).map((l, i) => (
          <div key={i} className="text-xs mb-1">
            <span className="text-[#0A84FF] font-medium">{l.speaker}:</span>{' '}
            <span className="text-white/80">{l.text}</span>
          </div>
        ))}
        {d.lines.length > 3 && <div className="text-[10px] text-white/40">+{d.lines.length - 3} more</div>}
      </div>
      <H side="r" />
    </NodeFrame>
  );
}

export function AudioNode({ data }: NodeProps) {
  const d = data as AudioNodeData;
  return (
    <NodeFrame accent="#10b981">
      <H side="l" />
      <div className={HEADER}><Music className="h-3 w-3" /> Audio · {d.source}</div>
      <div className={BODY}>
        <div className="text-xs text-white/70 line-clamp-2">{d.prompt ?? d.url ?? 'Untitled'}</div>
      </div>
      <H side="r" />
    </NodeFrame>
  );
}

export function SceneNode({ data }: NodeProps) {
  const d = data as SceneNodeData;
  return (
    <NodeFrame accent="#0A84FF">
      <H side="l" />
      <div className={HEADER}><Layers className="h-3 w-3" /> Scene · {d.duration}s</div>
      <div className={BODY}>
        <div className="font-medium">{d.label}</div>
        {d.cameraNote && <div className="text-xs text-white/60 mt-1 italic">{d.cameraNote}</div>}
      </div>
      <H side="r" />
    </NodeFrame>
  );
}

export function RenderNode({ data }: NodeProps) {
  const d = data as RenderNodeData;
  const status = d.status ?? 'idle';
  return (
    <NodeFrame accent="#ef4444">
      <H side="l" />
      <div className={HEADER}><Film className="h-3 w-3" /> Render</div>
      <div className={BODY}>
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[#0A84FF]" />
          <span className="font-medium capitalize">{status}</span>
        </div>
        {typeof d.progress === 'number' && (
          <div className="mt-2 h-1 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full bg-[#0A84FF]" style={{ width: `${d.progress}%` }} />
          </div>
        )}
      </div>
    </NodeFrame>
  );
}

export const NODE_TYPES = {
  model: ModelNode,
  avatar: AvatarNode,
  environment: EnvironmentNode,
  dialogue: DialogueNode,
  audio: AudioNode,
  scene: SceneNode,
  render: RenderNode,
};