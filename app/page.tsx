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
  const [isAutoLoggingIn, setIsAutoLoggingIn] = useState(false);

  // Check for auto-login on mount
  useEffect(() => {
    const checkAutoLogin = async () => {
      if (typeof window === "undefined") return;
      
      // Check if user has logged in before
      const hasLoggedInBefore = localStorage.getItem("yasa_has_logged_in") === "true";
      
      if (hasLoggedInBefore) {
        console.log("🔄 User has logged in before, attempting auto-login...");
        setIsAutoLoggingIn(true);
        
        // Try to restore session from Supabase
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (session) {
          console.log("✅ Existing session found, redirecting to dashboard");
          router.push("/dashboard");
          return;
        }
        
        // No session, need to re-authenticate with Pi
        const Pi = (window as any).Pi;
        if (Pi) {
          try {
            Pi.init({ version: "2.0", sandbox: false });
            const authResult = await Pi.authenticate(["username", "payments", "wallet_address"], () => {});
            if (authResult?.user) {
              await handleAutoLogin(authResult.user);
            }
          } catch (err) {
            console.error("Auto-login failed:", err);
            setIsAutoLoggingIn(false);
            setPiReady(true);
          }
        } else {
          setIsAutoLoggingIn(false);
          setPiReady(true);
        }
      }
    };
    
    checkAutoLogin();
  }, []);

  // Auto-login handler
  const handleAutoLogin = async (piUser: any) => {
    try {
      const username = piUser.username ?? "Unknown";
      const pi_uid = piUser.uid ?? "";
      const avatar_url = piUser.photo ?? null;
      const wallet_address = (piUser as any).wallet_address ?? null;

      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pi_uid, username, avatar_url, wallet_address }),
      });
      
      const result = await response.json();
      
      if (response.ok && result.access_token && result.refresh_token) {
        await supabase.auth.setSession({
          access_token: result.access_token,
          refresh_token: result.refresh_token,
        });
        router.push("/dashboard");
      } else {
        setIsAutoLoggingIn(false);
        setPiReady(true);
      }
    } catch (err) {
      console.error("Auto-login error:", err);
      setIsAutoLoggingIn(false);
      setPiReady(true);
    }
  };

  // Initialize Pi SDK
  useEffect(() => {
    const loadPi = () => {
      try {
        const isLocal = typeof window !== "undefined" && window.location.hostname === "localhost";
        
        if (isLocal || isAutoLoggingIn) {
          console.log("🔧 Local mode or auto-logging in: Pi SDK init skipped");
          setPiReady(true);
          return;
        }

        if (typeof window !== "undefined" && (window as any).Pi) {
          console.log("✅ Pi SDK found, initializing...");
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
        setPiReady(true);
      }
    };

    loadPi();
  }, []);

  const handlePiLogin = async () => {
    if (typeof window === "undefined") return;

    let step = "Starting";
    let authResult: any = null;
    try {
      setIsLoading(true);
      console.log("🔵 handlePiLogin started");

      const isLocal = window.location.hostname === "localhost";
      let username, pi_uid, avatar_url, wallet_address;

      if (isLocal) {
        step = "Local mode";
        console.log("🔧 Local mode: Using fake Pi user");
        username = "LocalUser";
        pi_uid = "local_user_123";
        avatar_url = null;
        wallet_address = null;
      } else {
        step = "Checking Pi SDK";
        const Pi = (window as any).Pi;
        if (!Pi) {
          alert("⚠️ Pi SDK not loaded yet. Please wait a moment and try again.");
          setIsLoading(false);
          return;
        }

        step = "Pi.authenticate";
        console.log("✅ Pi SDK ready, calling authenticate with wallet_address...");

        try {
          const scopes = ["username", "payments", "wallet_address"];
          authResult = await Pi.authenticate(scopes, (payment: any) => {
            console.log("🪙 Incomplete payment:", payment);
          });
          console.log("✅ Pi authenticate success:", authResult);
        } catch (authError: any) {
          console.error("❌ Pi authenticate failed:", authError);
          alert("Pi auth failed: " + JSON.stringify(authError));
          throw new Error("Pi authentication failed: " + (authError?.message || JSON.stringify(authError)));
        }

        step = "Checking auth result";
        if (!authResult?.user) {
          alert("No user data from Pi");
          throw new Error("Pi authentication returned no user data");
        }

        username = authResult.user.username ?? "Unknown";
        pi_uid = authResult.user.uid ?? "";
        avatar_url = authResult.user.photo ?? null;
        wallet_address = (authResult.user as any).wallet_address ?? null;
      }

      step = "API test";
      console.log("🔵 Calling /api/login with:", { pi_uid, username });
      
      try {
        const testResponse = await fetch("/api/test");
        const testResult = await testResponse.json();
        console.log("✅ API connectivity test passed:", testResult);
      } catch (testError: any) {
        console.error("❌ API connectivity test failed:", testError);
        alert("API test failed: " + testError.message);
        throw new Error("API server is not responding");
      }
      
      step = "/api/login call";
      let response, result;
      try {
        response = await fetch("/api/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pi_uid, username, avatar_url, wallet_address }),
        });
        result = await response.json();
        console.log("🔵 /api/login response:", { ok: response.ok, status: response.status, result });
      } catch (fetchError: any) {
        console.error("❌ Network error calling /api/login:", fetchError);
        alert("Network error: " + fetchError.message);
        throw new Error("Network error: Could not reach login server");
      }

      step = "Checking response";
      if (!response.ok) {
        const errorMsg = result.error || "Unknown";
        const errorDetails = result.details || "";
        alert("Server error: " + errorMsg + (errorDetails ? " - " + errorDetails : ""));
        throw new Error(result.error || "Failed to save user");
      }

      step = "Setting session";
      console.log("✅ User synced with Supabase:", result);

      if (result.access_token && result.refresh_token) {
        console.log("🔵 Setting Supabase session...");
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: result.access_token,
          refresh_token: result.refresh_token,
        });
        
        if (sessionError) {
          console.error("❌ Error setting session:", sessionError);
          alert("Session error: " + sessionError.message);
          throw new Error("Failed to set user session: " + sessionError.message);
        }
        
        console.log("✅ Session set successfully");
        
        // Save flag that user has logged in before
        localStorage.setItem("yasa_has_logged_in", "true");
        console.log("✅ Saved yasa_has_logged_in flag");
      } else {
        console.error("❌ Missing tokens in result:", result);
        alert("No tokens from server");
        throw new Error("No tokens received from server");
      }

      alert("🎉 Welcome " + username + "!");
      router.push("/dashboard");
    } catch (err: any) {
      console.error("❌ Pi login error at step [" + step + "]:", err);
      alert("Login failed at [" + step + "]: " + (err?.message || JSON.stringify(err)));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center relative overflow-hidden"
      style={{
        backgroundImage: "url('/landing-bg.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      {/* Dark overlay for better contrast */}
      <div className="absolute inset-0 bg-black/30" />
      
      {/* Main Glass Card - Pill/Capsule Shape */}
      <div className="relative z-10 mx-4">
        <div 
          className="flex flex-col items-center text-center px-8 py-10 md:px-12 md:py-14"
          style={{
            background: "rgba(255, 255, 255, 0.15)",
            backdropFilter: "blur(25px)",
            WebkitBackdropFilter: "blur(25px)",
            borderRadius: "80px",
            border: "1px solid rgba(255, 255, 255, 0.3)",
            boxShadow: "0 8px 32px 0 rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)",
            minWidth: "320px",
            maxWidth: "420px",
          }}
        >
          {/* Circular Logo Image */}
          <div 
            className="mb-6 overflow-hidden"
            style={{
              width: "120px",
              height: "120px",
              borderRadius: "50%",
              border: "3px solid rgba(255, 255, 255, 0.4)",
              boxShadow: "0 4px 20px rgba(0, 0, 0, 0.3)",
            }}
          >
            <Image
              src="/yasa-tasker-logo.png"
              alt="YASA Logo"
              width={120}
              height={120}
              className="object-cover w-full h-full"
              priority
            />
          </div>

          {/* Text Content */}
          <div className="space-y-1">
            {/* Welcome to */}
            <p 
              className="text-sm tracking-widest uppercase"
              style={{ 
                color: "rgba(255, 255, 255, 0.7)",
                textShadow: "0 1px 2px rgba(0,0,0,0.2)"
              }}
            >
              Welcome to
            </p>
            
            {/* YASA TASKER - Large */}
            <h1 
              className="text-3xl md:text-4xl font-light tracking-wide mb-4"
              style={{ 
                color: "rgba(255, 255, 255, 0.95)",
                textShadow: "0 2px 10px rgba(0,0,0,0.3)",
                letterSpacing: "0.05em"
              }}
            >
              YASA TASKER
            </h1>
            
            {/* Post tasks */}
            <p 
              className="text-base md:text-lg font-light"
              style={{ 
                color: "rgba(255, 255, 255, 0.85)",
                textShadow: "0 1px 3px rgba(0,0,0,0.2)"
              }}
            >
              Post tasks
            </p>
            
            {/* Real time chat - minimal gap */}
            <p 
              className="text-sm md:text-base font-light leading-tight"
              style={{ 
                color: "rgba(255, 255, 255, 0.75)",
                textShadow: "0 1px 2px rgba(0,0,0,0.2)",
                marginTop: "2px"
              }}
            >
              Real time chat
            </p>
            
            {/* future ready - minimal gap */}
            <p 
              className="text-sm md:text-base font-light leading-tight"
              style={{ 
                color: "rgba(255, 255, 255, 0.75)",
                textShadow: "0 1px 2px rgba(0,0,0,0.2)",
                marginTop: "2px"
              }}
            >
              future ready
            </p>
          </div>

          {/* Login with Pi Button - White Background */}
          <button
            onClick={handlePiLogin}
            disabled={!piReady || isLoading}
            className="mt-8 px-8 py-3 rounded-full font-semibold text-sm transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed"
            style={{
              background: "rgba(255, 255, 255, 0.95)",
              color: "#000",
              boxShadow: "0 4px 15px rgba(0, 0, 0, 0.2)",
              border: "none",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255, 255, 255, 1)";
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = "0 6px 20px rgba(0, 0, 0, 0.25)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255, 255, 255, 0.95)";
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 4px 15px rgba(0, 0, 0, 0.2)";
            }}
            onMouseDown={(e) => {
              e.currentTarget.style.transform = "translateY(0) scale(0.98)";
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = "translateY(-2px) scale(1)";
            }}
          >
            {isLoading
              ? "Connecting..."
              : piReady
              ? "Login with Pi"
              : "Loading Pi SDK..."}
          </button>
        </div>
      </div>
    </div>
  );
}