import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { GalleryShowcaseItem, GalleryShowcaseInsert, GalleryShowcaseUpdate } from '@/types/gallery-showcase';
import { toast } from 'sonner';

export function useGalleryShowcase(includeInactive = false) {
  return useQuery({
    queryKey: ['gallery-showcase', includeInactive],
    queryFn: async () => {
      let query = supabase
        .from('gallery_showcase')
        .select('*')
        .order('sort_order', { ascending: true });
      
      if (!includeInactive) {
        query = query.eq('is_active', true);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as GalleryShowcaseItem[];
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useAddGalleryItem() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (item: GalleryShowcaseInsert) => {
      const { data, error } = await supabase
        .from('gallery_showcase')
        .insert(item)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gallery-showcase'] });
      toast.success('Gallery item added');
    },
    onError: (error) => {
      toast.error(`Failed to add: ${error.message}`);
    },
  });
}

export function useUpdateGalleryItem() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: GalleryShowcaseUpdate }) => {
      const { data, error } = await supabase
        .from('gallery_showcase')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gallery-showcase'] });
      toast.success('Gallery item updated');
    },
    onError: (error) => {
      toast.error(`Failed to update: ${error.message}`);
    },
  });
}

export function useDeleteGalleryItem() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('gallery_showcase')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gallery-showcase'] });
      toast.success('Gallery item removed');
    },
    onError: (error) => {
      toast.error(`Failed to delete: ${error.message}`);
    },
  });
}

export function useReorderGalleryItems() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (items: { id: string; sort_order: number }[]) => {
      const updates = items.map(({ id, sort_order }) =>
        supabase
          .from('gallery_showcase')
          .update({ sort_order })
          .eq('id', id)
      );
      
      await Promise.all(updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gallery-showcase'] });
      toast.success('Order updated');
    },
    onError: (error) => {
      toast.error(`Failed to reorder: ${error.message}`);
    },
  });
}
