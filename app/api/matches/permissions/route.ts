import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  try {
    const { matchId, allowVoice, allowVideo } = (await req.json()) as {
      matchId?: string;
      allowVoice?: boolean;
      allowVideo?: boolean;
    };

    if (!matchId) {
      return NextResponse.json({ error: "matchId gerekli" }, { status: 400 });
    }

    const supabase = createRouteHandlerClient({ cookies });
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check match participation
    const { data: match } = await supabase
      .from("matches")
      .select("user_id_1, user_id_2")
      .eq("id", matchId)
      .single();

    if (!match || (match.user_id_1 !== user.id && match.user_id_2 !== user.id)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Use admin client to bypass RLS, we already checked ownership
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("match_permissions")
      .upsert(
        {
          match_id: matchId,
          user_id: user.id,
          allow_voice: !!allowVoice,
          allow_video: !!allowVideo,
        },
        { onConflict: "match_id,user_id" }
      )
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, permission: data });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Server error" }, { status: 500 });
  }
}

