"use client";

import "./globals.css";
import { UserProvider, useUser } from "@/context/UserContext";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

function AuthWrapper({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoaded(true);
    }, 200);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (loaded && !user && pathname !== "/login") {
      router.push("/login");
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // ✅ Load the Pi SDK once globally when app starts
  useEffect(() => {
    const scriptId = "pi-sdk-script";
    if (!document.getElementById(scriptId)) {
      const script = document.createElement("script");
      script.id = scriptId;
      script.src = "https://sdk.minepi.com/pi-sdk.js";
      script.async = true;
      script.onload = () => console.log("✅ Pi SDK script loaded!");
      script.onerror = () =>
        console.error("❌ Failed to load Pi SDK script.");
      document.body.appendChild(script);
    }
  }, []);

  return (
    <html lang="en">
      <head>
        <title>Yasa Tasker</title>
      </head>
      <body className="bg-gray-950 text-gray-100">
        <UserProvider>
          <AuthWrapper>{children}</AuthWrapper>
        </UserProvider>
      </body>
    </html>
  );
}