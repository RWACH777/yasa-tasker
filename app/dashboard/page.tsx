"use client";

import { useEffect, useState } from "react";
import { useUser } from "@/context/UserContext";

export default function DashboardPage() {
  const { user, setUser } = useUser();
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "",
    budget: "",
    deadline: "",
  });

  // 🟣 Handle login with Pi SDK or mock fallback
  useEffect(() => {
    async function handleLogin() {
      setLoading(true);
      try {
        if (typeof window === "undefined") return;
        const Pi = (window as any).Pi;

        // ✅ Mock login for testing outside Pi Browser
        if (!Pi) {
          console.warn("⚠️ Pi SDK not found — using mock login.");

          const mockUser = {
            username: "MockUser",
            pi_uid: "mock_uid_001",
          };

          const res = await fetch("/api/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(mockUser),
          });

          const data = await res.json();
          if (data.error) setMessage("Login failed: " + data.error);
          else {
            setUser({
              id: data.userId,
              username: mockUser.username,
              email: `${mockUser.pi_uid}@pi.mock`,
              created_at: new Date().toISOString(),
            });
            setMessage(✅ Welcome ${mockUser.username}!);
          }

          setLoading(false);
          return;
        }

        // ✅ Real Pi login
        Pi.init({ version: "2.0", sandbox: false });

        const scopes = ["username", "payments"];
        const authResult = await Pi.authenticate(scopes, onIncompletePaymentFound);

        const piUser = {
          username: authResult.user.username,
          pi_uid: authResult.user.uid,
        };

        const res = await fetch("/api/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(piUser),
        });

        const data = await res.json();
        if (data.error) setMessage("Login failed: " + data.error);
        else {
          setUser({
            id: data.userId,
            username: piUser.username,
            email: `${piUser.pi_uid}@pi.mock`,
            created_at: new Date().toISOString(),
          });
          setMessage(`✅ Welcome ${piUser.username}!`);
        }
      } catch (err) {
        console.error("❌ Login error:", err);
        setMessage("Login failed — please try again.");
      } finally {
        setLoading(false);
      }
    }

    handleLogin();
  }, [setUser]);

  // 🟢 Handle task posting
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setMessage("⚠️ You must be logged in to post a task.");
      return;
    }

    try {
      setLoading(true);
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          poster_id: user.id,
        }),
      });

      const data = await res.json();
      if (data.error) setMessage("❌ " + data.error);
      else {
        setMessage("✅ Task posted successfully!");
        setForm({
          title: "",
          description: "",
          category: "",
          budget: "",
          deadline: "",
        });
      }
    } catch (err) {
      console.error("❌ Task post error:", err);
      setMessage("⚠️ Failed to post task.");
    } finally {
      setLoading(false);
    }
  };

  // 🟣 Handle Pi payments (stub)
  const onIncompletePaymentFound = (payment: any) => {
    console.log("Incomplete payment found:", payment);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-200 flex flex-col items-center p-4">
      {/* 🟣 Glassmorphic user profile bar */}
      <div className="w-full max-w-2xl bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-4 mb-6 shadow-xl flex items-center justify-between">
        {user ? (
          <div>
            <h2 className="text-xl font-semibold text-purple-300">
              👋 Welcome, {user.username}
            </h2>
            <p className="text-sm text-gray-300">
              {user.email || "No email"}  
            </p>
          </div>
        ) : (
          <p className="text-gray-400">Loading user profile...</p>
        )}
        <div className="text-sm text-right">
          {loading ? (
            <p className="text-yellow-400 animate-pulse">Loading...</p>
          ) : (
            <p className="text-green-400">{message}</p>
          )}
        </div>
      </div>

      {/* 🟢 Post Task Form */}
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-2xl bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-6 shadow-lg"
      >
        <h3 className="text-lg font-semibold text-purple-300 mb-4">
          📝 Post a Task
        </h3>

        <input
          type="text"
          placeholder="Task Title"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          className="w-full mb-3 p-2 rounded-md bg-gray-900 border border-gray-700 text-gray-100"
          required
        />
        <textarea
          placeholder="Task Description"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="w-full mb-3 p-2 rounded-md bg-gray-900 border border-gray-700 text-gray-100"
          required
        />
        <input
          type="text"
          placeholder="Category"
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
          className="w-full mb-3 p-2 rounded-md bg-gray-900 border border-gray-700 text-gray-100"
          required
        />
        <input
          type="number"
          placeholder="Budget (Pi)"
          value={form.budget}
          onChange={(e) => setForm({ ...form, budget: e.target.value })}
          className="w-full mb-3 p-2 rounded-md bg-gray-900 border border-gray-700 text-gray-100"
          required
        />
        <input
          type="date"
          value={form.deadline}
          onChange={(e) => setForm({ ...form, deadline: e.target.value })}
          className="w-full mb-4 p-2 rounded-md bg-gray-900 border border-gray-700 text-gray-100"
          required
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-purple-600 hover:bg-purple-700 transition-all text-white p-2 rounded-lg font-semibold"
        >
          {loading ? "Posting..." : "Post Task"}
        </button>
      </form>
    </div>
  );
}