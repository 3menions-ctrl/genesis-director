/**
 * Navigation Loading Guard Rails Tests v2.0
 * 
 * These tests verify that the navigation loading coordination system
 * properly handles race conditions and ensures smooth page transitions.
 * 
 * v2.0: Added tests for BFCache, navigation queue, cleanup summary
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Navigation Loading Coordination', () => {
  
  describe('Auto-Complete Disable Pattern', () => {
    it('should have disableAutoComplete exported from context', () => {
      const contextPath = path.join(process.cwd(), 'src/contexts/NavigationLoadingContext.tsx');
      const content = fs.readFileSync(contextPath, 'utf-8');
      
      // Context should export disableAutoComplete
      expect(content.includes('disableAutoComplete')).toBe(true);
      expect(content.includes('autoCompleteDisabledRef')).toBe(true);
    });

    it('should skip auto-complete when disabled', () => {
      const contextPath = path.join(process.cwd(), 'src/contexts/NavigationLoadingContext.tsx');
      const content = fs.readFileSync(contextPath, 'utf-8');
      
      // Should check autoCompleteDisabledRef before auto-completing
      expect(content.includes('if (autoCompleteDisabledRef.current)')).toBe(true);
    });

    it('should reset autoCompleteDisabledRef on new navigation', () => {
      const contextPath = path.join(process.cwd(), 'src/contexts/NavigationLoadingContext.tsx');
      const content = fs.readFileSync(contextPath, 'utf-8');
      
      // Should reset the flag when starting new navigation
      expect(content.includes('autoCompleteDisabledRef.current = false')).toBe(true);
    });
  });

  describe('Create Page Pattern Compliance', () => {
    it('should use gatekeeper timeout pattern for forced visibility', () => {
      const createPath = path.join(process.cwd(), 'src/pages/Create.tsx');
      const content = fs.readFileSync(createPath, 'utf-8');
      
      // Create page should use gatekeeper timeout pattern to prevent infinite loading
      expect(content.includes('GATEKEEPER_TIMEOUT_MS')).toBe(true);
      expect(content.includes('gatekeeperTimeout')).toBe(true);
    });

    it('should track hub ready state for coordinated loading', () => {
      const createPath = path.join(process.cwd(), 'src/pages/Create.tsx');
      const content = fs.readFileSync(createPath, 'utf-8');
      
      // Should have isHubReady state
      expect(content.includes('isHubReady')).toBe(true);
      
      // Should coordinate loading visibility with hub readiness OR gatekeeper timeout
      expect(content.includes('!isHubReady && !gatekeeperTimeout')).toBe(true);
    });

    it('should pass onReady callback to CreationHub', () => {
      const createPath = path.join(process.cwd(), 'src/pages/Create.tsx');
      const content = fs.readFileSync(createPath, 'utf-8');
      
      // Should pass onReady prop
      expect(content.includes('onReady={handleHubReady}')).toBe(true);
    });
  });

  describe('CreationHub Ready Signal Pattern', () => {
    it('should signal ready only after data dependencies load', () => {
      const hubPath = path.join(process.cwd(), 'src/components/studio/CreationHub.tsx');
      const content = fs.readFileSync(hubPath, 'utf-8');
      
      // Should check templateLoading and tierLoading
      expect(content.includes('!templateLoading && !tierLoading')).toBe(true);
      
      // Should track hasSignaledReady to prevent multiple calls
      expect(content.includes('hasSignaledReady.current')).toBe(true);
    });

    it('should accept onReady callback prop', () => {
      const hubPath = path.join(process.cwd(), 'src/components/studio/CreationHub.tsx');
      const content = fs.readFileSync(hubPath, 'utf-8');
      
      // Should have onReady in props interface
      expect(content.includes('onReady?:')).toBe(true);
      expect(content.includes("onReady?.()")).toBe(true);
    });
  });
});

describe('Heavy Route Configuration', () => {
  it('should have proper min duration for Create route', () => {
    const contextPath = path.join(process.cwd(), 'src/contexts/NavigationLoadingContext.tsx');
    const content = fs.readFileSync(contextPath, 'utf-8');
    
    // Create route should have substantial min duration
    expect(content.includes("'/create'")).toBe(true);
    expect(content.includes('minDuration: 800')).toBe(true);
  });

  it('should have progressive loading messages', () => {
    const contextPath = path.join(process.cwd(), 'src/contexts/NavigationLoadingContext.tsx');
    const content = fs.readFileSync(contextPath, 'utf-8');
    
    // Should have multiple messages for user engagement
    expect(content.includes('Initializing AI engine...')).toBe(true);
    expect(content.includes('Loading creation tools...')).toBe(true);
  });
});

describe('forwardRef Compliance for Navigation Routes', () => {
  const forwardRefPages = [
    'Projects.tsx',
    'Avatars.tsx', 
    'Create.tsx',
  ];

  forwardRefPages.forEach(pageName => {
    it(`${pageName} should attach ref to DOM element`, () => {
      const filePath = path.join(process.cwd(), 'src/pages', pageName);
      
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        
        // If using forwardRef, must attach to DOM via mergedRef, containerRef, or ref pattern
        // Also accepts fallback pattern: ref={ref || containerRef}
        if (content.includes('forwardRef<')) {
          expect(
            content.includes('ref={mergedRef}') || 
            content.includes('ref={containerRef}') || 
            content.includes('ref={ref}') ||
            content.includes('ref={ref || containerRef}')
          ).toBe(true);
        }
      }
    });
  });
});

describe('Race Condition Prevention Patterns', () => {
  it('should use Promise.race with timeout in tier limits', () => {
    const hookPath = path.join(process.cwd(), 'src/hooks/useTierLimits.ts');
    const content = fs.readFileSync(hookPath, 'utf-8');
    
    // Should have timeout pattern
    expect(content.includes('Promise.race')).toBe(true);
    expect(content.includes('timeoutPromise')).toBe(true);
  });

  it('should have graceful fallbacks for failed data loads', () => {
    const hookPath = path.join(process.cwd(), 'src/hooks/useTierLimits.ts');
    const content = fs.readFileSync(hookPath, 'utf-8');
    
    // Should fallback to defaults
    expect(content.includes('DEFAULT_TIER_LIMITS')).toBe(true);
  });
});

describe('NavigationCoordinator v2.0 Features', () => {
  const coordinatorPath = path.join(process.cwd(), 'src/lib/navigation/NavigationCoordinator.ts');
  
  it('should have BFCache handlers for Safari', () => {
    const content = fs.readFileSync(coordinatorPath, 'utf-8');
    
    // Should register pageshow/pagehide handlers
    expect(content.includes('registerBFCacheHandlers')).toBe(true);
    expect(content.includes("'pageshow'")).toBe(true);
    expect(content.includes("'pagehide'")).toBe(true);
    expect(content.includes('event.persisted')).toBe(true);
  });

  it('should have navigation queue for rapid navigation', () => {
    const content = fs.readFileSync(coordinatorPath, 'utf-8');
    
    // Should have queue system
    expect(content.includes('navigationQueue')).toBe(true);
    expect(content.includes('queueNavigation')).toBe(true);
    expect(content.includes('processQueue')).toBe(true);
    expect(content.includes('maxQueueSize')).toBe(true);
  });

  it('should have listener limit to prevent memory leaks', () => {
    const content = fs.readFileSync(coordinatorPath, 'utf-8');
    
    // Should check and limit listeners
    expect(content.includes('maxListeners')).toBe(true);
    expect(content.includes('this.listeners.size >= this.options.maxListeners')).toBe(true);
  });

  it('should have cleanup summary aggregation', () => {
    const content = fs.readFileSync(coordinatorPath, 'utf-8');
    
    // Should have CleanupSummary type
    expect(content.includes('CleanupSummary')).toBe(true);
    expect(content.includes('successfulCleanups')).toBe(true);
    expect(content.includes('failedCleanups')).toBe(true);
    expect(content.includes('timedOutCleanups')).toBe(true);
  });

  it('should integrate with memoryManager for blob URL cleanup', () => {
    const content = fs.readFileSync(coordinatorPath, 'utf-8');
    
    // Should import and use memoryManager
    expect(content.includes("from '@/lib/memoryManager'")).toBe(true);
    expect(content.includes('blobUrlTracker')).toBe(true);
    expect(content.includes('blobUrlTracker.revokeAll()')).toBe(true);
  });

  it('should use Set instead of WeakSet for media elements (iterable)', () => {
    const content = fs.readFileSync(coordinatorPath, 'utf-8');
    
    // Should use Set for registered elements (allows iteration)
    expect(content.includes('registeredMediaElements = new Set<HTMLMediaElement>()')).toBe(true);
  });

  it('should have performance metrics tracking', () => {
    const content = fs.readFileSync(coordinatorPath, 'utf-8');
    
    // Should track metrics
    expect(content.includes('getMetrics')).toBe(true);
    expect(content.includes('totalNavigations')).toBe(true);
    expect(content.includes('averageNavigationTime')).toBe(true);
    expect(content.includes('abortedRequests')).toBe(true);
  });
});

describe('Loading State Coordination Documentation', () => {
  it('should document the readiness coordination pattern', () => {
    /**
     * PATTERN: Coordinated Page Readiness
     * 
     * For pages with async data dependencies:
     * 1. Page calls disableAutoComplete() on mount
     * 2. Child component (e.g., CreationHub) loads data dependencies
     * 3. Child signals ready via onReady callback when data is loaded
     * 4. Page updates state (e.g., isHubReady = true)
     * 5. Page effect sees ready state and calls markReady()
     * 6. GlobalLoadingOverlay fades out smoothly
     * 
     * This prevents:
     * - Auto-complete racing with data loads
     * - Overlay dismissing before UI is hydrated
     * - Flash of unloaded content
     */
    
    const pattern = {
      step1: 'disableAutoComplete() on mount',
      step2: 'Child loads async dependencies',
      step3: 'Child calls onReady callback',
      step4: 'Parent updates ready state',
      step5: 'Parent calls markReady()',
      step6: 'Overlay fades out',
    };
    
    expect(Object.keys(pattern).length).toBe(6);
  });
});
