import React from 'react';
import { useParams } from 'react-router-dom';
import { WidgetRenderer } from '@/components/scenes/WidgetRenderer';

/**
 * Minimal page for iframe embeds.
 * URL: /widget/:publicKey
 * The embed iframe points here and renders just the overlay widget.
 */
export default function WidgetEmbed() {
  const { publicKey } = useParams<{ publicKey: string }>();

  if (!publicKey) {
    return null; // Fail silently
  }

  return (
    <div className="w-full h-full bg-transparent">
      <WidgetRenderer publicKey={publicKey} mode="embed" />
    </div>
  );
}
