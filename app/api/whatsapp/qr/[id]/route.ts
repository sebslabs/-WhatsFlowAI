import { NextRequest, NextResponse } from "next/server";
import { requireAuthApi } from "@/lib/auth";
import { createClient } from "@supabase/supabase-js";


const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { user, supabase: userSupabase, error: authError } = await requireAuthApi(request);
    if (authError || !user || !userSupabase) return authError || NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const sessionId = params.id;

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5000';
    const internalKey = process.env.INTERNAL_API_KEY || '';

    // Disconnect baileys on backend
    await fetch(`${apiUrl}/api/internal/baileys/qr/${sessionId}`, {
      method: 'DELETE',
      headers: { 'X-Internal-Key': internalKey }
    });

    // Delete from DB
    const { error } = await userSupabase
      .from("whatsapp_qr_sessions")
      .delete()
      .eq("id", sessionId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
