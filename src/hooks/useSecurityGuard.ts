/**
 * useSecurityGuard
 *
 * React hook that activates tamper detection, rate limiting, and
 * console protection for sensitive pages (payment, profile, etc.)
 */

import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  initConsoleWarning,
  reportSecurityEvent,
} from '@/lib/security';

interface UseSecurityGuardOptions {
  /** Page context for security logging */
  context?: string;
  /** Whether this page handles payments/credits */
  isPaymentPage?: boolean;
  /** Whether to detect DOM mutations (for pages with critical UI state) */
  detectDOMTampering?: boolean;
}

export function useSecurityGuard({
  context = 'unknown',
  isPaymentPage = false,
  detectDOMTampering = false,
}: UseSecurityGuardOptions = {}) {
  const { user } = useAuth();
  const observerRef = useRef<MutationObserver | null>(null);
  const hasReportedRef = useRef(false);

  useEffect(() => {
    // Initialize console self-XSS warning on first mount
    initConsoleWarning();
  }, []);

  useEffect(() => {
    if (!detectDOMTampering || !user) return;

    // Watch for unexpected DOM mutations on critical elements
    // (e.g., credit balance display being modified by browser extensions or injected scripts)
    const criticalSelectors = [
      '[data-credit-balance]',
      '[data-security-critical]',
    ];

    const targetNodes = criticalSelectors
      .flatMap(sel => Array.from(document.querySelectorAll(sel)));

    if (targetNodes.length === 0) return;

    observerRef.current = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'characterData' || mutation.type === 'childList') {
          // Check if the mutation came from our React tree (legitimate) or externally
          const isExternalScript = !mutation.target.isConnected ||
            !(mutation.target instanceof Element || mutation.target instanceof Text);

          if (!hasReportedRef.current) {
            hasReportedRef.current = true;
            reportSecurityEvent('dom_manipulation_detected', {
              context,
              mutation_type: mutation.type,
              external: isExternalScript,
            });
          }
        }
      }
    });

    targetNodes.forEach(node => {
      observerRef.current?.observe(node, {
        characterData: true,
        childList: true,
        subtree: true,
      });
    });

    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
    };
  }, [user, detectDOMTampering, context]);

  useEffect(() => {
    if (!isPaymentPage || !user) return;

    // Detect clipboard paste of suspicious content on payment pages
    const handlePaste = (e: ClipboardEvent) => {
      const text = e.clipboardData?.getData('text') || '';
      // Detect attempts to paste scripts or SQL injection patterns
      const suspicious = /(<script|javascript:|DROP TABLE|UNION SELECT|eval\()/i.test(text);
      if (suspicious) {
        e.preventDefault();
        reportSecurityEvent('xss_attempt_blocked', {
          context: 'payment_paste',
          pattern_matched: true,
        });
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [user, isPaymentPage, context]);
}
