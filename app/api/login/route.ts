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

    // 1. Ensure a Supabase user exists (use pi_uid as email local-part)
    const email = `${pi_uid}@pi.mock`;
    const { data: existing } = await supabase.auth.admin.listUsers();
    const found = existing.users.find((u) => u.email === email);

    let userId: string;
    if (found) {
      userId = found.id;
    } else {
      const { data: created } = await supabase.auth.admin.createUser({
        email,
        password: "PiStorageTempPassword123!", //fixed strong password
        email_confirmed: true,
        user_metadata: { username, pi_uid },
      });
      if (!created.user) throw new Error("User creation failed");
      userId = created.user.id;
    }

    // 2. Create a session (access + refresh token)
    const { data: sessionData, error: sessionErr } =
      await supabase.auth.signInWithPassword({ email, password: pi_uid });
    if (sessionErr) throw sessionErr;

    // 3. Upsert profile row (same id)
    const { error: profileErr } = await supabase
      .from("profiles")
      .upsert({ id: userId, username, pi_uid, email }, { onConflict: "id" });
    if (profileErr) throw profileErr;

    // 4. Return session tokens to frontend
    return NextResponse.json({
      success: true,
      user: { id: userId, username, email },
      access_token: sessionData.session.access_token,
      refresh_token: sessionData.session.refresh_token,
    });
  } catch (err: any) {
    console.error("Login API error:", err);
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}