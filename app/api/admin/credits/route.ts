import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, amount, action } = body as {
      userId: string;
      amount: number;
      action: "add" | "remove";
    };

    if (!userId || !amount || amount <= 0) {
      return NextResponse.json({ error: "Geçersiz istek" }, { status: 400 });
    }

    // Check caller is admin
    const routeClient = createRouteHandlerClient({ cookies });
    const {
      data: { user },
    } = await routeClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: callerProfile } = await routeClient
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (!callerProfile?.is_admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const adminClient = createAdminClient();

    // Adjust credits atomically
    const delta = action === "remove" ? -amount : amount;

    const { data: target, error: fetchError } = await adminClient
      .from("profiles")
      .select("credits")
      .eq("id", userId)
      .single();

    if (fetchError || !target) {
      return NextResponse.json({ error: "Kullanıcı bulunamadı" }, { status: 404 });
    }

    const newCredits = Math.max(0, (target.credits || 0) + delta);

    const { error: updateError } = await adminClient
      .from("profiles")
      .update({ credits: newCredits })
      .eq("id", userId);

    if (updateError) throw updateError;

    await adminClient.from("credits_transactions").insert({
      user_id: userId,
      amount: delta,
      type: delta >= 0 ? "admin_added" : "admin_removed",
      description: `Admin credit ${delta >= 0 ? "add" : "remove"}`,
    });

    return NextResponse.json({ success: true, credits: newCredits });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Server error" }, { status: 500 });
  }
}

