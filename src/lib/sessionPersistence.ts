/**
 * Session Persistence Layer v1.0
 * 
 * Ensures Create workflow state survives page refreshes and crashes.
 * Uses localStorage with database fallback for draft state.
 */

import { supabase } from '@/integrations/supabase/client';

// Storage keys
const DRAFT_KEY = 'apex_create_draft';
const DRAFT_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Draft state structure
 */
export interface CreateDraft {
  // Core creation parameters
  mode: string;
  prompt: string;
  aspectRatio: string;
  clipCount: number;
  clipDuration: number;
  
  // Optional parameters
  style?: string;
  genre?: string;
  mood?: string;
  enableNarration?: boolean;
  enableMusic?: boolean;
  imageUrl?: string;
  videoUrl?: string;
  voiceId?: string;
  
  // Metadata
  savedAt: string;
  userId?: string;
  templateId?: string;
}

/**
 * Save draft to localStorage
 */
export function saveDraft(draft: Omit<CreateDraft, 'savedAt'>): void {
  try {
    const draftWithTimestamp: CreateDraft = {
      ...draft,
      savedAt: new Date().toISOString(),
    };
    
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draftWithTimestamp));
    console.log('[SessionPersistence] Draft saved:', draft.mode);
  } catch (error) {
    console.warn('[SessionPersistence] Failed to save draft:', error);
  }
}

/**
 * Load draft from localStorage
 */
export function loadDraft(): CreateDraft | null {
  try {
    const stored = localStorage.getItem(DRAFT_KEY);
    if (!stored) return null;
    
    const draft = JSON.parse(stored) as CreateDraft;
    
    // Check expiry
    const savedTime = new Date(draft.savedAt).getTime();
    if (Date.now() - savedTime > DRAFT_EXPIRY_MS) {
      clearDraft();
      console.log('[SessionPersistence] Draft expired, cleared');
      return null;
    }
    
    console.log('[SessionPersistence] Draft loaded:', draft.mode);
    return draft;
  } catch (error) {
    console.warn('[SessionPersistence] Failed to load draft:', error);
    return null;
  }
}

/**
 * Clear draft from localStorage
 */
export function clearDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY);
    console.log('[SessionPersistence] Draft cleared');
  } catch (error) {
    console.warn('[SessionPersistence] Failed to clear draft:', error);
  }
}

/**
 * Check if draft exists
 */
export function hasDraft(): boolean {
  try {
    const stored = localStorage.getItem(DRAFT_KEY);
    if (!stored) return false;
    
    const draft = JSON.parse(stored) as CreateDraft;
    const savedTime = new Date(draft.savedAt).getTime();
    
    return Date.now() - savedTime <= DRAFT_EXPIRY_MS;
  } catch {
    return false;
  }
}

/**
 * Save draft to database (for long-term persistence)
 */
export async function saveDraftToDatabase(
  userId: string,
  draft: Omit<CreateDraft, 'savedAt'>
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('profiles')
      .update({
        // Store in preferences JSON column
        preferences: {
          createDraft: {
            ...draft,
            savedAt: new Date().toISOString(),
          },
        },
      })
      .eq('id', userId);
    
    if (error) {
      console.error('[SessionPersistence] Failed to save draft to database:', error);
      return false;
    }
    
    console.log('[SessionPersistence] Draft saved to database');
    return true;
  } catch (error) {
    console.error('[SessionPersistence] Database save error:', error);
    return false;
  }
}

/**
 * Load draft from database
 */
export async function loadDraftFromDatabase(userId: string): Promise<CreateDraft | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('preferences')
      .eq('id', userId)
      .maybeSingle();
    
    if (error || !data?.preferences) {
      return null;
    }
    
    const preferences = data.preferences as Record<string, unknown>;
    const draft = preferences.createDraft as CreateDraft | undefined;
    
    if (!draft) return null;
    
    // Check expiry
    const savedTime = new Date(draft.savedAt).getTime();
    if (Date.now() - savedTime > DRAFT_EXPIRY_MS) {
      console.log('[SessionPersistence] Database draft expired');
      return null;
    }
    
    return draft;
  } catch (error) {
    console.error('[SessionPersistence] Database load error:', error);
    return null;
  }
}

/**
 * Hook for auto-saving drafts during Create workflow
 */
export function useAutosaveDraft() {
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  
  const scheduleAutosave = (draft: Omit<CreateDraft, 'savedAt'>) => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    
    debounceTimer = setTimeout(() => {
      saveDraft(draft);
    }, 1000); // Debounce by 1 second
  };
  
  const cancelAutosave = () => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
  };
  
  return {
    scheduleAutosave,
    cancelAutosave,
    saveDraft,
    loadDraft,
    clearDraft,
    hasDraft,
  };
}

/**
 * Recovery status for Create page
 */
export interface RecoveryStatus {
  hasDraft: boolean;
  draft: CreateDraft | null;
  source: 'localStorage' | 'database' | null;
}

/**
 * Check for recoverable state from both localStorage and database
 */
export async function checkRecoverableState(userId?: string): Promise<RecoveryStatus> {
  // First check localStorage (faster)
  const localDraft = loadDraft();
  if (localDraft) {
    return {
      hasDraft: true,
      draft: localDraft,
      source: 'localStorage',
    };
  }
  
  // Fall back to database if user is logged in
  if (userId) {
    const dbDraft = await loadDraftFromDatabase(userId);
    if (dbDraft) {
      // Also cache in localStorage for faster access next time
      saveDraft(dbDraft);
      return {
        hasDraft: true,
        draft: dbDraft,
        source: 'database',
      };
    }
  }
  
  return {
    hasDraft: false,
    draft: null,
    source: null,
  };
}
