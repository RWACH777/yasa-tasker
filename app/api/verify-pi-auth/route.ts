// app/api/verify-pi-auth/route.ts
import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";

const APP_ACCESS_TOKEN = process.env.PI_APP_ACCESS_TOKEN || "YOUR_APP_ACCESS_TOKEN";

export async function POST(req: Request) {
  try {
    const { user, accessToken } = await req.json();

    if (!user || !accessToken) {
      return NextResponse.json({ error: "Missing credentials" }, { status: 400 });
    }

    // 🔹 Verify the Pi JWT when on mainnet / real Pi browser
    try {
      const decoded = jwt.verify(accessToken, APP_ACCESS_TOKEN);
      return NextResponse.json({ success: true, verified: true, user: decoded });
    } catch (err) {
      console.warn("⚠️ Token verification failed, possibly mock/local login:", err);
      // fallback for localhost testing
      return NextResponse.json({ success: true, verified: false, user });
    }
  } catch (error) {
    console.error("❌ Verification failed:", error);
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}