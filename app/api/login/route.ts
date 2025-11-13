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

    const clean = pi_uid.replace(/[^a-zA-Z0-9]/g, "").slice(-7);
    const email = `p${clean}@pi.mock`;
    console.log("EMAIL:", email);

    // 1. Create or fetch user via service-role
    const { data: existing } = await supabase.auth.admin.listUsers();
    let user = existing.users.find((u) => u.email === email);
    if (!user) {
      const { data: created } = await supabase.auth.admin.createUser({
        email,
        password: crypto.randomUUID(),
        email_confirmed: true,
        user_metadata: { username, pi_uid },
      });
      user = created.user;
      if (!user) throw new Error("User creation failed");
    }

    // 2. ADMIN create session instantly (no password, no OTP)
    const { data: sessionData, error: sessionErr } =
      await supabase.auth.admin.generateLink({
        type: "magiclink",
        email,
        options: { redirectTo: "https://yasa-tasker-official.vercel.app" },
      });
    if (sessionErr) throw sessionErr;

    // 3. Use the generated access_token
    const { data: session, error: signErr } =
      await supabase.auth.getUser(sessionData.properties.access_token);
    if (signErr) throw signErr;

    // 4. Upsert profile
    await supabase
      .from("profiles")
      .upsert({ id: user.id, username, pi_uid, email }, { onConflict: "id" });

    // 5. Return official tokens
    return NextResponse.json({
      success: true,
      user: { id: user.id, username, email },
      access_token: sessionData.properties.access_token,
      refresh_token: sessionData.properties.refresh_token,
    });
  } catch (err: any) {
    console.error("Login API error:", err);
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}