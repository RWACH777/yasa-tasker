"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";

interface LedgerEntry {
  id: string;
  task_id: string | null;
  tasker_id: string | null;
  freelancer_id: string | null;
  amount_pi: number;
  currency: string;
  payment_status: string;
  transaction_reference: string | null;
  confirmed_by_tasker: boolean;
  confirmed_by_freelancer: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  task?: { title: string; budget: number } | null;
  tasker?: { username: string } | null;
  freelancer?: { username: string; freelancer_username: string | null } | null;
}

export default function AdminPayoutsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [payouts, setPayouts] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [txIdInput, setTxIdInput] = useState<Record<string, string>>({});
  const [notesInput, setNotesInput] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<string>("all");

  // Check admin status and load user
  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        router.push("/");
        return;
      }

      setUser(session.user);

      // Check if user is admin via authenticated session
      const { data: adminData, error: adminError } = await supabase
        .from("admin_users")
        .select("*")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (adminError) {
        setError("Access denied.");
        setLoading(false);
        return;
      }

      if (!adminData) {
        setError("Access denied. You are not an admin.");
        setLoading(false);
        return;
      }

      setIsAdmin(true);
      loadPayouts();
    };

    checkAdmin();
  }, [router]);

  const loadPayouts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("payment_ledger")
        .select(`
          *,
          task:tasks(title, budget),
          tasker:profiles!payment_ledger_tasker_id_fkey(username),
          freelancer:profiles!payment_ledger_freelancer_id_fkey(username, freelancer_username)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPayouts(data || []);
    } catch (err: any) {
      setError("Failed to load payment ledger: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const markAsConfirmed = async (entryId: string) => {
    const txid = txIdInput[entryId]?.trim();
    if (!txid) {
      alert("Please enter the Pi transaction ID before confirming.");
      return;
    }

    try {
      setProcessingId(entryId);
      const { error } = await supabase
        .from("payment_ledger")
        .update({
          payment_status: "payment_confirmed",
          transaction_reference: txid,
          confirmed_by_freelancer: true,
          notes: notesInput[entryId]?.trim() || "Confirmed by admin",
          updated_at: new Date().toISOString(),
        })
        .eq("id", entryId);

      if (error) throw error;
      setTxIdInput((p) => ({ ...p, [entryId]: "" }));
      setNotesInput((p) => ({ ...p, [entryId]: "" }));
      await loadPayouts();
    } catch (err: any) {
      alert("Failed to confirm payout: " + err.message);
    } finally {
      setProcessingId(null);
    }
  };

  const markAsDisputed = async (entryId: string) => {
    if (!confirm("Mark this payment as disputed?")) return;
    try {
      setProcessingId(entryId);
      const { error } = await supabase
        .from("payment_ledger")
        .update({
          payment_status: "disputed",
          notes: notesInput[entryId]?.trim() || "Disputed by admin",
          updated_at: new Date().toISOString(),
        })
        .eq("id", entryId);
      if (error) throw error;
      await loadPayouts();
    } catch (err: any) {
      alert("Failed: " + err.message);
    } finally {
      setProcessingId(null);
    }
  };

  const cancelPayout = async (payoutId: string) => {
    if (!confirm("Cancel this payment record?")) return;

    try {
      setProcessingId(payoutId);

      const { error } = await supabase
        .from("payment_ledger")
        .update({
          payment_status: "cancelled",
          notes: notesInput[payoutId]?.trim() || "Cancelled by admin",
          updated_at: new Date().toISOString(),
        })
        .eq("id", payoutId);

      if (error) throw error;
      await loadPayouts();
    } catch (err: any) {
      alert("Failed to cancel: " + err.message);
    } finally {
      setProcessingId(null);
    }
  };

  const filteredPayouts = payouts.filter((p) =>
    filter === "all" ? true : p.payment_status === filter
  );

  const pendingTotal = payouts
    .filter((p) => ["payment_sent", "awaiting_payment"].includes(p.payment_status))
    .reduce((sum, p) => sum + Number(p.amount_pi), 0);

  const confirmedTotal = payouts
    .filter((p) => p.payment_status === "payment_confirmed")
    .reduce((sum, p) => sum + Number(p.amount_pi), 0);

  const statusColor: Record<string, string> = {
    pending: "bg-gray-500/20 text-gray-400",
    awaiting_payment: "bg-blue-500/20 text-blue-400",
    payment_sent: "bg-yellow-500/20 text-yellow-400",
    payment_confirmed: "bg-green-500/20 text-green-400",
    disputed: "bg-red-500/20 text-red-400",
    cancelled: "bg-gray-500/20 text-gray-500",
  };

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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="glass-card p-4">
            <p className="text-sm glass-text-muted mb-1">Total Records</p>
            <p className="text-2xl font-bold glass-text">{payouts.length}</p>
          </div>
          <div className="glass-card p-4 border-yellow-500/30">
            <p className="text-sm glass-text-muted mb-1">Awaiting / Sent</p>
            <p className="text-2xl font-bold text-yellow-400">
              {payouts.filter((p) => ["payment_sent","awaiting_payment"].includes(p.payment_status)).length}
            </p>
            <p className="text-sm text-yellow-400/70">{pendingTotal.toFixed(2)} π</p>
          </div>
          <div className="glass-card p-4 border-green-500/30">
            <p className="text-sm glass-text-muted mb-1">Confirmed</p>
            <p className="text-2xl font-bold text-green-400">
              {payouts.filter((p) => p.payment_status === "payment_confirmed").length}
            </p>
            <p className="text-sm text-green-400/70">{confirmedTotal.toFixed(2)} π</p>
          </div>
          <div className="glass-card p-4 border-red-500/30">
            <p className="text-sm glass-text-muted mb-1">Disputed</p>
            <p className="text-2xl font-bold text-red-400">
              {payouts.filter((p) => p.payment_status === "disputed").length}
            </p>
          </div>
        </div>

        {/* Filter */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {["all","awaiting_payment","payment_sent","payment_confirmed","disputed","cancelled"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`glass-button text-sm whitespace-nowrap ${
                filter === f ? "glass-button-primary" : "glass-button-secondary"
              }`}
            >
              {f === "all" ? "All" : f.replace(/_/g, " ")} ({f === "all" ? payouts.length : payouts.filter((p) => p.payment_status === f).length})
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
                  {filteredPayouts.map((entry) => (
                    <tr key={entry.id} className="hover:bg-white/5">
                      <td className="p-4">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium glass-text text-sm">
                            {entry.task?.title || "Unknown task"}
                          </span>
                          <span className="text-xs glass-text-muted">
                            Tasker: {entry.tasker?.username || "—"}
                          </span>
                          <span className="text-xs glass-text-muted">
                            Freelancer: {entry.freelancer?.freelancer_username || entry.freelancer?.username || "—"}
                          </span>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="text-lg font-bold text-green-400">
                          {Number(entry.amount_pi).toFixed(4)} π
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col gap-1">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium w-fit ${statusColor[entry.payment_status] || "bg-gray-500/20 text-gray-400"}` }>
                            {entry.payment_status.replace(/_/g, " ")}
                          </span>
                          <span className="text-[10px] glass-text-muted">
                            Tasker ✓: {entry.confirmed_by_tasker ? "Yes" : "No"} · Freelancer ✓: {entry.confirmed_by_freelancer ? "Yes" : "No"}
                          </span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col text-xs glass-text-muted">
                          <span>{new Date(entry.created_at).toLocaleDateString()}</span>
                          <span>{new Date(entry.created_at).toLocaleTimeString()}</span>
                          {entry.transaction_reference && (
                            <span className="font-mono mt-1 text-blue-400">
                              TX: {entry.transaction_reference.slice(0, 16)}...
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        {["payment_sent", "awaiting_payment"].includes(entry.payment_status) && (
                          <div className="flex flex-col gap-2">
                            <input
                              type="text"
                              placeholder="Pi TXID (if not auto-filled)"
                              value={txIdInput[entry.id] || ""}
                              onChange={(e) => setTxIdInput((p) => ({ ...p, [entry.id]: e.target.value }))}
                              className="glass-input px-3 py-2 text-xs w-full min-w-[180px]"
                            />
                            <input
                              type="text"
                              placeholder="Admin notes (optional)"
                              value={notesInput[entry.id] || ""}
                              onChange={(e) => setNotesInput((p) => ({ ...p, [entry.id]: e.target.value }))}
                              className="glass-input px-3 py-2 text-xs w-full min-w-[180px]"
                            />
                            <div className="flex gap-2 flex-wrap">
                              <button
                                onClick={() => markAsConfirmed(entry.id)}
                                disabled={processingId === entry.id}
                                className="glass-button glass-button-primary text-xs flex-1"
                              >
                                {processingId === entry.id ? "..." : "Confirm Paid"}
                              </button>
                              <button
                                onClick={() => markAsDisputed(entry.id)}
                                disabled={processingId === entry.id}
                                className="glass-button text-xs border border-yellow-500/40 text-yellow-400"
                              >
                                Dispute
                              </button>
                              <button
                                onClick={() => cancelPayout(entry.id)}
                                disabled={processingId === entry.id}
                                className="glass-button text-xs border border-red-500/40 text-red-400"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                        {entry.payment_status === "payment_confirmed" && (
                          <div className="text-xs">
                            <p className="text-green-400 font-medium">Payment confirmed ✓</p>
                            {entry.notes && <p className="glass-text-muted mt-1">{entry.notes}</p>}
                          </div>
                        )}
                        {entry.payment_status === "disputed" && (
                          <div className="text-xs">
                            <p className="text-red-400 font-medium">⚠️ Disputed</p>
                            {entry.notes && <p className="glass-text-muted mt-1">{entry.notes}</p>}
                            <button
                              onClick={() => markAsConfirmed(entry.id)}
                              disabled={processingId === entry.id}
                              className="glass-button glass-button-primary text-xs mt-2"
                            >
                              Resolve &amp; Confirm
                            </button>
                          </div>
                        )}
                        {entry.payment_status === "cancelled" && (
                          <p className="text-xs text-gray-500">Cancelled{entry.notes ? `: ${entry.notes}` : ""}</p>
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
          <h3 className="text-lg font-bold glass-text mb-4">Payment Ledger Guide</h3>
          <ol className="list-decimal list-inside space-y-2 text-sm glass-text-muted">
            <li><strong className="glass-text">payment_sent</strong> — Tasker says they sent Pi. Verify by checking the blockchain TXID.</li>
            <li>Open your Pi Wallet and confirm you received the correct amount from the tasker.</li>
            <li>If correct, enter the TXID and click <strong className="glass-text">Confirm Paid</strong> to close the record.</li>
            <li>If something is wrong, click <strong className="glass-text">Dispute</strong> to flag it for review.</li>
            <li>When Pi A2U becomes available, this ledger will drive automatic payouts.</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
