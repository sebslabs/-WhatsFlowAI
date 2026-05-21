/** Restore Baileys sessions when the Next.js server boots. */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Avoid launching in-memory persistent WASocket connections inside ephemeral serverless lambdas (e.g. Vercel)
    // to prevent split-brain conflicts and socket dropping during horizontal scaling.
    if (process.env.VERCEL === 'true' || process.env.DISABLE_BAILEYS_IN_NEXTJS === 'true') {
      console.log('[instrumentation] Serverless / Ephemeral context detected. Skipping in-process Baileys session restoration.');
    } else {
      const { initActiveSessions } = await import('./lib/whatsapp-qr');
      initActiveSessions().catch((err) => {
        console.error('[instrumentation] initActiveSessions failed:', err);
      });
    }

    if (process.env.REDIS_URL) {
      try {
        const { startFlowResumeWorker } = await import('./lib/flow-worker');
        startFlowResumeWorker();
      } catch (err) {
        console.error('[instrumentation] Flow resume worker failed to start (QR/Baileys unaffected):', err);
      }
    }
  }
}
