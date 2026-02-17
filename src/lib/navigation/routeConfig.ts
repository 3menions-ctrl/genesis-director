 /**
  * Route Configuration - Single Source of Truth
  * 
  * Defines which routes are "heavy" (require loading overlay)
  * and their loading characteristics.
  * 
  * CRITICAL: Both NavigationLoadingContext and NavigationGuardProvider
  * must use this same configuration to prevent race conditions.
  */
 
 export interface HeavyRouteConfig {
   messages: string[];
   minDuration: number;
 }
 
 /**
  * Heavy routes require loading overlays during transitions.
  * The messages cycle while loading, and minDuration ensures
  * users see meaningful feedback (not a flash).
  */
 export const HEAVY_ROUTES: Record<string, HeavyRouteConfig> = {
   '/create': {
     messages: [
       'Initializing AI engine...',
       'Loading creation tools...',
       'Syncing your preferences...',
       'Preparing studio environment...',
     ],
     minDuration: 800,
   },
   '/production': {
     messages: [
       'Loading production pipeline...',
       'Initializing video engine...',
       'Syncing clips data...',
       'Preparing render context...',
     ],
     minDuration: 600,
   },
   '/avatars': {
     messages: [
       'Loading avatar library...',
       'Initializing voice engine...',
       'Preparing character models...',
     ],
     minDuration: 600,
   },
   '/projects': {
     messages: [
       'Loading your projects...',
       'Syncing latest updates...',
     ],
     minDuration: 400,
   },
   '/creators': {
     messages: [
       'Loading community content...',
       'Fetching latest creations...',
     ],
     minDuration: 400,
   },
   '/templates': {
     messages: [
       'Loading template library...',
       'Preparing previews...',
     ],
     minDuration: 400,
   },
   '/environments': {
     messages: [
       'Loading environments...',
       'Preparing scene presets...',
     ],
     minDuration: 400,
   },
 };
 
 /**
  * List of heavy route prefixes for quick checking.
  * IMPORTANT: Keep this in sync with HEAVY_ROUTES keys.
  */
 export const HEAVY_ROUTE_PREFIXES = Object.keys(HEAVY_ROUTES);
 
 /**
  * Check if a route is a heavy route (exact or prefix match).
  */
 export function isHeavyRoute(route: string): boolean {
   // Exact match
   if (HEAVY_ROUTES[route]) return true;
   
   // Prefix match (e.g., /production/:id)
   return HEAVY_ROUTE_PREFIXES.some(prefix => 
     route.startsWith(prefix) && (route === prefix || route[prefix.length] === '/')
   );
 }
 
 /**
  * Get route config for a heavy route (exact or prefix match).
  */
 export function getHeavyRouteConfig(route: string): HeavyRouteConfig | null {
   // Exact match
   if (HEAVY_ROUTES[route]) return HEAVY_ROUTES[route];
   
   // Prefix match
   for (const key of HEAVY_ROUTE_PREFIXES) {
     if (route.startsWith(key) && (route === key || route[key.length] === '/')) {
       return HEAVY_ROUTES[key];
     }
   }
   
   return null;
 }
 
 /**
  * Default completion delay for heavy routes.
  * This gives gatekeepers time to call markReady().
  */
 export const HEAVY_ROUTE_COMPLETION_DELAY_MS = 800;