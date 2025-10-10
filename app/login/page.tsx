"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/context/UserContext";
import { mockPiAuthenticate } from "@/lib/piAuth.ts";

export default function LoginPage() {
  const router = useRouter();
  const { setUser } = useUser();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleLogin = async () => {
    try {
      setLoading(true);
      setMessage("Connecting to Pi Network...");

      // local mock (will be replaced by real Pi SDK on Pi Browser later)
      const authResult = await mockPiAuthenticate();

      // Call backend verification endpoint (mock or real)
      const res = await fetch("/api/verify-pi-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessToken: authResult.accessToken,
          user: authResult, // mockPiAuthenticate returns the user object
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        // prefer server-provided user if present, fallback to authResult
        const serverUser = data.user || authResult;

        // Normalize the user object we store in context
        const normalized = {
          uid: serverUser.uid ?? serverUser.uid ?? (serverUser?.id as string) ?? "pi_local",
          username: serverUser.username ?? serverUser.name ?? "PiUser",
          accessToken: serverUser.accessToken ?? authResult.accessToken,
          avatar: serverUser.avatar ?? null,
        };

        setUser(normalized);
        setMessage("Login verified — redirecting...");
        router.push("/dashboard");
      } else {
        setMessage("Verification failed. Try again (or test in Pi Browser).");
      }
    } catch (err) {
      console.error(err);
      setMessage("Connection error — try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#000222] text-white p-6">
      <div className="max-w-md w-full bg-white/6 border border-white/10 p-8 rounded-2xl text-center backdrop-blur-md">
        <h1 className="text-3xl font-bold mb-3">Welcome to YASA Tasker</h1>
        <p className="text-gray-300 mb-6">Sign in with Pi Network to access your dashboard.</p>

        <button
          onClick={handleLogin}
          disabled={loading}
          className={`w-full py-3 rounded-xl font-semibold transition ${
            loading ? "bg-blue-400/30 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          {loading ? "Connecting..." : "Connect to Pi Network"}
        </button>

        {message && <p className="mt-4 text-sm text-gray-300">{message}</p>}
      </div>
    </div>
  );
}