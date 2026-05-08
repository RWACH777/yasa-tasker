"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";

interface MembershipPayment {
  id: string;
  user_id: string;
  username: string;
  payment_txid: string;
  status: string;
  started_at: string;
  submitted_at: string;
}

export default function AdminMembershipPaymentsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [payments, setPayments] = useState<MembershipPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approving, setApproving] = useState<string | null>(null);

  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        router.push("/dashboard");
        return;
      }

      const userData = session.user;
      setUser(userData);

      // Check if user is admin
      const { data: adminData, error: adminError } = await supabase
        .from("admin_users")
        .select("*")
        .eq("user_id", userData.id)
        .single();

      if (adminError || !adminData) {
        console.error("Admin check error:", adminError);
        setError(`Access denied. User ID: ${userData.id}`);
        setLoading(false);
        return;
      }

      setIsAdmin(true);
      loadPayments();
    };

    checkAdmin();
  }, [router]);

  const loadPayments = async () => {
    try {
      const { data, error } = await supabase
        .from("memberships")
        .select("id, user_id, username, payment_txid, status, started_at, updated_at")
        .eq("status", "pending_review")
        .order("updated_at", { ascending: false });

      if (error) {
        console.error("Error loading payments:", error);
        setError("Failed to load payments");
      } else {
        setPayments(data || []);
      }
    } catch (err) {
      console.error("Error:", err);
      setError("An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const checkDuplicateTxid = async (txid: string): Promise<boolean> => {
    const { data, error } = await supabase
      .from("memberships")
      .select("id")
      .eq("payment_txid", txid)
      .neq("status", "pending_review")
      .limit(1);

    if (error) {
      console.error("Error checking TXID:", error);
      return false;
    }

    return data && data.length > 0;
  };

  const handleApprove = async (payment: MembershipPayment) => {
    setApproving(payment.id);

    try {
      // Check for duplicate TXID
      const isDuplicate = await checkDuplicateTxid(payment.payment_txid);
      
      if (isDuplicate) {
        alert("Error: Duplicate TXID detected. This transaction has already been used.");
        setApproving(null);
        return;
      }

      // Update membership to active
      const { error } = await supabase
        .from("memberships")
        .update({ 
          status: "active",
          last_paid_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", payment.id);

      if (error) {
        console.error("Error approving payment:", error);
        alert("Failed to approve payment");
        setApproving(null);
        return;
      }

      alert("Payment approved successfully");
      loadPayments();
    } catch (err) {
      console.error("Error:", err);
      alert("An error occurred");
    } finally {
      setApproving(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-500">{error}</div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-500">Access denied</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-white">Membership Payments</h1>
          <Link 
            href="/admin/payouts"
            className="text-blue-400 hover:text-blue-300"
          >
            ← Back to Admin
          </Link>
        </div>

        {payments.length === 0 ? (
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-8 text-center">
            <p className="text-white/60">No pending membership payments</p>
          </div>
        ) : (
          <div className="space-y-4">
            {payments.map((payment) => (
              <div 
                key={payment.id}
                className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20"
              >
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <span className="text-white/60 text-sm">Username</span>
                    <p className="text-white font-medium">{payment.username}</p>
                  </div>
                  <div>
                    <span className="text-white/60 text-sm">Amount</span>
                    <p className="text-white font-medium">1 π</p>
                  </div>
                  <div>
                    <span className="text-white/60 text-sm">Submitted</span>
                    <p className="text-white font-medium">
                      {new Date(payment.submitted_at || payment.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <span className="text-white/60 text-sm">Member Since</span>
                    <p className="text-white font-medium">
                      {new Date(payment.started_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="bg-black/20 rounded-lg p-3 mb-4">
                  <div className="flex justify-between items-center">
                    <span className="text-white/60 text-sm">TXID:</span>
                    <div className="flex items-center gap-2">
                      <a 
                        href={`https://blockexplorer.minepi.com/tx/${payment.payment_txid}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 text-sm"
                      >
                        {payment.payment_txid?.slice(0, 20)}... ↗
                      </a>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <a
                    href={`https://blockexplorer.minepi.com/tx/${payment.payment_txid}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 py-2 px-4 rounded-lg text-center transition-all"
                  >
                    Verify on Blockchain ↗
                  </a>
                  <button
                    onClick={() => handleApprove(payment)}
                    disabled={approving === payment.id}
                    className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded-lg transition-all disabled:opacity-50"
                  >
                    {approving === payment.id ? "Approving..." : "Approve"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
