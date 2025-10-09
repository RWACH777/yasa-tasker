"use client";

import React, { useState, useEffect } from "react";
import { initPiPayment } from "@/lib/piPayment";

interface Task {
  title: string;
  category: string;
  deadline: string;
  description: string;
  status: string;
}

export default function DashboardPage() {
  const [active, setActive] = useState("All");
  const [activeTasks, setActiveTasks] = useState<Task[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("activeTasks");
      if (saved) return JSON.parse(saved);
    }
    return [];
  });

  // persist tasks to localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("activeTasks", JSON.stringify(activeTasks));
    }
  }, [activeTasks]);

  const handleAddTask = async (form: HTMLFormElement) => {
    const formData = new FormData(form);
    const title = formData.get("title") as string;
    const category = formData.get("category") as string;
    const deadline = formData.get("deadline") as string;
    const description = formData.get("description") as string;

    if (!title || !deadline) return alert("Please fill required fields");

    // Simulated Pi payment before adding task
    const payment = await initPiPayment(0.1, `Posting task: ${title}`, { title, category });
    if (!payment) return alert("Payment failed or cancelled.");

    const newTask: Task = { title, category, deadline, description, status: "Pending" };
    setActiveTasks((prev: Task[]) => [...prev, newTask]);
    form.reset();
  };

  const filteredTasks =
    active === "All"
      ? activeTasks
      : activeTasks.filter((t) => t.status === active);

  return (
    <div className="min-h-screen bg-[#000222] text-white p-6">
      <main className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">My Tasks</h1>
          <button
            onClick={() => localStorage.clear()}
            className="text-sm text-gray-400 hover:text-red-400"
          >
            Clear All
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {["All", "Pending", "In Progress", "Completed"].map((name) => (
            <button
              key={name}
              onClick={() => setActive(name)}
              className={`text-left px-3 py-2 rounded-lg transition ${
                active === name
                  ? "bg-white/8 text-blue-300"
                  : "hover:bg-white/5 text-gray-300"
              }`}
            >
              {name}
            </button>
          ))}
        </div>

        {/* Add Task Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAddTask(e.currentTarget);
          }}
          className="bg-white/5 p-4 rounded-lg border border-white/10 space-y-3"
        >
          <input
            name="title"
            placeholder="Task title"
            className="w-full p-2 rounded bg-transparent border border-white/20"
          />
          <input
            name="category"
            placeholder="Category"
            className="w-full p-2 rounded bg-transparent border border-white/20"
          />
          <input
            type="date"
            name="deadline"
            className="w-full p-2 rounded bg-transparent border border-white/20"
          />
          <textarea
            name="description"
            placeholder="Description"
            className="w-full p-2 rounded bg-transparent border border-white/20"
          />
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 w-full py-2 rounded-lg font-semibold"
          >
            Add Task
          </button>
        </form>

        {/* Tasks Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTasks.map((t: Task, i: number) => (
            <div
              key={i}
              className="p-4 rounded-lg bg-white/6 border border-white/8"
            >
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-semibold">{t.title}</h3>
                <span
                  className={`text-xs px-2 py-1 rounded ${
                    t.status === "Completed"
                      ? "bg-green-500/20 text-green-400"
                      : t.status === "In Progress"
                      ? "bg-yellow-500/20 text-yellow-400"
                      : "bg-gray-500/20 text-gray-400"
                  }`}
                >
                  {t.status}
                </span>
              </div>
              <p className="text-sm text-gray-400">{t.description}</p>
              <p className="text-xs text-gray-500 mt-1">
                {t.category} • Due: {t.deadline}
              </p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}