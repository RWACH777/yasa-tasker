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

    // 1. Create / fetch user
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

    // 2. Mint official Supabase JWT (service-role)
    const token = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    const access_token = token.data.properties.access_token;
    const refresh_token = token.data.properties.refresh_token;

    // 3. Force the session on the client side
    await supabase.auth.setSession({ access_token, refresh_token });

    // 4. Upsert profile
    await supabase
      .from("profiles")
      .upsert({ id: user.id, username, pi_uid, email }, { onConflict: "id" });

    // 5. Return tokens
    return NextResponse.json({
      success: true,
      user: { id: user.id, username, email },
      access_token,
      refresh_token,
    });
  } catch (err: any) {
    console.error("Login API error:", err);
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}