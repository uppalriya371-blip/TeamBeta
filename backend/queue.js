import { Queue } from 'bullmq';
import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const connection = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null,
});

connection.on('error', (err) => {
  console.error('[Queue] Redis connection error:', err.message);
});

connection.on('connect', () => {
  console.log('[Queue] Redis connected.');
});

export const redisConnection = connection;

export const scanQueue = new Queue('scan-queue', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
});

console.log('[Queue] BullMQ Scan Queue initialized.');
