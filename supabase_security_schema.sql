-- ── 1. Create the AI Security Logs Audit Table ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_security_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  lead_id uuid, -- Optional, matches our CRM leads structure
  risk_score numeric(4,3) NOT NULL DEFAULT 0.000, -- Risk probability between 0.000 and 1.000
  category text NOT NULL CHECK (
    category IN (
      'none', 'prompt_injection', 'jailbreak', 'system_prompt_probe',
      'harmful_content', 'role_manipulation', 'secrets_request',
      'unsafe_business_request', 'data_exfiltration', 'pii_leak', 'other'
    )
  ),
  blocked boolean NOT NULL DEFAULT false,
  model_used text NOT NULL DEFAULT 'unknown',
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  cost numeric(10,6) NOT NULL DEFAULT 0.000000, -- Monitored cost in USD
  raw_input_preview text NOT NULL,
  action_taken text NOT NULL CHECK (action_taken IN ('process', 'block', 'handoff')),
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ── 2. Add Foreign Keys for Relational Integrity ─────────────────────────────
ALTER TABLE public.ai_security_logs
  ADD CONSTRAINT fk_security_logs_tenant
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

-- ── 3. Optimize with Multi-Tenant Indexes for Fast Search ─────────────────────
CREATE INDEX IF NOT EXISTS idx_security_logs_tenant_category
  ON public.ai_security_logs (tenant_id, category, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_security_logs_blocked
  ON public.ai_security_logs (tenant_id, blocked)
  WHERE blocked = true;

-- ── 4. Enable Row Level Security (RLS) ────────────────────────────────────────
ALTER TABLE public.ai_security_logs ENABLE ROW LEVEL SECURITY;

-- Allow read-only access for tenant members to view security metrics of their tenant
CREATE POLICY select_security_logs_tenant_scoped ON public.ai_security_logs
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_members
      WHERE user_id = auth.uid()
    )
  );

-- Allow service role to perform all insert/management tasks
CREATE POLICY service_role_all_security_logs ON public.ai_security_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
