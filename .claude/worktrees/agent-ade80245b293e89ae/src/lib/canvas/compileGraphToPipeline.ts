/**
 * Compile a Director Canvas graph into an ordered pipeline payload
 * that the existing Hollywood pipeline endpoints can consume.
 */
import type { CanvasGraph, CanvasNode, SceneNodeData } from './types';

export interface CompiledScene {
  id: string;
  duration: number;
  cameraNote?: string;
  modelRef?: { owner: string; name: string };
  modelInputs?: Record<string, unknown>;
  avatars: { id?: string; name?: string; imageUrl?: string }[];
  environment?: { prompt?: string; imageUrl?: string };
  dialogue: { speaker: string; text: string }[];
  audio: { source: string; prompt?: string; url?: string }[];
}

export interface CompiledPipeline {
  scenes: CompiledScene[];
  warnings: string[];
}

export function compileGraphToPipeline(graph: CanvasGraph): CompiledPipeline {
  const warnings: string[] = [];
  const byId = new Map<string, CanvasNode>();
  graph.nodes.forEach((n) => byId.set(n.id, n));

  const incoming = (target: string) =>
    graph.edges.filter((e) => e.target === target).map((e) => byId.get(e.source)).filter(Boolean) as CanvasNode[];

  const sceneNodes = graph.nodes.filter((n) => n.data.kind === 'scene');
  if (sceneNodes.length === 0) warnings.push('No scenes defined.');

  const scenes: CompiledScene[] = sceneNodes.map((sceneNode) => {
    const data = sceneNode.data as SceneNodeData;
    const ins = incoming(sceneNode.id);
    const modelN = ins.find((n) => n.data.kind === 'model');
    const envN = ins.find((n) => n.data.kind === 'environment');
    const dialogueN = ins.find((n) => n.data.kind === 'dialogue');
    const avatars = ins.filter((n) => n.data.kind === 'avatar');
    const audio = ins.filter((n) => n.data.kind === 'audio');

    if (!modelN) warnings.push(`Scene "${data.label}" has no model attached.`);
    if (avatars.length === 0 && !envN) warnings.push(`Scene "${data.label}" has no avatar or environment.`);

    return {
      id: sceneNode.id,
      duration: data.duration ?? 5,
      cameraNote: data.cameraNote,
      modelRef: modelN && (modelN.data as any).model
        ? { owner: (modelN.data as any).model.owner, name: (modelN.data as any).model.name }
        : undefined,
      modelInputs: modelN ? (modelN.data as any).inputs : undefined,
      avatars: avatars.map((a) => ({
        id: (a.data as any).avatarId,
        name: (a.data as any).name ?? a.data.label,
        imageUrl: (a.data as any).imageUrl,
      })),
      environment: envN ? { prompt: (envN.data as any).prompt, imageUrl: (envN.data as any).imageUrl } : undefined,
      dialogue: dialogueN ? (dialogueN.data as any).lines ?? [] : [],
      audio: audio.map((a) => ({
        source: (a.data as any).source,
        prompt: (a.data as any).prompt,
        url: (a.data as any).url,
      })),
    };
  });

  return { scenes, warnings };
}