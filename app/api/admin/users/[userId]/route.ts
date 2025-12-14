import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const supabase = createAdminClient();
    const { userId } = await params;

    // Delete auth user (requires service role)
    const { error } = await supabase.auth.admin.deleteUser(userId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const supabase = createAdminClient();
    const { userId } = await params;

    // Get user with email
    const { data: authUser, error } = await supabase.auth.admin.getUserById(userId);

    if (error) throw error;

    return NextResponse.json({ email: authUser.user.email });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

