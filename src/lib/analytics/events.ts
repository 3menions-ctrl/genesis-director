/**
 * Event taxonomy — the canonical product events for funnels & analysis.
 * Use these names (not ad-hoc strings) so funnels/paths stay consistent.
 * Call `trackEvent(EVENTS.PROJECT_CREATED, { genre })` at the natural moment.
 */
import { track } from "./track";

export const EVENTS = {
  SIGNED_IN: "signed_in",
  SIGNED_UP: "signed_up",
  ONBOARDING_COMPLETED: "onboarding_completed",
  PROJECT_CREATED: "project_created",
  RENDER_STARTED: "render_started",
  RENDER_COMPLETED: "render_completed",
  PUBLISHED: "published",
  CREDITS_PURCHASED: "credits_purchased",
  CREDITS_SPENT: "credits_spent",
  AVATAR_SELECTED: "avatar_selected",
  TEMPLATE_USED: "template_used",
} as const;

export type ProductEvent = (typeof EVENTS)[keyof typeof EVENTS];

export function trackEvent(event: ProductEvent | string, props?: Record<string, unknown>): void {
  track(event, props);
}
