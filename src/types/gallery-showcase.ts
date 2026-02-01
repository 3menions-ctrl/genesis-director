export type GalleryCategory = 'text-to-video' | 'image-to-video' | 'avatar';

export interface GalleryShowcaseItem {
  id: string;
  title: string;
  description: string | null;
  video_url: string;
  thumbnail_url: string | null;
  category: GalleryCategory;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface GalleryShowcaseInsert {
  title: string;
  description?: string | null;
  video_url: string;
  thumbnail_url?: string | null;
  category: GalleryCategory;
  sort_order?: number;
  is_active?: boolean;
}

export interface GalleryShowcaseUpdate {
  title?: string;
  description?: string | null;
  video_url?: string;
  thumbnail_url?: string | null;
  category?: GalleryCategory;
  sort_order?: number;
  is_active?: boolean;
}
