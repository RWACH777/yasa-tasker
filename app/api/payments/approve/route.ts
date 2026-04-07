// app/api/payments/approve/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

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

    // Store the pending payment
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
      // Continue anyway - don't block the payment
    }

    // Approve the payment immediately for Testnet
    console.log("✅ Payment approved:", paymentId);
    
    return NextResponse.json({
      success: true,
      approved: true,
      paymentId,
    });
  } catch (error) {
    console.error("❌ Payment approval error:", error);
    return NextResponse.json(
      { error: "Payment approval failed", details: String(error) },
      { status: 500 }
    );
  }
}
