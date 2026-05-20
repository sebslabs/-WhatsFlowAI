import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { AIGateway } from '@/services/ai-gateway';
import { createClient as createServiceClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const adminSupabase = createServiceClient(supabaseUrl, supabaseKey);

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient();

    // 1. Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 2. Fetch tenant context (organization_id)
    const { data: profile, error: profileError } = await adminSupabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile || !profile.organization_id) {
      return new Response(JSON.stringify({ error: 'Tenant context mismatch or forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { messages } = await req.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'Messages array is required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Extract the latest user message and history
    const userMessages = messages.filter((m: any) => m.role === 'user');
    const lastUserMessage = userMessages[userMessages.length - 1];
    
    if (!lastUserMessage || !lastUserMessage.content) {
      return new Response(JSON.stringify({ error: 'No user message content found.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const history = messages
      .slice(0, messages.length - 1)
      .filter((m: any) => m.role === 'user' || m.role === 'assistant')
      .map((m: any) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content as string,
      }));

    // 3. Route through AIGateway (handles prompt injection, RAG, and Rate Limits)
    const aiResponse = await AIGateway.generateResponse({
      message: lastUserMessage.content,
      systemPrompt: 'You are a helpful customer support assistant for WhatsFlow.',
      history,
      tenantId: profile.organization_id,
      userId: user.id,
    });

    if (!aiResponse.success) {
      return new Response(JSON.stringify({ error: aiResponse.error || 'AI request blocked or rate-limited.' }), {
        status: aiResponse.blockedByGuard ? 400 : 429,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 4. Construct a Server-Sent Events (SSE) stream compatible with the chat UI
    const text = aiResponse.text;
    const encoder = new TextEncoder();
    const customStream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          choices: [{
            delta: { content: text },
            finish_reason: 'stop',
            index: 0
          }]
        })}\n\n`));
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      }
    });

    return new Response(customStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });

  } catch (error: any) {
    console.error('Chat Route Error:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
