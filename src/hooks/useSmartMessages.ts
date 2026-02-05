 /**
  * useSmartMessages Hook
  * 
  * Provides easy access to smart contextual messages throughout the app.
  * Handles message deduplication, navigation integration, and context-aware display.
  */
 
 import { useCallback, useEffect, useRef } from 'react';
 import { useNavigate } from 'react-router-dom';
 import { useAuth } from '@/contexts/AuthContext';
 import { useStudio } from '@/contexts/StudioContext';
 import {
   SmartMessage,
   CREDIT_MESSAGES,
   PROJECT_MESSAGES,
   AUTH_MESSAGES,
   ONBOARDING_MESSAGES,
   TIPS_MESSAGES,
   SYSTEM_MESSAGES,
   ACHIEVEMENT_MESSAGES,
   showSmartMessage,
   showOnce,
   getCreditWarningLevel,
   getCreditMessage,
   hasBeenShown,
 } from '@/lib/smartMessages';
 
 interface UseSmartMessagesOptions {
   /** Check credit levels and show warnings */
   monitorCredits?: boolean;
   /** Show onboarding tips for new users */
   showOnboardingTips?: boolean;
   /** Show system/browser compatibility warnings */
   checkSystemCompat?: boolean;
 }
 
 export function useSmartMessages(options: UseSmartMessagesOptions = {}) {
   const navigate = useNavigate();
   const { user, profile } = useAuth();
   const studioContext = useStudio();
   const hasCheckedOnboarding = useRef(false);
   const hasCheckedCredits = useRef(false);
   const hasCheckedSystem = useRef(false);
   
   // Helper to show a message with navigation
   const show = useCallback((message: SmartMessage) => {
     showSmartMessage(message, navigate);
   }, [navigate]);
   
   // Helper to show a message only once per session
   const showOneTime = useCallback((message: SmartMessage) => {
     return showOnce(message, navigate);
   }, [navigate]);
   
   // Credit-related messages
   const showCreditWarning = useCallback((credits: number, estimatedCost?: number) => {
     const message = getCreditMessage(credits, estimatedCost);
     if (message) {
       showOneTime(message);
       return true;
     }
     return false;
   }, [showOneTime]);
   
   const showPurchaseSuccess = useCallback((amount: number) => {
     show(CREDIT_MESSAGES.PURCHASE_SUCCESS(amount));
   }, [show]);
   
   const showCreditsRefunded = useCallback((amount: number, reason = 'Generation failed.') => {
     show(CREDIT_MESSAGES.CREDITS_REFUNDED(amount, reason));
   }, [show]);
   
   const showWelcomeBonus = useCallback((credits: number) => {
     showOneTime(CREDIT_MESSAGES.WELCOME_BONUS(credits));
   }, [showOneTime]);
   
   // Project-related messages
   const showGenerationStarted = useCallback((title: string) => {
     show(PROJECT_MESSAGES.GENERATION_STARTED(title));
   }, [show]);
   
   const showGenerationComplete = useCallback((title: string, clipCount: number) => {
     show(PROJECT_MESSAGES.GENERATION_COMPLETE(title, clipCount));
   }, [show]);
   
   const showGenerationFailed = useCallback((title: string) => {
     show(PROJECT_MESSAGES.GENERATION_FAILED(title));
   }, [show]);
   
   const showActiveProjectExists = useCallback((title: string, projectId: string) => {
     show(PROJECT_MESSAGES.ACTIVE_PROJECT_EXISTS(title, projectId));
   }, [show]);
   
   const showClipCompleted = useCallback((current: number, total: number) => {
     show(PROJECT_MESSAGES.CLIP_COMPLETED(current, total));
   }, [show]);
   
   const showStitchingStarted = useCallback(() => {
     show(PROJECT_MESSAGES.STITCHING_STARTED());
   }, [show]);
   
   const showStitchComplete = useCallback(() => {
     show(PROJECT_MESSAGES.STITCH_COMPLETE());
   }, [show]);
   
   // Auth messages
   const showSessionExpired = useCallback(() => {
     show(AUTH_MESSAGES.SESSION_EXPIRED());
   }, [show]);
   
   const showEmailVerificationSent = useCallback((email: string) => {
     show(AUTH_MESSAGES.EMAIL_VERIFICATION_SENT(email));
   }, [show]);
   
   const showProfileUpdated = useCallback(() => {
     show(AUTH_MESSAGES.PROFILE_UPDATED());
   }, [show]);
   
   const showTierUpgraded = useCallback((tierName: string) => {
     show(AUTH_MESSAGES.TIER_UPGRADED(tierName));
   }, [show]);
   
   // Tips messages
   const showFirstProjectTip = useCallback(() => {
     showOneTime(ONBOARDING_MESSAGES.FIRST_PROJECT_TIP());
   }, [showOneTime]);
   
   const showAvatarFeatureIntro = useCallback(() => {
     showOneTime(ONBOARDING_MESSAGES.AVATAR_FEATURE_INTRO());
   }, [showOneTime]);
   
   const showTemplatesAvailable = useCallback(() => {
     showOneTime(ONBOARDING_MESSAGES.TEMPLATES_AVAILABLE());
   }, [showOneTime]);
   
   const showFirstVideoComplete = useCallback(() => {
     showOneTime(ONBOARDING_MESSAGES.FIRST_VIDEO_COMPLETE());
   }, [showOneTime]);
   
   const showHighClipCountWarning = useCallback((clipCount: number) => {
     if (clipCount >= 8) {
       showOneTime(TIPS_MESSAGES.HIGH_CLIP_COUNT_WARNING(clipCount));
     }
   }, [showOneTime]);
   
   const showRegenerationTip = useCallback(() => {
     showOneTime(TIPS_MESSAGES.REGENERATION_TIP());
   }, [showOneTime]);
   
   const showReferenceImageTip = useCallback(() => {
     showOneTime(TIPS_MESSAGES.REFERENCE_IMAGE_TIP());
   }, [showOneTime]);
   
   const showAvatarScriptTip = useCallback(() => {
     showOneTime(TIPS_MESSAGES.AVATAR_SCRIPT_TIP());
   }, [showOneTime]);
   
   // System messages
   const showConnectionLost = useCallback(() => {
     show(SYSTEM_MESSAGES.CONNECTION_LOST());
   }, [show]);
   
   const showConnectionRestored = useCallback(() => {
     show(SYSTEM_MESSAGES.CONNECTION_RESTORED());
   }, [show]);
   
   const showSafariCompatibility = useCallback(() => {
     showOneTime(SYSTEM_MESSAGES.SAFARI_COMPATIBILITY());
   }, [showOneTime]);
   
   const showServiceDegraded = useCallback(() => {
     showOneTime(SYSTEM_MESSAGES.SERVICE_DEGRADED());
   }, [showOneTime]);
   
   const showNewVersionAvailable = useCallback(() => {
     showOneTime(SYSTEM_MESSAGES.NEW_VERSION_AVAILABLE());
   }, [showOneTime]);
   
   // Achievement messages
   const showMilestoneVideos = useCallback((count: number) => {
     showOneTime(ACHIEVEMENT_MESSAGES.MILESTONE_VIDEOS(count));
   }, [showOneTime]);
   
   const showStreakMaintained = useCallback((days: number) => {
     showOneTime(ACHIEVEMENT_MESSAGES.STREAK_MAINTAINED(days));
   }, [showOneTime]);
   
   // ============= Automatic Checks =============
   
   // Monitor credit levels
   useEffect(() => {
     if (!options.monitorCredits || hasCheckedCredits.current) return;
     if (!studioContext?.credits) return;
     
     hasCheckedCredits.current = true;
     const credits = studioContext.credits.remaining;
     
     // Only show critical warnings proactively
     const level = getCreditWarningLevel(credits);
     if (level === 'empty' || level === 'critical') {
       showCreditWarning(credits);
     }
   }, [options.monitorCredits, studioContext?.credits, showCreditWarning]);
   
   // Show onboarding tips for new users
   useEffect(() => {
     if (!options.showOnboardingTips || hasCheckedOnboarding.current) return;
     if (!profile) return;
     
     hasCheckedOnboarding.current = true;
     
     // Check if user is relatively new (created in last 7 days)
     const createdAt = new Date(profile.created_at);
     const daysSinceCreation = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
     
     if (daysSinceCreation <= 7 && !hasBeenShown('first_project_tip')) {
       // Delay to not overwhelm on first load
       setTimeout(() => {
         showFirstProjectTip();
       }, 3000);
     }
   }, [options.showOnboardingTips, profile, showFirstProjectTip]);
   
   // Check system compatibility
   useEffect(() => {
     if (!options.checkSystemCompat || hasCheckedSystem.current) return;
     
     hasCheckedSystem.current = true;
     
     // Safari detection
     const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
     if (isSafari) {
       // Delay to not overwhelm
       setTimeout(() => {
         showSafariCompatibility();
       }, 5000);
     }
   }, [options.checkSystemCompat, showSafariCompatibility]);
   
   return {
     // Generic
     show,
     showOneTime,
     
     // Credits
     showCreditWarning,
     showPurchaseSuccess,
     showCreditsRefunded,
     showWelcomeBonus,
     
     // Projects
     showGenerationStarted,
     showGenerationComplete,
     showGenerationFailed,
     showActiveProjectExists,
     showClipCompleted,
     showStitchingStarted,
     showStitchComplete,
     
     // Auth
     showSessionExpired,
     showEmailVerificationSent,
     showProfileUpdated,
     showTierUpgraded,
     
     // Tips
     showFirstProjectTip,
     showAvatarFeatureIntro,
     showTemplatesAvailable,
     showFirstVideoComplete,
     showHighClipCountWarning,
     showRegenerationTip,
     showReferenceImageTip,
     showAvatarScriptTip,
     
     // System
     showConnectionLost,
     showConnectionRestored,
     showSafariCompatibility,
     showServiceDegraded,
     showNewVersionAvailable,
     
     // Achievements
     showMilestoneVideos,
     showStreakMaintained,
     
     // Utilities
     getCreditWarningLevel: (credits: number, estimated?: number) => 
       getCreditWarningLevel(credits, estimated),
   };
 }