/**
 * Pipeline Notifications - Insert notifications for video lifecycle events
 * 
 * Notifications are inserted via service role (bypasses RLS block on authenticated users).
 */

export type VideoNotificationType = 
  | 'video_started'
  | 'video_complete' 
  | 'video_failed';

interface NotificationPayload {
  userId: string;
  projectId: string;
  projectName?: string;
  type: VideoNotificationType;
  title: string;
  body?: string;
  data?: Record<string, unknown>;
}

/**
 * Insert a notification into the notifications table.
 * Fails silently — notifications should never break the pipeline.
 */
export async function sendPipelineNotification(
  supabase: any,
  payload: NotificationPayload
): Promise<void> {
  try {
    await supabase.from('notifications').insert({
      user_id: payload.userId,
      type: payload.type,
      title: payload.title,
      body: payload.body || null,
      data: {
        projectId: payload.projectId,
        projectName: payload.projectName || null,
        ...payload.data,
      },
    });
  } catch (err) {
    // Never let notification failures crash the pipeline
    console.warn(`[Notifications] Failed to send ${payload.type}:`, err);
  }
}

/** Notify: video generation started */
export async function notifyVideoStarted(
  supabase: any,
  userId: string,
  projectId: string,
  projectName?: string,
  clipCount?: number
): Promise<void> {
  await sendPipelineNotification(supabase, {
    userId,
    projectId,
    projectName,
    type: 'video_started',
    title: 'Video generation started',
    body: clipCount 
      ? `Your ${clipCount}-clip video is now being produced.`
      : 'Your video is now being produced.',
    data: { clipCount },
  });
}

/** Notify: video completed successfully */
export async function notifyVideoComplete(
  supabase: any,
  userId: string,
  projectId: string,
  projectName?: string,
  extras?: { clipCount?: number; duration?: string; videoUrl?: string }
): Promise<void> {
  await sendPipelineNotification(supabase, {
    userId,
    projectId,
    projectName,
    type: 'video_complete',
    title: 'Your video is ready! 🎬',
    body: extras?.clipCount
      ? `Your ${extras.clipCount}-clip video has finished rendering.`
      : 'Your video has finished rendering.',
    data: extras,
  });
}

/** Notify: video generation failed */
export async function notifyVideoFailed(
  supabase: any,
  userId: string,
  projectId: string,
  projectName?: string,
  extras?: { reason?: string; creditsRefunded?: number; resumable?: boolean }
): Promise<void> {
  let body = 'Something went wrong during video generation.';
  if (extras?.creditsRefunded && extras.creditsRefunded > 0) {
    body += ` ${extras.creditsRefunded} credits have been refunded.`;
  }
  if (extras?.resumable) {
    body += ' You can retry from where it left off.';
  }

  await sendPipelineNotification(supabase, {
    userId,
    projectId,
    projectName,
    type: 'video_failed',
    title: 'Video generation failed',
    body,
    data: extras,
  });
}
