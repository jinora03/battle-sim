import type { ReplayExportSource, ReplayVideoExportCameraSettings, VideoExportFrameRate } from './types';
import type { CreatorBattleHighlight } from './types';
import type { SimulationEvent, Vec2 } from '@kinetic/protocol';
import { ReplayFrameStepper } from './replayFrameStepper';
import { scoreCreatorHighlightEvent } from './creatorHighlightScoring';

const SIM_TICK_RATE = 60;
const MIN_FOCUS_SCORE = 700;
const MIN_SLOW_MOTION_SCORE = 760;
const MIN_MOMENT_SPACING_TICKS = 150;
const FINAL_KNOCKOUT_GUARD_TICKS = 75;
const FOCUS_LEAD_TICKS = 24;
const FOCUS_TRAIL_TICKS = 36;

export interface CinematicHighlightCandidate {
  tick: number;
  kind: Exclude<CreatorBattleHighlight['kind'], 'knockout'>;
  score: number;
  position: Vec2 | null;
}

export interface CinematicHighlightMoment extends CinematicHighlightCandidate {
  intensity: number;
  focusStartTick: number;
  focusEndTick: number;
  slowMotionStartTick: number | null;
  slowMotionEndTick: number | null;
}

export interface CinematicHighlightPlan {
  moments: readonly CinematicHighlightMoment[];
  fps: VideoExportFrameRate;
  endTick: number;
  extraFrames: number;
  addedSeconds: number;
}

export interface CinematicHighlightFocus {
  tick: number;
  kind: CinematicHighlightMoment['kind'];
  score: number;
  intensity: number;
  progress: number;
  position: Vec2 | null;
  slowMotion: boolean;
}

/**
 * Replay-only prepass. It replays deterministic commands in an isolated runner
 * to discover presentation moments; it never feeds camera/highlight state back
 * into gameplay or the live renderer.
 */
export async function buildCinematicHighlightPlan(
  source: ReplayExportSource,
  camera: ReplayVideoExportCameraSettings,
  fps: VideoExportFrameRate,
  signal?: AbortSignal
): Promise<CinematicHighlightPlan> {
  if (camera.mode !== 'cinematic' || camera.maxHighlightSlowMotionMoments <= 0) {
    return emptyPlan(source.endTick, fps);
  }

  const stepper = new ReplayFrameStepper(source.replay, source.endTick, 60);
  const candidates: CinematicHighlightCandidate[] = [];
  let scannedFrames = 0;

  while (!stepper.done) {
    if (signal?.aborted) throw createCancelledError();
    const frame = stepper.next();
    if (!frame) break;
    collectCandidates(frame.events, candidates);
    scannedFrames += 1;
    if (scannedFrames % 900 === 0) await yieldToBrowser();
  }

  return createCinematicHighlightPlan(
    candidates,
    source.endTick,
    camera,
    fps
  );
}

export function createCinematicHighlightPlan(
  candidates: readonly CinematicHighlightCandidate[],
  endTick: number,
  camera: ReplayVideoExportCameraSettings,
  fps: VideoExportFrameRate
): CinematicHighlightPlan {
  if (camera.mode !== 'cinematic' || camera.maxHighlightSlowMotionMoments <= 0 || endTick <= 0) {
    return emptyPlan(endTick, fps);
  }

  const shortBattleLimit = endTick < 600 ? 1 : camera.maxHighlightSlowMotionMoments;
  const selected: CinematicHighlightCandidate[] = [];
  const ordered = candidates
    .filter((candidate) => candidate.score >= MIN_FOCUS_SCORE)
    .filter((candidate) => candidate.tick < Math.max(1, endTick - FINAL_KNOCKOUT_GUARD_TICKS))
    .slice()
    .sort((left, right) => right.score - left.score || left.tick - right.tick || compareKinds(left.kind, right.kind));

  for (const candidate of ordered) {
    if (selected.length >= shortBattleLimit) break;
    if (selected.some((current) => Math.abs(current.tick - candidate.tick) < MIN_MOMENT_SPACING_TICKS)) continue;
    selected.push(candidate);
  }

  selected.sort((left, right) => left.tick - right.tick || right.score - left.score);
  let remainingSlowMotionMoments = camera.maxHighlightSlowMotionMoments;
  const slowWindowTicks = Math.max(0, Math.round(camera.highlightSlowMotionSeconds * SIM_TICK_RATE));
  const moments: CinematicHighlightMoment[] = selected.map((candidate) => {
    const eligibleForSlowMotion = candidate.score >= MIN_SLOW_MOTION_SCORE
      && slowWindowTicks > 0
      && remainingSlowMotionMoments > 0;
    if (eligibleForSlowMotion) remainingSlowMotionMoments -= 1;
    const leadTicks = Math.floor(slowWindowTicks * 0.25);
    const slowStart = eligibleForSlowMotion ? Math.max(1, candidate.tick - leadTicks) : null;
    const slowEnd = eligibleForSlowMotion
      ? Math.min(endTick, (slowStart ?? candidate.tick) + slowWindowTicks - 1)
      : null;
    return {
      ...candidate,
      intensity: clamp01((candidate.score - 620) / 980),
      focusStartTick: Math.max(1, candidate.tick - FOCUS_LEAD_TICKS),
      focusEndTick: Math.min(endTick, candidate.tick + FOCUS_TRAIL_TICKS),
      slowMotionStartTick: slowStart,
      slowMotionEndTick: slowEnd
    };
  });

  const extraFrames = calculateCinematicHighlightExtraFrames({
    moments,
    fps,
    endTick,
    extraFrames: 0,
    addedSeconds: 0
  });
  return {
    moments,
    fps,
    endTick,
    extraFrames,
    addedSeconds: extraFrames / fps
  };
}

export function getCinematicHighlightFocus(
  plan: CinematicHighlightPlan,
  tick: number
): CinematicHighlightFocus | null {
  const moment = plan.moments.find((candidate) => tick >= candidate.focusStartTick && tick <= candidate.focusEndTick);
  if (!moment) return null;
  const span = Math.max(1, moment.focusEndTick - moment.focusStartTick);
  const progress = clamp01((tick - moment.focusStartTick) / span);
  return {
    tick: moment.tick,
    kind: moment.kind,
    score: moment.score,
    intensity: moment.intensity,
    progress,
    position: moment.position,
    slowMotion: isTickInSlowMotionMoment(moment, tick)
  };
}

export function isCinematicHighlightSlowMotionFrame(
  plan: CinematicHighlightPlan,
  frameEndTick: number
): boolean {
  return plan.moments.some((moment) => isTickInSlowMotionMoment(moment, frameEndTick));
}

export function calculateCinematicHighlightExtraFrames(plan: CinematicHighlightPlan): number {
  if (plan.moments.length === 0 || plan.endTick <= 0) return 0;
  return plan.moments.reduce(
    (sum, moment) => sum + countSlowMotionFrames(plan, moment, Number.POSITIVE_INFINITY),
    0
  );
}

/** Added presentation time before a simulation event at `tick`. */
export function cinematicHighlightOffsetSecondsAtTick(
  plan: CinematicHighlightPlan,
  tick: number
): number {
  if (plan.extraFrames <= 0 || tick <= 0) return 0;
  const duplicatedFrames = plan.moments.reduce(
    (sum, moment) => sum + countSlowMotionFrames(plan, moment, tick),
    0
  );
  return duplicatedFrames / plan.fps;
}

function collectCandidates(
  events: readonly SimulationEvent[],
  candidates: CinematicHighlightCandidate[]
): void {
  const bestByTick = new Map<number, CinematicHighlightCandidate>();
  for (const event of events) {
    const signal = scoreCreatorHighlightEvent(event);
    if (!signal || signal.kind === 'knockout') continue;
    const candidate: CinematicHighlightCandidate = {
      tick: signal.tick,
      kind: signal.kind,
      score: signal.score,
      position: signal.position
    };
    const current = bestByTick.get(candidate.tick);
    if (!current || candidate.score > current.score) bestByTick.set(candidate.tick, candidate);
  }
  candidates.push(...bestByTick.values());
}

function countSlowMotionFrames(
  plan: CinematicHighlightPlan,
  moment: CinematicHighlightMoment,
  beforeTick: number
): number {
  if (moment.slowMotionStartTick === null || moment.slowMotionEndTick === null) return 0;
  const ticksPerFrame = SIM_TICK_RATE / plan.fps;
  const upperTick = Math.min(plan.endTick, moment.slowMotionEndTick, beforeTick - 1);
  if (upperTick < moment.slowMotionStartTick) return 0;

  const firstRegularFrameEnd = Math.ceil(moment.slowMotionStartTick / ticksPerFrame) * ticksPerFrame;
  const lastRegularFrameEnd = Math.min(
    Math.floor(plan.endTick / ticksPerFrame) * ticksPerFrame,
    Math.floor(upperTick / ticksPerFrame) * ticksPerFrame
  );
  let count = lastRegularFrameEnd >= firstRegularFrameEnd
    ? Math.floor((lastRegularFrameEnd - firstRegularFrameEnd) / ticksPerFrame) + 1
    : 0;

  const partialFinalFrameEnd = plan.endTick % ticksPerFrame === 0 ? null : plan.endTick;
  if (partialFinalFrameEnd !== null
    && partialFinalFrameEnd >= moment.slowMotionStartTick
    && partialFinalFrameEnd <= upperTick
    && partialFinalFrameEnd > lastRegularFrameEnd) count += 1;
  return count;
}

function isTickInSlowMotionMoment(moment: CinematicHighlightMoment, tick: number): boolean {
  return moment.slowMotionStartTick !== null
    && moment.slowMotionEndTick !== null
    && tick >= moment.slowMotionStartTick
    && tick <= moment.slowMotionEndTick;
}

function emptyPlan(endTick: number, fps: VideoExportFrameRate): CinematicHighlightPlan {
  return { moments: [], fps, endTick, extraFrames: 0, addedSeconds: 0 };
}

function compareKinds(left: CinematicHighlightCandidate['kind'], right: CinematicHighlightCandidate['kind']): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

function createCancelledError(): Error {
  const error = new Error('Cinematic highlight analysis was cancelled.');
  error.name = 'AbortError';
  return error;
}

async function yieldToBrowser(): Promise<void> {
  const schedulerApi = (globalThis as typeof globalThis & { scheduler?: { yield?: () => Promise<void> } }).scheduler;
  if (schedulerApi?.yield) {
    await schedulerApi.yield();
    return;
  }
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
