import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// ✅ Server-side client – bypasses RLS
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
});

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

    // 🟢 Otherwise, create a new profile (upsert to avoid username clash)
const { data: newProfile, error: insertError } = await supabase
  .from("profiles")
  .upsert(
    {
      username,          // unique key
      pi_uid,            // will be updated if user exists
      email: `${pi_uid}@pi.mock`,
      created_at: new Date().toISOString(),
    },
    { onConflict: "username" }   // tells Postgres to DO UPDATE if username exists
  )
  .select()
  .single();

    if (insertError) {
      console.error("Profile insert error:", insertError);
      return NextResponse.json({ error: "Profile creation failed" }, { status: 500 });
    }

    // 1. Mint our own Supabase JWT (service-role)
    import jwt from "jsonwebtoken"; // npm install jsonwebtoken @types/jsonwebtoken
    const supabaseJwt = jwt.sign(
      {
        sub: newProfile?.id ?? existingProfile.id,
        email: `${pi_uid}@pi.mock`,
        role: "authenticated",
        pi_uid,
      },
      process.env.SUPABASE_JWT_SECRET!, // add this env var = service role key
      { expiresIn: "1h" }
    );

    // 2. Set cookie & return
    return NextResponse.json(
      { success: true, user: newProfile || existingProfile },
      {
        status: 200,
        headers: {
          "Set-Cookie": `sb-access-token=${supabaseJwt}; Path=/; HttpOnly; SameSite=Lax; Max-Age=3600`,
        },
      }
    );

  } catch (err) {
    console.error("Login API error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}