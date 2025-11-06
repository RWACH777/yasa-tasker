import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// ✅ Use service role client (server-only, bypasses RLS)
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

export async function POST(req: Request) {
  try {
    const { username, pi_uid } = await req.json();
    if (!username || !pi_uid)
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });

    // ✅ Create or get Supabase auth user (anonymously)
    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email: `${pi_uid}@pi.mock`,
        email_confirm: true,
      });

    if (authError && !authError.message.includes("already exists")) {
      console.error("Auth creation error:", authError);
      return NextResponse.json({ error: "Auth creation failed" }, { status: 500 });
    }

    const supabaseUserId = authData?.user?.id;

    // ✅ Upsert into profiles (bypasses RLS)
    const { error: upsertError } = await supabaseAdmin
      .from("profiles")
      .upsert(
        {
          id: supabaseUserId,
          username,
          email: `${pi_uid}@pi.mock`,
          created_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );

    if (upsertError) {
      console.error("Profile upsert error:", upsertError);
      return NextResponse.json({ error: "Profile update failed" }, { status: 500 });
    }

    return NextResponse.json({ success: true, userId: supabaseUserId });
  } catch (err) {
    console.error("Login API error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}