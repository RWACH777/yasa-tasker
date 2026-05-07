// app/api/payments/approve/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const piApiKey = process.env.PI_API_KEY!;

const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

export async function POST(req: Request) {
  try {
    const { paymentId, amount, receiver, sender } = await req.json();
    
    console.log("🔵 Payment approval request:", { paymentId, amount, receiver, sender });

    if (!paymentId || !amount || !receiver) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Store the pending payment in Supabase
    const { error: insertError } = await adminClient.from("payments").insert({
      payment_id: paymentId,
      amount: amount,
      receiver: receiver,
      sender: sender || "unknown",
      status: "pending",
      created_at: new Date().toISOString(),
    });

    if (insertError) {
      console.error("❌ Error storing payment:", insertError);
    }

    // Call Pi API to approve the payment
    console.log("🔵 Calling Pi API to approve payment:", paymentId);
    const piResponse = await fetch(`https://api.minepi.com/v2/payments/${paymentId}/approve`, {
      method: "POST",
      headers: {
        "Authorization": `Key ${piApiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!piResponse.ok) {
      const piError = await piResponse.text();
      console.error("❌ Pi API approval failed:", piError);
      return NextResponse.json(
        { error: "Pi API approval failed", details: piError },
        { status: piResponse.status }
      );
    }

    const piResult = await piResponse.json();
    console.log("✅ Pi API approval success:", piResult);
    
    return NextResponse.json({
      success: true,
      approved: true,
      paymentId,
      piResponse: piResult,
    });
  } catch (error) {
    console.error("❌ Payment approval error:", error);
    return NextResponse.json(
      { error: "Payment approval failed", details: String(error) },
      { status: 500 }
    );
  }
}
