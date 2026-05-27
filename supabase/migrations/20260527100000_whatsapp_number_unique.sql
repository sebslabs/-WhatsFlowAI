-- Enforce WhatsApp number uniqueness for QR sessions
ALTER TABLE public.whatsapp_qr_sessions ADD CONSTRAINT whatsapp_qr_sessions_phone_number_key UNIQUE (phone_number);
