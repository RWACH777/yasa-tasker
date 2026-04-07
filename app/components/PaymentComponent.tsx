"use client";

import { useState, useEffect } from "react";
import { createPiPayment, getPaymentStats } from "@/lib/piPayment";

export default function PaymentComponent({ sender }: { sender?: string }) {
  const [receiver, setReceiver] = useState("");
  const [amount, setAmount] = useState(0.01);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [stats, setStats] = useState({
    uniqueReceivers: 0,
    totalPayments: 0,
    remaining: 10,
    requirementMet: false,
  });

  // Load stats on mount
  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    const data = await getPaymentStats();
    setStats({
      uniqueReceivers: data.uniqueReceivers,
      totalPayments: data.totalPayments,
      remaining: data.remaining,
      requirementMet: data.requirementMet,
    });
  };

  const handlePayment = async () => {
    if (!receiver) {
      setMessage("❌ Please enter a receiver wallet address");
      return;
    }

    if (amount <= 0) {
      setMessage("❌ Amount must be greater than 0");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      await createPiPayment(
        amount,
        receiver,
        "Test payment",
        { type: "test" },
        sender
      );
      
      setMessage(`✅ Payment of ${amount} Pi sent to ${receiver.slice(0, 8)}...`);
      setReceiver("");
      
      // Reload stats after payment
      await loadStats();
    } catch (error: any) {
      setMessage("❌ " + (error.message || "Payment failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-panel p-6">
      <h2 className="text-xl font-bold glass-text mb-4">💳 Pay with Pi (Testnet)</h2>
      
      {/* Progress Tracker */}
      <div className="mb-6 p-4 glass-card">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm glass-text-muted">Testnet Requirement Progress</span>
          <span className={`text-sm font-bold ${stats.requirementMet ? 'glass-text-accent' : 'text-yellow-300'}`}>
            {stats.uniqueReceivers}/10
          </span>
        </div>
        <div className="w-full bg-black/30 rounded-full h-2.5">
          <div 
            className="bg-gradient-to-r from-blue-400 to-purple-400 h-2.5 rounded-full transition-all shadow-lg"
            style={{ width: `${Math.min(100, (stats.uniqueReceivers / 10) * 100)}%` }}
          ></div>
        </div>
        <p className="text-xs glass-text-muted mt-2">
          {stats.requirementMet 
            ? "✅ Testnet requirement met! 10+ unique receivers." 
            : `Send to ${stats.remaining} more unique wallet(s) to meet requirement.`}
        </p>
      </div>

      {/* Payment Form */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium glass-text-muted mb-1">
            Receiver Wallet Address
          </label>
          <input
            type="text"
            value={receiver}
            onChange={(e) => setReceiver(e.target.value)}
            placeholder="Enter Pi wallet address..."
            className="w-full glass-input px-4 py-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium glass-text-muted mb-1">
            Amount (Pi)
          </label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            value={amount}
            onChange={(e) => setAmount(parseFloat(e.target.value))}
            className="w-full glass-input px-4 py-2"
          />
          <p className="text-xs glass-text-muted opacity-70 mt-1">Default: 0.01 Pi for Testnet</p>
        </div>

        <button
          onClick={handlePayment}
          disabled={loading || !receiver}
          className="w-full glass-button glass-button-primary py-3 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Processing..." : `Send ${amount} Pi`}
        </button>
      </div>

      {/* Message */}
      {message && (
        <div className={`mt-4 p-3 rounded-lg text-sm glass-panel ${
          message.startsWith("✅") ? "border-green-400/50 bg-green-500/10" : 
          message.startsWith("❌") ? "border-red-400/50 bg-red-500/10" : 
          "border-blue-400/50 bg-blue-500/10"
        }`}>
          <p className={message.startsWith("✅") ? "glass-text-accent" : message.startsWith("❌") ? "text-red-300" : "glass-text"}>
            {message}
          </p>
        </div>
      )}
    </div>
  );
}
