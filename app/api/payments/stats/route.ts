// app/api/payments/stats/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

export async function GET() {
  try {
    // Get count of unique receivers
    const { count: uniqueReceivers, error: countError } = await adminClient
      .from("unique_receivers")
      .select("*", { count: "exact", head: true });

    if (countError) {
      console.error("❌ Error counting unique receivers:", countError);
    }

    // Get total payments
    const { count: totalPayments, error: paymentError } = await adminClient
      .from("payments")
      .select("*", { count: "exact", head: true });

    if (paymentError) {
      console.error("❌ Error counting payments:", paymentError);
    }

    // Get recent unique receivers list
    const { data: receivers, error: receiversError } = await adminClient
      .from("unique_receivers")
      .select("wallet_address, first_payment_at")
      .order("first_payment_at", { ascending: false })
      .limit(10);

    if (receiversError) {
      console.error("❌ Error fetching receivers:", receiversError);
    }

    return NextResponse.json({
      uniqueReceivers: uniqueReceivers || 0,
      totalPayments: totalPayments || 0,
      receivers: receivers || [],
      requirementMet: (uniqueReceivers || 0) >= 10,
      remaining: Math.max(0, 10 - (uniqueReceivers || 0)),
    });
  } catch (error) {
    console.error("❌ Stats error:", error);
    return NextResponse.json(
      { error: "Failed to fetch stats", uniqueReceivers: 0, totalPayments: 0 },
      { status: 500 }
    );
  }
}
