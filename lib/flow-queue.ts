import { Queue } from 'bullmq';
import { Redis } from 'ioredis';

export interface ResumeFlowJobPayload {
  tenantId: string;
  contactId: string;
  conversationId: string;
  flowId: string;
  stepIndex: number;
}

export const FLOW_QUEUE_NAME = 'whatsapp-flows';

function createRedisConnection(): Redis {
  const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
  return new Redis(url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    tls: url.startsWith('rediss://') ? {} : undefined,
  });
}

let _flowQueue: Queue<ResumeFlowJobPayload> | null = null;

export function getFlowQueue(): Queue<ResumeFlowJobPayload> {
  if (_flowQueue) return _flowQueue;

  if (process.env.SKIP_REDIS === 'true') {
    return new Proxy({} as Queue<ResumeFlowJobPayload>, {
      get(_, prop) {
        return () => {
          console.warn(`[Redis Skipped] Attempted to access Queue.${String(prop)} during build`);
        };
      }
    });
  }

  _flowQueue = new Queue<ResumeFlowJobPayload>(FLOW_QUEUE_NAME, {
    connection: createRedisConnection(),
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      // OPTIMIZATION: Reduced from count:500 each.
      removeOnComplete: { count: 50,  age: 3_600  },
      removeOnFail:     { count: 20,  age: 86_400 },
    },
  });

  return _flowQueue;
}

/** Lazy accessor — avoids opening a Redis connection until a delay step runs. */
export function flowQueue() {
  return getFlowQueue();
}
