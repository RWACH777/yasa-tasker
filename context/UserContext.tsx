"use client";
import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/lib/supabaseClient";

type User = {
  username: string;
  uid: string;
  accessToken?: string;
} | null;

type UserContextType = {
  user: User;
  setUser: (u: User) => void;
  logout: () => void;
};

const UserContext = createContext<UserContextType>({
  user: null,
  setUser: () => {},
  logout: () => {},
});

// Function to ensure user exists in Supabase
async function ensureUserExists(uid: string, username: string) {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .upsert([{ id: uid, username }]);

    if (error) {
      console.warn("⚠️ Supabase profile sync failed:", error.message);
    } else {
      console.log("✅ Supabase user synced:", data);
    }
  } catch (err) {
    console.error("❌ Error ensuring user exists:", err);
  }
}

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User>(null);

  // hydrate user from Supabase session or localStorage
  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const uid = session.user.id;
        const username = session.user.user_metadata?.name || uid;
        const userObj = { uid, username };
        setUser(userObj);
        localStorage.setItem("piUser", JSON.stringify(userObj));
        ensureUserExists(uid, username);
      }
    };

    init();

    // subscribe to auth changes
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        const uid = session.user.id;
        const username = session.user.user_metadata?.name || uid;
        const userObj = { uid, username };
        setUser(userObj);
        localStorage.setItem("piUser", JSON.stringify(userObj));
        ensureUserExists(uid, username);
      } else {
        setUser(null);
        localStorage.removeItem("piUser");
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const handleSetUser = (u: User) => {
    setUser(u);
    if (u) {
      localStorage.setItem("piUser", JSON.stringify(u));
      ensureUserExists(u.uid, u.username);
    } else {
      localStorage.removeItem("piUser");
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    localStorage.removeItem("piUser");
  };

  return (
    <UserContext.Provider value={{ user, setUser: handleSetUser, logout }}>
      {children}
    </UserContext.Provider>
  );
}
export const useUser = () => useContext(UserContext);