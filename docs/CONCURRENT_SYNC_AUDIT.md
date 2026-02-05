 # Concurrent Sync Operations Audit Report
 
 **Date:** 2026-02-05
 **Issue:** Safari crash loops caused by concurrent async operations exceeding memory limits
 
 ## Executive Summary
 
 The application experiences crash loops on Safari (especially iOS) due to:
 1. **Unbounded parallel async operations** during page load
 2. **Realtime subscription cascade** triggering multiple simultaneous refreshes
 3. **Race conditions** between paginated data fetching and clip URL resolution
 4. **No debouncing** on realtime-triggered refreshes
 
 ## Identified Race Conditions
 
 ### 1. Projects Page - Triple Data Source Collision
 
 **Location:** `src/pages/Projects.tsx` + `src/hooks/usePaginatedProjects.ts`
 
 **Problem:** When the Projects page loads, THREE concurrent operations compete:
 
 ```
 Timeline:
 T+0ms    usePaginatedProjects.fetchProjects() starts
 T+50ms   useEffect resolveClipUrls() starts (depends on projects)
 T+100ms  Realtime subscription fires (external change)
 T+150ms  refreshProjects() called by realtime
 T+200ms  resolveClipUrls() gets stale project list
 T+250ms  New fetchProjects() overlaps with clip resolution
 ```
 
 **Evidence:**
 - `usePaginatedProjects.ts:241-243`: Re-fetches on ANY filter change
 - `Projects.tsx:427-450`: Realtime subscription calls `refreshProjects()` on every event
 - `Projects.tsx:227-279`: Clip resolution runs independently, no coordination
 
 **Risk:** Memory pressure from parallel DB queries + network requests
 
 ---
 
 ### 2. StudioContext + usePaginatedProjects Dual Loading
 
 **Location:** `src/contexts/StudioContext.tsx` + `src/hooks/usePaginatedProjects.ts`
 
 **Problem:** BOTH systems load projects independently:
 
 - `StudioContext.loadProjects()` loads first 5 projects for context
 - `usePaginatedProjects.fetchProjects()` loads first 5 projects for display
 - Both query `movie_projects` and `video_clips` tables
 
 **Impact:** 4 database queries instead of 2, doubled memory allocation
 
 ---
 
 ### 3. Realtime Subscription - No Debounce
 
 **Location:** `src/pages/Projects.tsx:427-450`
 
 ```typescript
 .on(
   'postgres_changes',
   { event: '*', schema: 'public', table: 'movie_projects', filter: `user_id=eq.${user.id}` },
   () => {
     refreshProjects(); // ⚠️ FIRES ON EVERY EVENT - NO DEBOUNCE
   }
 )
 ```
 
 **Problem:** During video generation, `movie_projects` updates frequently:
 - Status changes (pending → generating → completed)
 - Progress updates
 - Thumbnail generation
 - Each triggers a full refresh cascade
 
 ---
 
 ### 4. Clip URL Resolution - Race with Pagination
 
 **Location:** `src/pages/Projects.tsx:227-279`
 
 **Problem:** Clip URL resolution depends on `projects` state but doesn't coordinate:
 
 ```typescript
 useEffect(() => {
   if (!user || !hasLoadedOnce || !Array.isArray(projects) || projects.length === 0) return;
   
   const resolveClipUrls = async () => {
     // Uses projects from closure - may be stale
     const projectsNeedingResolution = projects.filter(...);
     // ...starts async work
   };
   
   resolveClipUrls();
 }, [user, hasLoadedOnce, projects]); // Re-runs on every projects change
 ```
 
 If `refreshProjects()` is called while resolution is in progress:
 1. Old resolution continues with stale data
 2. New resolution starts immediately
 3. Both write to `resolvedClipUrls` state
 4. React batches updates, causing UI flicker
 
 ---
 
 ### 5. Multiple Viewport Resize Events
 
 **Evidence from Session Replay:**
 ```
 1770261608325: Viewport resize to 440x561
 1770261610383: Viewport resize to 440x534
 1770261611089: Viewport resize to 440x561
 ```
 
 Three resizes in ~3 seconds during loading state causes:
 - Layout recalculation
 - Component re-renders
 - Memory allocation for new layouts
 
 Combined with concurrent data fetching = memory exhaustion
 
 ---
 
 ## Recommended Fixes
 
 ### Fix 1: Debounce Realtime Refreshes
 
 ```typescript
 // Add debounce to realtime subscription
 const debouncedRefresh = useMemo(
   () => debounce(() => refreshProjects(), 500),
   [refreshProjects]
 );
 
 useEffect(() => {
   if (!user) return;
   
   const channel = supabase
     .channel('projects_realtime')
     .on('postgres_changes', {...}, () => {
       debouncedRefresh(); // Debounced, not immediate
     })
     .subscribe();
   
   return () => {
     debouncedRefresh.cancel();
     supabase.removeChannel(channel);
   };
 }, [user, debouncedRefresh]);
 ```
 
 ### Fix 2: Coordinate Clip Resolution with AbortController
 
 ```typescript
 useEffect(() => {
   const abortController = new AbortController();
   
   const resolveClipUrls = async () => {
     if (abortController.signal.aborted) return;
     // ... resolution logic
   };
   
   resolveClipUrls();
   
   return () => abortController.abort(); // Cancel on re-run
 }, [user, hasLoadedOnce, projects]);
 ```
 
 ### Fix 3: Eliminate Dual Project Loading
 
 Either:
 - Remove project loading from StudioContext (use usePaginatedProjects only)
 - Or consolidate into a single shared hook with deduplication
 
 ### Fix 4: Stagger Operations on Mobile
 
 ```typescript
 const isMobile = window.innerWidth < 768;
 
 useEffect(() => {
   if (isMobile) {
     // Stagger: load projects first, then resolve clips after render
     const timer = setTimeout(resolveClipUrls, 300);
     return () => clearTimeout(timer);
   } else {
     resolveClipUrls();
   }
 }, [projects, isMobile]);
 ```
 
 ---
 
 ## Implementation Priority
 
 | Fix | Impact | Effort | Priority |
 |-----|--------|--------|----------|
 | Debounce realtime | High | Low | P0 |
 | AbortController for clips | High | Low | P0 |
 | Eliminate dual loading | Medium | Medium | P1 |
 | Mobile staggering | Medium | Low | P1 |
 
 ---
 
 ## Verification Checklist
 
 - [ ] Safari iOS: Navigate to /projects with 10+ projects
 - [ ] Trigger realtime update during loading
 - [ ] Verify no crash loop occurs
 - [ ] Memory profiler shows stable allocation