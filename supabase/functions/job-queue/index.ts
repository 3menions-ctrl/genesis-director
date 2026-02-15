import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

/**
 * Job Queue Edge Function - High-Traffic Video Production
 * 
 * Features:
 * - Priority-based job queuing
 * - Rate limiting per user/tier
 * - Automatic load balancing
 * - Job status tracking
 * - Graceful degradation under load
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Job types
type JobType = 'video_generation' | 'stitching' | 'audio_generation' | 'thumbnail';
type JobStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
type Priority = 'critical' | 'high' | 'normal' | 'low';

interface Job {
  id: string;
  type: JobType;
  priority: Priority;
  status: JobStatus;
  userId: string;
  projectId: string;
  payload: unknown;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  retryCount: number;
  maxRetries: number;
  result?: unknown;
}

interface QueueRequest {
  action: 'enqueue' | 'dequeue' | 'status' | 'cancel' | 'stats' | 'process_batch';
  jobType?: JobType;
  userId?: string;
  projectId?: string;
  payload?: unknown;
  priority?: Priority;
  jobId?: string;
  batchSize?: number;
}

// In-memory job queue (in production, use Redis or database)
const jobQueues: Map<JobType, Job[]> = new Map([
  ['video_generation', []],
  ['stitching', []],
  ['audio_generation', []],
  ['thumbnail', []],
]);

// Active jobs tracking
const activeJobs: Map<string, Job> = new Map();

// Rate limiting per user
const userRateLimits: Map<string, { count: number; resetAt: number }> = new Map();

// Configuration
const CONFIG = {
  maxQueueSize: 1000,
  maxJobsPerUser: 10,
  rateLimitWindow: 60000, // 1 minute
  rateLimitPerMinute: {
    free: 5,
    pro: 15,
    growth: 30,
    agency: 60,
  } as Record<string, number>,
  processingLimits: {
    video_generation: 10,
    stitching: 5,
    audio_generation: 20,
    thumbnail: 50,
  } as Record<JobType, number>,
  priorityWeights: {
    critical: 1000,
    high: 100,
    normal: 10,
    low: 1,
  } as Record<Priority, number>,
};

// Rate limiting check
function checkUserRateLimit(userId: string, tier: string): { allowed: boolean; remainingQuota: number; resetIn: number } {
  const now = Date.now();
  const limit = CONFIG.rateLimitPerMinute[tier] || CONFIG.rateLimitPerMinute.free;
  
  let userLimit = userRateLimits.get(userId);
  
  if (!userLimit || userLimit.resetAt <= now) {
    userLimit = { count: 0, resetAt: now + CONFIG.rateLimitWindow };
    userRateLimits.set(userId, userLimit);
  }
  
  if (userLimit.count >= limit) {
    return {
      allowed: false,
      remainingQuota: 0,
      resetIn: userLimit.resetAt - now,
    };
  }
  
  userLimit.count++;
  return {
    allowed: true,
    remainingQuota: limit - userLimit.count,
    resetIn: userLimit.resetAt - now,
  };
}

// Get user tier from database
async function getUserTier(supabaseUrl: string, supabaseKey: string, userId: string): Promise<string> {
  try {
    const client = createClient(supabaseUrl, supabaseKey);
    const { data } = await client.rpc('get_user_tier_limits', { p_user_id: userId } as unknown as undefined);
    return (data as { tier?: string } | null)?.tier || 'free';
  } catch {
    return 'free';
  }
}

// Priority-based job sorting
function sortQueue(queue: Job[]): void {
  queue.sort((a, b) => {
    // First by priority
    const priorityDiff = CONFIG.priorityWeights[b.priority] - CONFIG.priorityWeights[a.priority];
    if (priorityDiff !== 0) return priorityDiff;
    
    // Then by creation time (FIFO within same priority)
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}

// Enqueue a new job
function enqueueJob(job: Omit<Job, 'id' | 'createdAt' | 'status' | 'retryCount'>): Job {
  const queue = jobQueues.get(job.type);
  if (!queue) throw new Error(`Unknown job type: ${job.type}`);
  
  if (queue.length >= CONFIG.maxQueueSize) {
    throw new Error('Queue is full - please try again later');
  }
  
  // Check user's active job count
  const userJobCount = [...queue, ...activeJobs.values()].filter(j => j.userId === job.userId).length;
  if (userJobCount >= CONFIG.maxJobsPerUser) {
    throw new Error(`Maximum concurrent jobs (${CONFIG.maxJobsPerUser}) reached`);
  }
  
  const newJob: Job = {
    ...job,
    id: crypto.randomUUID(),
    status: 'queued',
    createdAt: new Date().toISOString(),
    retryCount: 0,
    maxRetries: job.maxRetries || 3,
  };
  
  queue.push(newJob);
  sortQueue(queue);
  
  console.log(`[JobQueue] Enqueued job ${newJob.id} (type=${job.type}, priority=${job.priority}, queue_size=${queue.length})`);
  
  return newJob;
}

// Dequeue next job for processing
function dequeueJob(jobType: JobType): Job | null {
  const queue = jobQueues.get(jobType);
  if (!queue || queue.length === 0) return null;
  
  // Check processing limits
  const activeCount = [...activeJobs.values()].filter(j => j.type === jobType).length;
  if (activeCount >= CONFIG.processingLimits[jobType]) {
    console.log(`[JobQueue] Processing limit reached for ${jobType} (${activeCount}/${CONFIG.processingLimits[jobType]})`);
    return null;
  }
  
  const job = queue.shift();
  if (!job) return null;
  
  job.status = 'processing';
  job.startedAt = new Date().toISOString();
  activeJobs.set(job.id, job);
  
  console.log(`[JobQueue] Dequeued job ${job.id} (type=${jobType}, remaining=${queue.length})`);
  
  return job;
}

// Complete a job
function completeJob(jobId: string, result?: unknown, error?: string): Job | null {
  const job = activeJobs.get(jobId);
  if (!job) return null;
  
  job.completedAt = new Date().toISOString();
  
  if (error) {
    job.status = 'failed';
    job.error = error;
    job.retryCount++;
    
    // Re-queue if retries remaining
    if (job.retryCount < job.maxRetries) {
      const queue = jobQueues.get(job.type);
      if (queue) {
        job.status = 'queued';
        job.startedAt = undefined;
        job.completedAt = undefined;
        queue.push(job);
        sortQueue(queue);
        console.log(`[JobQueue] Re-queued job ${jobId} (retry ${job.retryCount}/${job.maxRetries})`);
      }
    }
  } else {
    job.status = 'completed';
    job.result = result;
  }
  
  activeJobs.delete(jobId);
  
  console.log(`[JobQueue] Job ${jobId} ${job.status} (duration=${job.completedAt && job.startedAt ? new Date(job.completedAt).getTime() - new Date(job.startedAt).getTime() : 0}ms)`);
  
  return job;
}

// Get queue statistics
function getQueueStats(): {
  queues: Record<JobType, { queued: number; processing: number }>;
  totalQueued: number;
  totalProcessing: number;
  oldestJobAge: number | null;
} {
  const stats: Record<string, { queued: number; processing: number }> = {};
  let totalQueued = 0;
  let totalProcessing = 0;
  let oldestTime: number | null = null;
  const now = Date.now();
  
  for (const [type, queue] of jobQueues) {
    const processingCount = [...activeJobs.values()].filter(j => j.type === type).length;
    stats[type] = {
      queued: queue.length,
      processing: processingCount,
    };
    totalQueued += queue.length;
    totalProcessing += processingCount;
    
    for (const job of queue) {
      const jobTime = new Date(job.createdAt).getTime();
      if (oldestTime === null || jobTime < oldestTime) {
        oldestTime = jobTime;
      }
    }
  }
  
  return {
    queues: stats as Record<JobType, { queued: number; processing: number }>,
    totalQueued,
    totalProcessing,
    oldestJobAge: oldestTime ? now - oldestTime : null,
  };
}

// Process a batch of jobs
async function processBatch(
  supabaseUrl: string,
  supabaseKey: string,
  jobType: JobType,
  batchSize: number
): Promise<{ processed: number; succeeded: number; failed: number }> {
  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  
  for (let i = 0; i < batchSize; i++) {
    const job = dequeueJob(jobType);
    if (!job) break;
    
    processed++;
    
    try {
      // Route to appropriate handler
      const handlerMap: Record<JobType, string> = {
        video_generation: 'generate-single-clip',
        stitching: 'simple-stitch',
        audio_generation: 'generate-voice',
        thumbnail: 'generate-thumbnail',
      };
      
      const handler = handlerMap[jobType];
      
      const response = await fetch(`${supabaseUrl}/functions/v1/${handler}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify(job.payload),
      });
      
      if (response.ok) {
        const result = await response.json();
        completeJob(job.id, result);
        succeeded++;
      } else {
        const errorText = await response.text();
        completeJob(job.id, undefined, `Handler error: ${response.status} - ${errorText.substring(0, 100)}`);
        failed++;
      }
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      completeJob(job.id, undefined, errorMsg);
      failed++;
    }
  }
  
  return { processed, succeeded, failed };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ═══ AUTH GUARD: Prevent unauthorized job queue access ═══
    const { validateAuth, unauthorizedResponse } = await import("../_shared/auth-guard.ts");
    const auth = await validateAuth(req);
    if (!auth.authenticated) {
      return unauthorizedResponse(corsHeaders, auth.error);
    }

    const request = await req.json() as QueueRequest;
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    switch (request.action) {
      case 'enqueue': {
        if (!request.userId || !request.projectId || !request.jobType || !request.payload) {
          throw new Error('Missing required fields: userId, projectId, jobType, payload');
        }
        
        // Get user tier and check rate limit
        const tier = await getUserTier(supabaseUrl, supabaseKey, request.userId);
        const rateLimit = checkUserRateLimit(request.userId, tier);
        
        if (!rateLimit.allowed) {
          return new Response(
            JSON.stringify({
              success: false,
              error: 'Rate limit exceeded',
              retryAfter: Math.ceil(rateLimit.resetIn / 1000),
            }),
            { 
              status: 429, 
              headers: { 
                ...corsHeaders, 
                "Content-Type": "application/json",
                "Retry-After": String(Math.ceil(rateLimit.resetIn / 1000)),
              } 
            }
          );
        }
        
        const job = enqueueJob({
          type: request.jobType,
          priority: request.priority || 'normal',
          userId: request.userId,
          projectId: request.projectId,
          payload: request.payload,
          maxRetries: 3,
        });
        
        return new Response(
          JSON.stringify({
            success: true,
            job: {
              id: job.id,
              status: job.status,
              position: jobQueues.get(job.type)?.findIndex(j => j.id === job.id) ?? -1,
            },
            rateLimit: {
              remaining: rateLimit.remainingQuota,
              resetIn: Math.ceil(rateLimit.resetIn / 1000),
            },
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      case 'dequeue': {
        if (!request.jobType) {
          throw new Error('Missing jobType');
        }
        
        const job = dequeueJob(request.jobType);
        
        return new Response(
          JSON.stringify({
            success: true,
            job: job ? {
              id: job.id,
              type: job.type,
              payload: job.payload,
              userId: job.userId,
              projectId: job.projectId,
            } : null,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      case 'status': {
        if (!request.jobId) {
          throw new Error('Missing jobId');
        }
        
        // Check active jobs
        let job = activeJobs.get(request.jobId);
        
        // Check queues if not active
        if (!job) {
          for (const queue of jobQueues.values()) {
            job = queue.find(j => j.id === request.jobId);
            if (job) break;
          }
        }
        
        if (!job) {
          return new Response(
            JSON.stringify({ success: false, error: 'Job not found' }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        const queuePosition = job.status === 'queued' 
          ? jobQueues.get(job.type)?.findIndex(j => j.id === job!.id) ?? -1
          : -1;
        
        return new Response(
          JSON.stringify({
            success: true,
            job: {
              id: job.id,
              type: job.type,
              status: job.status,
              priority: job.priority,
              queuePosition,
              createdAt: job.createdAt,
              startedAt: job.startedAt,
              completedAt: job.completedAt,
              error: job.error,
              result: job.result,
            },
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      case 'cancel': {
        if (!request.jobId) {
          throw new Error('Missing jobId');
        }
        
        // Remove from queue
        for (const [type, queue] of jobQueues) {
          const idx = queue.findIndex(j => j.id === request.jobId);
          if (idx !== -1) {
            const job = queue.splice(idx, 1)[0];
            job.status = 'cancelled';
            console.log(`[JobQueue] Cancelled job ${request.jobId}`);
            
            return new Response(
              JSON.stringify({ success: true, cancelled: true }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }
        
        // Can't cancel if already processing
        if (activeJobs.has(request.jobId)) {
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: 'Cannot cancel job - already processing' 
            }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        return new Response(
          JSON.stringify({ success: false, error: 'Job not found' }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      case 'stats': {
        const stats = getQueueStats();
        
        return new Response(
          JSON.stringify({
            success: true,
            stats: {
              ...stats,
              limits: CONFIG.processingLimits,
              maxQueueSize: CONFIG.maxQueueSize,
            },
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      case 'process_batch': {
        if (!request.jobType) {
          throw new Error('Missing jobType');
        }
        
        const batchSize = request.batchSize || 5;
        const result = await processBatch(supabaseUrl, supabaseKey, request.jobType, batchSize);
        
        return new Response(
          JSON.stringify({
            success: true,
            ...result,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      default:
        throw new Error(`Unknown action: ${request.action}`);
    }

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("[JobQueue] Error:", errorMsg);

    return new Response(
      JSON.stringify({ success: false, error: errorMsg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
