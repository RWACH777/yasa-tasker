import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

console.log("📩 /api/login route called");
// POST /api/login
export async function POST(req: Request) {
  try {
    const { pi_uid, username, avatar_url } = await req.json();

    if (!pi_uid || !username) {
      return NextResponse.json(
        { error: "Missing Pi user data" },
        { status: 400 }
      );
    }

    // ✅ Sign in anonymously just to ensure Supabase client has a session
    const { data: authData, error: authError } = await supabase.auth.signInAnonymously();

    if (authError) {
      console.error("❌ Supabase auth error:", authError.message);
      return NextResponse.json({ error: authError.message }, { status: 500 });
    }

    const userId = authData.user?.id;

    // ✅ Upsert into "profiles" table instead of "users"
    const { data: upsertData, error: upsertError } = await supabase
      .from("profiles")
      .upsert(
        {
          id: userId,
          username,
          email: `${pi_uid}@pi.mock`,
          created_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      )
      .select()
      .single();

    if (upsertError) {
      console.error("❌ Upsert error:", upsertError.message);
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    console.log("✅ User profile synced:", upsertData.username);

    return NextResponse.json({ user: upsertData });
  } catch (err: any) {
    console.error("❌ Login route error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}