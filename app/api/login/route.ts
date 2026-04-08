// app/api/login/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Server-side Supabase admin client
let admin: any = null;

function getAdminClient() {
  if (!admin && supabaseUrl && serviceRoleKey) {
    admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });
  }
  return admin;
}

export async function POST(req: Request) {
  let step = "Parsing request";
  try {
    const { username, pi_uid, avatar_url } = await req.json();
    console.log("🔵 LOGIN API:", { username, pi_uid });

    step = "Checking env vars";

    // Check environment variables
    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      console.error("❌ Missing environment variables:", {
        hasUrl: !!supabaseUrl,
        hasServiceRole: !!serviceRoleKey,
        hasAnonKey: !!anonKey,
      });
      return NextResponse.json(
        { error: "Server configuration error", details: "Missing environment variables" },
        { status: 500 }
      );
    }

    if (!pi_uid || !username) {
      return NextResponse.json(
        { error: "Missing Pi user data", step },
        { status: 400 }
      );
    }

    step = "Creating email";
    // 1️⃣ Deterministic email
    const safe = pi_uid.replace(/[^a-zA-Z0-9]/g, "").slice(-12);
    const email = `${safe}@pi.mock`;

    step = "Checking existing user";
    // 2️⃣ Check if user exists
    console.log("📋 Checking for existing user with email:", email);
    const adminClient = getAdminClient();
    if (!adminClient) {
      throw new Error("Failed to initialize Supabase admin client at step: " + step);
    }
    
    const { data: userList, error: listError } = await adminClient.auth.admin.listUsers();
    
    if (listError) {
      console.error("❌ Error listing users:", listError);
      throw new Error(`Failed to list users: ${listError.message}`);
    }
    
    let existingUser = userList.users.find((u) => u.email === email);
    console.log("👤 Existing user found:", !!existingUser);

    step = "Creating user if needed";
    // 3️⃣ Create user if missing
    let newUser = null;

    if (!existingUser) {
      console.log("➕ Creating new user with email:", email);
      let createResult;
      try {
        createResult = await adminClient.auth.admin.createUser({
          email,
          password: crypto.randomUUID(),
          email_confirm: true,
        });
      } catch (createErr: any) {
        console.error("❌ Exception creating user:", createErr);
        throw new Error(`Exception creating user: ${createErr?.message || JSON.stringify(createErr)}`);
      }

      if (createResult.error) {
        console.error("❌ Error creating user:", createResult.error);
        throw new Error(`Failed to create user: ${createResult.error.message || JSON.stringify(createResult.error)}`);
      }
      newUser = createResult.data?.user;
      if (!newUser) {
        throw new Error("createUser returned no user data");
      }
      console.log("✅ New user created:", newUser.id);
    }

    const authUser = existingUser || newUser;
    console.log("✅ Auth user:", authUser.id);

    step = "Generating magic link";
    // 4️⃣ Generate a magic link and immediately use it to create a session
    console.log("🔗 Generating magic link for:", email);
    const { data: linkData, error: linkErr } = await adminClient.auth.admin.generateLink({
      type: "magiclink",
      email,
    });

    if (linkErr) {
      console.error("❌ Magic link generation error:", linkErr);
      throw linkErr;
    }

    console.log("📋 Magic link generated");

    // Extract the hashed token directly from the response
    const hashedToken = linkData?.properties?.hashed_token;
    if (!hashedToken) throw new Error("No hashed token in magic link response");

    console.log("🔐 Using hashed token to create session");
    const verifyUrl = `${supabaseUrl}/auth/v1/verify`;
    console.log("🌐 Calling verify endpoint:", verifyUrl);

    step = "Verifying session";
    // 5️⃣ Use the hashed token to create a session via the REST API
    const sessionResponse = await fetch(verifyUrl, {
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
    console.log("📦 Session verification result:", { 
      status: sessionResponse.status, 
      ok: sessionResponse.ok,
      hasAccessToken: !!(sessionData.access_token || sessionData.session?.access_token)
    });

    if (!sessionResponse.ok) {
      console.error("❌ Session verification failed:", sessionData);
      throw new Error(`Session verification failed at step [${step}]: ${sessionData.error_description || sessionData.error}`);
    }

    // Tokens can be at top level or in session object
    const access_token = sessionData.access_token || sessionData.session?.access_token;
    const refresh_token = sessionData.refresh_token || sessionData.session?.refresh_token;

    if (!access_token || !refresh_token) {
      console.error("❌ No tokens in session response:", sessionData);
      throw new Error(`Failed to extract tokens from session at step [${step}]`);
    }

    console.log("✅ Session tokens obtained successfully");

    step = "Upserting profile";
    // 6️⃣ Update or insert profile
    const { error: profileErr } = await adminClient.from("profiles").upsert(
      {
        id: authUser.id,
        username,
        pi_uid,
        email,
      }
    );

    if (profileErr) {
      console.error("❌ Profile upsert error:", profileErr);
      throw new Error(`Profile upsert failed at step [${step}]: ${profileErr.message}`);
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
  } catch (error: any) {
    console.error("❌ Login error at step [" + step + "]:", error);
    return NextResponse.json(
      { error: "Login failed at [" + step + "]", details: error?.message || String(error) },
      { status: 500 }
    );
  }
}
