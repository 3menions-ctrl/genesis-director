import { memo } from 'react';

/**
 * Deprecated: previously displayed simulated "live activity" messages — a
 * fabricated social-proof feed (dark pattern). Removed 2026-06-09.
 *
 * If real activity needs to be shown, wire this to the gallery feed or to
 * anonymized public events from the database. Do NOT reintroduce hard-coded
 * fake events with rotating timestamps.
 */
interface SocialProofTickerProps {
  /** Suspend interval when overlay is active to reduce background work */
  suspended?: boolean;
}

export const SocialProofTicker = memo(function SocialProofTicker(_props: SocialProofTickerProps) {
  return null;
});

SocialProofTicker.displayName = 'SocialProofTicker';
