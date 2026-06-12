import StudioShell from '@/components/studio/v2/StudioShell';
import { DesktopRecommendedBanner } from '@/components/ui/DesktopRecommendedBanner';

import { usePageMeta } from '@/hooks/usePageMeta';
export default function CreateCanvas() {
  usePageMeta({ title: "Create Canvas — Small Bridges", description: "Hands-on cinematic canvas for sketching scene compositions and shots." });

  return (
    <>
      <DesktopRecommendedBanner surface="Director Studio" />
      <StudioShell />
    </>
  );
}