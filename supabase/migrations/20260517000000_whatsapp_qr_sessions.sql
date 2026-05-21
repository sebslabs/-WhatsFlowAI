CREATE TABLE IF NOT EXISTS public.whatsapp_qr_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    session_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'init', -- 'init', 'qr_ready', 'connected', 'disconnected', 'error'
    qr_code TEXT,
    phone_number TEXT,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_connected_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_qr_sessions_tenant_id ON public.whatsapp_qr_sessions(tenant_id);

ALTER TABLE public.whatsapp_qr_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their tenant's qr sessions"
    ON public.whatsapp_qr_sessions FOR SELECT
    USING (tenant_id IN (
        SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can insert their tenant's qr sessions"
    ON public.whatsapp_qr_sessions FOR INSERT
    WITH CHECK (tenant_id IN (
        SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can update their tenant's qr sessions"
    ON public.whatsapp_qr_sessions FOR UPDATE
    USING (tenant_id IN (
        SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()
    ))
    WITH CHECK (tenant_id IN (
        SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can delete their tenant's qr sessions"
    ON public.whatsapp_qr_sessions FOR DELETE
    USING (tenant_id IN (
        SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()
    ));
