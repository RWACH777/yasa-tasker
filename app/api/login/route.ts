// app/api/login/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// server-side supabase client (bypasses RLS)
const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

export async function POST(req: Request) {
  try {
    const { username, pi_uid } = await req.json();
    console.log("🔵 /api/login HIT:", { username, pi_uid });

    if (!pi_uid || !username) {
      return NextResponse.json(
        { error: "Missing Pi user data" },
        { status: 400 }
      );
    }

    // ------------------------------------------------------------
    // 1️⃣ Create deterministic email for Supabase Auth
    // ------------------------------------------------------------
    const safe = pi_uid.replace(/[^a-zA-Z0-9]/g, "").slice(-12);
    const email = `${safe}@pi.mock`;

    // ------------------------------------------------------------
    // 2️⃣ Check if user already exists
    // ------------------------------------------------------------
    const { data: list } = await admin.auth.admin.listUsers();
    let authUser = list.users.find((u) => u.email === email);

    // ------------------------------------------------------------
    // 3️⃣ If not exist → create auth user
    // ------------------------------------------------------------
    if (!authUser) {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password: crypto.randomUUID(),
        email_confirmed: true,
        user_metadata: { username, pi_uid },
      });

      if (error) throw error;
      authUser = data.user;
    }

    // ------------------------------------------------------------
    // 4️⃣ Create a new auth session (the RIGHT way)
    // ------------------------------------------------------------
    const { data: tokenData, error: tokenErr } =
      await admin.auth.admin.generateLink({
        type: "magiclink",
        email,
      });

    if (tokenErr) throw tokenErr;

    const access_token = tokenData.properties.access_token;
    const refresh_token = tokenData.properties.refresh_token;

    // ------------------------------------------------------------
    // 5️⃣ Upsert profile row
    // ------------------------------------------------------------
    const { error: profileErr } = await admin
      .from("profiles")
      .upsert(
        {
          id: authUser.id,
          username,
          pi_uid,
          email,
        },
        { onConflict: "id" }
      );

    if (profileErr) throw profileErr;

    // ------------------------------------------------------------
    // 6️⃣ Return valid auth session to the client
    // ------------------------------------------------------------
    return NextResponse.json({
      success: true,
      user: {
        id: authUser.id,
        username,
        email,
      },
      access_token,
      refresh_token,
    });
  } catch (err: any) {
    console.error("❌ Login API error:", err);
    return NextResponse.json(
      { error: err.message || "Server error" },
      { status: 500 }
    );
  }
}