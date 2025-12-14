import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  try {
    const { targetUserId } = (await req.json()) as { targetUserId?: string };
    if (!targetUserId) {
      return NextResponse.json({ error: "targetUserId gerekli" }, { status: 400 });
    }

    const routeClient = createRouteHandlerClient({ cookies });
    const {
      data: { user },
    } = await routeClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();
    const filter = `or(and(user_id_1.eq.${user.id},user_id_2.eq.${targetUserId}),and(user_id_1.eq.${targetUserId},user_id_2.eq.${user.id}))`;

    // Verify match exists for this user
    const { data: matches, error: fetchError } = await admin
      .from("matches")
      .select("id")
      .or(filter)
      .limit(2);

    if (fetchError) throw fetchError;
    if (!matches || matches.length === 0) {
      return NextResponse.json({ error: "Eşleşme bulunamadı" }, { status: 404 });
    }

    // Prefer marking as rejected (allows re-match in swipe flow)
    const { error: updateError } = await admin.from("matches").update({ status: "rejected" }).or(filter);
    if (updateError) throw updateError;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Server error" },
      { status: 500 }
    );
  }
}

