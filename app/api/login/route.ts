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

    const email = `${pi_uid.slice(-8)}@pi.mock`; // last 8 chars only

    // 1. Create user (or fetch existing) with strong random password
    const { data: existing } = await supabase.auth.admin.listUsers();
    let user = existing.users.find((u) => u.email === email);
    if (!user) {
      const { data: created } = await supabase.auth.admin.createUser({
        email,
        password: crypto.randomUUID(), // one-time random password
        email_confirmed: true,
        user_metadata: { username, pi_uid },
      });
      user = created.user;
      if (!user) throw new Error("User creation failed");
    }

    // 2. Generate a magic-link (OTP) token
    const { data: otpData, error: otpErr } =
      await supabase.auth.signInWithOtp({ email });
    if (otpErr) throw otpErr;

    // 3. Immediately verify the OTP ourselves (server-side)
    const { data: sessionData, error: verifyErr } =
      await supabase.auth.verifyOtp({ email, token: otpData.session?.access_token || "", type: "magiclink" });
    if (verifyErr) throw verifyErr;

    // 4. Upsert profile row
    await supabase
      .from("profiles")
      .upsert({ id: user.id, username, pi_uid, email }, { onConflict: "id" });

    // 5. Return official Supabase tokens
    return NextResponse.json({
      success: true,
      user: { id: user.id, username, email },
      access_token: sessionData.session.access_token,
      refresh_token: sessionData.session.refresh_token,
    });
  } catch (err: any) {
    console.error("Login API error:", err);
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}