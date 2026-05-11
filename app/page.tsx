"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useUser } from "@/context/UserContext";
import { supabase } from "@/lib/supabaseClient";
import { injectMockPiSDK } from "@/lib/piMock";

export default function Home() {
  const router = useRouter();
  const userCtx = useUser();
  const setUser = userCtx?.setUser;

  const [piReady, setPiReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showMembershipModal, setShowMembershipModal] = useState(false);
  const [membershipStatus, setMembershipStatus] = useState<any>(null);
  const [autoRedirecting, setAutoRedirecting] = useState(false);

  // On mount: Check for existing session and inject mock Pi SDK
  useEffect(() => {
    console.log("📍 Landing page - checking session...");
    
    // Inject mock Pi SDK for local testing
    injectMockPiSDK();
    
    // Check for existing Supabase session
    const checkExistingSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        console.log("✅ Existing session found, auto-redirecting...");
        setAutoRedirecting(true);
        
        // Wait a moment to show the redirecting state
        setTimeout(() => {
          // Check membership and admin status before redirecting
          checkUserAccessAndRedirect(session.user.id);
        }, 1500);
      } else {
        console.log("📍 No existing session, showing login page");
        setPiReady(true);
      }
    };
    
    checkExistingSession();
  }, []);
  
  // Check membership and redirect
  const checkUserAccessAndRedirect = async (userId: string) => {
    try {
      // Check membership status
      const { data: membershipData } = await supabase
        .from("memberships")
        .select("*")
        .eq("user_id", userId)
        .single();
      
      // Check if admin (exempt from membership)
      const { data: adminData } = await supabase
        .from("admin_users")
        .select("*")
        .eq("user_id", userId)
        .single();
      
      const isAdmin = !!adminData;
      const membershipExpired = membershipData?.status === 'expired' || !membershipData;
      
      if (membershipExpired && !isAdmin) {
        // Redirect to membership page
        router.push("/membership");
      } else {
        // Redirect to dashboard
        router.push("/dashboard");
      }
    } catch (err) {
      console.error("Error checking access:", err);
      router.push("/dashboard");
    }
  };

  // Initialize Pi SDK
  useEffect(() => {
    const loadPi = () => {
      try {
        const isLocal = typeof window !== "undefined" && window.location.hostname === "localhost";
        
        if (isLocal) {
          console.log("🔧 Local mode: Pi SDK init skipped");
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

      const isLocal = window.location.hostname === "localhost" || 
                      window.location.hostname === "127.0.0.1";
      let username, pi_uid, avatar_url, wallet_address;

      if (isLocal) {
        step = "Local mode";
        console.log("🔧 Local mode: Using mock Pi SDK");
        // In local mode, we'll use a mock user but still need to authenticate via mock SDK
        const Pi = (window as any).Pi;
        if (Pi?.authenticate) {
          try {
            const mockAuth = await Pi.authenticate(["username"], () => {});
            username = mockAuth.user?.username || "LocalUser";
            pi_uid = mockAuth.user?.uid || "local_user_123";
          } catch (e) {
            username = "LocalUser";
            pi_uid = "local_user_123";
          }
        } else {
          username = "LocalUser";
          pi_uid = "local_user_123";
        }
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
          throw new Error("Pi authentication failed: " + (authError?.message || JSON.stringify(authError)));
        }

        step = "Checking auth result";
        if (!authResult?.user) {
          throw new Error("Pi authentication returned no user data");
        }

        username = authResult.user.username ?? "Unknown";
        pi_uid = authResult.user.uid ?? "";
        avatar_url = authResult.user.photo ?? null;
        wallet_address = (authResult.user as any).wallet_address ?? null;
        
        // Check if Pi granted payments scope - Pi doesn't tell us directly, but we can infer from the flow
        // If we get here without error, Pi has authenticated. We'll save the flag and try payment.
        console.log("✅ Pi auth successful, saving payments scope flag");
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
          console.error(" Error setting session:", sessionError);
          alert("Session error: " + sessionError.message);
          throw new Error("Failed to set user session: " + sessionError.message);
        }
        
        console.log(" Session set successfully");
        
        // Save flags that user has logged in before and has wallet permission
        localStorage.setItem("yasa_has_logged_in", "true");
        localStorage.setItem("yasa_has_wallet", "true");
        localStorage.setItem("yasa_has_payments_scope", "true");
        
        // Save pi_user data for other pages to access
        const userData = {
          id: pi_uid,
          username: username,
          avatar_url: avatar_url,
          wallet_address: wallet_address,
        };
        localStorage.setItem("pi_user", JSON.stringify(userData));
        console.log(" Saved pi_user and login flags");
      } else {
        console.error(" Missing tokens in result:", result);
        alert("No tokens from server");
        throw new Error("No tokens received from server");
      }

      // Check membership status before redirecting
      const { data: membershipData } = await supabase
        .from("memberships")
        .select("*")
        .eq("user_id", result.user?.id)
        .single();

      // Check if user is admin (admins are exempt from membership)
      const { data: adminData } = await supabase
        .from("admin_users")
        .select("*")
        .eq("user_id", result.user?.id)
        .single();

      const isAdmin = !!adminData;

      if (!isAdmin && membershipData) {
        const now = new Date();
        const startedAt = new Date(membershipData.started_at);
        const lastPaidAt = membershipData.last_paid_at ? new Date(membershipData.last_paid_at) : null;
        
        // Calculate if 30 days have passed since started_at
        const daysSinceStart = Math.floor((now.getTime() - startedAt.getTime()) / (1000 * 60 * 60 * 24));
        
        // Check if last payment was more than 30 days ago or never paid
        let isExpired = false;
        if (daysSinceStart > 30) {
          if (!lastPaidAt) {
            // Never paid and free trial expired
            isExpired = true;
          } else {
            const daysSinceLastPayment = Math.floor((now.getTime() - lastPaidAt.getTime()) / (1000 * 60 * 60 * 24));
            if (daysSinceLastPayment > 30) {
              isExpired = true;
            }
          }
        }

        if (isExpired || membershipData.status === "expired") {
          // Show membership modal instead of redirecting
          setMembershipStatus(membershipData);
          setShowMembershipModal(true);
          setIsLoading(false);
          return;
        }
      }

      // If not expired or is admin, proceed to dashboard
      alert(" Welcome " + username + "!");
      router.push("/dashboard");
    } catch (err: any) {
      console.error(" Pi login error at step [" + step + "]:", err);
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
          {autoRedirecting ? (
            <div className="mt-4 flex flex-col items-center gap-2">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
              <span className="text-white/80 text-sm">Logging you in...</span>
            </div>
          ) : (
            <button
              onClick={handlePiLogin}
              disabled={!piReady || isLoading}
              className="mt-4 px-8 py-3 rounded-full font-semibold text-sm transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed"
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
          )}
        </div>
      </div>

      {/* Membership Required Modal */}
      {showMembershipModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20 max-w-md w-full">
            <h2 className="text-2xl font-bold text-white mb-4">Membership Required</h2>
            <p className="text-white/80 mb-6">
              Your free month has ended. Pay 1 Pi to continue using YASA Tasker.
            </p>
            
            <div className="bg-blue-500/10 rounded-xl p-4 mb-6 border border-blue-500/20">
              <p className="text-white/80 text-sm mb-2">Send exactly <strong className="text-white">1 π</strong> to:</p>
              <div className="bg-black/30 rounded-lg p-3 mb-3">
                <span className="text-white font-mono text-sm">yair777</span>
              </div>
              <p className="text-white/80 text-sm mb-2">With memo:</p>
              <div className="bg-black/30 rounded-lg p-3">
                <span className="text-white font-mono text-sm">MEMBERSHIP-{membershipStatus?.username || "USER"}</span>
              </div>
            </div>

            <button
              onClick={() => window.location.href = "/membership"}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-6 rounded-xl transition-all"
            >
              Pay Membership — 1 Pi
            </button>
          </div>
        </div>
      )}
    </div>
  );
}