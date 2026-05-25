import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { isConversationAiEnabled } from '@/lib/whatsapp-message-utils';

export async function GET(request: NextRequest) {
  try {
    const admin = getSupabaseAdmin();

    // 1. Check OpenRouter config
    const openrouterKey = process.env.OPENROUTER_API_KEY;
    const openrouterConfigured = !!openrouterKey;

    // 2. Lightweight OpenRouter ping
    let openrouterReachable = false;
    if (openrouterConfigured) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        const pingRes = await fetch('https://openrouter.ai/api/v1/models', {
          headers: { Authorization: `Bearer ${openrouterKey}` },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        openrouterReachable = pingRes.ok;
      } catch {
        openrouterReachable = false;
      }
    }

    // 3. Embeddings Key Check
    const embeddingsKeyPresent = !!(process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY);

    // 4. RAG Chunks Check
    let ragChunksFound = 0;
    try {
      const { count } = await admin
        .from('knowledge_base')
        .select('*', { count: 'exact', head: true });
      ragChunksFound = count ?? 0;
    } catch (err: any) {
      console.warn('[AI Health] Failed to count knowledge chunks:', err.message);
    }

    // 5. Baileys Socket Check
    let baileysSocketReady = false;
    try {
      const globalForBaileys = global as unknown as {
        baileysSessions?: Map<string, any>;
      };
      const sessions = globalForBaileys.baileysSessions;
      if (sessions && sessions.size > 0) {
        for (const sock of Array.from(sessions.values())) {
          if (sock && sock.ws?.readyState === 1) {
            baileysSocketReady = true;
            break;
          }
        }
      }
    } catch {
      baileysSocketReady = false;
    }

    // 6. AI Enabled Toggle Check
    const aiEnabledCheck =
      isConversationAiEnabled({ ai_enabled: true, mode: 'ai' }) &&
      !isConversationAiEnabled({ ai_enabled: false, mode: 'ai' }) &&
      !isConversationAiEnabled({ ai_enabled: true, mode: 'manual' });

    // 7. Markdown Stripping Check
    let markdownStrippingEnabled = false;
    try {
      const { convertMarkdownToWhatsApp } = require('@/lib/ai-guards');
      const testInput = '**bold** * ***AI Chatbot Development:**';
      const testOutput = convertMarkdownToWhatsApp(testInput);
      markdownStrippingEnabled = !testOutput.includes('**') && typeof convertMarkdownToWhatsApp === 'function';
    } catch {
      markdownStrippingEnabled = false;
    }

    return NextResponse.json({
      success: true,
      openrouterConfigured,
      openrouterReachable,
      embeddingsKeyPresent,
      ragChunksFound,
      baileysSocketReady,
      aiEnabledCheck,
      markdownStrippingEnabled,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('[AI Health] Diagnostic failed:', err);
    return NextResponse.json(
      {
        success: false,
        error: 'AI Health diagnostics crashed',
        details: err.message || String(err),
      },
      { status: 500 }
    );
  }
}
