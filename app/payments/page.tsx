"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";

interface Transaction {
  id: string;
  task_id: string;
  sender_uid: string;
  sender_username: string;
  receiver_uid: string;
  receiver_username: string;
  total_amount: number;
  platform_fee_amount: number;
  net_amount: number;
  status: string;
  created_at: string;
  completed_at?: string;
  pi_txid?: string;
}

export default function PaymentsPage() {
  const [user, setUser] = useState<any>(null);
  const [sentPayments, setSentPayments] = useState<Transaction[]>([]);
  const [receivedPayments, setReceivedPayments] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"sent" | "received">("sent");

  useEffect(() => {
    const checkUser = async () => {
      // First check localStorage
      const stored = localStorage.getItem("pi_user");
      if (stored) {
        const userData = JSON.parse(stored);
        setUser(userData);
        loadTransactions(userData.id);
        return;
      }

      // If no localStorage, check Supabase session (for existing logged-in users)
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const userData = {
          id: session.user.id,
          username: session.user.user_metadata?.username || session.user.email?.split('@')[0] || "User",
          avatar_url: session.user.user_metadata?.avatar_url || null,
          wallet_address: session.user.user_metadata?.wallet_address || null,
        };
        // Save to localStorage for next time
        localStorage.setItem("pi_user", JSON.stringify(userData));
        setUser(userData);
        loadTransactions(userData.id);
        return;
      }

      setLoading(false);
    };

    checkUser();
  }, []);

  const loadTransactions = async (userId: string) => {
    try {
      // Load sent payments (user is sender)
      const { data: sent } = await supabase
        .from("transactions")
        .select("*")
        .eq("sender_uid", userId)
        .order("created_at", { ascending: false });

      // Load received payments (user is receiver)
      const { data: received } = await supabase
        .from("transactions")
        .select("*")
        .eq("receiver_uid", userId)
        .order("created_at", { ascending: false });

      setSentPayments(sent || []);
      setReceivedPayments(received || []);
    } catch (err) {
      console.error("Error loading transactions:", err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "success":
      case "completed":
        return "text-green-400";
      case "pending":
      case "processing":
        return "text-yellow-400";
      case "failed":
        return "text-red-400";
      default:
        return "text-gray-400";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success":
      case "completed":
        return "✓";
      case "pending":
      case "processing":
        return "⏳";
      case "failed":
        return "✗";
      default:
        return "?";
    }
  };

  const transactions = activeTab === "sent" ? sentPayments : receivedPayments;
  const totalAmount = transactions.reduce((sum, t) => sum + (activeTab === "sent" ? t.total_amount : t.net_amount), 0);

  if (loading) {
    return (
      <div className="min-h-screen app-background flex items-center justify-center">
        <div className="glass-card p-8">
          <div className="glass-loading mx-auto mb-4"></div>
          <p className="glass-text-accent">Loading payments...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen app-background flex items-center justify-center">
        <div className="glass-card p-8 max-w-md text-center">
          <h2 className="text-xl font-bold mb-4">Please Login</h2>
          <p className="glass-text mb-6">You need to be logged in to view payments.</p>
          <Link href="/" className="glass-button glass-button-primary">
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen app-background text-white flex flex-col">
      {/* Header */}
      <div className="glass-nav sticky top-0 z-50 p-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/dashboard" className="text-xl">← Dashboard</Link>
          <h1 className="text-lg font-bold">💳 Payments</h1>
          <div className="w-8"></div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 pt-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="glass-card p-4">
            <p className="glass-text-accent text-sm mb-1">Sent Payments</p>
            <p className="text-2xl font-bold glass-text">{sentPayments.length}</p>
          </div>
          <div className="glass-card p-4">
            <p className="glass-text-accent text-sm mb-1">Received Payments</p>
            <p className="text-2xl font-bold glass-text">{receivedPayments.length}</p>
          </div>
          <div className="glass-card p-4">
            <p className="glass-text-accent text-sm mb-1">
              Total {activeTab === "sent" ? "Sent" : "Received"}
            </p>
            <p className="text-2xl font-bold text-yellow-400">{totalAmount.toFixed(2)} π</p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="glass-card p-1 mb-6">
          <div className="flex">
            <button
              onClick={() => setActiveTab("sent")}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition ${
                activeTab === "sent"
                  ? "glass-button-primary"
                  : "glass-text-muted hover:glass-text"
              }`}
            >
              📤 Sent ({sentPayments.length})
            </button>
            <button
              onClick={() => setActiveTab("received")}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition ${
                activeTab === "received"
                  ? "glass-button-primary"
                  : "glass-text-muted hover:glass-text"
              }`}
            >
              📥 Received ({receivedPayments.length})
            </button>
          </div>
        </div>

        {/* Transactions List */}
        <div className="space-y-3">
          {transactions.length === 0 ? (
            <div className="glass-card p-8 text-center">
              <div className="text-4xl mb-4">💳</div>
              <p className="glass-text mb-2">
                No {activeTab} payments yet
              </p>
              <p className="text-sm glass-text-muted">
                {activeTab === "sent"
                  ? "Payments you make to freelancers will appear here"
                  : "Payments you receive from taskers will appear here"}
              </p>
            </div>
          ) : (
            transactions.map((tx) => (
              <div key={tx.id} className="glass-card p-4 hover:bg-white/5 transition">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-lg ${getStatusColor(tx.status)}`}>
                        {getStatusIcon(tx.status)}
                      </span>
                      <span className={`text-sm font-medium ${getStatusColor(tx.status)}`}>
                        {tx.status?.toUpperCase()}
                      </span>
                      <span className="text-xs glass-text-muted">
                        {formatDate(tx.created_at)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mb-2">
                      <span className="glass-text text-sm">
                        {activeTab === "sent" ? "To:" : "From:"}
                      </span>
                      <span className="glass-text-accent font-medium">
                        {activeTab === "sent" ? tx.receiver_username : tx.sender_username}
                      </span>
                    </div>

                    <div className="flex items-baseline gap-2">
                      <span className="text-xl font-bold text-yellow-400">
                        {activeTab === "sent" ? tx.total_amount.toFixed(2) : tx.net_amount.toFixed(2)} π
                      </span>
                      {activeTab === "sent" && tx.platform_fee_amount > 0 && (
                        <span className="text-xs glass-text-muted">
                          (Fee: {tx.platform_fee_amount.toFixed(2)} π)
                        </span>
                      )}
                    </div>

                    {tx.pi_txid && (
                      <p className="text-xs glass-text-muted mt-2 font-mono">
                        TX: {tx.pi_txid.slice(0, 16)}...
                      </p>
                    )}
                  </div>

                  {tx.status === "success" || tx.status === "completed" ? (
                    <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                      <span className="text-green-400 text-sm">✓</span>
                    </div>
                  ) : tx.status === "failed" ? (
                    <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center">
                      <span className="text-red-400 text-sm">✗</span>
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center">
                      <span className="text-yellow-400 text-sm">⏳</span>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
