-- ==============================================================================
-- WhatsFlow AI Database Migration: Add Endorsely Affiliate Referral Tracking
-- File: 20260519100000_add_endorsely_referral.sql
-- Description: Adds endorsely_referral_id column to billing_subscriptions table
-- ==============================================================================

BEGIN;

-- Add endorsely_referral_id column to track affiliate attribution per tenant
ALTER TABLE public.billing_subscriptions 
  ADD COLUMN IF NOT EXISTS endorsely_referral_id text;

-- Add performance index for quick retrieval during webhook execution
CREATE INDEX IF NOT EXISTS idx_billing_subs_endorsely_ref 
  ON public.billing_subscriptions (endorsely_referral_id);

COMMIT;
