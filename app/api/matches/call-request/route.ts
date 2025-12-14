import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  try {
    const { matchId, type, action, requestId, status } = (await req.json()) as {
      matchId?: string;
      type?: "voice" | "video";
      action?: "create" | "respond" | "unblock" | "list";
      requestId?: string;
      status?: "accepted" | "rejected";
    };

    const supabase = createRouteHandlerClient({ cookies });
    const admin = createAdminClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Check match ownership using admin to avoid RLS
    if (matchId) {
      const { data: match, error: matchErr } = await admin
        .from("matches")
        .select("user_id_1, user_id_2")
        .eq("id", matchId)
        .single();
      if (matchErr || !match || (match.user_id_1 !== user.id && match.user_id_2 !== user.id)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // Helper: block check
    const isBlocked = async (callerId: string) => {
      const { data: block } = await admin
        .from("call_blocks")
        .select("blocked")
        .eq("match_id", matchId)
        .eq("blocked_user_id", callerId)
        .single();
      return !!block?.blocked;
    };

    // List call requests for this match (admin client, but requires participant check)
    if (action === "list") {
      if (!matchId) return NextResponse.json({ error: "Eksik parametre" }, { status: 400 });
      const { data: calls, error } = await admin
        .from("call_requests")
        .select("*")
        .eq("match_id", matchId)
        .in("status", ["pending", "accepted"]);
      if (error) throw error;
      return NextResponse.json({ calls });
    }

    if (action === "create") {
      if (!matchId || !type) return NextResponse.json({ error: "Eksik parametre" }, { status: 400 });
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 dk

      // Block check
      if (await isBlocked(user.id)) {
        return NextResponse.json({ error: "Karşı taraf çağrıları engelledi." }, { status: 403 });
      }

      // Use upsert to avoid unique constraint issues on pending
      const { data, error } = await admin
        .from("call_requests")
        .upsert(
          {
            match_id: matchId,
            requester_id: user.id,
            type,
            status: "pending",
            expires_at: expiresAt,
          },
          { onConflict: "match_id,requester_id" }
        )
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, request: data });
    }

    if (action === "respond") {
      if (!status) return NextResponse.json({ error: "Eksik parametre" }, { status: 400 });

      // Try by id first, otherwise fallback to pending request in this match not initiated by current user
      let request: any = null;
      if (requestId) {
        const { data } = await admin
          .from("call_requests")
          .select("id, match_id, requester_id, status")
          .eq("id", requestId)
          .single();
        request = data || null;
      }
      if (!request && matchId) {
        const { data } = await admin
          .from("call_requests")
          .select("id, match_id, requester_id, status")
          .eq("match_id", matchId)
          .eq("status", "pending")
          .neq("requester_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();
        request = data || null;
      }

      if (!request) return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });

      // Only target (non-requester) can accept/reject
      const { data: match } = await admin
        .from("matches")
        .select("user_id_1, user_id_2")
        .eq("id", request.match_id)
        .single();

      const targetId = match?.user_id_1 === request.requester_id ? match?.user_id_2 : match?.user_id_1;
      if (targetId !== user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const { data, error } = await admin
        .from("call_requests")
        .update({ status })
        .eq("id", request.id)
        .select()
        .single();

      if (error) throw error;

      // If rejected: block caller
      if (status === "rejected") {
        await admin
          .from("call_blocks")
          .upsert(
            {
              match_id: request.match_id,
              blocker_id: user.id,
              blocked_user_id: request.requester_id,
              blocked: true,
            },
            { onConflict: "match_id,blocked_user_id" }
          );
      }

      return NextResponse.json({ success: true, request: data });
    }

    if (action === "unblock") {
      if (!matchId) return NextResponse.json({ error: "Eksik parametre" }, { status: 400 });
      // Current user can unblock whoever they blocked in this match
      const { error } = await admin
        .from("call_blocks")
        .delete()
        .eq("match_id", matchId)
        .eq("blocker_id", user.id);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Geçersiz işlem" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Server error" }, { status: 500 });
  }
}

