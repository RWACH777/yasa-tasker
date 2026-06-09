import { NextResponse } from "next/server";

const PI_HORIZON_URL = "https://api.mainnet.minepi.com";

export async function POST(req: Request) {
  try {
    const { txid, expectedRecipient, expectedAmount } = await req.json();

    if (!txid || !expectedRecipient) {
      return NextResponse.json(
        { error: "Missing transaction ID or recipient address." },
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
        op.to === expectedRecipient &&
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
