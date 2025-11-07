import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// ✅ Initialize Supabase client (public key, uses RLS policies)
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function POST(req: Request) {
  try {
    const { username, pi_uid } = await req.json();

    if (!username || !pi_uid) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // 🟣 Check if profile already exists
    const { data: existingProfile, error: fetchError } = await supabase
      .from("profiles")
      .select("*")
      .eq("pi_uid", pi_uid)
      .single();

    if (fetchError && fetchError.code !== "PGRST116") {
      console.error("Fetch profile error:", fetchError);
      return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 });
    }

    // 🟢 If profile exists, return it
    if (existingProfile) {
      console.log("✅ Existing user logged in:", existingProfile.username);
      return NextResponse.json({ success: true, user: existingProfile });
    }

    // 🟢 Otherwise, create a new profile
    const { data: newProfile, error: insertError } = await supabase
      .from("profiles")
      .insert([
        {
          username,
          pi_uid,
          email: `${pi_uid}@pi.mock`,
          created_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (insertError) {
      console.error("Profile insert error:", insertError);
      return NextResponse.json({ error: "Profile creation failed" }, { status: 500 });
    }

    console.log("✅ /api/login called successfully for user:", username);
    return NextResponse.json({ success: true, user: newProfile });

  } catch (err) {
    console.error("Login API error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}