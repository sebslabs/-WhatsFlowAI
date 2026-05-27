/** Instrumentation is empty because backend handles workers */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('[instrumentation] Next.js starting up. Workers are handled by Fly.io backend.');
  }
}
