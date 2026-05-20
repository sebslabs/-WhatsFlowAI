-- Ensures Baileys session credentials can be stored (required for QR pairing persistence).
CREATE TABLE IF NOT EXISTS public.whatsapp_baileys_auth_states (
    session_id UUID NOT NULL REFERENCES public.whatsapp_qr_sessions(id) ON DELETE CASCADE,
    data_key TEXT NOT NULL,
    data_value JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (session_id, data_key)
);

ALTER TABLE public.whatsapp_baileys_auth_states ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all access for service role only" ON public.whatsapp_baileys_auth_states;
DROP POLICY IF EXISTS "Service role manages baileys auth states" ON public.whatsapp_baileys_auth_states;

-- No policies for authenticated/anon roles — only service_role (bypasses RLS) may access this table.
