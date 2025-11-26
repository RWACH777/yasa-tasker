// app/api/login/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Server-side client (full access)
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

    // 1️⃣ Create deterministic email
    const safe = pi_uid.replace(/[^a-zA-Z0-9]/g, "").slice(-12);
    const email = `${safe}@pi.mock`;

    // 2️⃣ Check if auth user exists
    const { data: userList } = await admin.auth.admin.listUsers();
    let authUser = userList.users.find((u) => u.email === email);

    // 3️⃣ Create new user if missing
    if (!authUser) {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password: crypto.randomUUID(),
        email_confirmed: true,
      });

      if (error) throw error;
      authUser = data.user;
    }

    const user_id = authUser.id;

    // 4️⃣ Generate session tokens
   // ... earlier code where you call admin.auth.admin.generateLink(...)
const { data: tokenData, error: tokenErr } = await admin.auth.admin.generateLink({
  type: "magiclink",
  email,
});
if (tokenErr) throw tokenErr;

// Grab the actual tokens from the returned object
const access_token = tokenData.properties.access_token;
const refresh_token = tokenData.properties.refresh_token;

// Upsert profile (keep the onConflict fix you already applied)
const { error: profileErr } = await admin
  .from("profiles")
  .upsert(
    {
      id: authUser.id,
      username,
      pi_uid,
      email,
    },
    { onConflict: "pi_uid" } // ensure this matches your unique constraint
  );
if (profileErr) throw profileErr;

// ✅ Return tokens in top-level fields the client expects
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
//