import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { decryptWallet } from "@/lib/walletEncryption";

const PI_HORIZON_URL = "https://api.mainnet.minepi.com";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

async function resolveRecipientWallet(
  taskId: string
): Promise<{ wallet: string | null; freelancerId: string | null }> {
  const admin = getAdminClient();

  const { data: task } = await admin
    .from("tasks")
    .select("assignee_id")
    .eq("id", taskId)
    .single();

  if (!task?.assignee_id) return { wallet: null, freelancerId: null };

  const { data: profile } = await admin
    .from("profiles")
    .select("id, user_wallet_address, wallet_address")
    .eq("id", task.assignee_id)
    .single();

  if (!profile) return { wallet: null, freelancerId: null };

  let wallet: string | null = null;
  if (profile.user_wallet_address) {
    try { wallet = decryptWallet(profile.user_wallet_address); } catch (_) {}
  } else if (profile.wallet_address) {
    wallet = profile.wallet_address;
  }

  return { wallet, freelancerId: profile.id };
}

export async function POST(req: Request) {
  try {
    const { txid, expectedRecipient, expectedAmount, taskId } = await req.json();

    if (!txid) {
      return NextResponse.json(
        { error: "Missing transaction ID." },
        { status: 400 }
      );
    }

    // Resolve recipient wallet: prefer server-side lookup via taskId (secure),
    // fall back to client-supplied expectedRecipient for legacy calls.
    let recipientWallet = expectedRecipient || null;
    if (!recipientWallet && taskId) {
      const { wallet } = await resolveRecipientWallet(taskId);
      recipientWallet = wallet;
    }

    if (!recipientWallet) {
      return NextResponse.json(
        { error: "Freelancer has not saved a wallet address yet. Ask them to add it in their YASA Tasker profile under Payment Information." },
        { status: 400 }
      );
    }

    // Step 1: Fetch transaction from Pi blockchain (Horizon API)
    const txRes = await fetch(`${PI_HORIZON_URL}/transactions/${txid.trim()}`, {
      headers: { Accept: "application/json" },
    });

    if (!txRes.ok) {
      if (txRes.status === 404) {
        return NextResponse.json(
          { error: "Transaction not found on the Pi blockchain. Please double-check the transaction ID." },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: "Failed to reach the Pi blockchain. Please try again in a moment." },
        { status: 502 }
      );
    }

    const txData = await txRes.json();

    if (!txData.successful) {
      return NextResponse.json(
        { error: "This transaction was not successful on the Pi blockchain." },
        { status: 400 }
      );
    }

    // Step 2: Fetch operations to verify recipient and amount
    const opsRes = await fetch(
      `${PI_HORIZON_URL}/transactions/${txid.trim()}/operations`,
      { headers: { Accept: "application/json" } }
    );

    if (!opsRes.ok) {
      return NextResponse.json(
        { error: "Failed to fetch transaction details from Pi blockchain." },
        { status: 502 }
      );
    }

    const opsData = await opsRes.json();
    const operations: any[] = opsData._embedded?.records || [];

    // Step 3: Find a native Pi payment operation to the expected recipient
    const paymentOp = operations.find(
      (op: any) =>
        op.type === "payment" &&
        op.to === recipientWallet &&
        op.asset_type === "native"
    );

    if (!paymentOp) {
      return NextResponse.json(
        {
          error: `No Pi payment to the freelancer's wallet found in this transaction. Make sure you sent Pi to the correct wallet address.`,
        },
        { status: 400 }
      );
    }

    // Step 4: Verify amount (allow 1% tolerance for rounding)
    const paidAmount = parseFloat(paymentOp.amount);
    const requiredAmount = parseFloat(String(expectedAmount || 0));

    if (requiredAmount > 0 && paidAmount < requiredAmount * 0.99) {
      return NextResponse.json(
        {
          error: `Payment amount (${paidAmount.toFixed(4)} π) is less than the agreed task budget (${requiredAmount.toFixed(4)} π).`,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      verified: true,
      paidAmount,
      recipient: paymentOp.to,
      txid: txData.hash,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Verification error: " + (err.message || "Unknown error") },
      { status: 500 }
    );
  }
}
