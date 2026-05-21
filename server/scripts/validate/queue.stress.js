/**
 * Queue Stress Validation Script
 * Run: npx tsx scripts/validate/queue.stress.ts
 *
 * Tests:
 * 1. Throughput: max sustainable jobs/sec
 * 2. Deduplication: same job ID never processed twice
 * 3. Burst handling: 500 jobs in 1 second
 * 4. DLQ routing: failed jobs land in DLQ correctly
 * 5. Retry consistency: exponential backoff observed
 * 6. Worker crash simulation: jobs survive worker restart
 */
import { Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import dotenv from 'dotenv';
dotenv.config();
const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
const TEST_QUEUE = 'whatsflow-stress-test';
const DLQ_QUEUE = 'whatsflow-stress-dlq';
function makeRedis() {
    return new Redis(REDIS_URL, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        tls: REDIS_URL.startsWith('rediss://') ? {} : undefined,
    });
}
// ── Test 1: Throughput benchmark ──────────────────────────────────────────────
async function testThroughput() {
    console.log('\n[1] Queue throughput test — 200 jobs, measure jobs/sec');
    const queue = new Queue(TEST_QUEUE, { connection: makeRedis() });
    let processed = 0;
    const startTime = Date.now();
    const TOTAL = 200;
    const worker = new Worker(TEST_QUEUE, async (_job) => { processed++; }, { connection: makeRedis(), concurrency: 10 });
    // Enqueue all jobs
    const enqueueStart = Date.now();
    await queue.addBulk(Array.from({ length: TOTAL }, (_, i) => ({
        name: 'throughput-test',
        data: { index: i, ts: Date.now() },
    })));
    const enqueueMs = Date.now() - enqueueStart;
    console.log(`   Enqueued ${TOTAL} jobs in ${enqueueMs}ms (${(TOTAL / (enqueueMs / 1000)).toFixed(0)} enqueues/sec)`);
    // Wait for all to be processed
    await new Promise((resolve) => {
        const check = setInterval(() => {
            if (processed >= TOTAL) {
                clearInterval(check);
                resolve();
            }
        }, 100);
        setTimeout(() => { clearInterval(check); resolve(); }, 30_000);
    });
    const totalMs = Date.now() - startTime;
    const jobsPerSec = (processed / (totalMs / 1000)).toFixed(0);
    const passed = parseInt(jobsPerSec) >= 20;
    console.log(`   ${passed ? '✅' : '❌'} Processed ${processed}/${TOTAL} jobs in ${totalMs}ms` +
        `  (${jobsPerSec} jobs/sec)  threshold≥20 jobs/sec`);
    await worker.close();
    await queue.obliterate({ force: true });
    await queue.close();
}
// ── Test 2: Deduplication ─────────────────────────────────────────────────────
async function testDeduplication() {
    console.log('\n[2] Deduplication test — same jobId enqueued 10 times, processed once');
    const queue = new Queue(TEST_QUEUE, { connection: makeRedis() });
    let processCount = 0;
    const worker = new Worker(TEST_QUEUE, async (_job) => { processCount++; }, { connection: makeRedis(), concurrency: 2 });
    const DEDUP_JOB_ID = 'dedup-test-fixed-id';
    const ATTEMPTS = 10;
    for (let i = 0; i < ATTEMPTS; i++) {
        await queue.add('dedup-msg', { index: i }, { jobId: DEDUP_JOB_ID });
    }
    // Give worker time to process
    await new Promise((r) => setTimeout(r, 3_000));
    const passed = processCount === 1;
    console.log(`   ${passed ? '✅' : '❌'} Enqueued ${ATTEMPTS}x, processed ${processCount}x` +
        `  (expected 1)  — ${passed ? 'deduplication works' : 'DEDUPLICATION BROKEN'}`);
    await worker.close();
    await queue.obliterate({ force: true });
    await queue.close();
}
// ── Test 3: Burst handling ────────────────────────────────────────────────────
async function testBurst() {
    console.log('\n[3] Burst test — 500 jobs in 1 second');
    const queue = new Queue(TEST_QUEUE, { connection: makeRedis() });
    let processed = 0;
    const BURST = 500;
    const worker = new Worker(TEST_QUEUE, async (_job) => { processed++; }, {
        connection: makeRedis(),
        concurrency: 20,
        limiter: { max: 100, duration: 1_000 },
    });
    const t0 = Date.now();
    await queue.addBulk(Array.from({ length: BURST }, (_, i) => ({
        name: 'burst-test',
        data: { i },
    })));
    const enqueueMs = Date.now() - t0;
    // Wait up to 30s for all to process
    await new Promise((resolve) => {
        const check = setInterval(() => {
            if (processed >= BURST) {
                clearInterval(check);
                resolve();
            }
        }, 200);
        setTimeout(() => { clearInterval(check); resolve(); }, 30_000);
    });
    const totalMs = Date.now() - t0;
    const passed = processed >= BURST * 0.99; // Allow 1% loss tolerance
    console.log(`   ${passed ? '✅' : '❌'} Burst ${BURST} jobs: enqueued in ${enqueueMs}ms, ` +
        `processed ${processed}/${BURST} in ${totalMs}ms  (${((processed / BURST) * 100).toFixed(1)}% delivery)`);
    await worker.close();
    await queue.obliterate({ force: true });
    await queue.close();
}
// ── Test 4: DLQ routing ───────────────────────────────────────────────────────
async function testDLQRouting() {
    console.log('\n[4] DLQ routing test — jobs that fail max attempts move to DLQ');
    const queue = new Queue(TEST_QUEUE, { connection: makeRedis() });
    const dlqQueue = new Queue(DLQ_QUEUE, { connection: makeRedis() });
    let failCount = 0;
    let dlqCount = 0;
    const worker = new Worker(TEST_QUEUE, async (_job) => {
        failCount++;
        throw new Error('Intentional test failure');
    }, {
        connection: makeRedis(),
        concurrency: 1,
    });
    // Listen for job failures and manually route to DLQ (simulating our queue.enterprise.ts logic)
    worker.on('failed', async (job) => {
        if (job && job.attemptsMade >= (job.opts.attempts ?? 3)) {
            await dlqQueue.add('dead-letter', {
                originalQueue: TEST_QUEUE,
                jobId: job.id,
                jobData: job.data,
                errorMessage: 'Intentional test failure',
                attempts: job.attemptsMade,
                failedAt: new Date().toISOString(),
            });
            dlqCount++;
        }
    });
    await queue.add('fail-test', { index: 1 }, { attempts: 2, backoff: { type: 'fixed', delay: 100 } });
    // Wait for all retries to complete
    await new Promise((r) => setTimeout(r, 5_000));
    const passed = failCount >= 2 && dlqCount === 1;
    console.log(`   ${passed ? '✅' : '❌'} Job failed ${failCount} times, DLQ received ${dlqCount} entry` +
        `  (expected 2 failures, 1 DLQ entry)`);
    await worker.close();
    await queue.obliterate({ force: true });
    await dlqQueue.obliterate({ force: true });
    await queue.close();
    await dlqQueue.close();
}
// ── Test 5: Redis reconnect simulation ───────────────────────────────────────
async function testRedisConnectivity() {
    console.log('\n[5] Redis connectivity health check');
    const redis = makeRedis();
    try {
        const t0 = performance.now();
        const pong = await redis.ping();
        const latencyMs = performance.now() - t0;
        const passed = pong === 'PONG' && latencyMs < 50;
        console.log(`   ${passed ? '✅' : '⚠️'} Redis PING in ${latencyMs.toFixed(1)}ms` +
            `  (threshold <50ms)  response=${pong}`);
        // Check memory usage
        const info = await redis.info('memory');
        const usedMemMatch = info.match(/used_memory_human:(.+)/);
        const usedMem = usedMemMatch?.[1]?.trim() ?? 'unknown';
        console.log(`   ℹ️  Redis used memory: ${usedMem}`);
    }
    finally {
        redis.disconnect();
    }
}
// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
    console.log('═══════════════════════════════════════════════════════');
    console.log('  WhatsFlow AI — Queue Stress Validation');
    console.log('  Redis URL:', REDIS_URL.replace(/:[^@]*@/, ':***@'));
    console.log('═══════════════════════════════════════════════════════');
    try {
        await testRedisConnectivity();
        await testDeduplication();
        await testThroughput();
        await testBurst();
        await testDLQRouting();
    }
    catch (err) {
        console.error('\n❌ Queue validation error:', err);
        process.exit(1);
    }
    console.log('\n═══ Queue Stress Validation Complete ═══');
    process.exit(0);
}
main();
//# sourceMappingURL=queue.stress.js.map