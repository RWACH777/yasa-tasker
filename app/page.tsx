// app/page.tsx
"use client";

import { useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useUser } from "@/context/UserContext"; // assumes you already have this

export default function Home() {
  const router = useRouter();
  const { setUser } = useUser() ?? ({} as any);

  useEffect(() => {
    // Add Pi SDK script once if not present
    if (typeof window !== "undefined" && !(window as any).Pi) {
      const already = document.querySelector('script[data-pi-sdk="1"]');
      if (!already) {
        const script = document.createElement("script");
        script.src = "https://sdk.minepi.com/pi-sdk.js";
        script.async = true;
        script.setAttribute("data-pi-sdk", "1");
        script.onload = () => console.log("✅ Pi SDK loaded");
        script.onerror = () => console.warn("⚠️ Failed loading Pi SDK");
        document.body.appendChild(script);
      }
    }
  }, []);

  const handlePiLogin = async () => {
    try {
      if (typeof window !== "undefined" && (window as any).Pi) {
        const Pi = (window as any).Pi;
        Pi.init({ version: "2.0" });
        const scopes = ["username", "payments"];

        // authenticate returns a promise in the latest SDK
        const authResult = await Pi.authenticate(scopes, (payment: any) => {
          // optional callback for incomplete payments
          console.log("Incomplete payment callback:", payment);
        });

        console.log("✅ Auth result:", authResult);

        // Normalize username / uid / token (handle different SDK shapes)
        const username = authResult?.user?.username ?? authResult?.username ?? "PiUser";
        const uid = authResult?.user?.uid ?? authResult?.uid ?? null;
        const accessToken = authResult?.accessToken ?? null;

        // Persist user to context if available, otherwise fallback to localStorage
        try {
          if (typeof setUser === "function") {
            setUser({ username, uid, accessToken });
          } else {
            localStorage.setItem("piUser", JSON.stringify({ username, uid, accessToken }));
          }
        } catch (e) {
          console.warn("Could not set user in context, storing in localStorage", e);
          localStorage.setItem("piUser", JSON.stringify({ username, uid, accessToken }));
        }

        alert(`Welcome ${username}!`);
        // Redirect to dashboard
        router.push("/dashboard");
      } else {
        // Not inside Pi Browser yet
        alert("Pi SDK not available. Please open this site inside the Pi Browser to log in with Pi.");
      }
    } catch (err) {
      console.error("❌ Pi login error:", err);
      alert("Login failed — try again in the Pi Browser.");
    }
  };

  return (
    <div
      className="flex flex-col items-center justify-center min-h-screen text-white px-4"
      style={{ backgroundColor: "#000222" }}
    >
      {/* Logo and Title */}
      <div className="flex flex-col items-center text-center space-y-10 mb-10">
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl w-full my-20">
        <div className="glass p-6 rounded-2xl text-center">
          <h2 className="text-2xl font-semibold mb-2">Post Tasks</h2>
          <p className="text-gray-300 text-sm">
            Create tasks and find skilled freelancers for your projects.
          </p>
        </div>
        <div className="glass p-6 rounded-2xl text-center">
          <h2 className="text-2xl font-semibold mb-2">Real-time Chat</h2>
          <p className="text-gray-300 text-sm">Instant communication with clients.</p>
        </div>
        <div className="glass p-6 rounded-2xl text-center">
          <h2 className="text-2xl font-semibold mb-2">Future Ready</h2>
          <p className="text-gray-300 text-sm">Built for the decentralized economy.</p>
        </div>
      </div>

      {/* Glass Login Button */}
      <div className="mt-20">
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