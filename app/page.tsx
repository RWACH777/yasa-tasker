"use client";

import Image from "next/image";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/context/UserContext";

export default function Home() {
  const router = useRouter();
  const userCtx = useUser();
  const setUser = userCtx?.setUser;

  // Check for Pi SDK availability
  useEffect(() => {
    if (typeof window !== "undefined") {
      const Pi = (window as any).Pi;
      if (!Pi) {
        console.warn("⚠️ Pi SDK not detected. Please open inside the Pi Browser.");
      } else {
        console.log("✅ Pi SDK detected.");
      }
    }
  }, []);

  // ✅ Proper async Pi login handler
  const handlePiLogin = async () => {
    if (typeof window === "undefined") return;

    const Pi = (window as any).Pi;

    if (!Pi) {
      alert("⚠️ Pi SDK not detected — please open this app inside the Pi Browser.");
      return;
    }

    try {
      // Initialize Pi SDK before authentication
      Pi.init({
        version: "2.0",
        sandbox: false, // change to true if testing mode needed
      });

      console.log("✅ Pi SDK initialized");

      const scopes = ["username", "payments"];

      // Authenticate with Pi Network
      const authResult = await Pi.authenticate(scopes, (payment: any) => {
        console.log("Incomplete payment found:", payment);
      });

      console.log("✅ Auth success:", authResult);

      const username = authResult?.user?.username ?? "PiUser";
      const uid = authResult?.user?.uid ?? null;
      const accessToken = authResult?.accessToken ?? null;

      const newUser = { username, uid, accessToken };

      try {
        if (typeof setUser === "function") setUser(newUser);
      } catch (e) {
        console.warn("setUser failed or not available:", e);
      }

      localStorage.setItem("piUser", JSON.stringify(newUser));

      // ⚠️ Use backticks here
      alert(`Welcome ${username}!`);

      router.push("/dashboard");
    } catch (err) {
      console.error("❌ Pi login error:", err);
      alert("Login failed. Please try again inside the Pi Browser.");
    }
  };

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
          className="glass px-10 py-4 rounded-xl text-white text-lg font-semibold hover:bg-white/10 transition duration-300 backdrop-blur-lg shadow-lg border border-white/20"
        >
          Login with Pi
        </button>
      </div>
    </div>
  );
}