"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useUser } from "@/context/UserContext";

export default function LoginPage() {
  const router = useRouter();
  const { user, setUser } = useUser();
  const [loading, setLoading] = useState(false);

  // Redirect to dashboard if already logged in
  useEffect(() => {
    if (user) {
      router.push("/dashboard");
    }
  }, [user, router]);

  // Simulated Pi Network login (replace with actual Pi SDK call)
  const handlePiLogin = async () => {
    setLoading(true);
    try {
      // Simulate Pi authentication response
      const piUser = {
        uid: crypto.randomUUID(),
        username: "pi_user_" + Math.floor(Math.random() * 10000),
      };

      // Save to localStorage
      localStorage.setItem("piUser", JSON.stringify(piUser));

      // Sync with Supabase
      const { data, error } = await supabase
        .from("profiles")
        .upsert({
          id: piUser.uid,
          username: piUser.username,
        });

      if (error) throw error;

      // Update user context
      setUser(piUser);

      // Redirect to dashboard
      router.push("/dashboard");
    } catch (error: any) {
      alert("Login failed: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen text-white">
      <div className="glass-modal p-8 w-[90%] max-w-md text-center">
        <h1 className="text-3xl font-bold mb-6 glass-text">Welcome to Tasker</h1>
        <p className="glass-text-muted mb-8">
          Manage your tasks efficiently while connected to Pi Network.
        </p>

        <button
          onClick={handlePiLogin}
          disabled={loading}
          className="w-full glass-button glass-button-primary py-3 font-semibold text-lg disabled:opacity-50"
        >
          {loading ? "Connecting..." : "Login with Pi"}
        </button>
      </div>
    </div>
  );
}