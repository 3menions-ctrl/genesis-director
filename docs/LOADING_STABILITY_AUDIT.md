 # Loading System Stability Audit
 
 **Date:** 2026-02-05
 **Issue:** App crashing on Safari due to concurrent loading overlays
 
 ## Root Cause Analysis
 
 The app was rendering **up to 4 concurrent CinemaLoader instances** simultaneously:
 
 1. **GlobalLoadingOverlay** (z-9999) - From NavigationLoadingContext on route changes
 2. **ProtectedRoute** (z-100) - Auth phase loading (initializing, verifying, redirecting)
 3. **RouteContainer/AppLoader** - Suspense fallback for lazy-loaded routes
 4. **Page-level loaders** - Individual pages like Create.tsx with their own LoadingOverlay
 
 Each CinemaLoader was running:
 - 6 animated light rays with `will-change: transform`
 - 3 animated rings (outer, middle, inner)
 - 1 orbiting particle
 - 1 shimmer animation on progress bar
 - Blur filters and radial gradients
 
 **Total: ~44 concurrent CSS animations during initial load**
 
 ## Session Replay Evidence
 
 The session replay showed:
 - Rapid viewport resizing (440x639 → 440x609 → 440x582 etc.)
 - Each resize triggering layout recalculation for ALL animation layers
 - DOM mutations showing updates to `animate-cinema-*` classes
 - Navigation lock timeouts indicating thread exhaustion
 
 ## Fixes Applied
 
 ### 1. Loader Deduplication (Priority System)
 
 Established hierarchy where only ONE loader renders at a time:
 
 ```
 GlobalLoadingOverlay (HIGHEST) → Others defer to it
 ├── ProtectedRoute → Renders placeholder if global is active
 ├── AppLoader → Renders placeholder if global is active  
 └── Page loaders → Should check navLoadingState
 ```
 
 **Files modified:**
 - `src/components/auth/ProtectedRoute.tsx` - Added navLoadingState check
 - `src/components/ui/app-loader.tsx` - Added navLoadingState check
 
 ### 2. Animation Reduction (Mobile)
 
 Reduced CinemaLoader complexity for mobile devices:
 
 | Element | Before | After (Mobile) |
 |---------|--------|----------------|
 | Light rays | 6 animated | 0 (hidden) |
 | Outer ring | animated | static |
 | Middle ring | complex rotation | simple pulse |
 | Inner ring | animated | static |
 | Orbit particle | animated | hidden |
 | Progress shimmer | animated | hidden |
 | Ambient glow | 600px | 300px |
 
 **Total animations on mobile: ~2 vs ~11**
 
 **File modified:**
 - `src/components/ui/CinemaLoader.tsx`
 
 ### 3. Light Ray Reduction (All Platforms)
 
 Reduced from 6 to 3 light rays:
 
 ```typescript
 // Before: 6 rays
 const LIGHT_RAYS = [
   { left: '10%', rotate: -15, opacity: 0.06 },
   { left: '25%', rotate: -8, opacity: 0.08 },
   { left: '40%', rotate: -3, opacity: 0.1 },
   { left: '55%', rotate: 2, opacity: 0.1 },
   { left: '70%', rotate: 7, opacity: 0.08 },
   { left: '85%', rotate: 12, opacity: 0.06 },
 ];
 
 // After: 3 rays
 const LIGHT_RAYS = [
   { left: '25%', rotate: -8, opacity: 0.06 },
   { left: '50%', rotate: 0, opacity: 0.08 },
   { left: '75%', rotate: 8, opacity: 0.06 },
 ];
 ```
 
 ## Architecture After Fix
 
 ```
 ┌─────────────────────────────────────────────────┐
 │  NavigationLoadingProvider                       │
 │  ├── state.isLoading = true/false               │
 │  └── Single source of truth for loading state  │
 └────────────────────┬────────────────────────────┘
                      │
         ┌────────────┴────────────┐
         │                         │
 ┌───────▼───────┐       ┌────────▼────────┐
 │ GlobalLoading │       │ ProtectedRoute  │
 │ Overlay       │       │ AppLoader       │
 │ (RENDERS)     │       │ (DEFER → null)  │
 └───────────────┘       └─────────────────┘
 ```
 
 ## Testing Recommendations
 
 1. **Safari iOS**: Navigate between /projects → /create → /avatars rapidly
 2. **Orientation change**: Rotate device during loading
 3. **Slow network**: Throttle to 3G and observe loading states
 4. **Memory**: Monitor Safari Web Inspector for memory usage
 
 ## Metrics to Monitor
 
 - Console warnings for "Navigation lock timeout"
 - Safari memory warnings
 - Time to interactive on heavy routes
 - CSS animation frame drops