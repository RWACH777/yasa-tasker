import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

console.log("🔑 Service role key present?", !!process.env.SUPABASE_SERVICE_ROLE_KEY);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

export async function POST(req: Request) {
  try {
    const { username, pi_uid } = await req.json();
    if (!username || !pi_uid)
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });

    const mockEmail = `${pi_uid}@pi.mock`;

    // ✅ Try to find the user first
    const { data: usersList, error: listError } =
      await supabaseAdmin.auth.admin.listUsers();

    if (listError)
      throw new Error("Failed to list users: " + listError.message);

    let existingUser = usersList.users.find((u) => u.email === mockEmail);
    let supabaseUserId = existingUser?.id;

    // ✅ If not found, create new user
    if (!supabaseUserId) {
      const { data: newUser, error: createError } =
        await supabaseAdmin.auth.admin.createUser({
          email: mockEmail,
          email_confirm: true,
        });
      if (createError) throw createError;
      supabaseUserId = newUser.user?.id;
    }

    if (!supabaseUserId)
      throw new Error("Supabase user ID not found after create/list.");

    // ✅ Upsert into profiles (bypass RLS)
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

    if (upsertError) throw upsertError;

    console.log("✅ Profile upserted successfully for", username);
    return NextResponse.json({ success: true, userId: supabaseUserId });
  } catch (err: any) {
    console.error("❌ Login API error:", err.message);
    return NextResponse.json(
      { error: "Auth creation failed", details: err.message },
      { status: 500 }
    );
  }
}