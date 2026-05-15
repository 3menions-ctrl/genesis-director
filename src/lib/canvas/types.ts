/**
 * Director Canvas — graph type definitions.
 * Each node represents a creative primitive: model, avatar, environment,
 * dialogue, audio, scene, or render. Edges wire data between them.
 */
import type { Node, Edge } from '@xyflow/react';

export type CanvasNodeKind =
  | 'model'
  | 'avatar'
  | 'environment'
  | 'dialogue'
  | 'audio'
  | 'scene'
  | 'render';

export interface ReplicateModelRef {
  owner: string;
  name: string;
  label?: string;
  category?: 'video' | 'image' | 'audio' | 'other';
}

export interface ModelNodeData extends Record<string, unknown> {
  kind: 'model';
  label: string;
  model?: ReplicateModelRef;
  inputs?: Record<string, unknown>;
}

export interface AvatarNodeData extends Record<string, unknown> {
  kind: 'avatar';
  label: string;
  avatarId?: string;
  imageUrl?: string;
  name?: string;
}

export interface EnvironmentNodeData extends Record<string, unknown> {
  kind: 'environment';
  label: string;
  prompt?: string;
  imageUrl?: string;
}

export interface DialogueLine {
  speaker: string; // matches an Avatar node label
  text: string;
}
export interface DialogueNodeData extends Record<string, unknown> {
  kind: 'dialogue';
  label: string;
  mode: 'storyboard' | 'conversation';
  lines: DialogueLine[];
}

export interface AudioNodeData extends Record<string, unknown> {
  kind: 'audio';
  label: string;
  source: 'musicgen' | 'elevenlabs' | 'upload';
  prompt?: string;
  url?: string;
}

export interface SceneNodeData extends Record<string, unknown> {
  kind: 'scene';
  label: string;
  duration: number; // seconds
  cameraNote?: string;
}

export interface RenderNodeData extends Record<string, unknown> {
  kind: 'render';
  label: string;
  status?: 'idle' | 'queued' | 'running' | 'done' | 'error';
  progress?: number;
}

export type CanvasNodeData =
  | ModelNodeData
  | AvatarNodeData
  | EnvironmentNodeData
  | DialogueNodeData
  | AudioNodeData
  | SceneNodeData
  | RenderNodeData;

export type CanvasNode = Node<CanvasNodeData>;
export type CanvasEdge = Edge;

export interface CanvasGraph {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  viewport?: { x: number; y: number; zoom: number };
}

/** Edge compatibility map — what can connect into what. */
export const EDGE_RULES: Record<CanvasNodeKind, CanvasNodeKind[]> = {
  model: ['scene', 'render'],
  avatar: ['scene', 'dialogue'],
  environment: ['scene'],
  dialogue: ['scene'],
  audio: ['scene', 'render'],
  scene: ['render'],
  render: [],
};

export function canConnect(source: CanvasNodeKind, target: CanvasNodeKind): boolean {
  return EDGE_RULES[source]?.includes(target) ?? false;
}