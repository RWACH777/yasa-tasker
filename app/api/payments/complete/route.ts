import { NextRequest, NextResponse } from "next/server";

// Pi Platform API base path (see https://github.com/pi-apps/pi-platform-docs)
const PI_API_URL = "https://api.minepi.com/v2";

/**
 * Server-side completion for a User-To-App (U2A) Pi payment.
 *
 * The Pi client SDK calls `onReadyForServerCompletion(paymentId, txid)` once
 * the user has signed and submitted the transaction. The frontend POSTs the
 * paymentId and txid here, and this endpoint proves to the Pi servers (using
 * the Server API Key) that the app has the txid, allowing the payment flow to
 * close successfully.
 */
export async function POST(req: NextRequest) {
  try {
    const { paymentId, txid } = await req.json();

    if (!paymentId || !txid) {
      return NextResponse.json(
        { error: "Missing paymentId or txid" },
        { status: 400 }
      );
    }

    const piApiKey = process.env.PI_API_KEY;

    if (!piApiKey) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("⚠️ PI_API_KEY not set — returning mock completion (dev only)");
        return NextResponse.json({ success: true, mock: true, paymentId, txid });
      }
      return NextResponse.json(
        { error: "Server is not configured for Pi payments (missing PI_API_KEY)." },
        { status: 500 }
      );
    }

    const response = await fetch(`${PI_API_URL}/payments/${paymentId}/complete`, {
      method: "POST",
      headers: {
        Authorization: `Key ${piApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ txid }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error("Pi complete failed:", data);
      return NextResponse.json(
        { error: data?.error_message || data?.error || "Pi completion failed", details: data },
        { status: response.status }
      );
    }

    return NextResponse.json({ success: true, payment: data });
  } catch (error: any) {
    console.error("Complete route error:", error);
    return NextResponse.json(
      { error: error?.message || "Completion failed" },
      { status: 500 }
    );
  }
}
