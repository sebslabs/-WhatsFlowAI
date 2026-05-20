import { NextRequest, NextResponse } from "next/server";
import { requireAuthApi } from "@/lib/auth";
import { createClient } from "@supabase/supabase-js";
import { disconnectBaileysSession } from "@/lib/whatsapp-qr";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { user, supabase: userSupabase, error: authError } = await requireAuthApi(request);
    if (authError || !user || !userSupabase) return authError || NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const sessionId = params.id;

    // Disconnect baileys
    await disconnectBaileysSession(sessionId);

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
