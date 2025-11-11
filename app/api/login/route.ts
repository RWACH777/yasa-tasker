import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// ✅ Server-side client – bypasses RLS
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
});

export async function POST(req: Request) {
  try {
    const { username, pi_uid } = await req.json();
    console.log("LOGIN HIT:", { username, pi_uid });

    // 1. upsert profile (new or existing)
    const { data: profile, error: upsertError } = await supabase
      .from("profiles")
      .upsert(
        { username, pi_uid, email: `${pi_uid}@pi.mock` },
        { onConflict: "username" }
      )
      .select()
      .single();
    if (upsertError) throw upsertError;

    console.log("Profile upserted:", profile);

    // 2. mint JWT & set cookie
    console.log("ABOUT TO MINT JWT for user:", profile.id);
    const supabaseJwt = jwt.sign(
      { sub: profile.id, email: `${pi_uid}@pi.mock`, role: "authenticated", pi_uid },
      process.env.SUPABASE_JWT_SECRET!,
      { expiresIn: "1h" }
    );

    return NextResponse.json(
      { success: true, user: profile },
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

      } catch (err) {
    console.error("Login API error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}