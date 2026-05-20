/**
 * SECURITY FIX (CRITICAL): This endpoint performed destructive database mutations
 * (UPDATE, DELETE) via an unauthenticated GET request — a severe violation of
 * REST semantics and multi-tenant data integrity.
 *
 * Fix: Permanently disabled. Returns 404 in ALL environments.
 * Any future data-migration tooling must go through a protected admin migration
 * runner, not a public HTTP GET handler.
 */
import { NextResponse } from 'next/server';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET() {
  // Endpoint permanently disabled — destructive GET mutations are forbidden
  return NextResponse.json({ error: 'Not Found' }, { status: 404 });
}
