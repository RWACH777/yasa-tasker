// app/api/login/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

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
        email_confirm: true,
      });

      if (error) throw error;
      newUser = data.user;
    }

    const authUser = existingUser || newUser;
    console.log("✅ Auth user:", authUser.id);

    // 4️⃣ Generate a magic link and immediately use it to create a session
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });

    if (linkErr) throw linkErr;

    console.log("📋 Magic link generated");

    // Extract the hashed token directly from the response
    const hashedToken = linkData?.properties?.hashed_token;
    if (!hashedToken) throw new Error("No hashed token in magic link response");

    console.log("🔐 Using hashed token to create session");

    // 5️⃣ Use the hashed token to create a session via the REST API
    const sessionResponse = await fetch(`${supabaseUrl}/auth/v1/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": anonKey,
      },
      body: JSON.stringify({
        token_hash: hashedToken,
        type: "magiclink",
      }),
    });

    const sessionData = await sessionResponse.json();

    if (!sessionResponse.ok) {
      console.error("❌ Session verification failed:", sessionData);
      throw new Error(`Session verification failed: ${sessionData.error_description || sessionData.error}`);
    }

    // Tokens can be at top level or in session object
    const access_token = sessionData.access_token || sessionData.session?.access_token;
    const refresh_token = sessionData.refresh_token || sessionData.session?.refresh_token;

    if (!access_token || !refresh_token) {
      console.error("❌ No tokens in session response:", sessionData);
      throw new Error("Failed to extract tokens from session");
    }

    console.log("✅ Session tokens obtained successfully");

    // 6️⃣ Update or insert profile
    const { error: profileErr } = await admin.from("profiles").upsert(
      {
        id: authUser.id,
        username,
        pi_uid,
        email,
      },
      { onConflict: "pi_uid" }
    );

    if (profileErr) {
      console.error("❌ Profile upsert error:", profileErr);
      throw profileErr;
    }

    console.log("✅ Profile upserted successfully");

    // 7️⃣ Success response
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
    console.error("❌ Login error:", error);
    return NextResponse.json(
      { error: "Login failed", details: String(error) },
      { status: 500 }
    );
  }
}
