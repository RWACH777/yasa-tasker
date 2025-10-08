"use client";

import Image from "next/image";

export default function Home() {
  const handlePiLogin = () => {
    if (typeof window !== "undefined" && (window as any).Pi) {
      const Pi = (window as any).Pi;
      const scopes = ["username", "payments"];
      Pi.authenticate(scopes, (payment: any) => {
        console.log("Incomplete payment found:", payment);
      })
        .then((authResult: any) => {
          console.log("Auth result:", authResult);
        })
        .catch((err: any) => console.error("Pi login error:", err));
    } else {
      console.error("Pi SDK not loaded yet.");
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