import { Queue } from 'bullmq'
import { Redis } from 'ioredis'

export interface BaileysJobData {
  tenantId: string
  sessionId: string
  sendJid: string
  rawJid: string
  messageId: string
  phone: string
  pushName: string | null
  text: string
  fromMe: boolean
  rawMessage?: any
}

const QUEUE_NAME = 'baileys-incoming'

function createRedisConnection(): Redis {
  const url = process.env.REDIS_URL ?? 'redis://localhost:6379'
  return new Redis(url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    tls: url.startsWith('rediss://') ? {} : undefined,
  })
}

let _queue: Queue<BaileysJobData> | null = null

export function getBaileysQueue(): Queue<BaileysJobData> {
  if (_queue) return _queue

  const connection = createRedisConnection()

  _queue = new Queue<BaileysJobData>(QUEUE_NAME, {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000, // Starts at 2 seconds, backoff up to 8s
      },
      // OPTIMIZATION: Reduced from count:500 each.
      // Large job histories are the primary source of Redis key bloat.
      removeOnComplete: { count: 50,  age: 3_600  },
      removeOnFail:     { count: 20,  age: 86_400 },
    },
  })
  return _queue
}

export { QUEUE_NAME }
