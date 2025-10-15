"use client";

import "./globals.css";
import { UserProvider, useUser } from "@/context/UserContext";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Script from "next/script";

// --- Auth wrapper to protect routes ---
function AuthWrapper({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const [loaded, setLoaded] = useState(false);

  // Small delay to ensure user state loads from context
  useEffect(() => {
    const timer = setTimeout(() => setLoaded(true), 200);
    return () => clearTimeout(timer);
  }, []);

  // ✅ Only redirect if trying to access protected pages (like /dashboard)
useEffect(() => {
  const protectedPaths = ["/dashboard"];
  if (loaded && !user && protectedPaths.includes(pathname)) {
    router.push("/login"); // or show Pi login page
  }
}, [user, loaded, pathname, router]);
  
  if (!loaded) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-950 text-gray-300">
        Loading...
      </div>
    );
  }

  return <>{children}</>;
}

// --- Root layout ---
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-950 text-gray-100">
        {/* ✅ Load Pi SDK before anything interactive */}
        <Script
          src="https://sdk.minepi.com/pi-sdk.js"
          strategy="beforeInteractive"
          onLoad={() => {
            try {
              if (typeof window !== "undefined" && (window as any).Pi) {
                (window as any).Pi.init({ version: "2.0", sandbox: false });
                console.log("✅ Pi SDK initialized via RootLayout");
              } else {
                console.warn("⚠️ Pi SDK not available in window");
              }
            } catch (error) {
              console.error("❌ Pi SDK initialization failed:", error);
            }
          }}
        />

        {/* ✅ Global user context and auth protection */}
        <UserProvider>
          <AuthWrapper>{children}</AuthWrapper>
        </UserProvider>
      </body>
    </html>
  );
}