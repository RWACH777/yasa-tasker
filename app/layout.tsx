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
    // Wait a moment to ensure localStorage is read
    const timer = setTimeout(() => {
      setLoaded(true);
    }, 200);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Redirect if not logged in and not on /login
    if (loaded && !user && pathname !== "/login") {
      router.push("/login");
    }
  }, [user, loaded, pathname, router]);

  // While loading user from localStorage, show nothing (avoid flicker)
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
        <UserProvider>
          <AuthWrapper>{children}</AuthWrapper>
        </UserProvider>
      </body>
    </html>
  );
}