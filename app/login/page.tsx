// app/login/page.tsx
"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/context/UserContext";

export default function LoginPage() {
  const router = useRouter();
  const userCtx = useUser();
  const setUser = userCtx?.setUser;

  const [piReady, setPiReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Poll for Pi SDK injected by Pi Browser
  useEffect(() => {
    if (typeof window === "undefined") return;
    const interval = setInterval(function () {
      if ((window as any).Pi) {
        setPiReady(true);
        clearInterval(interval);
        console.log("✅ Pi SDK detected by login page.");
      }
    }, 400);

    // safety: stop after 20s
    const timeout = setTimeout(function () {
      clearInterval(interval);
    }, 20000);

    return function cleanup() {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, []);

  // Ensure SDK script is requested when possible (Pi browser injects it normally;
  // this is a no-op in Pi Browser but helps some environments)
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!(window as any).Pi) {
      // try to attach the official SDK script - harmless if Pi Browser already has it
      var s = document.createElement("script");
      s.src = "https://sdk.minepi.com/pi-sdk.js";
      s.async = true;
      s.onload = function () {
        console.log("Pi SDK script appended on login page.");
      };
      document.body.appendChild(s);
    }
  }, []);

  const handlePiLogin = async () => {
    if (typeof window === "undefined") return;

    const Pi = (window as any).Pi;
    if (!Pi) {
      alert(
        "⚠️ Pi SDK not detected. Please open this link in the Pi Browser to log in with Pi."
      );
      return;
    }

    try {
      setIsLoading(true);

      // Init the SDK (harmless if already initialized)
      try {
        if (typeof Pi.init === "function") {
          Pi.init({ version: "2.0", sandbox: false });
          console.log("✅ Pi.init called on login page.");
        }
      } catch (e) {
        console.warn("Pi.init threw:", e);
      }

      // Request username and payments permission (payments used later)
      var scopes = ["username", "payments"];

      // Pi.authenticate returns a Promise
      var authResult = await Pi.authenticate(scopes, function (payment: any) {
        // optional callback for incomplete payments
        console.log("Incomplete payment callback (login):", payment);
      });

      // normalize user object shapes across SDK versions
      var username =
        (authResult && authResult.user && authResult.user.username) ||
        authResult.username ||
        "PiUser";
      var uid =
        (authResult && authResult.user && authResult.user.uid) ||
        authResult.uid ||
        null;
      var accessToken = authResult && authResult.accessToken ? authResult.accessToken : null;

      var newUser = { username: username, uid: uid, accessToken: accessToken };

      // Save in context (if provided) and localStorage
      try {
        if (typeof setUser === "function") setUser(newUser);
      } catch (e) {
        console.warn("setUser failed:", e);
      }
      try {
        localStorage.setItem("piUser", JSON.stringify(newUser));
      } catch (e) {
        console.warn("localStorage set failed:", e);
      }

      // friendly message then redirect to dashboard
      alert("Welcome " + username + "!");
      router.push("/dashboard");
    } catch (err) {
      console.error("Pi login error:", err);
      var msg = "Login failed. Please try again inside Pi Browser.";
      if (err && (err as any).message) msg = "Login failed: " + (err as any).message;
      alert(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="flex flex-col items-center justify-start min-h-screen text-white px-4 pt-12 pb-12"
      style={{ backgroundColor: "#000222" }}
    >
      {/* Logo and Title */}
      <div className="flex flex-col items-center text-center space-y-6 mb-8">
        <Image
          src="/logo.png"
          alt="Yasa TASKER"
          width={420}
          height={420}
          priority
          className="mb-4 w-[85vw] max-w-[420px] h-auto"
        />
        <h1 className="text-4xl font-bold">Welcome to Yasa TASKER</h1>
        <p className="text-lg text-gray-300 max-w-md">
          Connect with talented freelancers and get paid in Pi cryptocurrency.
        </p>
      </div>

      {/* Feature Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl w-full mb-12">
        <div className="glass p-6 rounded-2xl text-center">
          <h2 className="text-2xl font-semibold mb-2">Post Tasks</h2>
          <p className="text-gray-300 text-sm">Create tasks and find skilled freelancers.</p>
        </div>
        <div className="glass p-6 rounded-2xl text-center">
          <h2 className="text-2xl font-semibold mb-2">Chat</h2>
          <p className="text-gray-300 text-sm">Contact taskers and discuss work directly.</p>
        </div>
        <div className="glass p-6 rounded-2xl text-center">
          <h2 className="text-2xl font-semibold mb-2">Secure</h2>
          <p className="text-gray-300 text-sm">All authentication via Pi Network only.</p>
        </div>
      </div>

      {/* Login Button */}
      <div className="w-full flex items-center justify-center">
        <button
          onClick={handlePiLogin}
          disabled={!piReady || isLoading}
          className={
            "glass px-10 py-4 rounded-xl text-white text-lg font-semibold transition duration-300 backdrop-blur-lg shadow-lg border border-white/20 " +
            (isLoading ? "bg-white/10 cursor-not-allowed" : "hover:bg-white/20 active:scale-95 active:shadow-inner")
          }
        >
          {isLoading ? "Connecting..." : piReady ? "Login with Pi" : "Open in Pi Browser to log in"}
        </button>
      </div>
    </div>
  );
}