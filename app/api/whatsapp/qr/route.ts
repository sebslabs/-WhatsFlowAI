import { NextRequest, NextResponse } from "next/server";
import { requireAuthApi } from "@/lib/auth";
import { createClient } from "@supabase/supabase-js";

export const maxDuration = 60;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { user, supabase: userSupabase, error: authError } = await requireAuthApi(request);
    if (authError || !user || !userSupabase) return authError || NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

    if (phoneNumber) {
      // Clear out any old sessions tied to this phone number to avoid unique constraint database errors
      await userSupabase
        .from("whatsapp_qr_sessions")
        .delete()
        .eq("phone_number", phoneNumber);
    }

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

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5000';
    const internalKey = process.env.INTERNAL_API_KEY || '';

    // Proxy QR generation to the long-running Express backend
    const res = await fetch(`${apiUrl}/api/internal/baileys/qr`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Key': internalKey,
      },
      body: JSON.stringify({
        tenantId: user.tenant_id,
        sessionId: data.id
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Backend QR generation failed HTTP ${res.status}: ${errText}`);
    }

    const readyData = await res.json();
    return NextResponse.json({ ...data, ...readyData });
  } catch (error: any) {
    console.error('[whatsapp/qr] POST error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
