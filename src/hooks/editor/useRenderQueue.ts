/**
 * useRenderQueue — reactive read of the render queue.
 */
import { useSyncExternalStore } from "react";
import {
  getRenderJobs,
  subscribeRenderQueue,
  addRenderJob,
  updateRenderJob,
  removeRenderJob,
  clearCompletedJobs,
  clearAllJobs,
} from "@/lib/editor/renderQueue";

export function useRenderQueue() {
  const jobs = useSyncExternalStore(
    subscribeRenderQueue,
    getRenderJobs,
    getRenderJobs,
  );
  return {
    jobs,
    addRenderJob,
    updateRenderJob,
    removeRenderJob,
    clearCompletedJobs,
    clearAllJobs,
  };
}
