// ═══════════════════════════════════════════════════════════════════════════
// effect-executor — runs an EffectPlan DAG, one budget-slice per invocation.
//
// The Effect Compiler's runtime: stages execute sequentially against the tool
// registry; media outputs persist to storage; the Critic (vision) checks each
// stage's assertions; failures retry the FAILED STAGE with a seed bump and the
// critic's fix hint appended to the prompt. Long generations survive edge
// wall-clock limits by persisting the pending prediction id and self-invoking.
//
// POST { plan } | { recipeSlug, overrides? } | { runId }  (service-role or owner)
// → { runId, status, finalUrl? }
// ═══════════════════════════════════════════════════════════════════════════

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { publicErrorMessage } from '../_shared/safe-error.ts';
import { validateEffectPlan, resolveInputs, type EffectPlan, type EffectStage } from '../_shared/effect-plan.ts';
import { invokeTool, resumeToolPrediction, PendingPrediction, setStageBudget, type ToolResult } from '../_shared/effect-tools.ts';
import { preflightAiGate, chargeAiGate } from '../_shared/ai-credit-gate.ts';
import { buildBreakoutPlan } from '../_shared/breakout-plan-builder.ts';

// Flat price for one effect run, sized to WORST-CASE bounded spend (2 seedance
// clips + 1 budgeted video retry + images/critic/ffmpeg ≈ $8 COGS) so the 30%
// margin holds even when the retry fires. Reprice deliberately, not casually.
const EFFECT_RUN_COST_CREDITS = 150;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

interface RunState {
  stageIdx: number;
  outputs: Record<string, Record<string, unknown>>;
  attempts: Record<string, number>;
  pending: { stageId: string; predictionId: string } | null;
  critic: Record<string, unknown>;
}

function admin() {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
}

/** Fire-and-forget self-invocation to continue a run. */
function continueRun(runId: string) {
  fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/effect-executor`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
    },
    body: JSON.stringify({ runId }),
  }).catch((e) => console.warn('[effect-executor] continuation fire failed:', e));
}

/** Run the Critic on a completed stage's assertions. Returns null on pass. */
async function runCritic(
  plan: EffectPlan,
  stage: EffectStage,
  out: ToolResult,
  outputs: RunState['outputs'],
  runId: string,
): Promise<{ failures: string[]; fixHint: string; advisoryOnly: boolean } | null> {
  if (!stage.assertions?.length || !out.url) return null;
  const url = String(out.url);
  const isVideo = /\.mp4(\?|$)/i.test(url);
  const failures: string[] = [];
  let fixHint = '';
  let anyBlocking = false;
  for (const a of stage.assertions) {
    // Sample frames for video, or use the image directly.
    let images: string[] = [url];
    if (isVideo) {
      const frames: string[] = [];
      for (const pos of ['first', 'last'] as const) {
        try {
          const f = await invokeTool('frame.extract', { video: url, position: pos }, runId, `${stage.id}_qc_${pos}`);
          if (f.url) frames.push(String(f.url));
        } catch (_e) { /* sampling is best-effort */ }
      }
      if (frames.length) images = frames;
    }
    if (a.referenceKey && outputs[a.referenceKey]?.url) images.push(String(outputs[a.referenceKey].url));

    const contract =
      `ASSERTION (${a.kind}): ${a.contract}\n` +
      (a.region ? `Locked region (normalized x,y,w,h): ${a.region.join(', ')}. The FIRST images are frames from the clip in time order` : 'Images are frames from the clip in time order') +
      (a.referenceKey ? '; the LAST image is the reference.' : '.') +
      `\nJudge strictly. pass=false if the contract is visibly violated.`;
    const verdict = await invokeTool('critic.vision', { contract, images }, runId, `${stage.id}_critic`);
    if (!verdict.pass) {
      // Severity: physics judgments from still frames are unreliable →
      // ADVISORY by default on video (flag, don't burn a regeneration).
      const advisory = a.severity === 'advisory' ||
        (a.severity !== 'blocking' && a.kind === 'physics_plausible' && isVideo);
      failures.push(...(((verdict.failures as string[]) ?? [a.contract]).map((f) => `${advisory ? '[advisory] ' : ''}${f}`)));
      if (!fixHint) fixHint = String(verdict.fix_hint ?? '');
      if (!advisory) anyBlocking = true;
    }
  }
  if (!failures.length) return null;
  return { failures, fixHint, advisoryOnly: !anyBlocking };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabase = admin();
  let runId: string | undefined;
  let runUserId: string | null = null;
  let runProjectId: string | null = null;
  try {
    const { validateAuth, unauthorizedResponse } = await import('../_shared/auth-guard.ts');
    const auth = await validateAuth(req);
    if (!auth.authenticated) return unauthorizedResponse(corsHeaders, auth.error);

    const body = await req.json();

    // ── Resolve or create the run ────────────────────────────────────────
    let plan: EffectPlan;
    let state: RunState;
    if (body.runId) {
      runId = String(body.runId);
      const { data: run } = await supabase.from('effect_runs').select('*').eq('id', runId).maybeSingle();
      if (!run) return json(404, { error: 'run not found' });
      // Ownership: users may only touch their own runs (service = continuations).
      if (!auth.isServiceRole && run.user_id !== auth.userId) return json(403, { error: 'not your run' });
      if (run.status !== 'running') return json(200, { runId, status: run.status, finalUrl: run.final_url });
      plan = run.plan as EffectPlan;
      state = run.state as RunState;
      runUserId = (run.user_id as string) ?? null;
      runProjectId = (run.project_id as string) ?? null;
    } else {
      // Raw plans are INTERNAL ONLY: an arbitrary plan could chain unlimited
      // paid generations for a flat charge. Users go through breakout params
      // or a seeded recipe, both of which price deterministically.
      let rawPlan = auth.isServiceRole ? body.plan : undefined;
      if (body.plan && !auth.isServiceRole) return json(403, { error: 'custom plans are internal — use breakout params or a recipeSlug' });
      let dynamicCost: number | null = null;
      // Studio path: user story params → compiled plan + scaled price.
      if (!rawPlan && body.breakout) {
        try {
          const built = buildBreakoutPlan(body.breakout);
          rawPlan = built.plan;
          dynamicCost = built.costCredits;
        } catch (e) {
          return json(400, { error: e instanceof Error ? e.message : 'invalid breakout params' });
        }
      }
      if (!rawPlan && body.recipeSlug) {
        const { data: recipe } = await supabase.from('effect_recipes').select('plan').eq('slug', body.recipeSlug).maybeSingle();
        if (!recipe) return json(404, { error: `recipe ${body.recipeSlug} not found` });
        rawPlan = recipe.plan;
      }
      const v = validateEffectPlan(rawPlan);
      if (!v.ok) return json(400, { error: 'invalid plan', details: v.errors });
      plan = v.plan;
      // ── CREDIT GATE (new runs only; continuations are service-role) ────
      const blocked = await preflightAiGate({
        supabase,
        fnName: 'effect-executor',
        userId: auth.userId ?? null,
        isServiceRole: auth.isServiceRole ?? false,
        projectId: body.projectId ?? null,
        cost: dynamicCost ?? EFFECT_RUN_COST_CREDITS,
        dailyCap: 20,
        corsHeaders,
      });
      if (blocked) return blocked;
      state = { stageIdx: 0, outputs: {}, attempts: {}, pending: null, critic: {} } as RunState & { costCredits?: number };
      (state as { costCredits?: number }).costCredits = dynamicCost ?? EFFECT_RUN_COST_CREDITS;
      const { data: created, error } = await supabase
        .from('effect_runs')
        .insert({ user_id: auth.userId, project_id: body.projectId ?? null, recipe_slug: plan.id, plan, state })
        .select('id')
        .maybeSingle();
      if (error || !created) throw new Error(`run insert failed: ${error?.message}`);
      runId = created.id as string;
      runUserId = auth.userId ?? null;
      runProjectId = (body.projectId as string) ?? null;
    }

    const save = async (patch: Partial<{ state: RunState; status: string; final_url: string; error: string }>) => {
      await supabase.from('effect_runs').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', runId!);
    };

    // ── RESPOND EARLY, WORK IN BACKGROUND ────────────────────────────────
    // The API gateway idle-times out at 150s; a multi-stage DAG cannot hold
    // the connection. Schedule the slice with waitUntil and return 202 —
    // each slice self-invokes the next until the run completes.
    // deno-lint-ignore no-explicit-any
    (globalThis as any).EdgeRuntime?.waitUntil?.(processSlice()) ?? processSlice();
    return json(202, { runId, status: 'running', stage: plan.stages[state.stageIdx]?.id ?? null });

    async function processSlice(): Promise<void> {
      try {
    // ── Execute stages within this invocation's budget ───────────────────
    const INVOCATION_BUDGET = 250_000;
    const started = Date.now();

    while (state.stageIdx < plan.stages.length) {
      const remaining = INVOCATION_BUDGET - (Date.now() - started);
      if (remaining < 30_000) {
        await save({ state });
        continueRun(runId!);
        return;
      }
      setStageBudget(Math.min(240_000, remaining - 20_000));

      const stage = plan.stages[state.stageIdx];
      console.log(`[effect-executor] run=${runId} stage ${state.stageIdx + 1}/${plan.stages.length}: ${stage.id} (${stage.tool})`);

      let out: ToolResult;
      try {
        if (state.pending?.stageId === stage.id) {
          out = await resumeToolPrediction(stage.tool, state.pending.predictionId, runId, stage.id);
          state.pending = null;
        } else {
          const attempts = state.attempts[stage.id] ?? 0;
          const resolved = resolveInputs(stage.inputs, state.outputs);
          // Retry adjustments: bump seed + append the critic's fix hint.
          if (attempts > 0) {
            if (typeof resolved.seed === 'number') resolved.seed = Math.floor(Math.random() * 2147483647);
            const hint = (state.critic[stage.id] as { fixHint?: string } | undefined)?.fixHint;
            if (hint && typeof resolved.prompt === 'string') resolved.prompt = `${resolved.prompt}\n\nCORRECTION (previous attempt failed QC): ${hint}`;
          }
          out = await invokeTool(stage.tool, resolved, runId, `${stage.id}${attempts > 0 ? `_r${attempts}` : ''}`);
        }
      } catch (e) {
        if (e instanceof PendingPrediction) {
          state.pending = { stageId: stage.id, predictionId: e.predictionId };
          await save({ state });
          continueRun(runId!);
          return;
        }
        const attempts = (state.attempts[stage.id] ?? 0) + 1;
        state.attempts[stage.id] = attempts;
        if (attempts <= (stage.maxRetries ?? 1)) {
          console.warn(`[effect-executor] stage ${stage.id} errored (attempt ${attempts}) — retrying:`, e instanceof Error ? e.message : e);
          await save({ state });
          continue; // retry same stage
        }
        await save({ status: 'failed', error: `${stage.id}: ${e instanceof Error ? e.message : String(e)}`, state });
        console.error(`[effect-executor] run=${runId} FAILED at ${stage.id}`);
        return;
      }

      // ── Critic gate ─────────────────────────────────────────────────────
      const verdict = await runCritic(plan, stage, out, state.outputs, runId);
      if (verdict) {
        state.critic[stage.id] = { pass: false, ...verdict };
        // CREDIT GUARD: advisory-only failures never regenerate — flag and move on.
        // Video regenerations are the expensive kind: hard-cap ONE video retry
        // per RUN regardless of per-stage maxRetries.
        const isVideoStage = stage.tool.startsWith('video.');
        const videoRetriesUsed = Object.entries(state.attempts)
          .filter(([sid]) => plan.stages.find((st) => st.id === sid)?.tool.startsWith('video.'))
          .reduce((acc, [, n]) => acc + (n as number), 0);
        const canRetry = !verdict.advisoryOnly &&
          (!isVideoStage || videoRetriesUsed < 1);
        if (canRetry) {
          const attempts = (state.attempts[stage.id] ?? 0) + 1;
          state.attempts[stage.id] = attempts;
          if (attempts <= (stage.maxRetries ?? 1)) {
            console.warn(`[effect-executor] stage ${stage.id} failed QC (${verdict.failures.join('; ')}) — retrying with fix hint`);
            await save({ state });
            continue;
          }
        }
        console.warn(`[effect-executor] stage ${stage.id} QC: ${verdict.advisoryOnly ? 'advisory-only — accepting with flag (no regen)' : 'accepting with flag (retry budget spent)'}`);
      } else {
        state.critic[stage.id] = { pass: true };
      }

      state.outputs[stage.id] = out as Record<string, unknown>;
      state.stageIdx += 1;
      await save({ state });
    }

    const finalUrl = String(state.outputs[plan.finalStage]?.url ?? '');
    await save({ status: 'completed', final_url: finalUrl, state });
    // Charge on success, once (idempotency key = runId collapses any retry).
    await chargeAiGate({
      supabase,
      fnName: 'effect-executor',
      userId: runUserId,
      projectId: runProjectId,
      cost: (state as { costCredits?: number }).costCredits ?? EFFECT_RUN_COST_CREDITS,
      dailyCap: 20,
      idempotencyKey: `effect-run-${runId}`,
      corsHeaders,
    });
    // LIBRARY DELIVERY: the finished film lands in the user's projects so it
    // appears in their library/Reel like any other creation.
    if (runUserId && finalUrl) {
      const { error: projErr } = await supabase.from('movie_projects').insert({
        user_id: runUserId,
        title: plan.name ?? 'Breakout',
        genre: 'funny',
        story_structure: 'three_act',
        target_duration_minutes: 1,
        include_narration: false,
        status: 'completed',
        video_url: finalUrl,
        synopsis: plan.intent ?? null,
      });
      if (projErr) console.warn('[effect-executor] library delivery failed:', projErr.message);
    }
    console.log(`[effect-executor] run=${runId} COMPLETED → ${finalUrl}`);
      } catch (e) {
        console.error('[effect-executor] slice fatal:', e);
        await save({ status: 'failed', error: String(e).slice(0, 500) });
      }
    }
  } catch (e) {
    console.error('[effect-executor] fatal:', e);
    if (runId) await admin().from('effect_runs').update({ status: 'failed', error: String(e).slice(0, 500) }).eq('id', runId);
    return json(500, { error: publicErrorMessage(e), runId });
  }
});
