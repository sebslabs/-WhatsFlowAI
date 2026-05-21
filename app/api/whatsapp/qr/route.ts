import { NextRequest, NextResponse } from "next/server";
import { requireAuthApi } from "@/lib/auth";
import { createClient } from "@supabase/supabase-js";
import { initActiveSessions, startBaileysSession, waitForSessionQr } from "@/lib/whatsapp-qr";

/** Baileys QR generation can take up to ~45s while waiting for WhatsApp. */
export const maxDuration = 60;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { user, supabase: userSupabase, error: authError } = await requireAuthApi(request);
    if (authError || !user || !userSupabase) return authError || NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Background self-heal: ensure active sessions are in-memory
    initActiveSessions().catch(console.error);

    const { data, error } = await userSupabase
      .from("whatsapp_qr_sessions")
      .select("*")
      .eq("tenant_id", user.tenant_id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, supabase: userSupabase, error: authError } = await requireAuthApi(request);
    if (authError || !user || !userSupabase) return authError || NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { sessionName, phoneNumber } = body;

    // Create a new session in DB
    const { data, error } = await userSupabase
      .from("whatsapp_qr_sessions")
      .insert({
        tenant_id: user.tenant_id,
        session_name: sessionName || "My QR Connection",
        phone_number: phoneNumber || null,
        status: "init"
      })
      .select("*")
      .single();

    if (error) throw error;

    // Start Baileys, then wait until QR is written to DB (keeps the route alive in serverless)
    try {
      await startBaileysSession(user.tenant_id, data.id);
      const ready = await waitForSessionQr(data.id);
      return NextResponse.json({ ...data, ...ready });
    } catch (waitErr: any) {
      console.error('[whatsapp/qr] Baileys session failed:', waitErr);
      return NextResponse.json({
        ...data,
        status: 'error',
        error_message: waitErr.message || 'QR generation timed out',
      });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
