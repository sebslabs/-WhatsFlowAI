import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(request: NextRequest) {
  // 1. Disable in production
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  }

  // 2. Authenticate user
  try {
    const serverSupabase = createServerClient();
    const { data: { user }, error: authError } = await serverSupabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 3. Check admin role in profiles
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }
  } catch (err: any) {
    return NextResponse.json({ error: 'Authentication failed', details: err.message }, { status: 401 });
  }

  const logs: string[] = [];

  const log = (...args: any[]) => {
    const line = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)).join(' ');
    console.log("[Diagnostic]", line);
    logs.push(line);
  };

  try {
    log("=== WHATSFLOW AI DATABASE DIAGNOSTIC ROUTE ===");
    log("Supabase Url:", supabaseUrl);

    // 1. Inspect Conversations Table Columns
    log("\n--- 1. Testing SELECT * on Conversations ---");
    const { data: convs, error: convError } = await supabase
      .from('conversations')
      .select('*')
      .limit(1);

    if (convError) {
      log("❌ Conversations SELECT * failed:", convError.message || convError);
    } else {
      log("✅ Conversations SELECT * succeeded!");
      if (convs && convs.length > 0) {
        log("Columns found in Conversations table:", Object.keys(convs[0]));
        log("Sample Conversation Record:", convs[0]);
      } else {
        log("No conversations found in the database.");
      }
    }

    // 2. Test specific select with ai_enabled
    log("\n--- 2. Testing select with 'ai_enabled' ---");
    const { data: convAi, error: convAiError } = await supabase
      .from('conversations')
      .select('ai_enabled')
      .limit(1);

    if (convAiError) {
      log("❌ Conversations does NOT have 'ai_enabled' column:", convAiError.message);
    } else {
      log("✅ Conversations HAS 'ai_enabled' column!");
    }

    // 3. Test select with mode
    log("\n--- 3. Testing select with 'mode' ---");
    const { data: convMode, error: convModeError } = await supabase
      .from('conversations')
      .select('mode')
      .limit(1);

    if (convModeError) {
      log("❌ Conversations does NOT have 'mode' column:", convModeError.message);
    } else {
      log("✅ Conversations HAS 'mode' column! Sample value:", convMode?.[0]?.mode);
    }

    // 4. Test select active AI agent
    log("\n--- 4. Checking Active AI Agents ---");
    const { data: agents, error: agentsError } = await supabase
      .from('ai_agents')
      .select('*');

    if (agentsError) {
      log("❌ Failed to query ai_agents table:", agentsError.message);
    } else {
      log("✅ AI Agents query succeeded. Count:", agents?.length);
      log("Agents registered:", agents);
    }

    // 5. Test QR sessions
    log("\n--- 5. Checking WhatsApp QR Sessions ---");
    const { data: qrSessions, error: qrError } = await supabase
      .from('whatsapp_qr_sessions')
      .select('*');

    if (qrError) {
      log("❌ Failed to query whatsapp_qr_sessions:", qrError.message);
    } else {
      log("✅ WhatsApp QR Sessions query succeeded. Count:", qrSessions?.length);
      log("QR Sessions:", qrSessions);
    }

  } catch (err: any) {
    log("❌ Diagnostic execution crashed:", err.message || err);
  }

  return NextResponse.json({ logs });
}
