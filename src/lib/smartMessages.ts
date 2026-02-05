 /**
  * Smart Messages System
  * 
  * Centralized registry of all contextual user notifications.
  * These messages are designed to be helpful, reassuring, and actionable.
  * 
  * Categories:
  * 1. Credits & Billing - Purchase, low balance, refunds
  * 2. Project Status - Generation states, completion, errors
  * 3. Account & Auth - Session, verification, tier
  * 4. Onboarding - First-time user guidance
  * 5. Quality & Tips - Best practices, warnings
  * 6. System - Connectivity, browser compatibility
  */
 
 import { toast } from 'sonner';
 
 // ============= Message Types =============
 
 export type MessageCategory = 
   | 'credits'
   | 'project'
   | 'auth'
   | 'onboarding'
   | 'tips'
   | 'system'
   | 'achievement';
 
 export type MessageSeverity = 'info' | 'success' | 'warning' | 'error' | 'epic';
 
 export interface SmartMessage {
   id: string;
   category: MessageCategory;
   severity: MessageSeverity;
   title: string;
   message: string;
   action?: {
     label: string;
     path?: string;
     onClick?: () => void;
   };
   duration?: number;
   /** Conditions under which this message should display */
   conditions?: {
     minCredits?: number;
     maxCredits?: number;
     isFirstProject?: boolean;
     tierName?: string;
     projectStatus?: string[];
   };
 }
 
 // ============= Message Registry =============
 
 /**
  * CREDITS & BILLING MESSAGES
  * - Welcome bonus notification
  * - Low credits warnings (multiple thresholds)
  * - Credit purchase success
  * - Insufficient credits for action
  * - Auto-recharge triggered
  * - Credits refunded
  */
 export const CREDIT_MESSAGES = {
   // Welcome & Bonuses
   WELCOME_BONUS: (credits: number): SmartMessage => ({
     id: 'welcome_bonus',
     category: 'credits',
     severity: 'epic',
     title: '🎉 Welcome to Genesis!',
     message: `You've received ${credits} free credits to start creating. That's enough for about ${Math.floor(credits / 10)} video clips!`,
     action: { label: 'Start Creating', path: '/create' },
     duration: 10000,
   }),
   
   // Low Credit Warnings (tiered thresholds)
   LOW_CREDITS_CRITICAL: (remaining: number): SmartMessage => ({
     id: 'low_credits_critical',
     category: 'credits',
     severity: 'warning',
     title: '⚠️ Credits Running Low',
     message: `Only ${remaining} credits left. You may not be able to complete your next video.`,
     action: { label: 'Get Credits', path: '/settings?tab=billing' },
     duration: 8000,
   }),
   
   LOW_CREDITS_WARNING: (remaining: number): SmartMessage => ({
     id: 'low_credits_warning',
     category: 'credits',
     severity: 'info',
     title: '💳 Credits Getting Low',
     message: `${remaining} credits remaining. Consider topping up to avoid interruptions.`,
     action: { label: 'View Plans', path: '/settings?tab=billing' },
     duration: 6000,
   }),
   
   OUT_OF_CREDITS: (): SmartMessage => ({
     id: 'out_of_credits',
     category: 'credits',
     severity: 'error',
     title: '🚫 No Credits Remaining',
     message: "You've used all your credits. Purchase more to continue creating amazing videos.",
     action: { label: 'Buy Credits', path: '/settings?tab=billing' },
     duration: 10000,
   }),
   
   // Purchase & Refunds
   PURCHASE_SUCCESS: (amount: number): SmartMessage => ({
     id: 'purchase_success',
     category: 'credits',
     severity: 'success',
     title: '✅ Credits Added!',
     message: `${amount} credits have been added to your account. Happy creating!`,
     duration: 5000,
   }),
   
   CREDITS_REFUNDED: (amount: number, reason: string): SmartMessage => ({
     id: 'credits_refunded',
     category: 'credits',
     severity: 'info',
     title: '💰 Credits Refunded',
     message: `${amount} credits returned to your account. ${reason}`,
     duration: 6000,
   }),
   
   AUTO_RECHARGE_TRIGGERED: (amount: number): SmartMessage => ({
     id: 'auto_recharge_triggered',
     category: 'credits',
     severity: 'info',
     title: '🔄 Auto-Recharge Activated',
     message: `We've added ${amount} credits to keep your workflow uninterrupted.`,
     duration: 5000,
   }),
   
   INSUFFICIENT_FOR_ACTION: (required: number, available: number): SmartMessage => ({
     id: 'insufficient_for_action',
     category: 'credits',
     severity: 'warning',
     title: '💳 Need More Credits',
     message: `This action requires ~${required} credits. You have ${available}.`,
     action: { label: 'Buy Credits', path: '/settings?tab=billing' },
     duration: 8000,
   }),
 };
 
 /**
  * PROJECT STATUS MESSAGES
  * - Generation started
  * - Stage transitions
  * - Completion notifications
  * - Error states
  * - Active project reminders
  */
 export const PROJECT_MESSAGES = {
   // Generation States
   GENERATION_STARTED: (title: string): SmartMessage => ({
     id: 'generation_started',
     category: 'project',
     severity: 'success',
     title: '🚀 Generation Started',
     message: `"${title}" is now being created. This typically takes 2-4 minutes per clip.`,
     duration: 5000,
   }),
   
   GENERATION_COMPLETE: (title: string, clipCount: number): SmartMessage => ({
     id: 'generation_complete',
     category: 'project',
     severity: 'epic',
     title: '🎬 Video Complete!',
     message: `"${title}" is ready! ${clipCount} clips generated successfully.`,
     action: { label: 'View Video', path: '/projects' },
     duration: 10000,
   }),
   
   GENERATION_FAILED: (title: string): SmartMessage => ({
     id: 'generation_failed',
     category: 'project',
     severity: 'error',
     title: '❌ Generation Failed',
     message: `"${title}" couldn't be completed. Your credits have been refunded automatically.`,
     action: { label: 'Try Again', path: '/create' },
     duration: 10000,
   }),
   
   // Active Project Reminders
   ACTIVE_PROJECT_EXISTS: (title: string, projectId: string): SmartMessage => ({
     id: 'active_project_exists',
     category: 'project',
     severity: 'info',
     title: '🎬 Project In Progress',
     message: `"${title}" is still generating. You can only have one video at a time.`,
     action: { label: 'View Progress', path: `/production/${projectId}` },
     duration: 10000,
   }),
   
   // Stage Notifications
   STAGE_SCRIPT_READY: (): SmartMessage => ({
     id: 'stage_script_ready',
     category: 'project',
     severity: 'info',
     title: '📝 Script Ready',
     message: 'Your script has been generated. Review it before we proceed.',
     duration: 5000,
   }),
   
   STAGE_ASSETS_COMPLETE: (): SmartMessage => ({
     id: 'stage_assets_complete',
     category: 'project',
     severity: 'info',
     title: '🎨 Assets Ready',
     message: 'Visual assets are ready. Starting video generation...',
     duration: 4000,
   }),
   
   STAGE_AUDIO_COMPLETE: (): SmartMessage => ({
     id: 'stage_audio_complete',
     category: 'project',
     severity: 'info',
     title: '🎙️ Audio Ready',
     message: 'Voiceover has been generated. Now creating video clips...',
     duration: 4000,
   }),
   
   // Clip Progress
   CLIP_COMPLETED: (current: number, total: number): SmartMessage => ({
     id: 'clip_completed',
     category: 'project',
     severity: 'success',
     title: `✅ Clip ${current}/${total} Ready`,
     message: `Progress: ${Math.round((current / total) * 100)}% complete`,
     duration: 3000,
   }),
   
   // Stitch/Assembly
   STITCHING_STARTED: (): SmartMessage => ({
     id: 'stitching_started',
     category: 'project',
     severity: 'info',
     title: '🎞️ Assembling Video',
     message: 'All clips ready! Now stitching your final video together...',
     duration: 5000,
   }),
   
   STITCH_COMPLETE: (): SmartMessage => ({
     id: 'stitch_complete',
     category: 'project',
     severity: 'epic',
     title: '🎉 Video Assembled!',
     message: 'Your complete video is ready to watch and download.',
     duration: 8000,
   }),
 };
 
 /**
  * AUTHENTICATION & ACCOUNT MESSAGES
  * - Session states
  * - Email verification
  * - Profile updates
  * - Tier changes
  */
 export const AUTH_MESSAGES = {
   SESSION_EXPIRED: (): SmartMessage => ({
     id: 'session_expired',
     category: 'auth',
     severity: 'warning',
     title: '🔐 Session Expired',
     message: 'For your security, please sign in again.',
     action: { label: 'Sign In', path: '/auth' },
     duration: 5000,
   }),
   
   SESSION_EXPIRING_SOON: (): SmartMessage => ({
     id: 'session_expiring',
     category: 'auth',
     severity: 'info',
     title: '⏰ Session Expiring',
     message: 'Your session will expire soon. Save your work!',
     duration: 8000,
   }),
   
   EMAIL_VERIFICATION_SENT: (email: string): SmartMessage => ({
     id: 'email_verification_sent',
     category: 'auth',
     severity: 'info',
     title: '📧 Check Your Email',
     message: `Verification link sent to ${email}. Check your spam folder too!`,
     duration: 8000,
   }),
   
   EMAIL_VERIFIED: (): SmartMessage => ({
     id: 'email_verified',
     category: 'auth',
     severity: 'success',
     title: '✅ Email Verified',
     message: 'Your email has been verified. Welcome aboard!',
     duration: 5000,
   }),
   
   PROFILE_UPDATED: (): SmartMessage => ({
     id: 'profile_updated',
     category: 'auth',
     severity: 'success',
     title: '✅ Profile Updated',
     message: 'Your changes have been saved.',
     duration: 3000,
   }),
   
   TIER_UPGRADED: (tierName: string): SmartMessage => ({
     id: 'tier_upgraded',
     category: 'auth',
     severity: 'epic',
     title: '🎉 Account Upgraded!',
     message: `Welcome to ${tierName}! Enjoy your new features and limits.`,
     duration: 8000,
   }),
   
   ACCOUNT_DEACTIVATED: (): SmartMessage => ({
     id: 'account_deactivated',
     category: 'auth',
     severity: 'warning',
     title: '👋 Account Deactivated',
     message: 'Your account has been deactivated. Log in anytime to reactivate.',
     duration: 8000,
   }),
 };
 
 /**
  * ONBOARDING & FIRST-TIME USER MESSAGES
  * - Welcome guidance
  * - Feature discovery
  * - First project tips
  */
 export const ONBOARDING_MESSAGES = {
   FIRST_PROJECT_TIP: (): SmartMessage => ({
     id: 'first_project_tip',
     category: 'onboarding',
     severity: 'info',
     title: '💡 Pro Tip',
     message: 'Start with a short, focused prompt. AI works best with clear, specific ideas!',
     duration: 8000,
   }),
   
   AVATAR_FEATURE_INTRO: (): SmartMessage => ({
     id: 'avatar_feature_intro',
     category: 'onboarding',
     severity: 'info',
     title: '🎭 Meet Avatars',
     message: 'Create videos with AI-powered spokespersons! Perfect for explainers and presentations.',
     action: { label: 'Explore', path: '/avatars' },
     duration: 10000,
   }),
   
   TEMPLATES_AVAILABLE: (): SmartMessage => ({
     id: 'templates_available',
     category: 'onboarding',
     severity: 'info',
     title: '📋 Templates Available',
     message: 'Skip the blank page! Start with a proven template and customize it.',
     action: { label: 'Browse Templates', path: '/templates' },
     duration: 8000,
   }),
   
   FIRST_VIDEO_COMPLETE: (): SmartMessage => ({
     id: 'first_video_complete',
     category: 'onboarding',
     severity: 'epic',
     title: '🎉 First Video Created!',
     message: "Congratulations! You've created your first AI video. The possibilities are endless!",
     duration: 10000,
   }),
 };
 
 /**
  * QUALITY & TIPS MESSAGES
  * - Best practice suggestions
  * - Improvement tips
  * - Warning about potential issues
  */
 export const TIPS_MESSAGES = {
   PROMPT_TOO_SHORT: (): SmartMessage => ({
     id: 'prompt_too_short',
     category: 'tips',
     severity: 'info',
     title: '📝 Tip: Add More Detail',
     message: 'Longer, more descriptive prompts often produce better results.',
     duration: 5000,
   }),
   
   PROMPT_TOO_LONG: (): SmartMessage => ({
     id: 'prompt_too_long',
     category: 'tips',
     severity: 'warning',
     title: '📝 Prompt Too Long',
     message: 'Consider breaking this into a shorter, focused prompt for best results.',
     duration: 5000,
   }),
   
   HIGH_CLIP_COUNT_WARNING: (clipCount: number): SmartMessage => ({
     id: 'high_clip_count_warning',
     category: 'tips',
     severity: 'info',
     title: '⏱️ Longer Wait Time',
     message: `${clipCount} clips will take ${Math.ceil(clipCount * 3)}-${Math.ceil(clipCount * 4)} minutes. Grab a coffee!`,
     duration: 6000,
   }),
   
   REGENERATION_TIP: (): SmartMessage => ({
     id: 'regeneration_tip',
     category: 'tips',
     severity: 'info',
     title: '🔄 Tip: Regenerations',
     message: 'AI results vary. Budget 2-4x credits for getting the perfect result.',
     duration: 6000,
   }),
   
   REFERENCE_IMAGE_TIP: (): SmartMessage => ({
     id: 'reference_image_tip',
     category: 'tips',
     severity: 'info',
     title: '🖼️ Tip: Reference Images',
     message: 'Add a reference image for more consistent visual style across clips.',
     action: { label: 'Learn More', path: '/help/reference-images' },
     duration: 8000,
   }),
   
   AVATAR_SCRIPT_TIP: (): SmartMessage => ({
     id: 'avatar_script_tip',
     category: 'tips',
     severity: 'info',
     title: '💡 Avatar Tip',
     message: 'Keep sentences short for natural lip-sync. Punctuation affects pacing!',
     duration: 6000,
   }),
 };
 
 /**
  * SYSTEM MESSAGES
  * - Connectivity issues
  * - Browser compatibility
  * - Service status
  */
 export const SYSTEM_MESSAGES = {
   CONNECTION_LOST: (): SmartMessage => ({
     id: 'connection_lost',
     category: 'system',
     severity: 'warning',
     title: '📶 Connection Lost',
     message: 'Check your internet connection. Your work is saved automatically.',
     duration: 0, // Persistent until resolved
   }),
   
   CONNECTION_RESTORED: (): SmartMessage => ({
     id: 'connection_restored',
     category: 'system',
     severity: 'success',
     title: '📶 Connection Restored',
     message: "You're back online!",
     duration: 3000,
   }),
   
   SAFARI_COMPATIBILITY: (): SmartMessage => ({
     id: 'safari_compatibility',
     category: 'system',
     severity: 'info',
     title: '🌐 Safari Detected',
     message: 'For best experience, we recommend Chrome or Firefox for video editing.',
     duration: 8000,
   }),
   
   SERVICE_DEGRADED: (): SmartMessage => ({
     id: 'service_degraded',
     category: 'system',
     severity: 'warning',
     title: '⚠️ Slower Than Usual',
     message: 'Our video engine is experiencing high demand. Generation may take longer.',
     duration: 8000,
   }),
   
   MAINTENANCE_SCHEDULED: (time: string): SmartMessage => ({
     id: 'maintenance_scheduled',
     category: 'system',
     severity: 'info',
     title: '🔧 Scheduled Maintenance',
     message: `Brief maintenance at ${time}. Save your work beforehand!`,
     duration: 10000,
   }),
   
   NEW_VERSION_AVAILABLE: (): SmartMessage => ({
     id: 'new_version_available',
     category: 'system',
     severity: 'info',
     title: '🆕 Update Available',
     message: 'A new version is ready. Refresh to get the latest features!',
     action: { 
       label: 'Refresh',
       onClick: () => window.location.reload(),
     },
     duration: 0, // Persistent
   }),
 };
 
 /**
  * ACHIEVEMENT MESSAGES
  * - Milestones
  * - Unlocks
  */
 export const ACHIEVEMENT_MESSAGES = {
   MILESTONE_VIDEOS: (count: number): SmartMessage => ({
     id: 'milestone_videos',
     category: 'achievement',
     severity: 'epic',
     title: '🏆 Milestone Reached!',
     message: `You've created ${count} videos! You're on fire!`,
     duration: 8000,
   }),
   
   STREAK_MAINTAINED: (days: number): SmartMessage => ({
     id: 'streak_maintained',
     category: 'achievement',
     severity: 'success',
     title: `🔥 ${days}-Day Streak!`,
     message: 'Keep creating every day to maintain your streak!',
     duration: 5000,
   }),
 };
 
 // ============= Display Utilities =============
 
 /**
  * Show a smart message as a toast
  */
 export function showSmartMessage(
   message: SmartMessage,
   navigate?: (path: string) => void
 ): void {
   const action = message.action
     ? {
         label: message.action.label,
         onClick: () => {
           if (message.action?.onClick) {
             message.action.onClick();
           } else if (message.action?.path && navigate) {
             navigate(message.action.path);
           }
         },
       }
     : undefined;
 
   const toastOptions = {
     duration: message.duration ?? 5000,
     action,
   };
 
   switch (message.severity) {
     case 'success':
       toast.success(message.message, toastOptions);
       break;
     case 'warning':
       toast.warning(message.message, toastOptions);
       break;
     case 'error':
       toast.error(message.message, toastOptions);
       break;
     case 'epic':
       // Use custom epic toast for special moments
       toast(message.message, {
         ...toastOptions,
         className: 'epic-toast',
         icon: '✨',
       });
       break;
     case 'info':
     default:
       toast.info(message.message, toastOptions);
       break;
   }
 }
 
 /**
  * Get credit warning level based on balance
  */
 export function getCreditWarningLevel(
   credits: number,
   estimatedCost?: number
 ): 'none' | 'low' | 'critical' | 'empty' {
   if (credits === 0) return 'empty';
   if (estimatedCost && credits < estimatedCost) return 'critical';
   if (credits <= 5) return 'critical';
   if (credits <= 20) return 'low';
   return 'none';
 }
 
 /**
  * Get appropriate credit message based on balance
  */
 export function getCreditMessage(
   credits: number,
   estimatedCost?: number
 ): SmartMessage | null {
   const level = getCreditWarningLevel(credits, estimatedCost);
   
   switch (level) {
     case 'empty':
       return CREDIT_MESSAGES.OUT_OF_CREDITS();
     case 'critical':
       if (estimatedCost && credits < estimatedCost) {
         return CREDIT_MESSAGES.INSUFFICIENT_FOR_ACTION(estimatedCost, credits);
       }
       return CREDIT_MESSAGES.LOW_CREDITS_CRITICAL(credits);
     case 'low':
       return CREDIT_MESSAGES.LOW_CREDITS_WARNING(credits);
     default:
       return null;
   }
 }
 
 // ============= Message Tracking =============
 
 // Track which messages have been shown to avoid spam
 const shownMessages = new Set<string>();
 
 /**
  * Show a message only once per session
  */
 export function showOnce(
   message: SmartMessage,
   navigate?: (path: string) => void
 ): boolean {
   if (shownMessages.has(message.id)) {
     return false;
   }
   shownMessages.add(message.id);
   showSmartMessage(message, navigate);
   return true;
 }
 
 /**
  * Reset shown messages (e.g., on logout)
  */
 export function resetShownMessages(): void {
   shownMessages.clear();
 }
 
 /**
  * Check if a message has been shown
  */
 export function hasBeenShown(messageId: string): boolean {
   return shownMessages.has(messageId);
 }