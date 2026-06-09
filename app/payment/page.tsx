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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [customAmount, setCustomAmount] = useState<number>(0);


  const taskAmount = customAmount || task?.budget || 0;

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    if (user && taskId) {
      loadTaskDetails();
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

      setUser(userData);
    } else {
      setError("Please login first");
      setLoading(false);
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

  const handleCopyWallet = () => {
    if (!freelancer?.wallet_address) return;
    navigator.clipboard.writeText(freelancer.wallet_address).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
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
          <h1 className="text-lg font-bold">Payment Details</h1>
          <div className="w-8"></div>
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4 pt-6">

        {/* Task & Freelancer Info */}
        <div className="glass-card p-5 mb-4">
          <h2 className="text-base font-semibold glass-text-accent mb-3">Payment Summary</h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="glass-text-muted text-sm">Task</span>
              <span className="glass-text text-sm text-right max-w-[60%]">{task?.title}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="glass-text-muted text-sm">To</span>
              <span className="glass-text text-sm font-semibold">
                {freelancer?.freelancer_username || freelancer?.username || "Unknown"}
              </span>
            </div>
            <div className="flex justify-between items-center border-t border-white/10 pt-3">
              <span className="glass-text-muted text-sm">Amount to Send</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(Number(e.target.value))}
                  className="glass-input w-24 px-2 py-1 text-right text-sm"
                />
                <span className="text-yellow-400 font-bold">π</span>
              </div>
            </div>
          </div>
        </div>

        {/* Wallet Address Card */}
        <div className="glass-card p-5 mb-4">
          <h2 className="text-base font-semibold glass-text-accent mb-1">Freelancer Wallet Address</h2>
          <p className="text-xs glass-text-muted mb-3">Copy this address and use it in your Pi Wallet to send payment.</p>

          {freelancer?.wallet_address ? (
            <div className="space-y-3">
              <div className="bg-black/30 rounded-lg p-3 border border-white/10">
                <p className="text-xs font-mono glass-text break-all">{freelancer.wallet_address}</p>
              </div>
              <button
                onClick={handleCopyWallet}
                className={`glass-button w-full py-3 text-sm font-semibold transition-all ${copied ? "glass-button-primary" : ""}`}
              >
                {copied ? "✅ Copied!" : "📋 Copy Wallet Address"}
              </button>
            </div>
          ) : (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
              <p className="text-yellow-400 text-sm">
                ⚠️ This freelancer has not set up their wallet address yet. Ask them to log out and log back in to YASA Tasker so their wallet address gets saved.
              </p>
            </div>
          )}
        </div>

        {/* How to Pay Instructions */}
        <div className="glass-card p-5 mb-4">
          <h2 className="text-base font-semibold glass-text-accent mb-3">How to Pay</h2>
          <ol className="space-y-2 text-sm glass-text-muted">
            <li className="flex gap-2"><span className="text-yellow-400 font-bold">1.</span> Copy the wallet address above</li>
            <li className="flex gap-2"><span className="text-yellow-400 font-bold">2.</span> Open your <strong className="glass-text">Pi Wallet</strong> app</li>
            <li className="flex gap-2"><span className="text-yellow-400 font-bold">3.</span> Send <strong className="text-yellow-400">{taskAmount} π</strong> to the copied address</li>
            <li className="flex gap-2"><span className="text-yellow-400 font-bold">4.</span> Come back to your Profile → Active Tasks</li>
            <li className="flex gap-2"><span className="text-yellow-400 font-bold">5.</span> Click <strong className="glass-text">Complete</strong> next to this task and paste the Transaction ID to verify</li>
          </ol>
        </div>

        {error && (
          <div className="glass-card p-4 mb-4 border-red-500/30 bg-red-500/10">
            <p className="text-red-400 text-sm">⚠️ {error}</p>
          </div>
        )}

        <Link
          href={returnUrl as any}
          className="glass-button w-full text-center block py-3"
        >
          ← Back to Chat
        </Link>

        <p className="text-center text-xs glass-text-muted mt-4">
          Payment is verified on the Pi Network Mainnet blockchain.
        </p>
      </div>
    </div>
  );
}
