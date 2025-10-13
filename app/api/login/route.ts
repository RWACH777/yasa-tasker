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

    // Check if user already exists
    const { data: existing, error: findError } = await supabase
      .from("users")
      .select("*")
      .eq("pi_uid", pi_uid)
      .single();

    if (findError && findError.code !== "PGRST116") throw findError;

    if (existing) {
      // Update last login timestamp
      const { data: updated } = await supabase
        .from("users")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", existing.id)
        .select()
        .single();

      return NextResponse.json({ user: updated });
    }

    // Otherwise, insert new user
    const { data: newUser, error: insertError } = await supabase
      .from("users")
      .insert([{ pi_uid, username, avatar_url }])
      .select()
      .single();

    if (insertError) throw insertError;

    return NextResponse.json({ user: newUser });
  } catch (err: any) {
    console.error("❌ Login route error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}