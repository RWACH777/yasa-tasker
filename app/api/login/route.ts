// app/api/login/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Server-side Supabase admin client
const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

export async function POST(req: Request) {
  try {
    const { username, pi_uid, avatar_url } = await req.json();
    console.log("🔵 LOGIN API:", { username, pi_uid });

    if (!pi_uid || !username) {
      return NextResponse.json(
        { error: "Missing Pi user data" },
        { status: 400 }
      );
    }

    // 1️⃣ Deterministic email
    const safe = pi_uid.replace(/[^a-zA-Z0-9]/g, "").slice(-12);
    const email = `${safe}@pi.mock`;

    // 2️⃣ Check if user exists
    const { data: userList } = await admin.auth.admin.listUsers();
    let existingUser = userList.users.find((u) => u.email === email);

    // 3️⃣ Create user if missing
    let newUser = null;

    if (!existingUser) {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password: crypto.randomUUID(),
        email_confirmed: true,
      });

      if (error) throw error;
      newUser = data.user;
    }

    const authUser = existingUser || newUser;

    // 4️⃣ Generate session tokens
    const { data: tokenData, error: tokenErr } =
      await admin.auth.admin.generateLink({
        type: "magiclink",
        email,
      });

    if (tokenErr) throw tokenErr;

    const access_token = tokenData.properties.access_token;
    const refresh_token = tokenData.properties.refresh_token;

    // 5️⃣ Update or insert profile
    const { error: profileErr } = await admin.from("profiles").upsert(
      {
        id: authUser.id,
        username,
        pi_uid,
        email,
      },
      { onConflict: "pi_uid" }
    );

    if (profileErr) throw profileErr;

    // 6️⃣ Success response
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
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Login failed", details: String(error) },
      { status: 500 }
    );
  }
}