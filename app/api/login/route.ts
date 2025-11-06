import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

console.log("🔑 Service role key present?", !!process.env.SUPABASE_SERVICE_ROLE_KEY);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// ✅ Use service role client (server-only, bypasses RLS)
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

export async function POST(req: Request) {
  try {
    const { username, pi_uid } = await req.json();
    if (!username || !pi_uid)
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });

    const mockEmail = `${pi_uid}@pi.mock`;

    // ✅ Try to create a new user first
    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email: mockEmail,
        email_confirm: true,
      });

    let supabaseUserId = authData?.user?.id;

    // If user already exists, fetch it
    if (authError && authError.message.includes("already exists")) {
      console.warn("User already exists, fetching existing auth user...");
      const { data: existingUser, error: fetchError } =
        await supabaseAdmin.auth.admin.listUsers();

      if (fetchError) {
        console.error("❌ Failed to list users:", fetchError.message);
        return NextResponse.json(
          { error: "Auth fetch failed" },
          { status: 500 }
        );
      }

      const found = existingUser.users.find((u) => u.email === mockEmail);
      supabaseUserId = found?.id;
    } else if (authError) {
      console.error("❌ Auth creation failed:", authError.message);
      return NextResponse.json(
        { error: "Auth creation failed", details: authError.message },
        { status: 500 }
      );
    }

    if (!supabaseUserId) {
      console.error("❌ No Supabase user ID found.");
      return NextResponse.json(
        { error: "Auth user not found" },
        { status: 500 }
      );
    }

    // ✅ Upsert into profiles (bypasses RLS)
    const { error: upsertError } = await supabaseAdmin
      .from("profiles")
      .upsert(
        {
          id: supabaseUserId,
          username,
          email: mockEmail,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );

    if (upsertError) {
      console.error("❌ Profile upsert error:", upsertError.message);
      return NextResponse.json(
        { error: "Profile update failed", details: upsertError.message },
        { status: 500 }
      );
    }

    console.log("✅ Profile upserted successfully for", username);
    return NextResponse.json({ success: true, userId: supabaseUserId });
  } catch (err: any) {
    console.error("❌ Login API error:", err.message);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}