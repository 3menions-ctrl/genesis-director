 # Smart Messages System
 
 A centralized registry of all contextual user notifications designed to be helpful, reassuring, and actionable.
 
 ## Overview
 
 The Smart Messages system provides:
 - **Consistent UX**: All user-facing messages follow the same patterns
 - **Actionable notifications**: Every message includes a clear next step
 - **Context-aware display**: Messages show based on user state
 - **Deduplication**: Prevents message spam with `showOnce()`
 
 ## Message Categories
 
 ### 1. Credits & Billing (`CREDIT_MESSAGES`)
 
 | Message ID | When to Show | Severity |
 |------------|--------------|----------|
 | `WELCOME_BONUS` | New user receives initial credits | epic |
 | `LOW_CREDITS_CRITICAL` | Credits ≤ 5 | warning |
 | `LOW_CREDITS_WARNING` | Credits ≤ 20 | info |
 | `OUT_OF_CREDITS` | Credits = 0 | error |
 | `PURCHASE_SUCCESS` | After successful purchase | success |
 | `CREDITS_REFUNDED` | When credits are returned | info |
 | `AUTO_RECHARGE_TRIGGERED` | Auto-recharge activated | info |
 | `INSUFFICIENT_FOR_ACTION` | Action requires more credits than available | warning |
 
 ### 2. Project Status (`PROJECT_MESSAGES`)
 
 | Message ID | When to Show | Severity |
 |------------|--------------|----------|
 | `GENERATION_STARTED` | Video generation begins | success |
 | `GENERATION_COMPLETE` | Video ready | epic |
 | `GENERATION_FAILED` | Generation error (credits refunded) | error |
 | `ACTIVE_PROJECT_EXISTS` | User tries to create new while one is active | info |
 | `STAGE_SCRIPT_READY` | Script stage complete | info |
 | `STAGE_ASSETS_COMPLETE` | Assets ready | info |
 | `STAGE_AUDIO_COMPLETE` | Audio generated | info |
 | `CLIP_COMPLETED` | Individual clip ready | success |
 | `STITCHING_STARTED` | Final assembly starting | info |
 | `STITCH_COMPLETE` | Full video assembled | epic |
 
 ### 3. Authentication & Account (`AUTH_MESSAGES`)
 
 | Message ID | When to Show | Severity |
 |------------|--------------|----------|
 | `SESSION_EXPIRED` | Auth token expired | warning |
 | `SESSION_EXPIRING_SOON` | Token expiring in <15 min | info |
 | `EMAIL_VERIFICATION_SENT` | Verification email dispatched | info |
 | `EMAIL_VERIFIED` | Email confirmed | success |
 | `PROFILE_UPDATED` | Profile saved | success |
 | `TIER_UPGRADED` | Account tier changed | epic |
 | `ACCOUNT_DEACTIVATED` | Account deactivated | warning |
 
 ### 4. Onboarding & Tips (`ONBOARDING_MESSAGES`, `TIPS_MESSAGES`)
 
 | Message ID | When to Show | Severity |
 |------------|--------------|----------|
 | `FIRST_PROJECT_TIP` | User's first creation | info |
 | `AVATAR_FEATURE_INTRO` | New user on avatars page | info |
 | `TEMPLATES_AVAILABLE` | User on create page | info |
 | `FIRST_VIDEO_COMPLETE` | First video finished | epic |
 | `PROMPT_TOO_SHORT` | Prompt < 20 chars | info |
 | `PROMPT_TOO_LONG` | Prompt > 500 chars | warning |
 | `HIGH_CLIP_COUNT_WARNING` | ≥ 8 clips selected | info |
 | `REGENERATION_TIP` | After first generation | info |
 | `REFERENCE_IMAGE_TIP` | No reference image used | info |
 | `AVATAR_SCRIPT_TIP` | Avatar mode selected | info |
 
 ### 5. System (`SYSTEM_MESSAGES`)
 
 | Message ID | When to Show | Severity |
 |------------|--------------|----------|
 | `CONNECTION_LOST` | Network offline | warning |
 | `CONNECTION_RESTORED` | Network restored | success |
 | `SAFARI_COMPATIBILITY` | Safari browser detected | info |
 | `SERVICE_DEGRADED` | High API latency | warning |
 | `MAINTENANCE_SCHEDULED` | Upcoming maintenance | info |
 | `NEW_VERSION_AVAILABLE` | App update ready | info |
 
 ### 6. Achievements (`ACHIEVEMENT_MESSAGES`)
 
 | Message ID | When to Show | Severity |
 |------------|--------------|----------|
 | `MILESTONE_VIDEOS` | 5, 10, 25, 50, 100 videos | epic |
 | `STREAK_MAINTAINED` | Daily creation streak | success |
 
 ## Usage
 
 ### Basic Usage
 
 ```typescript
 import { useSmartMessages } from '@/hooks/useSmartMessages';
 
 function MyComponent() {
   const { showGenerationComplete, showCreditWarning } = useSmartMessages();
   
   // Show a message
   showGenerationComplete('My Video Title', 6);
   
   // Check and show credit warning if needed
   showCreditWarning(15, 20); // 15 credits, needs 20
 }
 ```
 
 ### With Automatic Monitoring
 
 ```typescript
 const messages = useSmartMessages({
   monitorCredits: true,      // Auto-warn on low credits
   showOnboardingTips: true,  // Show tips for new users
   checkSystemCompat: true,   // Safari warnings, etc.
 });
 ```
 
 ### Direct Access
 
 ```typescript
 import { 
   CREDIT_MESSAGES, 
   showSmartMessage, 
   showOnce,
   getCreditWarningLevel 
 } from '@/lib/smartMessages';
 
 // Show once per session
 showOnce(CREDIT_MESSAGES.WELCOME_BONUS(60), navigate);
 
 // Check credit level
 const level = getCreditWarningLevel(credits, estimatedCost);
 // Returns: 'none' | 'low' | 'critical' | 'empty'
 ```
 
 ## Credit Warning Thresholds
 
 | Level | Condition | Visual |
 |-------|-----------|--------|
 | `none` | credits > 20 | No indicator |
 | `low` | 6 ≤ credits ≤ 20 | Amber warning |
 | `critical` | credits ≤ 5 OR credits < estimatedCost | Red warning |
 | `empty` | credits = 0 | Red + disabled actions |
 
 ## Integration Points
 
 The smart messages system is integrated with:
 
 1. **StickyGenerateBar** - Credit warnings and high clip count tips
 2. **LowCreditsWarningBanner** - Persistent credit warnings
 3. **userFriendlyErrors.ts** - API error mapping
 4. **Production pages** - Stage transition messages
 
 ## Best Practices
 
 1. **Use `showOnce()` for tips** - Prevents spam on repeat visits
 2. **Include actions** - Every warning should have a clear next step
 3. **Match severity to urgency** - `error` for blocking issues only
 4. **Be reassuring** - "Your credits are refunded" not "Generation failed"
 5. **Keep messages short** - Under 100 characters when possible