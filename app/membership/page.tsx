"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";

export default function MembershipPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [membership, setMembership] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [txid, setTxid] = useState("");
  const [memo, setMemo] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 p-4">
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
                  Send exactly <strong className="text-white">1 π</strong> to:
                </p>
                <div className="bg-black/30 rounded-lg p-3 mb-3">
                  <span className="text-white font-mono text-sm">yair777</span>
                </div>
                <p className="text-white/80 text-sm mb-2">With memo:</p>
                <div className="bg-black/30 rounded-lg p-3">
                  <span className="text-white font-mono text-sm">{memo}</span>
                </div>
              </div>

              {/* Submit Form */}
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
