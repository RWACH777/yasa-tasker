// app/api/login/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function POST(req: Request) {
  try {
    const { pi_uid, username, avatar_url } = await req.json();

    if (!pi_uid || !username) {
      return NextResponse.json(
        { error: "Missing Pi user data" },
        { status: 400 }
      );
    }

    console.log("📩 Incoming Pi login:", { pi_uid, username });

    // ✅ Ensure profile exists or update it
    const { data: profile, error: upsertError } = await supabase
      .from("profiles")
      .upsert(
        {
          id: pi_uid, // or a separate uuid if you use auth users
          username,
          email: `${pi_uid}@pi.mock`,
          created_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      )
      .select()
      .single();

    if (upsertError) {
      console.error("❌ Supabase upsert error:", upsertError);
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    console.log("✅ Profile synced:", profile);

    return NextResponse.json({ user: profile });
  } catch (err: any) {
    console.error("❌ Login route error:", err);
    return NextResponse.json(
      { error: err?.message || "Unknown error" },
      { status: 500 }
    );
  }
}