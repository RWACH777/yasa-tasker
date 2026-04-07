// app/api/payments/complete/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

export async function POST(req: Request) {
  try {
    const { paymentId, txid, amount, receiver, sender } = await req.json();
    
    console.log("🔵 Payment completion request:", { paymentId, txid, amount, receiver });

    if (!paymentId || !txid) {
      return NextResponse.json(
        { error: "Missing paymentId or txid" },
        { status: 400 }
      );
    }

    // Update the payment with completion details
    const { error: updateError } = await adminClient
      .from("payments")
      .update({
        txid: txid,
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("payment_id", paymentId);

    if (updateError) {
      console.error("❌ Error updating payment:", updateError);
    }

    // Record unique receiver for Testnet requirement tracking
    const { data: existingReceiver } = await adminClient
      .from("unique_receivers")
      .select("*")
      .eq("wallet_address", receiver)
      .single();

    if (!existingReceiver) {
      await adminClient.from("unique_receivers").insert({
        wallet_address: receiver,
        first_payment_at: new Date().toISOString(),
        total_payments: 1,
      });
      console.log("✅ New unique receiver recorded:", receiver);
    } else {
      await adminClient
        .from("unique_receivers")
        .update({
          total_payments: existingReceiver.total_payments + 1,
          last_payment_at: new Date().toISOString(),
        })
        .eq("wallet_address", receiver);
    }

    // Get count of unique receivers for progress tracking
    const { count } = await adminClient
      .from("unique_receivers")
      .select("*", { count: "exact", head: true });

    console.log("✅ Payment completed:", { paymentId, txid, uniqueReceivers: count });
    
    return NextResponse.json({
      success: true,
      completed: true,
      paymentId,
      txid,
      uniqueReceiversCount: count || 0,
    });
  } catch (error) {
    console.error("❌ Payment completion error:", error);
    return NextResponse.json(
      { error: "Payment completion failed", details: String(error) },
      { status: 500 }
    );
  }
}
