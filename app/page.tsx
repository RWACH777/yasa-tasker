"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/context/UserContext";

export default function Home() {
  const router = useRouter();
  const userCtx = useUser();
  const setUser = userCtx?.setUser;

  const [piReady, setPiReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Detect when Pi SDK becomes available
  useEffect(() => {
    const checkPi = setInterval(() => {
      if (typeof window !== "undefined" && (window as any).Pi) {
        setPiReady(true);
        clearInterval(checkPi);
        console.log("✅ Pi SDK detected and ready.");
      }
    }, 500);
    return () => clearInterval(checkPi);
  }, []);

  const handlePiLogin = async () => {
    if (typeof window === "undefined") return;

    const Pi = (window as any).Pi;
    if (!Pi) {
      alert("⚠️ Pi SDK still loading... please wait a few seconds.");
      return;
    }

    try {
      setIsLoading(true);

      // Initialize SDK (must happen before authentication)
      Pi.init({
        version: "2.0",
        sandbox: false, // true for test mode
      });

      console.log("✅ Pi SDK initialized");

      const scopes = ["username", "payments"];
      const authResult = await Pi.authenticate(scopes, (payment: any) => {
        console.log("Pending payment:", payment);
      });

      const username = authResult?.user?.username ?? "PiUser";
      const uid = authResult?.user?.uid ?? null;
      const accessToken = authResult?.accessToken ?? null;

      const newUser = { username, uid, accessToken };
      localStorage.setItem("piUser", JSON.stringify(newUser));
      if (typeof setUser === "function") setUser(newUser);

      alert(`Welcome ${username}!`);
      router.push("/dashboard");
    } catch (err) {
      console.error("Pi login error:", err);
      alert("❌ Login failed — please retry inside the Pi Browser.");
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

      {/* Glass Login Button */}
      <div className="w-full flex items-center justify-center">
        <button
          onClick={handlePiLogin}
          disabled={!piReady || isLoading}
          className={glass px-10 py-4 rounded-xl text-white text-lg font-semibold transition duration-300 backdrop-blur-lg shadow-lg border border-white/20 
            ${
              isLoading
                ? "bg-white/10 cursor-not-allowed"
                : "hover:bg-white/20 active:scale-95 active:shadow-inner"
            }}
        >
          {isLoading ? "Connecting..." : "Login with Pi"}
        </button>
      </div>
    </div>
  );
}