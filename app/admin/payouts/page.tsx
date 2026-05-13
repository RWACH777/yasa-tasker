"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";

interface PayoutRequest {
  id: string;
  task_id: string;
  transaction_id: string;
  freelancer_uid: string;
  freelancer_username: string;
  freelancer_wallet_address: string;
  amount: number;
  fee_amount: number;
  status: string;
  created_at: string;
  processed_by?: string;
  processed_at?: string;
  notes?: string;
  pi_txid?: string;
}

export default function AdminPayoutsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [payouts, setPayouts] = useState<PayoutRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [txIdInput, setTxIdInput] = useState<string>("");
  const [notesInput, setNotesInput] = useState<string>("");
  const [filter, setFilter] = useState<string>("all");

  // Check admin status and load user
  useEffect(() => {
    const checkAdmin = async () => {
      const stored = localStorage.getItem("pi_user");
      if (!stored) {
        router.push("/");
        return;
      }

      const userData = JSON.parse(stored);
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
      loadPayouts();
    };

    checkAdmin();
  }, [router]);

  // Load all payout requests
  const loadPayouts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("payout_requests")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      setPayouts(data || []);
    } catch (err: any) {
      setError("Failed to load payout requests: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Mark payout as completed
  const markAsCompleted = async (payoutId: string) => {
    if (!txIdInput.trim()) {
      alert("Please enter the Pi transaction ID (txid) from your Pi Browser payment");
      return;
    }

    try {
      setProcessingId(payoutId);

      const { error } = await supabase
        .from("payout_requests")
        .update({
          status: "completed",
          processed_by: user?.id,
          processed_at: new Date().toISOString(),
          pi_txid: txIdInput.trim(),
          notes: notesInput.trim() || "Payout completed manually via Pi Browser",
        })
        .eq("id", payoutId);

      if (error) throw error;

      // Reset form
      setTxIdInput("");
      setNotesInput("");

      // Reload payouts
      await loadPayouts();
      alert("Payout marked as completed!");
    } catch (err: any) {
      alert("Failed to update payout: " + err.message);
    } finally {
      setProcessingId(null);
    }
  };

  // Cancel a payout request
  const cancelPayout = async (payoutId: string) => {
    if (!confirm("Are you sure you want to cancel this payout request?")) return;

    try {
      setProcessingId(payoutId);

      const { error } = await supabase
        .from("payout_requests")
        .update({
          status: "cancelled",
          processed_by: user?.id,
          processed_at: new Date().toISOString(),
          notes: notesInput.trim() || "Cancelled by admin",
        })
        .eq("id", payoutId);

      if (error) throw error;

      await loadPayouts();
      alert("Payout request cancelled!");
    } catch (err: any) {
      alert("Failed to cancel payout: " + err.message);
    } finally {
      setProcessingId(null);
    }
  };

  // Filter payouts
  const filteredPayouts = payouts.filter((p) => {
    if (filter === "all") return true;
    return p.status === filter;
  });

  // Calculate totals
  const pendingTotal = payouts
    .filter((p) => p.status === "pending")
    .reduce((sum, p) => sum + p.amount, 0);

  const completedTotal = payouts
    .filter((p) => p.status === "completed")
    .reduce((sum, p) => sum + p.amount, 0);

  if (loading) {
    return (
      <div className="app-background min-h-screen text-white flex items-center justify-center">
        <div className="glass-card p-8">
          <p className="glass-text text-lg">Loading admin panel...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-background min-h-screen text-white flex items-center justify-center">
        <div className="glass-card p-8 max-w-md">
          <h1 className="text-2xl font-bold text-red-400 mb-4">Access Denied</h1>
          <p className="glass-text mb-6">{error}</p>
          <Link href="/" className="glass-button glass-button-primary w-full text-center">
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="app-background min-h-screen text-white">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold glass-text mb-2">Admin Payout Dashboard</h1>
            <p className="glass-text-muted">Manage freelancer payout requests</p>
          </div>
          <div className="flex gap-3">
            <Link href="/dashboard" className="glass-button glass-button-secondary">
              Dashboard
            </Link>
            <button onClick={loadPayouts} className="glass-button glass-button-primary">
              Refresh
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="glass-card p-4">
            <p className="text-sm glass-text-muted mb-1">Total Payout Requests</p>
            <p className="text-2xl font-bold glass-text">{payouts.length}</p>
          </div>
          <div className="glass-card p-4 border-yellow-500/30">
            <p className="text-sm glass-text-muted mb-1">Pending Payouts</p>
            <p className="text-2xl font-bold text-yellow-400">
              {payouts.filter((p) => p.status === "pending").length}
            </p>
            <p className="text-sm text-yellow-400/70">{pendingTotal.toFixed(2)} π</p>
          </div>
          <div className="glass-card p-4 border-green-500/30">
            <p className="text-sm glass-text-muted mb-1">Completed Payouts</p>
            <p className="text-2xl font-bold text-green-400">
              {payouts.filter((p) => p.status === "completed").length}
            </p>
            <p className="text-sm text-green-400/70">{completedTotal.toFixed(2)} π</p>
          </div>
        </div>

        {/* Filter */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {["all", "pending", "completed", "cancelled"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`glass-button text-sm capitalize ${
                filter === f ? "glass-button-primary" : "glass-button-secondary"
              }`}
            >
              {f} ({f === "all" ? payouts.length : payouts.filter((p) => p.status === f).length})
            </button>
          ))}
        </div>

        {/* Payout Requests Table */}
        <div className="glass-card overflow-hidden">
          {filteredPayouts.length === 0 ? (
            <div className="p-8 text-center">
              <p className="glass-text-muted">No payout requests found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="glass-nav border-b border-white/10">
                  <tr>
                    <th className="text-left p-4 text-sm font-semibold glass-text">Freelancer</th>
                    <th className="text-left p-4 text-sm font-semibold glass-text">Amount</th>
                    <th className="text-left p-4 text-sm font-semibold glass-text">Status</th>
                    <th className="text-left p-4 text-sm font-semibold glass-text">Date</th>
                    <th className="text-left p-4 text-sm font-semibold glass-text">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {filteredPayouts.map((payout) => (
                    <tr key={payout.id} className="hover:bg-white/5">
                      <td className="p-4">
                        <div className="flex flex-col">
                          <span className="font-medium glass-text">
                            {payout.freelancer_username || "Unknown"}
                          </span>
                          <span className="text-xs glass-text-muted font-mono">
                            {payout.freelancer_uid.slice(0, 8)}...
                          </span>
                          {payout.freelancer_wallet_address && (
                            <span className="text-xs text-blue-400 font-mono mt-1">
                              Wallet: {payout.freelancer_wallet_address.slice(0, 12)}...
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col">
                          <span className="text-lg font-bold text-green-400">
                            {payout.amount.toFixed(2)} π
                          </span>
                          <span className="text-xs glass-text-muted">
                            Fee: {payout.fee_amount.toFixed(2)} π
                          </span>
                        </div>
                      </td>
                      <td className="p-4">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${
                            payout.status === "pending"
                              ? "bg-yellow-500/20 text-yellow-400"
                              : payout.status === "completed"
                              ? "bg-green-500/20 text-green-400"
                              : "bg-red-500/20 text-red-400"
                          }`}
                        >
                          {payout.status}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col text-sm">
                          <span className="glass-text">
                            {new Date(payout.created_at).toLocaleDateString()}
                          </span>
                          <span className="text-xs glass-text-muted">
                            {new Date(payout.created_at).toLocaleTimeString()}
                          </span>
                        </div>
                      </td>
                      <td className="p-4">
                        {payout.status === "pending" && (
                          <div className="flex flex-col gap-2">
                            <input
                              type="text"
                              placeholder="Enter Pi TXID after manual payment"
                              value={txIdInput}
                              onChange={(e) => setTxIdInput(e.target.value)}
                              className="glass-input px-3 py-2 text-sm w-full min-w-[200px]"
                            />
                            <input
                              type="text"
                              placeholder="Notes (optional)"
                              value={notesInput}
                              onChange={(e) => setNotesInput(e.target.value)}
                              className="glass-input px-3 py-2 text-sm w-full min-w-[200px]"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => markAsCompleted(payout.id)}
                                disabled={processingId === payout.id}
                                className="glass-button glass-button-success text-sm flex-1"
                              >
                                {processingId === payout.id ? "Processing..." : "Mark Paid"}
                              </button>
                              <button
                                onClick={() => cancelPayout(payout.id)}
                                disabled={processingId === payout.id}
                                className="glass-button glass-button-danger text-sm"
                              >
                                Cancel
                              </button>
                            </div>
                            <p className="text-xs glass-text-muted mt-1">
                              Send {payout.amount.toFixed(2)} π manually via Pi Browser first, then paste TXID here
                            </p>
                          </div>
                        )}
                        {payout.status === "completed" && (
                          <div className="text-sm">
                            <p className="text-green-400 font-medium">Completed</p>
                            {payout.pi_txid && (
                              <p className="text-xs glass-text-muted font-mono mt-1">
                                TX: {payout.pi_txid.slice(0, 20)}...
                              </p>
                            )}
                            {payout.notes && (
                              <p className="text-xs glass-text-muted mt-1">{payout.notes}</p>
                            )}
                          </div>
                        )}
                        {payout.status === "cancelled" && (
                          <div className="text-sm">
                            <p className="text-red-400 font-medium">Cancelled</p>
                            {payout.notes && (
                              <p className="text-xs glass-text-muted mt-1">{payout.notes}</p>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="glass-card mt-8 p-6">
          <h3 className="text-lg font-bold glass-text mb-4">Payout Instructions</h3>
          <ol className="list-decimal list-inside space-y-2 text-sm glass-text-muted">
            <li>When a freelancer requests a payout, it appears here with status &quot;pending&quot;</li>
            <li>Open Pi Browser and manually send the exact amount to the freelancer&apos;s wallet</li>
            <li>Copy the Pi transaction ID (txid) from your Pi Browser payment history</li>
            <li>Paste the TXID in the input field and click &quot;Mark Paid&quot;</li>
            <li>The system will update the status and notify the freelancer</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
