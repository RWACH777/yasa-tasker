"use client";

import "./globals.css";
import { UserProvider, useUser } from "@/context/UserContext";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Script from "next/script";

function AuthWrapper({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setLoaded(true), 200);
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
  return (
    <html lang="en">
      <body className="bg-gray-950 text-gray-100">
        {/* Load Pi SDK early */}
        <Script
          src="https://sdk.minepi.com/pi-sdk.js"
          strategy="beforeInteractive"
          onLoad={() => {
            console.log("✅ Pi SDK loaded (layout)");
            // Immediately init so window.Pi is ready
            try {
              (window as any).Pi?.init({ version: "2.0", sandbox: false });
              console.log("✅ Pi SDK initialized via layout");
            } catch (e) {
              console.warn("Pi init failed in layout:", e);
            }
          }}
        />
        <UserProvider>
          <AuthWrapper>{children}</AuthWrapper>
        </UserProvider>
      </body>
    </html>
  );
}