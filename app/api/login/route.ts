```ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log("📩 Incoming Pi data:", body);

    const { pi_uid, username, avatar_url } = body;

    if (!pi_uid || !username) {
      console.error("❌ Missing Pi user data", { pi_uid, username });
      return NextResponse.json({ error: "Missing Pi user data" }, { status: 400 });
    }

    // Check for existing user
    const { data: existing, error: findError } = await supabase
      .from("profiles")
      .select("*")
      .eq("pi_uid", pi_uid)
      .single();

    if (findError && findError.code !== "PGRST116") {
      console.error("❌ Error finding existing user:", findError);
      throw findError;
    }

    if (existing) {
      console.log("✅ Existing user found:", existing);
      const { data: updated, error: updateError } = await supabase
        .from("profiles")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", existing.id)
        .select()
        .single();

      if (updateError) console.error("❌ Update error:", updateError);
      return NextResponse.json({ user: updated });
    }

    console.log("🆕 Creating new user in profiles…");
    const { data: newUser, error: insertError } = await supabase
      .from("profiles")
      .insert([
        {
          pi_uid,
          username,
          avatar_url,
          created_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (insertError) {
      console.error("❌ Supabase insert error:", insertError);
      throw insertError;
    }

    console.log("✅ New profile inserted:", newUser);
    return NextResponse.json({ user: newUser });
  } catch (err: any) {
    console.error("❌ Login route error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
```