import { NextRequest, NextResponse } from "next/server";

// Pi Platform API base path (see https://github.com/pi-apps/pi-platform-docs)
const PI_API_URL = "https://api.minepi.com/v2";

/**
 * Server-side approval for a User-To-App (U2A) Pi payment.
 *
 * The Pi client SDK calls `onReadyForServerApproval(paymentId)` during
 * `createPayment`. The frontend then POSTs that paymentId here, and this
 * endpoint proves to the Pi servers (using the Server API Key) that the app
 * approves the payment, enabling the user to submit it to the blockchain.
 */
export async function POST(req: NextRequest) {
  try {
    const { paymentId } = await req.json();

    if (!paymentId) {
      return NextResponse.json({ error: "Missing paymentId" }, { status: 400 });
    }

    const piApiKey = process.env.PI_API_KEY;

    // Without a configured Server API Key we cannot talk to Pi. Allow a mock
    // response only on non-production so local testing keeps working.
    if (!piApiKey) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("⚠️ PI_API_KEY not set — returning mock approval (dev only)");
        return NextResponse.json({ success: true, mock: true, paymentId });
      }
      return NextResponse.json(
        { error: "Server is not configured for Pi payments (missing PI_API_KEY)." },
        { status: 500 }
      );
    }

    const response = await fetch(`${PI_API_URL}/payments/${paymentId}/approve`, {
      method: "POST",
      headers: {
        Authorization: `Key ${piApiKey}`,
        "Content-Type": "application/json",
      },
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error("Pi approve failed:", data);
      return NextResponse.json(
        { error: data?.error_message || data?.error || "Pi approval failed", details: data },
        { status: response.status }
      );
    }

    return NextResponse.json({ success: true, payment: data });
  } catch (error: any) {
    console.error("Approve route error:", error);
    return NextResponse.json(
      { error: error?.message || "Approval failed" },
      { status: 500 }
    );
  }
}
