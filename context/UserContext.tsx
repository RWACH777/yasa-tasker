"use client";
import { createContext, useContext, useState, useEffect, ReactNode } from "react";

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

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User>(null);

  useEffect(() => {
    const saved = localStorage.getItem("piUser");
    if (saved) setUser(JSON.parse(saved));
  }, []);

  const logout = () => {
    setUser(null);
    localStorage.removeItem("piUser");
  };

  return (
    <UserContext.Provider value={{ user, setUser, logout }}>
      {children}
    </UserContext.Provider>
  );
}

export const useUser = () => useContext(UserContext);