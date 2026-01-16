import { Loader2, AlertTriangle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useUniverses } from '@/hooks/useUniverses';
import type { Universe } from '@/types/universe';

interface DeleteUniverseDialogProps {
  universe: Universe | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
}

export function DeleteUniverseDialog({ 
  universe, 
  open, 
  onOpenChange,
  onDeleted,
}: DeleteUniverseDialogProps) {
  const { deleteUniverse } = useUniverses();

  const handleDelete = async () => {
    if (!universe) return;
    
    await deleteUniverse.mutateAsync(universe.id);
    onOpenChange(false);
    onDeleted?.();
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Delete Universe
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>
              Are you sure you want to delete <strong>{universe?.name}</strong>?
            </p>
            <p className="text-destructive">
              This action cannot be undone. All associated data including characters, 
              timeline events, and chat history will be permanently deleted.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={deleteUniverse.isPending}
          >
            {deleteUniverse.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Delete Universe
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
