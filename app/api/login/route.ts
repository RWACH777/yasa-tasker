import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Create normal Supabase client (uses anon key)
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function POST(req: Request) {
  try {
    const { username, pi_uid } = await req.json();

    if (!username || !pi_uid) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // Check if a profile already exists for this Pi user
    const { data: existingProfile, error: fetchError } = await supabase
      .from("profiles")
      .select("*")
      .eq("email", ${pi_uid}@pi.mock)
      .single();

    if (fetchError && fetchError.code !== "PGRST116") {
      console.error("Fetch error:", fetchError);
    }

    if (!existingProfile) {
      // Insert a new profile (allowed by your RLS policies)
      const { error: insertError } = await supabase.from("profiles").insert({
        username,
        email: `${pi_uid}@pi.mock`,
        created_at: new Date().toISOString(),
      });

      if (insertError) {
        console.error("Insert error:", insertError);
        return NextResponse.json({ error: "Profile insert failed" }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Login API error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}