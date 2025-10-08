"use client";

import { initPiPayment } from "@/lib/piPayment";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/context/UserContext";

export default function DashboardPage() {
  const router = useRouter();
  const { user, logout } = useUser();
  const [active, setActive] = useState("Home");

  // Redirect to login if not authenticated (client-side guard)
  useEffect(() => {
    if (user === null) {
      router.push("/login");
    }
  }, [user, router]);

  // In-memory tasks for dev
  const [activeTasks, setActiveTasks] = useState(() => {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem("activeTasks");
    if (saved) return JSON.parse(saved);
  }
  // Default demo tasks
  return [
    { title: "Design homepage banner", status: "In Progress", deadline: "2025-10-12" },
    { title: "Fix payment API", status: "Pending", deadline: "2025-10-14" },
  ];
});

// Save to localStorage whenever activeTasks changes
useEffect(() => {
  if (typeof window !== "undefined") {
    localStorage.setItem("activeTasks", JSON.stringify(activeTasks));
  }
}, [activeTasks]);

  const handleAddTask = (form: HTMLFormElement) => {
    const formData = new FormData(form);
    const title = (formData.get("title") as string) || "";
    const category = (formData.get("category") as string) || "";
    const deadline = (formData.get("deadline") as string) || "";
    const description = (formData.get("description") as string) || "";

    if (!title || !deadline) return false;

    setActiveTasks((prev) => [
      ...prev,
      { title, category, deadline, description, status: "Pending" },
    ]);
    form.reset();
    return true;
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-[#000222] text-white flex">
      {/* Sidebar */}
      <aside className="w-64 hidden md:flex flex-col p-6 bg-black/30 border-r border-white/10">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-blue-300">YASA TASKER</h2>
        </div>

        <nav className="flex flex-col gap-2">
          {["Home", "Active Tasks", "Messages", "Payments", "My Tasks"].map((name) => (
            <button
              key={name}
              onClick={() => setActive(name)}
              className={`text-left px-3 py-2 rounded-lg transition ${
                active === name ? "bg-white/8 text-blue-300" : "hover:bg-white/5 text-gray-300"
              }`}
            >
              {name}
            </button>
          ))}
        </nav>

        <div className="mt-auto pt-6 border-t border-white/10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center font-semibold">
            {user.username?.[0]?.toUpperCase() || "U"}
          </div>
          <div>
            <div className="font-semibold">{user.username}</div>
            <div className="text-xs text-gray-400">Pi User</div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 p-8 overflow-y-auto">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">Welcome, {user.username}</h1>
            <p className="text-sm text-gray-300">Manage tasks, chats and payments (Pi)</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                logout();
                router.push("/login");
              }}
              className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 transition text-white"
            >
              Logout
            </button>
          </div>
        </header>

        {/* Active Tasks Section */}
        <section className="bg-white/5 p-6 rounded-2xl mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-semibold text-blue-300">Active Tasks</h2>
          </div>
{/* Post Task Form */}
<form
  onSubmit={async (e) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;

    const title = (form.elements.namedItem("title") as HTMLInputElement).value;
    const category = (form.elements.namedItem("category") as HTMLSelectElement).value;
    const deadline = (form.elements.namedItem("deadline") as HTMLInputElement).value;
    const description = (form.elements.namedItem("description") as HTMLTextAreaElement).value;

    if (!title.trim() || !deadline.trim()) {
      alert("Please provide a title and deadline.");
      return;
    }

    // Trigger Pi payment (mocked on desktop; real in Pi Browser)
    const payment = await initPiPayment(0.1, `Posting task: ${title}`, { title, category });

    if (!payment) {
      // payment cancelled or failed — don't post the task
      alert("Payment failed or cancelled. Task was not posted.");
      return;
    }

    // Add the new task (uses setActiveTasks from your component scope)
    const newTask = { title, category, deadline, description, status: "Pending" };
    setActiveTasks((prev) => [...prev, newTask]);

    // reset the form
    form.reset();
  }}
  className="mb-6 bg-white/10 p-4 rounded-xl border border-white/10 backdrop-blur-md"
>
  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
    <input
      name="title"
      placeholder="Task Title"
      className="p-2 rounded-lg bg-white/5 text-white border border-white/10 focus:outline-none focus:ring-2 focus:ring-blue-500"
      required
    />
    <select
      name="category"
      className="p-2 rounded-lg bg-white/5 text-white border border-white/10 focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      <option>Design</option>
      <option>Development</option>
      <option>Writing</option>
      <option>Marketing</option>
    </select>
    <input
      name="deadline"
      type="date"
      className="p-2 rounded-lg bg-white/5 text-white border border-white/10 focus:outline-none focus:ring-2 focus:ring-blue-500"
      required
    />
    <button
      type="submit"
      className="bg-blue-500/80 hover:bg-blue-600 text-white font-semibold py-2 rounded-lg transition"
    >
      Post Task (pay 0.1 π)
    </button>
  </div>

  <div className="mt-3">
    <textarea
      name="description"
      placeholder="Short description (optional)"
      rows={2}
      className="w-full p-2 rounded-lg bg-white/5 text-white border border-white/10 focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
  </div>
</form>
          
          {/* Tasks Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {activeTasks.map((t, i) => (
              <div key={i} className="p-4 rounded-lg bg-white/6 border border-white/8">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-semibold">{t.title}</h3>
                  <span className="text-xs text-gray-300">{t.status}</span>
                </div>
                <p className="text-sm text-gray-300 mb-2">{t.description}</p>
                <div className="text-xs text-gray-400">Deadline: {t.deadline}</div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}