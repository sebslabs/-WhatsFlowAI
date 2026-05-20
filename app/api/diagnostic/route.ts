import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Redis } from '@upstash/redis'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const diagnostics: Record<string, any> = {
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      SUPABASE_URL: !!process.env.SUPABASE_URL,
      SUPABASE_ANON_KEY: !!process.env.SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      DATABASE_URL: !!process.env.DATABASE_URL,
      DIRECT_URL: !!process.env.DIRECT_URL,
      REDIS_URL: !!process.env.REDIS_URL,
      UPSTASH_REDIS_REST_URL: !!process.env.UPSTASH_REDIS_REST_URL,
      UPSTASH_REDIS_REST_TOKEN: !!process.env.UPSTASH_REDIS_REST_TOKEN,
      ENCRYPTION_KEY: !!process.env.ENCRYPTION_KEY,
    }
  }

  // 1. Test Supabase connection
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (url && key) {
      const supabase = createClient(url, key)
      const { data, error } = await supabase.from('profiles').select('id').limit(1)
      diagnostics.supabaseConnection = {
        success: !error,
        error: error ? error.message : null,
        dataLength: data ? data.length : 0,
      }
    } else {
      diagnostics.supabaseConnection = {
        success: false,
        error: 'Missing URL or Anon Key',
      }
    }
  } catch (err: any) {
    diagnostics.supabaseConnection = {
      success: false,
      error: err.message || String(err),
    }
  }

  // 2. Test Upstash Redis connection
  try {
    const url = process.env.UPSTASH_REDIS_REST_URL
    const token = process.env.UPSTASH_REDIS_REST_TOKEN
    if (url && token) {
      const redis = new Redis({ url, token })
      const ping = await redis.ping()
      diagnostics.redisConnection = {
        success: ping === 'PONG',
        ping,
      }
    } else {
      diagnostics.redisConnection = {
        success: false,
        error: 'Missing REST URL or REST Token',
      }
    }
  } catch (err: any) {
    diagnostics.redisConnection = {
      success: false,
      error: err.message || String(err),
    }
  }

  return NextResponse.json(diagnostics)
}
