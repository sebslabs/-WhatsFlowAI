-- Add 'processed' to webhook_status enum if it doesn't exist
ALTER TYPE public.webhook_status ADD VALUE IF NOT EXISTS 'processed';
