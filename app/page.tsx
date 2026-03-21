"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useUser } from "@/context/UserContext";
import { supabase } from "@/lib/supabaseClient";

export default function Home() {
  const router = useRouter();
  const userCtx = useUser();
  const setUser = userCtx?.setUser;

  const [piReady, setPiReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // ✅ Initialize Pi SDK safely
  useEffect(() => {
    const loadPi = () => {
      try {
        if (typeof window !== "undefined" && (window as any).Pi) {
          console.log("✅ Pi SDK found, initializing...");
          
          // Initialize Pi SDK immediately when found
          try {
            (window as any).Pi.init({
              version: "2.0",
              sandbox: false,
            });
            console.log("✅ Pi SDK initialized successfully");
          } catch (initError) {
            console.error("❌ Pi SDK initialization failed:", initError);
          }
          
          setPiReady(true);
        } else {
          console.log("⚙️ Waiting for Pi SDK...");
          const check = setInterval(() => {
            if ((window as any).Pi) {
              console.log("✅ Pi SDK found after delay");
              
              // Initialize Pi SDK immediately when found
              try {
                (window as any).Pi.init({
                  version: "2.0",
                  sandbox: false,
                });
                console.log("✅ Pi SDK initialized successfully");
              } catch (initError) {
                console.error("❌ Pi SDK initialization failed:", initError);
              }
              
              setPiReady(true);
              clearInterval(check);
            }
          }, 500);

          // Timeout after 5 seconds
          setTimeout(() => {
            clearInterval(check);
            if (!((window as any).Pi)) {
              console.warn("⚠️ Pi SDK not loaded after 5s, allowing login anyway");
              setPiReady(true);
            }
          }, 5000);
        }
      } catch (err) {
        console.error("❌ Pi SDK initialization failed:", err);
        setPiReady(true); // Allow login anyway
      }
    };

    loadPi();
  }, []);

  // ✅ Handle Pi login and sync user to Supabase
  const handlePiLogin = async () => {
    if (typeof window === "undefined") return;

    try {
      setIsLoading(true);
      console.log("🔵 handlePiLogin started");

      // 🔧 PI BROWSER: Use real Pi SDK
      const Pi = (window as any).Pi;
      if (!Pi) {
        alert("⚠️ Pi SDK not loaded yet.");
        setIsLoading(false);
        return;
      }

      console.log("✅ Pi SDK ready for authentication");

      const scopes = ["username", "payments"];
      const authResult = await Pi.authenticate(scopes, (payment: any) => {
        console.log("🪙 Incomplete payment:", payment);
      });

      let username, pi_uid, avatar_url;
      username = authResult?.user?.username ?? "Unknown";
      pi_uid = authResult?.user?.uid ?? "";
      avatar_url = authResult?.user?.photo ?? null;

      console.log("🔵 Calling /api/login with:", { pi_uid, username });
      
      // Test API connectivity first
      try {
        const testResponse = await fetch("/api/test");
        const testResult = await testResponse.json();
        console.log("✅ API connectivity test passed:", testResult);
      } catch (testError) {
        console.error("❌ API connectivity test failed:", testError);
        throw new Error("API server is not responding");
      }
      
      // ✅ Send user data to API route (works for both localhost and production)
      let response, result;
      try {
        response = await fetch("/api/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pi_uid, username, avatar_url }),
        });
        result = await response.json();
        console.log("🔵 /api/login response:", { ok: response.ok, status: response.status, result });
      } catch (fetchError) {
        console.error("❌ Network error calling /api/login:", fetchError);
        throw new Error("Network error: Could not reach login server");
      }

      if (!response.ok) {
        throw new Error(result.error || "Failed to save user");
      }

      console.log("✅ User synced with Supabase:", result);

      // Set the session in Supabase client to actually log the user in
      if (result.access_token && result.refresh_token) {
        console.log("🔵 Setting Supabase session...");
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: result.access_token,
          refresh_token: result.refresh_token,
        });
        
        if (sessionError) {
          console.error("❌ Error setting session:", sessionError);
          throw new Error("Failed to set user session: " + sessionError.message);
        }
        
        console.log("✅ Session set successfully");
      } else {
        console.error("❌ Missing tokens in result:", result);
        throw new Error("No tokens received from server");
      }

      alert("🎉 Welcome " + username + "!");

      router.push("/dashboard");
    } catch (err: any) {
      console.error("❌ Pi login error:", err);
      alert("Login failed: " + (err?.message || JSON.stringify(err)));
    } finally {
      setIsLoading(false);
    }
  };

  // ✅ Basic Supabase test (optional)
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from("users").select("*").limit(1);
      console.log("✅ Supabase test result:", data || error);
    })();
  }, []);

  return (
    <div
      className="flex flex-col items-center justify-start min-h-screen text-white px-4 pt-12 pb-12"
      style={{ backgroundColor: "#000222" }}
    >
      {/* Logo and Title */}
      <div className="flex flex-col items-center text-center space-y-10 mb-8">
        <Image
          src="/logo.png"
          alt="Yasa TASKER"
          width={420}
          height={420}
          priority
          className="mb-4 w-[85vw] max-w-[420px] h-auto"
        />
        <h1 className="text-4xl font-bold">Welcome to YASA TASKER</h1>
        <p className="text-lg text-gray-300 max-w-md">
          Connect with talented freelancers, collaborate and get paid exclusively
          in Pi cryptocurrency.
        </p>
      </div>

      {/* Feature Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl w-full mb-12">
        <div className="glass p-6 rounded-2xl text-center">
          <h2 className="text-2xl font-semibold mb-2">Post Tasks</h2>
          <p className="text-gray-300 text-sm">
            Create tasks and find skilled freelancers for your projects.
          </p>
        </div>
        <div className="glass p-6 rounded-2xl text-center">
          <h2 className="text-2xl font-semibold mb-2">Real-time Chat</h2>
          <p className="text-gray-300 text-sm">
            Instant communication with clients.
          </p>
        </div>
        <div className="glass p-6 rounded-2xl text-center">
          <h2 className="text-2xl font-semibold mb-2">Future Ready</h2>
          <p className="text-gray-300 text-sm">
            Built for the decentralized economy.
          </p>
        </div>
      </div>

      {/* Login Button */}
      <div className="w-full flex items-center justify-center">
        <button
          onClick={handlePiLogin}
          disabled={!piReady || isLoading}
          className={`glass px-10 py-4 rounded-xl text-white text-lg font-semibold transition duration-300 backdrop-blur-lg shadow-lg border border-white/20 ${
            isLoading
              ? "bg-white/10 cursor-not-allowed"
              : "hover:bg-white/20 active:scale-95 active:shadow-inner"
          }`}
        >
          {isLoading
            ? "Connecting..."
            : piReady
            ? "Login with Pi"
            : "Loading Pi SDK..."}
        </button>
      </div>
    </div>
  );
}