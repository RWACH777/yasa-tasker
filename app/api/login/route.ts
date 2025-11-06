// app/api/login/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function POST(req: Request) {
  console.log("📩 /api/login called");
  try {
    const body = await req.json();
    console.log("➡️ Incoming body:", body);
    const { pi_uid, username, avatar_url } = body;

    if (!pi_uid || !username) {
      console.error("❌ Missing Pi user data", { pi_uid, username });
      return NextResponse.json({ error: "Missing Pi user data" }, { status: 400 });
    }

    // 1) Ensure we have a Supabase authenticated session (anonymous)
    const { data: authData, error: authError } = await supabase.auth.signInAnonymously();
    if (authError) {
      console.error("❌ supabase.auth.signInAnonymously error:", authError);
      return NextResponse.json({ error: authError.message }, { status: 500 });
    }

    const supabaseUserId = authData?.user?.id;
    if (!supabaseUserId) {
      console.error("❌ No supabase user id after signInAnonymously", authData);
      return NextResponse.json({ error: "Auth failed" }, { status: 500 });
    }

    console.log("🔑 Supabase user id:", supabaseUserId);

    // 2) Upsert profile using Supabase UUID as id (so auth.uid() === id in policies)
    const { data: upsertedProfile, error: upsertError } = await supabase
      .from("profiles")
      .upsert(
        {
          id: supabaseUserId,                 // <-- use the Supabase auth UUID
          username,
          email: ${pi_uid}@pi.mock,
          created_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      )
      .select()
      .single();

    if (upsertError) {
      console.error("❌ profiles upsert error:", upsertError);
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    console.log("✅ Profile upserted:", upsertedProfile);

    return NextResponse.json({ user: upsertedProfile });
  } catch (err: any) {
    console.error("❌ /api/login error:", err);
    return NextResponse.json({ error: err?.message || "Unknown error" }, { status: 500 });
  }
}