"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";

interface TaskDetails {
  id: string;
  title: string;
  budget: number;
  poster_id: string;
  assignee_id?: string;
  status: string;
}

interface FreelancerDetails {
  id: string;
  username: string;
  freelancer_username?: string;
  wallet_address?: string;
}

export default function PaymentPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const taskId = searchParams.get("task");
  const returnUrl = searchParams.get("return") || "/dashboard";

  const [task, setTask] = useState<TaskDetails | null>(null);
  const [freelancer, setFreelancer] = useState<FreelancerDetails | null>(null);
  const [user, setUser] = useState<any>(null);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<"idle" | "processing" | "success" | "failed">("idle");
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [customAmount, setCustomAmount] = useState<number>(0);

  // Platform fee settings - set to 0 since users pay via monthly membership
  const PLATFORM_FEE_PERCENT = 0;
  const [platformWallet, setPlatformWallet] = useState<string>("");

  // Calculate amounts - full amount goes to freelancer
  const taskAmount = customAmount || task?.budget || 0;
  const platformFee = 0;
  const freelancerAmount = taskAmount;

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    if (user && taskId) {
      loadTaskDetails();
      loadPlatformConfig();
    }
  }, [user, taskId]);

  const loadUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();

      const userData = profile || {
        id: session.user.id,
        username: session.user.user_metadata?.username || session.user.email?.split("@")[0] || "User",
        wallet_address: session.user.user_metadata?.wallet_address || null,
      };

      localStorage.setItem("pi_user", JSON.stringify(userData));
      setUser(userData);
      const balance = localStorage.getItem(`wallet_balance_${userData.id}`);
      if (balance) setWalletBalance(parseFloat(balance));
    } else {
      setError("Please login first");
      setLoading(false);
    }
  };

  const loadPlatformConfig = async () => {
    const { data } = await supabase
      .from("platform_config")
      .select("value")
      .eq("key", "platform_fee_wallet")
      .single();
    
    if (data?.value) {
      setPlatformWallet(data.value);
    }
  };

  const loadTaskDetails = async () => {
    try {
      // Load task
      const { data: taskData, error: taskError } = await supabase
        .from("tasks")
        .select("*")
        .eq("id", taskId)
        .single();

      if (taskError || !taskData) {
        setError("Task not found");
        setLoading(false);
        return;
      }

      setTask(taskData);
      setCustomAmount(Number(taskData.budget) || 0);

      // Verify user is the task poster
      if (taskData.poster_id !== user.id) {
        setError("Only the task poster can make payments");
        setLoading(false);
        return;
      }

      let freelancerId = taskData.assignee_id;

      if (!freelancerId) {
        const { data: approvedApplication } = await supabase
          .from("applications")
          .select("applicant_id")
          .eq("task_id", taskId)
          .eq("status", "approved")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        freelancerId = approvedApplication?.applicant_id;
      }

      if (freelancerId) {
        const { data: freelancerData } = await supabase
          .from("profiles")
          .select("id, username, freelancer_username, wallet_address")
          .eq("id", freelancerId)
          .single();

        if (freelancerData) setFreelancer(freelancerData);
      }

      // Check if payment already completed
      if (taskData.payment_status === "completed") {
        setPaymentStatus("success");
      }

      setLoading(false);
    } catch (err) {
      console.error("Error loading task:", err);
      setError("Failed to load task details");
      setLoading(false);
    }
  };

  const handlePayment = async () => {
    if (!task || !freelancer) {
      setError("Missing payment information");
      return;
    }

    const Pi = (window as any).Pi;
    if (!Pi) {
      setError("⚠️ Pi SDK not loaded. Please ensure you are using Pi Browser. If the issue persists, close and reopen the app.");
      setPaymentStatus("failed");
      return;
    }

    // Check Pi SDK is properly initialized
    try {
      Pi.init({ version: "2.0", sandbox: false });
    } catch (err) {
      setError("⚠️ Pi SDK initialization failed. Please refresh the page.");
      setPaymentStatus("failed");
      return;
    }

    setProcessingPayment(true);
    setPaymentStatus("processing");
    setError(null);

    try {
      // Step 1: Create transaction record
      const { data: transaction, error: txnError } = await supabase
        .from("transactions")
        .insert({
          task_id: task.id,
          sender_uid: user.id,
          sender_username: user.username,
          sender_wallet_address: user.wallet_address,
          receiver_uid: freelancer.id,
          receiver_username: freelancer.freelancer_username || freelancer.username,
          receiver_wallet_address: freelancer.wallet_address,
          platform_fee_recipient: platformWallet || null,
          total_amount: taskAmount,
          platform_fee_percent: PLATFORM_FEE_PERCENT,
          platform_fee_amount: platformFee,
          net_amount: freelancerAmount,
          status: "processing",
          payment_memo: `Payment for task: ${task.title}`,
        })
        .select()
        .single();

      if (txnError) {
        throw new Error("Failed to create transaction record: " + txnError.message);
      }

      setTransactionId(transaction.id);

      // Step 2: Per Pi Platform docs, authenticate with the "payments" scope BEFORE
      // calling createPayment, and provide an onIncompletePaymentFound handler.
      setError("Connecting to Pi Network... Please approve the payment permission when prompted.");
      
      const onIncompletePaymentFound = (payment: any) => {
        console.warn("⚠️ Incomplete Pi payment found:", payment);
        supabase
          .from("payment_errors")
          .insert({
            payment_id: payment?.identifier || "unknown",
            error: JSON.stringify({ reason: "incomplete_payment_found", payment }),
            created_at: new Date().toISOString(),
          })
          .then(() => {});
      };

      let authResult;
      try {
        authResult = await Pi.authenticate(
          ["username", "payments", "wallet_address"],
          onIncompletePaymentFound
        );
      } catch (authErr: any) {
        throw new Error("Pi authentication failed: " + (authErr?.message || "Please approve the payments permission in Pi Browser"));
      }

      if (!authResult?.accessToken) {
        throw new Error(
          "Pi authentication did not return a payments-enabled session. Please approve the 'payments' permission in Pi Browser and try again."
        );
      }

      // Step 3: Create the Pi payment
      setError("Opening Pi payment dialog...");
      
      await Pi.createPayment(
        {
          amount: taskAmount,
          memo: `YASA task payment: ${task.title}`,
          metadata: {
            task_id: task.id,
            transaction_id: transaction.id,
            freelancer_id: freelancer.id,
            freelancer_username: freelancer.freelancer_username || freelancer.username,
          },
        },
        {
          onReadyForServerApproval: async (paymentId: string) => {
            // Clear the "Opening Pi payment dialog..." message
            setError(null);
            // Server-side approval (required by Pi before the user can submit
            // the transaction to the blockchain).
            const res = await fetch("/api/payments/approve", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ paymentId }),
            });
            if (!res.ok) {
              const err = await res.json().catch(() => ({}));
              throw new Error(err?.error || "Server approval failed");
            }
            await supabase
              .from("transactions")
              .update({
                pi_payment_id: paymentId,
                status: "processing",
              })
              .eq("id", transaction.id);
          },
          onReadyForServerCompletion: async (paymentId: string, txid: string) => {
            // Server-side completion (proves to Pi the app has the txid).
            const res = await fetch("/api/payments/complete", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ paymentId, txid }),
            });
            if (!res.ok) {
              const err = await res.json().catch(() => ({}));
              throw new Error(err?.error || "Server completion failed");
            }
            await supabase
              .from("transactions")
              .update({
                status: "success",
                pi_payment_id: paymentId,
                pi_txid: txid,
                completed_at: new Date().toISOString(),
              })
              .eq("id", transaction.id);

            await supabase
              .from("tasks")
              .update({
                payment_status: "completed",
                transaction_id: transaction.id,
                payment_completed_at: new Date().toISOString(),
                payment_txid: txid,
                status: "payment_confirmed",
              })
              .eq("id", task.id);

            await supabase.from("notifications").insert({
              user_id: freelancer.id,
              type: "payment_received",
              message: `Payment was sent for "${task.title}". Please check your Pi wallet and confirm receipt in chat.`,
              related_task_id: task.id,
              read: false,
            });

            setPaymentStatus("success");
            setProcessingPayment(false);
            router.push(`/payment-summary?task=${task.id}&txid=${txid}&memo=${encodeURIComponent(`YASA task payment: ${task.title}`)}&amount=${taskAmount}&to=${encodeURIComponent(freelancer.freelancer_username || freelancer.username)}&to_uid=${freelancer.id}`);
          },
          onCancel: async (paymentId: string) => {
            await supabase
              .from("transactions")
              .update({
                status: "cancelled",
                pi_payment_id: paymentId,
              })
              .eq("id", transaction.id);

            setPaymentStatus("idle");
            setProcessingPayment(false);
            setError("Payment was cancelled. The task was not marked as paid.");
          },
          onError: async (paymentError: any, paymentId?: string) => {
            await supabase
              .from("transactions")
              .update({
                status: "failed",
                pi_payment_id: paymentId || null,
                error_message: paymentError?.message || String(paymentError),
              })
              .eq("id", transaction.id);

            setPaymentStatus("failed");
            setProcessingPayment(false);
            setError(paymentError?.message || "Payment failed. Please try again.");
          },
        }
      );

    } catch (err: any) {
      console.error("Payment error:", err);
      setError(err.message || "Payment failed. Please try again.");
      setPaymentStatus("failed");
      
      // Update transaction status to failed
      if (transactionId) {
        await supabase
          .from("transactions")
          .update({
            status: "failed",
            error_message: err.message,
          })
          .eq("id", transactionId);
      }
    } finally {
      setProcessingPayment(false);
    }
  };

  const handleContinueToRating = () => {
    router.push(`/rate?task=${taskId}&user=${freelancer?.id}&role=tasker`);
  };

  if (loading) {
    return (
      <div className="min-h-screen glass-dark flex items-center justify-center">
        <div className="glass-card p-8">
          <div className="glass-loading mx-auto mb-4"></div>
          <p className="glass-text-accent">Loading payment details...</p>
        </div>
      </div>
    );
  }

  if (error && !task) {
    return (
      <div className="min-h-screen glass-dark flex items-center justify-center">
        <div className="glass-card p-8 max-w-md">
          <div className="text-4xl mb-4 text-center">⚠️</div>
          <h2 className="text-xl font-bold text-red-400 mb-4 text-center">Error</h2>
          <p className="glass-text mb-6">{error}</p>
          <Link href={returnUrl as any} className="glass-button glass-button-primary w-full block text-center">
            Go Back
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen glass-dark app-background">
      {/* Header */}
      <div className="glass-nav sticky top-0 z-50 p-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href={returnUrl as any} className="text-xl">← Back</Link>
          <h1 className="text-lg font-bold">Pi Payment</h1>
          <div className="w-8"></div>
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4 pt-8">
        {/* Wallet Balance Card */}
        <div className="glass-card p-6 mb-6 border border-white/10">
          <div className="flex items-center justify-between mb-4">
            <span className="glass-text-accent text-sm">Wallet Balance</span>
            <span className="text-xs glass-text-muted">Pi Network</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold glass-text">
              {walletBalance !== null ? walletBalance.toFixed(2) : "--"}
            </span>
            <span className="text-lg glass-text-accent">π</span>
          </div>
          {walletBalance !== null && walletBalance < taskAmount && (
            <p className="text-red-400 text-sm mt-2">
              ⚠️ Insufficient balance for this payment
            </p>
          )}
        </div>

        {/* Pi Debit Card Style Card */}
        <div className="relative mb-6">
          <div className="glass-card p-6 aspect-[1.586/1] flex flex-col justify-between"
               style={{
                 background: "linear-gradient(135deg, rgba(0,0,0,0.8) 0%, rgba(30,30,30,0.9) 100%)",
                 border: "1px solid rgba(255,215,0,0.3)",
               }}>
            {/* Card Header */}
            <div className="flex justify-between items-start">
              <div className="text-white/60 text-xs">Pi Network</div>
              <div className="text-yellow-400 font-bold text-lg">π</div>
            </div>
            
            {/* Card Number */}
            <div className="text-yellow-400/80 font-mono text-lg tracking-wider">
              •••• •••• •••• {user?.id?.slice(-4) || "0000"}
            </div>
            
            {/* Card Footer */}
            <div className="flex justify-between items-end">
              <div>
                <div className="text-white/40 text-xs uppercase">Card Holder</div>
                <div className="text-white/80 text-sm truncate max-w-[180px]">
                  {user?.username || "Unknown"}
                </div>
              </div>
              <div className="text-right">
                <div className="text-white/40 text-xs">VALID</div>
                <div className="text-yellow-400/60 text-sm">MAINNET</div>
              </div>
            </div>
          </div>
        </div>

        {/* Payment Details */}
        {paymentStatus !== "success" && (
          <div className="glass-card p-6 mb-6">
            <h2 className="text-lg font-semibold glass-text-accent mb-4">Payment Details</h2>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-white/10">
                <span className="glass-text-muted text-sm">Task</span>
                <span className="glass-text text-sm text-right max-w-[60%]">{task?.title}</span>
              </div>
              
              <div className="flex justify-between items-center py-2 border-b border-white/10">
                <span className="glass-text-muted text-sm">Freelancer</span>
                <span className="glass-text text-sm">
                  {freelancer?.freelancer_username || freelancer?.username || "Unknown"}
                </span>
              </div>
              
              <div className="flex justify-between items-center py-2 border-b border-white/10">
                <span className="glass-text-muted text-sm">Wallet Address</span>
                <span className="glass-text text-xs font-mono truncate max-w-[150px]">
                  {freelancer?.wallet_address 
                    ? `${freelancer.wallet_address.slice(0, 8)}...${freelancer.wallet_address.slice(-8)}`
                    : "Not set"
                  }
                </span>
              </div>
              
              <div className="flex justify-between items-center py-2 border-b border-white/10">
                <span className="glass-text-muted text-sm">Task Amount</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={customAmount}
                    onChange={(e) => setCustomAmount(Number(e.target.value))}
                    className="glass-input w-24 px-2 py-1 text-right text-sm"
                    disabled={processingPayment}
                  />
                  <span className="glass-text font-semibold">π</span>
                </div>
              </div>
              
              <div className="flex justify-between items-center py-3 border-t-2 border-yellow-400/30">
                <span className="glass-text font-semibold">Freelancer Receives</span>
                <span className="text-yellow-400 font-bold text-lg">{freelancerAmount.toFixed(2)} π</span>
              </div>
              <p className="text-xs glass-text-muted text-center">
                No platform fee - you keep 100% (membership covers fees)
              </p>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && paymentStatus !== "success" && (
          <div className="glass-card p-4 mb-6 border-red-500/30 bg-red-500/10">
            <p className="text-red-400 text-sm">⚠️ {error}</p>
          </div>
        )}

        {/* Success State */}
        {paymentStatus === "success" && (
          <div className="glass-card p-6 mb-6 text-center border-green-500/30 bg-green-500/10">
            <div className="text-5xl mb-4">✅</div>
            <h2 className="text-xl font-bold text-green-400 mb-2">Payment Successful!</h2>
            <p className="glass-text mb-4">
              {freelancerAmount.toFixed(2)} π has been sent to {freelancer?.username}
            </p>
            <p className="text-sm glass-text-muted mb-6">
              Full payment received - no fees deducted.
            </p>
            <button
              onClick={handleContinueToRating}
              className="glass-button glass-button-primary w-full"
            >
              Continue to Rate Freelancer →
            </button>
          </div>
        )}

        {/* Processing State */}
        {paymentStatus === "processing" && (
          <div className="glass-card p-6 mb-6 text-center">
            <div className="glass-loading mx-auto mb-4"></div>
            <p className="glass-text-accent">Processing Pi payment...</p>
            <p className="text-sm glass-text-muted mt-2">
              Please confirm the payment in your Pi Browser
            </p>
          </div>
        )}

        {/* Pay Button */}
        {paymentStatus === "idle" && (
          <button
            onClick={handlePayment}
            disabled={processingPayment || !freelancer?.wallet_address || (walletBalance !== null && walletBalance < taskAmount)}
            className="glass-button glass-button-primary w-full py-4 text-lg disabled:opacity-50"
          >
            {processingPayment ? (
              <span className="flex items-center justify-center gap-2">
                <span className="glass-loading w-5 h-5"></span>
                Processing...
              </span>
            ) : (
              <span>
                Pay {freelancerAmount.toFixed(2)} π
              </span>
            )}
          </button>
        )}

        {/* Cancel Button */}
        {paymentStatus === "idle" && (
          <Link
            href={returnUrl as any}
            className="glass-button w-full mt-4 text-center block"
          >
            Cancel Payment
          </Link>
        )}

        {/* Help Text */}
        <p className="text-center text-xs glass-text-muted mt-6">
          Payment is secured by Pi Network Mainnet blockchain.
          <br />
          Transaction will be recorded on-chain.
        </p>
      </div>
    </div>
  );
}
