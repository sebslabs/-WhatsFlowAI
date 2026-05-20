-- Migration to add whatsapp_baileys_auth_states for database-backed multi-instance safe Baileys sessions
CREATE TABLE IF NOT EXISTS public.whatsapp_baileys_auth_states (
    session_id UUID NOT NULL REFERENCES public.whatsapp_qr_sessions(id) ON DELETE CASCADE,
    data_key TEXT NOT NULL,
    data_value JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (session_id, data_key)
);

-- Enable RLS for security
ALTER TABLE public.whatsapp_baileys_auth_states ENABLE ROW LEVEL SECURITY;

-- Enable all access for service role only
CREATE POLICY "Enable all access for service role only"
    ON public.whatsapp_baileys_auth_states FOR ALL
    USING (true)
    WITH CHECK (true);
