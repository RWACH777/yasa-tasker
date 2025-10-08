"use client";
export const PI_APP_CONFIG = {
  appId: process.env.NEXT_PUBLIC_PI_APP_ID || "YOUR_PI_APP_ID_HERE",
  accessToken: process.env.NEXT_PUBLIC_PI_ACCESS_TOKEN || "YOUR_PI_ACCESS_TOKEN_HERE",
};

// Helper to detect if running inside Pi Browser
const isPiBrowser = () =>
  typeof window !== "undefined" && (window as any).Pi !== undefined;

/**
 * Initializes a Pi payment.
 * - If inside Pi Browser, calls the real Pi SDK.
 * - If not, simulates a payment for testing.
 */
export const initPiPayment = async (
  amount: number,
  memo: string,
  metadata: any
) => {
  try {
    // ✅ If not in Pi Browser — simulate a successful payment
    if (!isPiBrowser()) {
      console.log("⚙️ Mock Pi payment (dev mode):", { amount, memo, metadata });
      return {
        txid: `mock-${Date.now()}`,
        amount,
        memo,
        metadata,
        status: "COMPLETED",
      };
    }

    // ✅ Real payment path (in Pi Browser)
    const Pi = (window as any).Pi;
    if (!Pi || !Pi.createPayment) {
      console.warn("Pi SDK not available in this environment.");
      return null;
    }

    // Configure Pi SDK
    Pi.init({ version: "2.0" });

    // Create payment
    const payment = await Pi.createPayment({
      amount,
      memo,
      metadata,
      onReadyForServerApproval: (paymentId: string) => {
        console.log("✅ Payment ready for server approval:", paymentId);
      },
      onReadyForServerCompletion: (paymentId: string, txid: string) => {
        console.log("✅ Payment ready for server completion:", paymentId, txid);
      },
      onCancel: (paymentId: string) => {
        console.log("❌ Payment cancelled:", paymentId);
      },
      onError: (error: any, payment?: any) => {
        console.error("⚠️ Payment error:", error, payment);
      },
    });

    return payment;
  } catch (error) {
    console.error("❌ Pi payment failed:", error);
    return null;
  }
};