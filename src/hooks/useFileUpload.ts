import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface UploadResult {
  url: string;
  path: string;
}

interface UseFileUploadOptions {
  bucket?: string;
  maxSizeMB?: number;
  allowedTypes?: string[];
}

export function useFileUpload(options: UseFileUploadOptions = {}) {
  const { 
    bucket = 'user-uploads',
    maxSizeMB = 100,
    allowedTypes = ['image/*', 'video/*']
  } = options;
  
  const { user } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  // Track mounted state and intervals for cleanup
  const isMountedRef = useRef(true);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    };
  }, []);

  const validateFile = useCallback((file: File): boolean => {
    // Check size
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      setError(`File too large. Maximum size is ${maxSizeMB}MB`);
      toast.error(`File too large. Maximum size is ${maxSizeMB}MB`);
      return false;
    }

    // Check type
    const isAllowed = allowedTypes.some(type => {
      if (type.endsWith('/*')) {
        const category = type.replace('/*', '');
        return file.type.startsWith(category);
      }
      return file.type === type;
    });

    if (!isAllowed) {
      setError(`Invalid file type. Allowed: ${allowedTypes.join(', ')}`);
      toast.error(`Invalid file type`);
      return false;
    }

    return true;
  }, [maxSizeMB, allowedTypes]);

  const uploadFile = useCallback(async (file: File): Promise<UploadResult | null> => {
    if (!user) {
      toast.error('Please sign in to upload files');
      return null;
    }

    if (!validateFile(file)) {
      return null;
    }

    setIsUploading(true);
    setProgress(0);
    setError(null);

    try {
      // Generate unique file path: userId/timestamp-filename
      const timestamp = Date.now();
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filePath = `${user.id}/${timestamp}-${sanitizedName}`;

      console.log(`[useFileUpload] Uploading to ${bucket}/${filePath}`);

      // Clear any existing interval before starting new one
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }

      // Simulate progress for UX (actual upload doesn't have progress events)
      progressIntervalRef.current = setInterval(() => {
        if (isMountedRef.current) {
          setProgress(prev => Math.min(prev + 10, 90));
        }
      }, 200);

      const { data, error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
        });

      // Clear interval after upload completes
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath);

      if (isMountedRef.current) {
        setProgress(100);
      }
      
      console.log(`[useFileUpload] Upload complete: ${urlData.publicUrl}`);
      toast.success('File uploaded successfully');

      return {
        url: urlData.publicUrl,
        path: filePath,
      };

    } catch (err) {
      // Clear interval on error
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      
      const message = err instanceof Error ? err.message : 'Upload failed';
      if (isMountedRef.current) {
        setError(message);
      }
      toast.error(message);
      console.error('[useFileUpload] Error:', err);
      return null;

    } finally {
      if (isMountedRef.current) {
        setIsUploading(false);
      }
    }
  }, [user, bucket, validateFile]);

  const uploadFromUrl = useCallback(async (url: string, filename: string): Promise<UploadResult | null> => {
    if (!user) {
      toast.error('Please sign in to upload files');
      return null;
    }

    setIsUploading(true);
    setError(null);

    try {
      // Fetch the file from URL
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch file');
      
      const blob = await response.blob();
      const file = new File([blob], filename, { type: blob.type });
      
      return await uploadFile(file);

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload from URL failed';
      setError(message);
      toast.error(message);
      return null;

    } finally {
      setIsUploading(false);
    }
  }, [user, uploadFile]);

  const deleteFile = useCallback(async (path: string): Promise<boolean> => {
    try {
      const { error } = await supabase.storage
        .from(bucket)
        .remove([path]);

      if (error) throw error;
      
      toast.success('File deleted');
      return true;

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Delete failed';
      toast.error(message);
      return false;
    }
  }, [bucket]);

  return {
    uploadFile,
    uploadFromUrl,
    deleteFile,
    isUploading,
    progress,
    error,
  };
}
