"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";

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
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<any>(null);
  const [piBalance, setPiBalance] = useState<number | null>(null);
  const [sentPayments, setSentPayments] = useState<Transaction[]>([]);
  const [receivedPayments, setReceivedPayments] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"sent" | "received" | "send">("sent");
  
  // Send Pi form state
  const [sendAmount, setSendAmount] = useState("");
  const [recipientUsername, setRecipientUsername] = useState("");
  const [recipientUid, setRecipientUid] = useState("");
  const [sendMemo, setSendMemo] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [sendSuccess, setSendSuccess] = useState("");
  
  // From task completion query params
  const taskId = searchParams.get("task");
  const prefillAmount = searchParams.get("amount");
  const prefillRecipient = searchParams.get("to");
  const prefillRecipientUid = searchParams.get("to_uid");
  const prefillMemo = searchParams.get("memo");

  // Generate unique card number from user ID
  const generateCardNumber = (userId: string) => {
    // Create a formatted card number: YASA-XXXX-XXXX-XXXX
    const hash = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const part1 = String(hash).padStart(4, '0').slice(-4);
    const part2 = Math.floor(Math.random() * 9000 + 1000);
    const part3 = userId.slice(-4).toUpperCase();
    return `YASA-${part1}-${part2}-${part3}`;
  };

  // Fetch Pi balance from Pi Network
  const fetchPiBalance = useCallback(async () => {
    const Pi = (window as any).Pi;
    if (Pi && user?.wallet_address) {
      try {
        // Try to get actual Pi balance from SDK if available
        // Pi SDK doesn't expose balance directly, so we check via available payment methods
        // or use a backend endpoint if configured
        
        // First try: Check if Pi SDK has a getBalance method (future versions)
        if (Pi.getBalance && typeof Pi.getBalance === 'function') {
          const balance = await Pi.getBalance();
          setPiBalance(parseFloat(balance) || 0);
          return;
        }
        
        // Second try: Fetch from backend API if you have one set up
        // This requires your backend to have Pi Network API access
        const response = await fetch(`/api/pi-balance?userId=${user.id}&wallet=${user.wallet_address}`);
        if (response.ok) {
          const data = await response.json();
          if (data.balance !== undefined) {
            setPiBalance(parseFloat(data.balance));
            return;
          }
        }
        
        // Fallback: Show calculated balance from app transactions
        // Note: This is NOT the real Pi wallet balance, just app-internal transactions
        console.warn("Real Pi balance unavailable - showing calculated app balance. Connect Pi Network API for real balance.");
        const totalReceived = receivedPayments.reduce((sum, t) => sum + t.net_amount, 0);
        const totalSent = sentPayments.reduce((sum, t) => sum + t.total_amount, 0);
        setPiBalance(Math.max(0, totalReceived - totalSent));
      } catch (err) {
        console.error("Error fetching balance:", err);
        // Fallback to calculated balance
        const totalReceived = receivedPayments.reduce((sum, t) => sum + t.net_amount, 0);
        const totalSent = sentPayments.reduce((sum, t) => sum + t.total_amount, 0);
        setPiBalance(Math.max(0, totalReceived - totalSent));
      }
    }
  }, [user, receivedPayments, sentPayments]);

  useEffect(() => {
    const checkUser = async () => {
      // First check localStorage
      const stored = localStorage.getItem("pi_user");
      if (stored) {
        const userData = JSON.parse(stored);
        setUser(userData);
        await loadTransactions(userData.id);
        return;
      }

      // If no localStorage, check Supabase session
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const userData = {
          id: session.user.id,
          username: session.user.user_metadata?.username || session.user.email?.split('@')[0] || "User",
          avatar_url: session.user.user_metadata?.avatar_url || null,
          wallet_address: session.user.user_metadata?.wallet_address || null,
        };
        localStorage.setItem("pi_user", JSON.stringify(userData));
        setUser(userData);
        await loadTransactions(userData.id);
        return;
      }

      setLoading(false);
    };

    checkUser();
  }, []);

  // Prefill form if coming from task completion
  useEffect(() => {
    if (prefillAmount) {
      setSendAmount(prefillAmount);
      setActiveTab("send");
    }
    if (prefillRecipient) {
      setRecipientUsername(prefillRecipient);
    }
    if (prefillRecipientUid) {
      setRecipientUid(prefillRecipientUid);
    }
    if (prefillMemo) {
      setSendMemo(prefillMemo);
    }
  }, [prefillAmount, prefillRecipient, prefillRecipientUid, prefillMemo]);

  useEffect(() => {
    if (user) {
      fetchPiBalance();
    }
  }, [user, fetchPiBalance]);

  const loadTransactions = async (userId: string) => {
    try {
      const { data: sent } = await supabase
        .from("transactions")
        .select("*")
        .eq("sender_uid", userId)
        .order("created_at", { ascending: false });

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

  // Handle Pi payment submission
  const handleSendPi = async () => {
    if (!sendAmount || parseFloat(sendAmount) <= 0) {
      setSendError("Please enter a valid amount");
      return;
    }
    if (!recipientUsername && !recipientUid) {
      setSendError("Please enter recipient username");
      return;
    }

    setIsSending(true);
    setSendError("");
    setSendSuccess("");

    try {
      const Pi = (window as any).Pi;
      if (!Pi) {
        setSendError("Pi Network not available. Please open in Pi Browser.");
        setIsSending(false);
        return;
      }

      const amount = parseFloat(sendAmount);
      const platformFee = amount * 0.05; // 5% platform fee
      const netAmount = amount - platformFee;

      // Create payment data
      const paymentData = {
        amount: amount,
        memo: sendMemo || `Payment to ${recipientUsername}`,
        metadata: {
          task_id: taskId,
          recipient_uid: recipientUid,
          recipient_username: recipientUsername,
          platform_fee: platformFee,
          net_amount: netAmount,
        },
      };

      // Initiate Pi payment
      const payment = await Pi.createPayment(paymentData, {
        onReadyForServerApproval: async (paymentId: string) => {
          console.log("Payment ready for approval:", paymentId);
          // Save pending transaction
          await supabase.from("transactions").insert({
            task_id: taskId,
            sender_uid: user.id,
            sender_username: user.username,
            receiver_uid: recipientUid,
            receiver_username: recipientUsername,
            total_amount: amount,
            platform_fee_amount: platformFee,
            net_amount: netAmount,
            status: "pending",
            pi_txid: paymentId,
          });
        },
        onReadyForServerCompletion: async (paymentId: string, txid: string) => {
          console.log("Payment completed:", paymentId, txid);
          // Update transaction as completed
          await supabase
            .from("transactions")
            .update({ status: "completed", completed_at: new Date().toISOString() })
            .eq("pi_txid", paymentId);
          
          setSendSuccess(`Successfully sent ${amount} π to ${recipientUsername}`);
          loadTransactions(user.id);
          
          // If from task completion, redirect to rating
          if (taskId) {
            setTimeout(() => {
              router.push(`/rate?task=${taskId}&user=${recipientUid}`);
            }, 2000);
          }
        },
        onCancel: (paymentId: string) => {
          console.log("Payment cancelled:", paymentId);
          setSendError("Payment was cancelled");
          setIsSending(false);
        },
        onError: (error: any, paymentId?: string) => {
          console.error("Payment error:", error);
          setSendError("Payment failed: " + (error?.message || "Unknown error"));
          setIsSending(false);
        },
      });

      console.log("Payment created:", payment);
    } catch (err: any) {
      console.error("Send Pi error:", err);
      setSendError("Failed to send: " + (err?.message || "Unknown error"));
    } finally {
      setIsSending(false);
    }
  };

  const cardNumber = user ? generateCardNumber(user.id) : "YASA-0000-0000-0000";

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

  const transactions = activeTab === "sent" ? sentPayments : activeTab === "received" ? receivedPayments : [];
  const totalSent = sentPayments.reduce((sum, t) => sum + t.total_amount, 0);
  const totalReceived = receivedPayments.reduce((sum, t) => sum + t.net_amount, 0);

  return (
    <div className="min-h-screen app-background text-white flex flex-col">
      {/* Header */}
      <div className="glass-nav sticky top-0 z-50 p-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/dashboard" className="text-xl">← Dashboard</Link>
          <h1 className="text-lg font-bold">Payments</h1>
          <div className="w-8"></div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 pt-6 w-full">
        {/* Pi Debit Card */}
        <div className="mb-6">
          <div 
            className="relative w-full max-w-md mx-auto rounded-2xl p-6 overflow-hidden"
            style={{
              background: "linear-gradient(145deg, #0a0a0a 0%, #1a1a1a 50%, #0d0d0d 100%)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.8), 0 0 40px rgba(255,215,0,0.15)",
              border: "1px solid rgba(255,215,0,0.4)",
            }}
          >
            {/* Card Pattern Overlay */}
            <div 
              className="absolute inset-0 opacity-5"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23FFD700' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
              }}
            />
            
            {/* Top Row - Card Type */}
            <div className="flex justify-between items-start mb-4 relative z-10">
              <span className="text-white/60 font-semibold text-xs tracking-widest">YASA CARD</span>
              <span className="text-white/40 text-xs">DEBIT</span>
            </div>

            {/* Center Pi Logo - Large */}
            <div className="flex justify-center items-center mb-6 relative z-10">
              <div 
                className="w-20 h-20 rounded-full flex items-center justify-center"
                style={{ 
                  background: "linear-gradient(135deg, #FFD700 0%, #FFA500 50%, #FFD700 100%)",
                  color: "#000000",
                  boxShadow: "0 0 30px rgba(255,215,0,0.6), inset 0 0 20px rgba(255,255,255,0.3)",
                  fontSize: "3rem",
                  fontWeight: "bold",
                  border: "3px solid rgba(255,215,0,0.5)"
                }}
              >
                π
              </div>
            </div>

            {/* Card Number */}
            <div className="mb-6 text-center relative z-10">
              <p 
                className="text-xl font-mono tracking-[0.3em]"
                style={{ 
                  color: "#FFD700",
                  textShadow: "0 0 15px rgba(255,215,0,0.5)",
                  fontFamily: "'Courier New', monospace"
                }}
              >
                {cardNumber}
              </p>
            </div>

            {/* Card Details */}
            <div className="flex justify-between items-end relative z-10">
              <div>
                <p className="text-white/40 text-xs mb-1 tracking-wider">CARDHOLDER</p>
                <p className="text-white font-semibold tracking-wider text-sm uppercase">
                  {user.username}
                </p>
              </div>
              <div className="text-right">
                <p className="text-white/40 text-xs mb-1 tracking-wider">BALANCE</p>
                <p className="text-2xl font-bold" style={{ color: "#FFD700", textShadow: "0 0 10px rgba(255,215,0,0.3)" }}>
                  {piBalance !== null ? piBalance.toFixed(2) : "--.--"} π
                </p>
              </div>
            </div>

            {/* Gold Accent Lines */}
            <div 
              className="absolute top-0 left-0 right-0 h-0.5"
              style={{ 
                background: "linear-gradient(90deg, transparent 0%, #FFD700 20%, #FFD700 80%, transparent 100%)",
                opacity: 0.8
              }}
            />
            <div 
              className="absolute bottom-0 left-0 right-0 h-0.5"
              style={{ 
                background: "linear-gradient(90deg, transparent 0%, #FFD700 20%, #FFD700 80%, transparent 100%)",
                opacity: 0.8
              }}
            />
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex gap-3 mb-6">
          <button
            onClick={() => setActiveTab("send")}
            className={`flex-1 py-3 px-4 rounded-xl font-semibold transition ${
              activeTab === "send"
                ? "bg-gradient-to-r from-yellow-500 to-yellow-600 text-black"
                : "glass-button hover:bg-white/10"
            }`}
          >
            Send Pi
          </button>
          <button
            onClick={() => setActiveTab("sent")}
            className={`flex-1 py-3 px-4 rounded-xl font-semibold transition ${
              activeTab === "sent"
                ? "glass-button-primary"
                : "glass-button hover:bg-white/10"
            }`}
          >
            History
          </button>
        </div>

        {/* Send Pi Form */}
        {activeTab === "send" && (
          <div className="glass-card p-6 mb-6">
            <h3 className="text-lg font-semibold mb-4 glass-text">
              {taskId ? "Complete Payment for Task" : "Send Pi"}
            </h3>
            
            {sendError && (
              <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 mb-4">
                <p className="text-red-400 text-sm">{sendError}</p>
              </div>
            )}
            
            {sendSuccess && (
              <div className="bg-green-500/20 border border-green-500/50 rounded-lg p-3 mb-4">
                <p className="text-green-400 text-sm">{sendSuccess}</p>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm glass-text-accent mb-2">Recipient Username</label>
                <input
                  type="text"
                  value={recipientUsername}
                  onChange={(e) => setRecipientUsername(e.target.value)}
                  placeholder="@username"
                  className="w-full glass-input px-4 py-3 rounded-lg text-white placeholder-white/30"
                  disabled={!!prefillRecipient || isSending}
                />
              </div>

              <div>
                <label className="block text-sm glass-text-accent mb-2">Amount (π)</label>
                <input
                  type="number"
                  value={sendAmount}
                  onChange={(e) => setSendAmount(e.target.value)}
                  placeholder="0.00"
                  step="0.01"
                  min="0.01"
                  className="w-full glass-input px-4 py-3 rounded-lg text-white placeholder-white/30 text-2xl font-bold"
                  disabled={isSending}
                />
                {parseFloat(sendAmount) > 0 && (
                  <p className="text-xs glass-text-muted mt-1">
                    Platform fee (5%): {(parseFloat(sendAmount) * 0.05).toFixed(2)} π<br/>
                    Recipient receives: {(parseFloat(sendAmount) * 0.95).toFixed(2)} π
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm glass-text-accent mb-2">Memo (Optional)</label>
                <input
                  type="text"
                  value={sendMemo}
                  onChange={(e) => setSendMemo(e.target.value)}
                  placeholder="Payment for..."
                  className="w-full glass-input px-4 py-3 rounded-lg text-white placeholder-white/30"
                  disabled={isSending}
                />
              </div>

              <button
                onClick={handleSendPi}
                disabled={isSending || !sendAmount || parseFloat(sendAmount) <= 0}
                className="w-full py-4 rounded-xl font-bold text-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: "linear-gradient(135deg, #FFD700 0%, #FFA500 100%)",
                  color: "#1a1a2e",
                  boxShadow: "0 4px 20px rgba(255,215,0,0.3)"
                }}
              >
                {isSending ? "Processing..." : taskId ? "Pay & Complete Task" : "Send Pi"}
              </button>
            </div>
          </div>
        )}

        {/* Transaction History Tabs */}
        {(activeTab === "sent" || activeTab === "received") && (
          <>
            {/* Summary Stats */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="glass-card p-4">
                <p className="glass-text-accent text-xs mb-1">Total Sent</p>
                <p className="text-xl font-bold text-white">{totalSent.toFixed(2)} π</p>
                <p className="text-xs glass-text-muted">{sentPayments.length} payments</p>
              </div>
              <div className="glass-card p-4">
                <p className="glass-text-accent text-xs mb-1">Total Received</p>
                <p className="text-xl font-bold" style={{ color: "#FFD700" }}>{totalReceived.toFixed(2)} π</p>
                <p className="text-xs glass-text-muted">{receivedPayments.length} payments</p>
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
                  Sent ({sentPayments.length})
                </button>
                <button
                  onClick={() => setActiveTab("received")}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition ${
                    activeTab === "received"
                      ? "glass-button-primary"
                      : "glass-text-muted hover:glass-text"
                  }`}
                >
                  Received ({receivedPayments.length})
                </button>
              </div>
            </div>

            {/* Transactions List */}
            <div className="space-y-3">
              {transactions.length === 0 ? (
                <div className="glass-card p-8 text-center">
                  <p className="glass-text mb-2">
                    No {activeTab} payments yet
                  </p>
                  <p className="text-sm glass-text-muted">
                    {activeTab === "sent"
                      ? "Payments you make will appear here"
                      : "Payments you receive will appear here"}
                  </p>
                </div>
              ) : (
                transactions.map((tx) => (
                  <div key={tx.id} className="glass-card p-4 hover:bg-white/5 transition">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`text-sm font-medium ${getStatusColor(tx.status)}`}>
                            {tx.status?.toUpperCase()}
                          </span>
                          <span className="text-xs glass-text-muted">
                            {formatDate(tx.created_at)}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 mb-1">
                          <span className="glass-text text-sm">
                            {activeTab === "sent" ? "To:" : "From:"}
                          </span>
                          <span className="glass-text-accent font-medium">
                            {activeTab === "sent" ? tx.receiver_username : tx.sender_username}
                          </span>
                        </div>

                        <div className="flex items-baseline gap-2">
                          <span className="text-lg font-bold text-yellow-400">
                            {activeTab === "sent" ? tx.total_amount.toFixed(2) : tx.net_amount.toFixed(2)} π
                          </span>
                          {activeTab === "sent" && tx.platform_fee_amount > 0 && (
                            <span className="text-xs glass-text-muted">
                              (fee: {tx.platform_fee_amount.toFixed(2)} π)
                            </span>
                          )}
                        </div>
                      </div>

                      <div className={`w-2 h-2 rounded-full ${
                        tx.status === "completed" ? "bg-green-400" :
                        tx.status === "failed" ? "bg-red-400" :
                        "bg-yellow-400"
                      }`} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
