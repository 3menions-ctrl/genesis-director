import { StudioLayout } from '@/components/layout/StudioLayout';
import { UnifiedStudio } from '@/components/studio/UnifiedStudio';

export default function LongVideo() {
  return (
    <StudioLayout>
      <div className="container max-w-4xl mx-auto py-8 px-4">
        <UnifiedStudio />
      </div>
    </StudioLayout>
  );
}
