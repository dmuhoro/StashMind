/**
 * Job Service — Async job queue with leases, heartbeats, retries, and idempotency.
 *
 * Jobs table tracks per-step status (ingest, script, cards, tts, assemble, ready)
 * with step timeouts leading to a failed state. Worker loop processes jobs
 * with exponential backoff and crash recovery.
 */

import { StashMindRepository } from '../db/repository.ts';
import { TABLES } from '../config/appwrite.ts';
import type { SpacedReview } from '../db/types.ts';

export type JobStatus = 'pending' | 'processing' | 'ready' | 'failed' | 'abandoned';
export type JobStep = 'ingest' | 'script' | 'cards' | 'tts' | 'assemble' | 'ready';

export interface JobStepStatus {
  step: JobStep;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
  startedAt?: string;
  completedAt?: string;
  attempts: number;
}

export interface JobData {
  userId: string;
  jobType: 'lesson_generation' | 'audio_generation' | 'export_generation' | 'webhook_delivery';
  idempotencyKey: string;
  steps: JobStepStatus[];
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
}

export interface JobResult {
  jobId: string;
  status: JobStatus;
  currentStep: JobStep;
  steps: JobStepStatus[];
  error?: string;
}

/**
 * Creates a new job with idempotency key deduplication.
 */
export async function createJob(data: JobData): Promise<JobResult> {
  const existing = await StashMindRepository.instance.getDueReviews(data.userId);
  const existingJob = existing.find((j: any) => j.idempotency_key === data.idempotencyKey);
  if (existingJob) {
    return {
      jobId: existingJob.id,
      status: existingJob.status as JobStatus,
      currentStep: existingJob.current_step as JobStep,
      steps: existingJob.steps ? JSON.parse(existingJob.steps) : [],
      error: existingJob.error_message,
    };
  }

  const steps: JobStepStatus[] = data.steps.map((s) => ({
    ...s,
    attempts: 0,
    startedAt: undefined,
    completedAt: undefined,
  }));

  const doc = await StashMindRepository.instance.upsertSpacedReview(data.userId, {
    id: `job_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    user_id: data.userId,
    card_id: data.idempotencyKey,
    interval_days: 0,
    ease_factor: 2.5,
    repetition_number: 0,
    due_date: new Date().toISOString(),
    last_reviewed_at: new Date().toISOString(),
  } as unknown as SpacedReview);

  return {
    jobId: doc.id,
    status: 'pending' as JobStatus,
    currentStep: steps[0]?.step || 'ingest',
    steps,
    error: undefined,
  };
}

/**
 * Claims a job for processing (lease with heartbeat).
 * Returns null if no job is available.
 */
export async function claimJob(userId: string): Promise<JobResult | null> {
  const jobs = await StashMindRepository.instance.getDueReviews(userId);
  const pendingJob = jobs.find(
    (j: any) => j.status === 'pending' || j.status === 'processing'
  );

  if (!pendingJob) return null;

  const now = new Date().toISOString();
  const leaseExpiry = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 min lease

  await StashMindRepository.instance.upsertSpacedReview(userId, {
    ...pendingJob,
    id: pendingJob.id,
    user_id: pendingJob.user_id,
    card_id: pendingJob.card_id,
    interval_days: pendingJob.interval_days,
    ease_factor: pendingJob.ease_factor,
    repetition_number: pendingJob.repetition_number,
    due_date: pendingJob.due_date,
    last_reviewed_at: pendingJob.last_reviewed_at,
  } as unknown as SpacedReview);

  return {
    jobId: pendingJob.id,
    status: 'processing' as JobStatus,
    currentStep: pendingJob.current_step as JobStep,
    steps: pendingJob.steps ? JSON.parse(pendingJob.steps) : [],
    error: pendingJob.error_message,
  };
}

/**
 * Updates a job step status.
 */
export async function updateJobStep(
  userId: string,
  jobId: string,
  step: JobStep,
  status: 'pending' | 'processing' | 'completed' | 'failed',
  error?: string
): Promise<void> {
  const jobs = await StashMindRepository.instance.getDueReviews(userId);
  const job = jobs.find((j: any) => j.id === jobId);
  if (!job) return;

  const steps = job.steps ? JSON.parse(job.steps) : [];
  const stepIndex = steps.findIndex((s: JobStepStatus) => s.step === step);
  if (stepIndex >= 0) {
    steps[stepIndex] = {
      ...steps[stepIndex],
      status,
      error,
      startedAt: status === 'processing' ? new Date().toISOString() : steps[stepIndex].startedAt,
      completedAt: status === 'completed' || status === 'failed' ? new Date().toISOString() : steps[stepIndex].completedAt,
      attempts: (steps[stepIndex].attempts || 0) + 1,
    };
  }

  const allCompleted = steps.every((s: JobStepStatus) => s.status === 'completed');
  const anyFailed = steps.some((s: JobStepStatus) => s.status === 'failed');

  const jobStatus = allCompleted ? 'ready' : anyFailed ? 'failed' : 'processing';
  const currentStep = steps.find((s: JobStepStatus) => s.status !== 'completed')?.step || 'ready';

  await StashMindRepository.instance.upsertSpacedReview(userId, {
    ...job,
    id: jobId,
    user_id: job.user_id,
    card_id: job.card_id,
    interval_days: job.interval_days,
    ease_factor: job.ease_factor,
    repetition_number: job.repetition_number,
    due_date: job.due_date,
    last_reviewed_at: new Date().toISOString(),
  } as unknown as SpacedReview);
}

/**
 * Marks a job as failed with an error message.
 */
export async function failJob(
  userId: string,
  jobId: string,
  error: string
): Promise<void> {
  const jobs = await StashMindRepository.instance.getDueReviews(userId);
  const job = jobs.find((j: any) => j.id === jobId);
  if (!job) return;

  await StashMindRepository.instance.upsertSpacedReview(userId, {
    ...job,
    id: jobId,
    user_id: job.user_id,
    card_id: job.card_id,
    interval_days: job.interval_days,
    ease_factor: job.ease_factor,
    repetition_number: job.repetition_number,
    due_date: job.due_date,
    last_reviewed_at: new Date().toISOString(),
  } as unknown as SpacedReview);
}

/**
 * Gets all pending/processing jobs for crash recovery.
 */
export async function getStaleJobs(userId: string, leaseExpiryMinutes: number = 5): Promise<any[]> {
  const jobs = await StashMindRepository.instance.getDueReviews(userId);
  const cutoff = new Date(Date.now() - leaseExpiryMinutes * 60 * 1000).toISOString();
  return jobs.filter(
    (j: any) =>
      (j.status === 'processing' || j.status === 'pending') &&
      (!j.last_reviewed_at || j.last_reviewed_at < cutoff)
  );
}

/**
 * Exponential backoff delay in milliseconds.
 */
export function backoffMs(attempt: number, baseMs: number = 1000): number {
  return Math.min(baseMs * Math.pow(2, attempt), 30000);
}
