import { Worker, type Job } from 'bullmq';
import { Redis } from 'ioredis';
import { createClient } from '@supabase/supabase-js';
import { FLOW_QUEUE_NAME, type ResumeFlowJobPayload } from './flow-queue';
import { WhatsAppFlowEngine } from './whatsapp-flow';
import { getConnectedSession } from './whatsapp-qr';
import { logger } from './logger';

function createRedisConnection(): Redis {
  const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
  return new Redis(url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    tls: url.startsWith('rediss://') ? {} : undefined,
  });
}

const globalForFlowWorker = global as unknown as {
  flowResumeWorker?: Worker<ResumeFlowJobPayload>;
};

async function processResumeFlowJob(job: Job<ResumeFlowJobPayload>): Promise<void> {
  if (job.name !== 'resume-flow') return;

  const { tenantId, contactId, conversationId, flowId, stepIndex } = job.data;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    logger.error('[FlowWorker] Supabase credentials missing — cannot resume flow');
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const session = await getConnectedSession(tenantId);
  if (!session?.sock) {
    logger.warn({ tenantId, flowId, stepIndex }, '[FlowWorker] No connected Baileys session — skipping resume');
    return;
  }

  logger.info({ tenantId, flowId, stepIndex, jobId: job.id }, '[FlowWorker] Resuming flow after delay');

  await WhatsAppFlowEngine.processFlow(
    supabase,
    tenantId,
    contactId,
    conversationId,
    '',
    flowId,
    stepIndex,
    session.sock
  );
}

export function startFlowResumeWorker(): Worker<ResumeFlowJobPayload> {
  if (globalForFlowWorker.flowResumeWorker) {
    return globalForFlowWorker.flowResumeWorker;
  }

  if (process.env.SKIP_REDIS === 'true') {
    return new Proxy({} as Worker<ResumeFlowJobPayload>, {
      get(_, prop) {
        return () => {
          console.warn(`[Redis Skipped] Attempted to access Worker.${String(prop)} during build`);
        };
      }
    });
  }

  const worker = new Worker<ResumeFlowJobPayload>(FLOW_QUEUE_NAME, processResumeFlowJob, {
    connection: createRedisConnection(),
    concurrency: 5,
  });

  worker.on('failed', (job, err) => {
    logger.error(
      { jobId: job?.id, flowId: job?.data.flowId, err: err.message },
      '[FlowWorker] resume-flow job failed'
    );
  });

  globalForFlowWorker.flowResumeWorker = worker;
  logger.info({ queue: FLOW_QUEUE_NAME }, '[FlowWorker] resume-flow processor started');
  return worker;
}
