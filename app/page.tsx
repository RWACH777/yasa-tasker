"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/context/UserContext";

export default function Home() {
  const router = useRouter();
  const userCtx = useUser();
  const setUser = userCtx?.setUser;

  const [isLoading, setIsLoading] = useState(false);

  const handlePiLogin = async () => {
  if (typeof window === "undefined") return;

  const Pi = (window as any).Pi;
  console.log("🧩 handlePiLogin, Pi:", Pi);
  if (!Pi) {
    alert("⚠️ Pi SDK not loaded yet.");
    return;
  }

  try {
    console.log("🔧 Calling Pi.authenticate...");
    const scopes = ["username", "payments"];
    const authResult = await Pi.authenticate(scopes, (payment: any) => {
      console.log("🪙 incomplete payment callback:", payment);
    });
    console.log("✅ authenticate result:", authResult);

    // rest of your logic ...
  } catch (err: any) {
  console.error("❌ Pi login error:", err);
  alert("Login failed: " + (err?.message || JSON.stringify(err)));
}

  return (
    <div
      className="flex flex-col items-center justify-start min-h-screen text-white px-4 pt-12 pb-12"
      style={{ backgroundColor: "#000222" }}
    >
      {/* Logo & text */}
      <div className="flex flex-col items-center text-center space-y-10 mb-8">
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
          Connect with talented freelancers, collaborate and get paid exclusively in Pi cryptocurrency.
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
          disabled={isLoading}
          className={`glass px-10 py-4 rounded-xl text-white text-lg font-semibold transition duration-300 backdrop-blur-lg shadow-lg border border-white/20 ${
            isLoading
              ? "bg-white/10 cursor-not-allowed"
              : "hover:bg-white/20 active:scale-95 active:shadow-inner"
          }`}
        >
          {isLoading ? "Connecting..." : "Login with Pi"}
        </button>
      </div>
    </div>
  );
}