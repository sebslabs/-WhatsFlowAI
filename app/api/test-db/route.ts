import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET() {
  // 1. Disable in production
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  }

  try {
    // 2. Run self-healing DB constraint update
    const sql = `
      ALTER TABLE public.knowledge_base DROP CONSTRAINT IF EXISTS knowledge_base_source_type_check;
      ALTER TABLE public.knowledge_base ADD CONSTRAINT knowledge_base_source_type_check CHECK (source_type IN ('text', 'url', 'pdf', 'faq', 'image'));
      
      -- Ensure supabase_realtime publication includes leads and contacts
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_publication_tables
          WHERE pubname = 'supabase_realtime' AND tablename = 'leads'
        ) THEN
          ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM pg_publication_tables
          WHERE pubname = 'supabase_realtime' AND tablename = 'contacts'
        ) THEN
          ALTER PUBLICATION supabase_realtime ADD TABLE public.contacts;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END $$;

      -- Create notifications table
      CREATE TABLE IF NOT EXISTS public.notifications (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
          type TEXT NOT NULL,
          title TEXT NOT NULL,
          body TEXT NOT NULL,
          time TEXT,
          read BOOLEAN NOT NULL DEFAULT false,
          action_lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'Users can view their tenant notifications'
        ) THEN
          CREATE POLICY "Users can view their tenant notifications"
              ON public.notifications FOR SELECT
              USING (tenant_id IN (
                  SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()
              ));
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'Users can update their tenant notifications'
        ) THEN
          CREATE POLICY "Users can update their tenant notifications"
              ON public.notifications FOR UPDATE
              USING (tenant_id IN (
                  SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()
              ))
              WITH CHECK (tenant_id IN (
                  SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()
              ));
        END IF;
        
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'Users can insert their tenant notifications'
        ) THEN
          CREATE POLICY "Users can insert their tenant notifications"
              ON public.notifications FOR INSERT
              WITH CHECK (tenant_id IN (
                  SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()
              ));
        END IF;
        
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'Users can delete their tenant notifications'
        ) THEN
          CREATE POLICY "Users can delete their tenant notifications"
              ON public.notifications FOR DELETE
              USING (tenant_id IN (
                  SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()
              ));
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM pg_publication_tables
          WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
        ) THEN
          ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END $$;
    `;
    const { error: migrationError } = await supabase.rpc('exec_sql', { sql });
    if (migrationError) {
      console.error('Self-healing database constraint update failed:', migrationError);
    } else {
      console.log('Self-healing database constraint updated successfully!');
    }

    const results: any = {
      migration_status: migrationError ? `Failed: ${migrationError.message}` : 'Success'
    };

    // 1. Check AI Agents
    const { data: agents, error: agentErr } = await supabase
      .from('ai_agents')
      .select('*');

    results.agents = {
      data: agents,
      error: agentErr ? agentErr.message : null
    };

    // 2. Check WhatsApp Accounts
    const { data: accounts, error: accErr } = await supabase
      .from('whatsapp_accounts')
      .select('*');

    results.whatsapp_accounts = {
      data: accounts,
      error: accErr ? accErr.message : null
    };

    // 3. Check Webhook QR Sessions
    const { data: qrSessions, error: qrErr } = await supabase
      .from('whatsapp_qr_sessions')
      .select('*');

    results.whatsapp_qr_sessions = {
      data: qrSessions,
      error: qrErr ? qrErr.message : null
    };

    // 4. Check recent conversations and messages
    const { data: convs, error: convErr } = await supabase
      .from('conversations')
      .select('*')
      .order('last_message_at', { ascending: false })
      .limit(5);

    results.recent_conversations = {
      data: convs,
      error: convErr ? convErr.message : null
    };

    // If there is an active conversation, fetch its messages
    if (convs && convs.length > 0) {
      const { data: msgs } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', convs[0].id)
        .order('created_at', { ascending: false })
        .limit(10);
      
      results.recent_messages_for_top_conv = msgs;
    }

    return NextResponse.json(results, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
