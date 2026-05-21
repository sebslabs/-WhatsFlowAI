import { Redis } from 'ioredis';
import dotenv from 'dotenv';
import { logger } from '../utils/logger.js';

dotenv.config();

let _redisInstance: Redis | null = null;

export function getRedisClient(): Redis {
  if (_redisInstance) return _redisInstance;

  const url = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
  logger.info('[redis] Initializing centralized Redis client…');

  try {
    _redisInstance = new Redis(url, {
      maxRetriesPerRequest: null, // Critical for BullMQ compatibility
      enableReadyCheck: false,
      tls: url.startsWith('rediss://') ? {} : undefined,
    });

    _redisInstance.on('connect', () => {
      logger.info('[redis] Connected to server successfully');
    });

    _redisInstance.on('error', (err) => {
      logger.error('[redis] Connection error occurred', { error: err.message });
    });

    _redisInstance.on('reconnecting', () => {
      logger.warn('[redis] Reconnecting to Redis server…');
    });

    return _redisInstance;
  } catch (error: any) {
    logger.error('[redis] Exception during initialization:', { error: error.message });
    throw error;
  }
}
