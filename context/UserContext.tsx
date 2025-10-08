"use client";

import React, { createContext, useState, useEffect, useContext } from "react";

interface User {
  username: string;
  accessToken: string;
}

interface UserContextType {
  user: User | null;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  logout: () => void;
}

const UserContext = createContext<UserContextType>({
  user: null,
  setUser: () => {},
  logout: () => {},
});

export const UserProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);

  // ✅ Load user from localStorage on first load
  useEffect(() => {
    try {
      const storedUser = localStorage.getItem("piUser");
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      }
    } catch (error) {
      console.error("Failed to load user from localStorage:", error);
    }
  }, []);

  // ✅ Save user to localStorage when it changes
  useEffect(() => {
    if (user) {
      localStorage.setItem("piUser", JSON.stringify(user));
    } else {
      localStorage.removeItem("piUser");
    }
  }, [user]);

  const logout = () => {
    setUser(null);
    localStorage.removeItem("piUser");
  };

  return (
    <UserContext.Provider value={{ user, setUser, logout }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => useContext(UserContext);