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

  // Platform fee settings
  const PLATFORM_FEE_PERCENT = 5;
  const [platformWallet, setPlatformWallet] = useState<string>("");

  // Calculate amounts
  const taskAmount = task?.budget || 0;
  const platformFee = (taskAmount * PLATFORM_FEE_PERCENT) / 100;
  const freelancerAmount = taskAmount - platformFee;

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
    const stored = localStorage.getItem("pi_user");
    if (stored) {
      const userData = JSON.parse(stored);
      setUser(userData);
      // Load wallet balance from Pi SDK or local storage
      const balance = localStorage.getItem(`wallet_balance_${userData.id}`);
      if (balance) {
        setWalletBalance(parseFloat(balance));
      }
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

      // Verify user is the task poster
      if (taskData.poster_id !== user.id) {
        setError("Only the task poster can make payments");
        setLoading(false);
        return;
      }

      // Load freelancer details
      if (taskData.assignee_id) {
        const { data: freelancerData } = await supabase
          .from("profiles")
          .select("id, username, freelancer_username, wallet_address")
          .eq("id", taskData.assignee_id)
          .single();

        if (freelancerData) {
          setFreelancer(freelancerData);
        }
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
    if (!task || !freelancer || !platformWallet) {
      setError("Missing payment information");
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
          platform_fee_recipient: platformWallet,
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

      // Step 2: Call Pi Payment API
      const paymentResponse = await fetch("/api/pi-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactionId: transaction.id,
          taskId: task.id,
          amount: taskAmount,
          freelancerAmount: freelancerAmount,
          platformFee: platformFee,
          freelancerWallet: freelancer.wallet_address,
          platformWallet: platformWallet,
          memo: `Task payment: ${task.title}`,
        }),
      });

      const paymentResult = await paymentResponse.json();

      if (!paymentResponse.ok) {
        throw new Error(paymentResult.error || "Payment failed");
      }

      // Step 3: Update transaction with Pi payment ID
      await supabase
        .from("transactions")
        .update({
          status: "success",
          pi_payment_id: paymentResult.paymentId,
          pi_txid: paymentResult.txid,
          completed_at: new Date().toISOString(),
        })
        .eq("id", transaction.id);

      // Step 4: Update task payment status
      await supabase
        .from("tasks")
        .update({
          payment_status: "completed",
          transaction_id: transaction.id,
          payment_completed_at: new Date().toISOString(),
          status: "completed",
        })
        .eq("id", task.id);

      // Step 5: Send notification to freelancer
      await supabase.from("notifications").insert({
        user_id: freelancer.id,
        type: "payment_received",
        message: `You have received ${freelancerAmount.toFixed(2)} Pi from ${user.username} for task: ${task.title}`,
        related_task_id: task.id,
        read: false,
      });

      setPaymentStatus("success");
      
      // Update wallet balance (deduct sent amount)
      const newBalance = (walletBalance || 0) - taskAmount;
      localStorage.setItem(`wallet_balance_${user.id}`, newBalance.toString());
      setWalletBalance(newBalance);

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
    // Redirect to rating page
    router.push(`/rating?task=${taskId}&role=tasker`);
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
          <Link href={returnUrl} className="glass-button glass-button-primary w-full block text-center">
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
          <Link href={returnUrl} className="text-xl">← Back</Link>
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
                <span className="glass-text font-semibold">{taskAmount.toFixed(2)} π</span>
              </div>
              
              <div className="flex justify-between items-center py-2 border-b border-white/10">
                <span className="glass-text-muted text-sm">Platform Fee ({PLATFORM_FEE_PERCENT}%)</span>
                <span className="glass-text-accent">-{platformFee.toFixed(2)} π</span>
              </div>
              
              <div className="flex justify-between items-center py-3 border-t-2 border-yellow-400/30">
                <span className="glass-text font-semibold">Freelancer Receives</span>
                <span className="text-yellow-400 font-bold text-lg">{freelancerAmount.toFixed(2)} π</span>
              </div>
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
              Platform fee of {platformFee.toFixed(2)} π applied.
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
                <span className="text-sm opacity-70 ml-2">(+{platformFee.toFixed(2)} fee)</span>
              </span>
            )}
          </button>
        )}

        {/* Cancel Button */}
        {paymentStatus === "idle" && (
          <Link
            href={returnUrl}
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
