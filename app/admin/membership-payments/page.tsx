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
  submitted_at?: string;
  updated_at?: string;
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
        .maybeSingle();

      if (adminError) {
        console.error("Admin check error:", adminError);
        setError(`Access denied. User ID: ${userData.id}. Error: ${adminError?.message}`);
        setLoading(false);
        return;
      }

      if (!adminData) {
        console.error("Admin check: User not found in admin_users table");
        setError(`Access denied. User ID: ${userData.id} is not an admin`);
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
      <div className="app-background min-h-screen flex items-center justify-center">
        <div className="glass-card p-8"><p className="glass-text">Loading...</p></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-background min-h-screen flex items-center justify-center">
        <div className="glass-card p-8 max-w-md text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <Link href="/dashboard" className="glass-button">Go Home</Link>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="app-background min-h-screen flex items-center justify-center">
        <div className="glass-card p-8 text-center"><p className="text-red-400">Access denied</p></div>
      </div>
    );
  }

  return (
    <div className="app-background min-h-screen text-white">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold glass-text">🏅 Membership Payments</h1>
            <p className="text-sm glass-text-muted mt-1">Approve pending membership payment submissions</p>
          </div>
          <div className="flex gap-2">
            <Link href="/admin/disputes" className="glass-button text-sm">Disputes</Link>
            <Link href="/admin/payouts" className="glass-button text-sm">Payouts</Link>
          </div>
        </div>

        {payments.length === 0 ? (
          <div className="glass-card p-10 text-center">
            <p className="text-3xl mb-3">✅</p>
            <p className="glass-text-muted">No pending membership payments</p>
          </div>
        ) : (
          <div className="space-y-4">
            {payments.map((payment) => (
              <div key={payment.id} className="glass-card p-5">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <span className="text-xs glass-text-muted">Username</span>
                    <p className="glass-text font-semibold">{payment.username}</p>
                  </div>
                  <div>
                    <span className="text-xs glass-text-muted">Amount</span>
                    <p className="text-yellow-400 font-semibold">155 π</p>
                  </div>
                  <div>
                    <span className="text-xs glass-text-muted">Submitted</span>
                    <p className="glass-text text-sm">{new Date(payment.submitted_at || payment.updated_at).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <span className="text-xs glass-text-muted">Member Since</span>
                    <p className="glass-text text-sm">{new Date(payment.started_at).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="glass-card p-3 mb-4 flex justify-between items-center">
                  <span className="text-xs glass-text-muted">TXID:</span>
                  <a href={`https://blockexplorer.minepi.com/tx/${payment.payment_txid}`} target="_blank" rel="noopener noreferrer"
                    className="text-blue-400 text-sm hover:underline">
                    {payment.payment_txid?.slice(0, 24)}... ↗
                  </a>
                </div>
                <div className="flex gap-2">
                  <a href={`https://blockexplorer.minepi.com/tx/${payment.payment_txid}`} target="_blank" rel="noopener noreferrer"
                    className="flex-1 glass-button text-sm text-blue-400 text-center py-2">
                    Verify on Blockchain ↗
                  </a>
                  <button onClick={() => handleApprove(payment)} disabled={approving === payment.id}
                    className="flex-1 glass-button glass-button-success text-sm disabled:opacity-50">
                    {approving === payment.id ? "Approving..." : "✅ Approve"}
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
