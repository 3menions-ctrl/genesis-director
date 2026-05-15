import StudioShell from '@/components/studio/v2/StudioShell';

import { usePageMeta } from '@/hooks/usePageMeta';
export default function CreateCanvas() {
  usePageMeta({ title: "Create Canvas — Apex Studio", description: "Hands-on cinematic canvas for sketching scene compositions and shots." });

  return <StudioShell />;
}