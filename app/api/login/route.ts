import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function POST(req: Request) {
  console.log("📩 /api/login route hit"); // 👈 Add this line

  try {
    const { pi_uid, username, avatar_url } = await req.json();
    console.log("➡️ Incoming data:", { pi_uid, username, avatar_url }); // 👈 Add this

    if (!pi_uid || !username) {
      return NextResponse.json(
        { error: "Missing Pi user data" },
        { status: 400 }
      );
    }

    // rest of your existing code...
  } catch (err: any) {
    console.error("❌ Login route error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}