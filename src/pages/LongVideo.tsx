import { UnifiedStudio } from '@/components/studio/UnifiedStudio';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

export default function LongVideo() {
  return (
    <ProtectedRoute>
      <UnifiedStudio />
    </ProtectedRoute>
  );
}
