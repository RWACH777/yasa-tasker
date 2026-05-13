"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";

interface PayoutDispute {
  id: string;
  task_id: string;
  transaction_id: string;
  freelancer_uid: string;
  freelancer_username: string;
  tasker_id: string;
  amount: number;
  txid: string;
  memo: string;
  status: string;
  created_at: string;
}

export default function AdminDisputesPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [disputes, setDisputes] = useState<PayoutDispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resolving, setResolving] = useState<string | null>(null);

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
        setError(`Access denied. User ID: ${userData.id}. Error: ${adminError.message}`);
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
      loadDisputes();
    };

    checkAdmin();
  }, [router]);

  const loadDisputes = async () => {
    try {
      const { data, error } = await supabase
        .from("payout_disputes")
        .select("*")
        .eq("status", "pending_review")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error loading disputes:", error);
        setError("Failed to load disputes");
      } else {
        setDisputes(data || []);
      }
    } catch (err) {
      console.error("Error:", err);
      setError("An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const checkDuplicateTxid = async (txid: string, excludeDisputeId: string): Promise<boolean> => {
    const { data, error } = await supabase
      .from("transactions")
      .select("id")
      .eq("txid", txid)
      .neq("id", excludeDisputeId)
      .limit(1);

    if (error) {
      console.error("Error checking TXID:", error);
      return false;
    }

    return data && data.length > 0;
  };

  const handleResolve = async (dispute: PayoutDispute) => {
    setResolving(dispute.id);

    try {
      // Check for duplicate TXID
      const isDuplicate = await checkDuplicateTxid(dispute.txid, dispute.transaction_id);
      
      if (isDuplicate) {
        alert("Error: Duplicate TXID detected. This transaction has already been used.");
        setResolving(null);
        return;
      }

      // Mark task as completed
      const { error: taskError } = await supabase
        .from("tasks")
        .update({ 
          status: "completed",
          resolved_at: new Date().toISOString(),
          resolved_by: user?.id,
        })
        .eq("id", dispute.task_id);

      if (taskError) {
        console.error("Error updating task:", taskError);
        alert("Failed to resolve dispute");
        setResolving(null);
        return;
      }

      // Update dispute status
      await supabase
        .from("payout_disputes")
        .update({ 
          status: "resolved",
          resolved_at: new Date().toISOString(),
          resolved_by: user?.id,
        })
        .eq("id", dispute.id);

      // Update transaction status
      await supabase
        .from("transactions")
        .update({ status: "completed" })
        .eq("id", dispute.transaction_id);

      alert("Dispute resolved successfully");
      loadDisputes();
    } catch (err) {
      console.error("Error resolving dispute:", err);
      alert("Failed to resolve dispute");
    } finally {
      setResolving(null);
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
          <h1 className="text-2xl font-bold text-white">Payout Disputes</h1>
          <Link 
            href="/admin/payouts"
            className="text-blue-400 hover:text-blue-300"
          >
            ← Back to Payouts
          </Link>
        </div>

        {disputes.length === 0 ? (
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-8 text-center">
            <p className="text-white/60">No pending disputes</p>
          </div>
        ) : (
          <div className="space-y-4">
            {disputes.map((dispute) => (
              <div 
                key={dispute.id}
                className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20"
              >
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <span className="text-white/60 text-sm">Task ID</span>
                    <p className="text-white font-medium">{dispute.task_id}</p>
                  </div>
                  <div>
                    <span className="text-white/60 text-sm">Freelancer</span>
                    <p className="text-white font-medium">{dispute.freelancer_username}</p>
                  </div>
                  <div>
                    <span className="text-white/60 text-sm">Amount</span>
                    <p className="text-white font-medium">{dispute.amount} π</p>
                  </div>
                  <div>
                    <span className="text-white/60 text-sm">Submitted</span>
                    <p className="text-white font-medium">
                      {new Date(dispute.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="bg-black/20 rounded-lg p-3 mb-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-white/60 text-sm">TXID:</span>
                    <a 
                      href={`https://blockexplorer.minepi.com/tx/${dispute.txid}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 text-sm"
                    >
                      {dispute.txid.slice(0, 20)}... ↗
                    </a>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/60 text-sm">Memo:</span>
                    <span className="text-white text-sm">{dispute.memo}</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <a
                    href={`https://blockexplorer.minepi.com/tx/${dispute.txid}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 py-2 px-4 rounded-lg text-center transition-all"
                  >
                    Verify on Blockchain ↗
                  </a>
                  <button
                    onClick={() => handleResolve(dispute)}
                    disabled={resolving === dispute.id}
                    className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded-lg transition-all disabled:opacity-50"
                  >
                    {resolving === dispute.id ? "Resolving..." : "Resolve & Complete"}
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
