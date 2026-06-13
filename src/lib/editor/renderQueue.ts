/**
 * render-queue — persistent queue of render jobs.
 *
 * Separate from the editor's main store because jobs survive across
 * project switches and page reloads. Lives in localStorage; when
 * supabase persistence lands in v2, the key becomes a server-side
 * job ledger.
 *
 * The queue is append-only from the UI's perspective — a job's
 * status transitions are pushed by the export panel, the toast
 * subscriber, and (eventually) realtime supabase notifications when
 * the final-assembly edge function completes.
 */
import type { RenderJob } from "./types";

const STORAGE_KEY = "smallbridges.editor.renderQueue";
const MAX_HISTORY = 50;

let jobs: RenderJob[] = readInitial();
const listeners = new Set<() => void>();

function readInitial(): RenderJob[] {
  try {
    if (typeof window === "undefined") return [];
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as RenderJob[];
    if (!Array.isArray(arr)) return [];
    return arr;
  } catch {
    return [];
  }
}

function persist(): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs));
  } catch {
    /* quota / private mode — silent */
  }
}

function notify(): void {
  for (const l of listeners) l();
}

export function getRenderJobs(): RenderJob[] {
  return jobs;
}

export function subscribeRenderQueue(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function addRenderJob(job: Omit<RenderJob, "id" | "createdAt" | "status"> & {
  status?: RenderJob["status"];
}): string {
  const id = `job-${Math.floor(performance.now())}-${Math.floor(Math.random() * 1e6).toString(36)}`;
  const next: RenderJob = {
    id,
    createdAt: new Date().toISOString(),
    status: job.status ?? "queued",
    ...job,
  };
  jobs = [next, ...jobs].slice(0, MAX_HISTORY);
  persist();
  notify();
  return id;
}

export function updateRenderJob(id: string, patch: Partial<RenderJob>): void {
  jobs = jobs.map((j) => (j.id === id ? { ...j, ...patch } : j));
  persist();
  notify();
}

export function removeRenderJob(id: string): void {
  jobs = jobs.filter((j) => j.id !== id);
  persist();
  notify();
}

export function clearCompletedJobs(): void {
  jobs = jobs.filter((j) => j.status !== "done");
  persist();
  notify();
}

export function clearAllJobs(): void {
  jobs = [];
  persist();
  notify();
}
