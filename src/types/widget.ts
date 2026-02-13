// Genesis Scenes - Widget Types

export interface WidgetScene {
  id: string;
  name: string;
  type: 'idle' | 'engage' | 'cta' | 'exit_save' | 'pricing_hover' | 'hero' | 'testimonial';
  src_mp4: string;
  poster_url?: string;
  loop: boolean;
  priority: number;
  subtitle_text?: string;
  duration_seconds?: number;
}

export interface WidgetTriggers {
  idle_seconds?: number;
  scroll_percent?: number;
  exit_intent?: boolean;
  pricing_hover_selector?: string;
}

export interface WidgetRule {
  event: 'PAGE_VIEW' | 'IDLE' | 'SCROLL_DEPTH' | 'EXIT_INTENT' | 'CTA_HOVER' | 'PRICING_HOVER';
  action: 'play_scene' | 'show_cta' | 'minimize';
  scene_id?: string;
}

export type WidgetPosition = 'bottom-right' | 'bottom-left' | 'center' | 'top-right' | 'top-left';
export type WidgetSensitivity = 'low' | 'medium' | 'high';
export type WidgetTone = 'friendly' | 'bold' | 'funny' | 'professional' | 'urgent';
export type WidgetStatus = 'draft' | 'published' | 'paused' | 'archived';
export type WidgetType = 'embed' | 'landing_page' | 'both';

export interface WidgetConfig {
  id: string;
  user_id: string;
  name: string;
  slug: string | null;
  widget_type: WidgetType;
  status: WidgetStatus;
  
  // Branding
  primary_color: string;
  logo_url: string | null;
  background_color: string;
  font_family: string;
  
  // Position
  position: WidgetPosition;
  z_index: number;
  widget_width: number;
  widget_height: number;
  
  // CTA
  cta_text: string;
  cta_url: string | null;
  cta_color: string;
  secondary_cta_text: string | null;
  secondary_cta_url: string | null;
  
  // Copy
  headline: string | null;
  subheadline: string | null;
  
  // Config
  scenes: WidgetScene[];
  triggers: WidgetTriggers;
  rules: WidgetRule[];
  sensitivity: WidgetSensitivity;
  allowed_domains: string[];
  tone: WidgetTone;
  public_key: string;
  
  // Analytics
  total_views: number;
  total_cta_clicks: number;
  total_scene_plays: number;
  
  // Credit tracking
  credits_charged: number;
  
  // Links
  source_project_id: string | null;
  
  // Timestamps
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

// Behavior engine state machine
export type EngineState = 'BOOTING' | 'IDLE_LOOP' | 'ENGAGING' | 'CTA_PUSH' | 'DISMISSED' | 'MINIMIZED';

export interface BehaviorEvent {
  type: 'PAGE_VIEW' | 'IDLE' | 'SCROLL_DEPTH' | 'EXIT_INTENT' | 'CTA_HOVER' | 'CTA_CLICK' | 'DISMISS' | 'MINIMIZE' | 'REOPEN';
  timestamp: number;
  data?: Record<string, unknown>;
}
