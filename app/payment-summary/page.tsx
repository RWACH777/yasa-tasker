"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";

export default function PaymentSummaryPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);

  const taskId = searchParams.get("task");
  const txid = searchParams.get("txid");
  const memo = searchParams.get("memo");
  const amount = searchParams.get("amount");
  const to = searchParams.get("to");

  useEffect(() => {
    const loadUser = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session?.user) {
        setUser(data.session.user);
      }
      setLoading(false);
    };
    loadUser();
  }, []);

  const handleConfirmPayment = async () => {
    if (!taskId || !txid) return;

    setConfirming(true);
    try {
      // Update task status to payment_confirmed
      const { error: taskError } = await supabase
        .from("tasks")
        .update({ 
          status: "payment_confirmed",
          payment_txid: txid,
          payment_confirmed_at: new Date().toISOString(),
        })
        .eq("id", taskId);

      if (taskError) {
        console.error("Failed to update task:", taskError);
        alert("Failed to confirm payment. Please try again.");
        setConfirming(false);
        return;
      }

      // Update transaction status
      await supabase
        .from("transactions")
        .update({ status: "payment_confirmed" })
        .eq("task_id", taskId);

      // Redirect to rating flow
      router.push(`/rate?task=${taskId}&type=tasker`);
    } catch (err) {
      console.error("Error confirming payment:", err);
      alert("An error occurred. Please try again.");
      setConfirming(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 p-4">
      <div className="max-w-md mx-auto pt-12">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20">
          {/* Success Icon */}
          <div className="text-center mb-6">
            <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-12 h-12 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Payment Sent Successfully</h1>
            <p className="text-white/60">Your payment has been submitted to the Pi Network</p>
          </div>

          {/* Payment Details */}
          <div className="bg-black/20 rounded-xl p-4 mb-6 space-y-3">
            <div className="flex justify-between">
              <span className="text-white/60">Freelancer:</span>
              <span className="text-white font-medium">{to || "Unknown"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/60">Amount:</span>
              <span className="text-white font-medium">{amount} π</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/60">Reference:</span>
              <span className="text-white font-medium text-sm">{memo}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/60">TXID:</span>
              <a 
                href={`https://blockexplorer.minepi.com/tx/${txid}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 text-sm truncate max-w-[150px]"
              >
                {txid?.slice(0, 16)}... ↗
              </a>
            </div>
          </div>

          {/* Confirm Button */}
          <button
            onClick={handleConfirmPayment}
            disabled={confirming}
            className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-3 px-6 rounded-xl transition-all disabled:opacity-50"
          >
            {confirming ? "Confirming..." : "Confirm Payment Complete"}
          </button>

          <p className="text-center text-white/40 text-sm mt-4">
            By confirming, you verify that the payment was sent successfully.
          </p>

          {/* Back to Chat */}
          <Link 
            href={`/chat?user=${searchParams.get("to_uid")}&task=${taskId}`}
            className="block text-center text-white/60 hover:text-white mt-6 text-sm"
          >
            Back to Chat
          </Link>
        </div>
      </div>
    </div>
  );
}
