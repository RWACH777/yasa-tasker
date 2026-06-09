"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";
import { injectMockPiSDK } from "@/lib/piMock";

export default function MembershipPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [membership, setMembership] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [txid, setTxid] = useState("");
  const [memo, setMemo] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentProcessing, setPaymentProcessing] = useState(false);

  useEffect(() => {
    // Inject mock Pi SDK for local testing
    injectMockPiSDK();
    
    // Initialize Pi SDK on mount
    const initPi = () => {
      const Pi = (window as any).Pi;
      if (Pi) {
        try {
          Pi.init({ version: "2.0", sandbox: false });
          console.log("✅ Pi SDK initialized on mount");
        } catch (err) {
          console.error("❌ Pi SDK init on mount failed:", err);
        }
      }
    };
    
    // Try to init immediately and after a delay
    initPi();
    setTimeout(initPi, 1000);
    
    const loadData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        router.push("/");
        return;
      }

      setUser(session.user);
      
      // Load membership data
      const { data: membershipData } = await supabase
        .from("memberships")
        .select("*")
        .eq("user_id", session.user.id)
        .single();

      setMembership(membershipData);
      
      // Pre-fill memo with MEMBERSHIP-username format
      setMemo(`MEMBERSHIP-${session.user.user_metadata?.username || session.user.id.slice(0, 8)}`);
      
      setLoading(false);
    };

    loadData();
  }, [router]);

  // Function to initiate Pi payment for membership
  const initiatePiPayment = async () => {
    if (!user) return;

    const Pi = (window as any).Pi;
    if (!Pi) {
      const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      if (isLocal) {
        alert("🔧 Mock Pi SDK not initialized. Please refresh the page.");
      } else {
        alert("Pi SDK not available. Please open this in Pi Browser.");
      }
      return;
    }

    // Initialize Pi SDK and authenticate with payment scope
    try {
      Pi.init({ version: "2.0", sandbox: false });
      console.log("✅ Pi SDK initialized");
      
      // Authenticate with payment scope. The onIncompletePaymentFound callback
      // is required by the Pi Platform SDK when requesting the "payments" scope.
      const authResult = await Pi.authenticate(
        ["username", "payments", "wallet_address"],
        (payment: any) => {
          console.warn("⚠️ Incomplete Pi payment found:", payment);
        }
      );
      console.log("✅ Pi authenticated with payment scope:", authResult);

      if (!authResult?.accessToken) {
        alert("Pi did not grant the 'payments' permission. Please approve it in Pi Browser and try again.");
        setPaymentProcessing(false);
        return;
      }
    } catch (err) {
      console.error("❌ Pi SDK init or auth failed:", err);
      alert("Failed to authenticate with Pi Network. Please try again.");
      setPaymentProcessing(false);
      return;
    }

    setPaymentProcessing(true);

    // Generate unique memo for membership payment
    const timestamp = Date.now();
    const memoRef = `MEMBERSHIP-${user.user_metadata?.username || user.id.slice(0, 8)}-${timestamp}`;
    setMemo(memoRef);

    const paymentData = {
      amount: 155, // 155 Pi (~$20 USD) for membership
      memo: memoRef,
      metadata: {
        membership_payment: true,
        user_id: user.id,
        username: user.user_metadata?.username || user.id.slice(0, 8),
        recipient: "GCU5JNKCZXFDH3EJFIH5UKCSA24ZUXJC4YB5OZ6AOSYDC4YHIIFJG4SM",
      },
    };

    console.log("Creating Pi membership payment:", paymentData);

    try {
      const payment = await Pi.createPayment(paymentData, {
        onReadyForServerApproval: async (paymentId: string) => {
          console.log("Membership payment ready for approval:", paymentId);

          // Server-side approval (required by Pi before submitting to blockchain).
          const res = await fetch("/api/payments/approve", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ paymentId }),
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err?.error || "Server approval failed");
          }

          // Save payment record
          await supabase.from("transactions").insert({
            payment_id: paymentId,
            tasker_id: user.id,
            amount: 155,
            memo: memoRef,
            status: "payment_pending",
            type: "membership",
            created_at: new Date().toISOString(),
          });
        },
        onReadyForServerCompletion: async (paymentId: string, receivedTxid: string) => {
          console.log("Membership payment completed:", { paymentId, txid: receivedTxid });

          // Server-side completion (proves to Pi the app has the txid).
          const res = await fetch("/api/payments/complete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ paymentId, txid: receivedTxid }),
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err?.error || "Server completion failed");
          }

          // Update transaction with TXID
          await supabase
            .from("transactions")
            .update({ 
              txid: receivedTxid,
              status: "payment_submitted",
              submitted_at: new Date().toISOString(),
            })
            .eq("payment_id", paymentId);

          // Update membership record
          await supabase
            .from("memberships")
            .update({
              payment_txid: receivedTxid,
              status: "pending_review",
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", user.id);

          setTxid(receivedTxid);
          setSubmitted(true);
          setShowPaymentModal(false);
          setPaymentProcessing(false);
        },
        onCancel: async (paymentId: string) => {
          console.log("Membership payment cancelled:", paymentId);
          await supabase
            .from("transactions")
            .update({ status: "cancelled" })
            .eq("payment_id", paymentId);
          setPaymentProcessing(false);
          alert("Payment was cancelled");
        },
        onError: async (error: any, paymentId?: string) => {
          console.error("Membership payment error:", error);
          await supabase.from("payment_errors").insert({
            payment_id: paymentId || "unknown",
            error: JSON.stringify(error),
            type: "membership",
            created_at: new Date().toISOString(),
          });
          setPaymentProcessing(false);
          alert("Payment failed: " + (error?.message || "Unknown error"));
        },
      });

      console.log("Membership payment created:", payment);
    } catch (err) {
      console.error("Failed to create membership payment:", err);
      setPaymentProcessing(false);
      alert("Failed to create payment: " + (err as Error).message);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!txid || !membership) return;

    setSubmitting(true);
    
    try {
      const { error } = await supabase
        .from("memberships")
        .update({
          payment_txid: txid,
          status: "pending_review",
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);

      if (error) {
        console.error("Error submitting payment:", error);
        alert("Failed to submit. Please try again.");
        setSubmitting(false);
        return;
      }

      setSubmitted(true);
    } catch (err) {
      console.error("Error:", err);
      alert("An error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "text-green-400";
      case "pending_review": return "text-yellow-400";
      case "expired": return "text-red-400";
      default: return "text-white";
    }
  };

  const getNextPaymentDate = () => {
    if (!membership?.started_at) return "N/A";
    const startDate = new Date(membership.started_at);
    const nextDate = new Date(startDate);
    nextDate.setDate(startDate.getDate() + 30);
    return nextDate.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="app-background min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="app-background min-h-screen p-4">
      <div className="max-w-md mx-auto pt-8">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20">
          <h1 className="text-2xl font-bold text-white mb-6 text-center">Membership</h1>

          {/* Status Card */}
          <div className="bg-black/20 rounded-xl p-4 mb-6">
            <div className="flex justify-between items-center mb-3">
              <span className="text-white/60">Status</span>
              <span className={`font-semibold capitalize ${getStatusColor(membership?.status)}`}>
                {membership?.status?.replace("_", " ")}
              </span>
            </div>
            <div className="flex justify-between items-center mb-3">
              <span className="text-white/60">Started</span>
              <span className="text-white">
                {membership?.started_at ? new Date(membership.started_at).toLocaleDateString() : "N/A"}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-white/60">Next Payment Due</span>
              <span className="text-white">{getNextPaymentDate()}</span>
            </div>
          </div>

          {submitted ? (
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-white font-medium">Payment Submitted</p>
              <p className="text-white/60 text-sm mt-2">
                Admin will verify your payment within 24 hours.
              </p>
            </div>
          ) : (
            <>
              {/* Payment Instructions */}
              <div className="bg-blue-500/10 rounded-xl p-4 mb-6 border border-blue-500/20">
                <h3 className="text-blue-400 font-medium mb-2">Payment Instructions</h3>
                <p className="text-white/80 text-sm mb-3">
                  Send exactly <strong className="text-white">155 π</strong> (~$20 USD) to:
                </p>
                <div className="bg-black/30 rounded-lg p-3 mb-3">
                  <span className="text-white font-mono text-xs break-all">GCU5JNKCZXFDH3EJFIH5UKCSA24ZUXJC4YB5OZ6AOSYDC4YHIIFJG4SM</span>
                </div>
                <p className="text-white/80 text-sm mb-2">With memo:</p>
                <div className="bg-black/30 rounded-lg p-3">
                  <span className="text-white font-mono text-sm">{memo}</span>
                </div>
              </div>

              {/* Pi Payment Button */}
              <button
                onClick={initiatePiPayment}
                disabled={paymentProcessing}
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold py-4 px-6 rounded-xl transition-all disabled:opacity-50 mb-4 flex items-center justify-center gap-2"
              >
                {paymentProcessing ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Processing...
                  </>
                ) : (
                  <>
                    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                    </svg>
                    Pay with Pi
                  </>
                )}
              </button>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/20"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white/10 text-white/60 rounded">Or submit manually</span>
                </div>
              </div>

              {/* Manual Submit Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-white/60 text-sm mb-2">TXID (from your Pi app)</label>
                  <input
                    type="text"
                    value={txid}
                    onChange={(e) => setTxid(e.target.value)}
                    placeholder="Enter transaction ID"
                    className="w-full bg-black/20 border border-white/20 rounded-lg px-4 py-2 text-white placeholder-white/40 focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-white/60 text-sm mb-2">Memo Used</label>
                  <input
                    type="text"
                    value={memo}
                    onChange={(e) => setMemo(e.target.value)}
                    className="w-full bg-black/20 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting || !txid}
                  className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-6 rounded-xl transition-all disabled:opacity-50"
                >
                  {submitting ? "Submitting..." : "Submit Payment"}
                </button>
              </form>
            </>
          )}

          <Link 
            href="/dashboard"
            className="block text-center text-white/60 hover:text-white mt-6 text-sm"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
