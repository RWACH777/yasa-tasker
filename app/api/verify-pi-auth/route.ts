// app/api/verify-pi-auth/route.ts
import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { mockPiAuthenticate } from "../../../lib/piAuth";

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
      // In production: reject unverified tokens outright
      if (process.env.NODE_ENV === "production") {
        console.warn("⚠️ Token verification failed in production — rejecting");
        return NextResponse.json({ error: "Token verification failed" }, { status: 401 });
      }
      // On localhost only: allow through for dev testing
      console.warn("⚠️ Token verification failed, allowing through in dev mode");
      return NextResponse.json({ success: true, verified: false, user });
    }
  } catch (error) {
    console.error("❌ Verification failed:", error);
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}