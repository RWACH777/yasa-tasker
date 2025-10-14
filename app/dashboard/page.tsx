// app/dashboard/page.tsx
"use client";

import React, { useEffect, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useUser } from "@/context/UserContext";

type Task = {
  id: string;
  poster_id: string | null;
  title: string;
  description?: string | null;
  category?: string | null;
  budget?: number | null;
  deadline?: string | null;
  status?: string | null;
  created_at?: string | null;
};

export default function DashboardPage(): JSX.Element {
  const router = useRouter();
  const { user } = useUser(); // expects user.uid or equivalent
  const currentUserId = user?.uid ?? null;

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [activeFilter, setActiveFilter] = useState<"All" | "Pending" | "In Progress" | "Completed">("All");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
const [notifications, setNotifications] = useState([]);
  const [userInfo, setUserInfo] = useState(null);

  // Load tasks from Supabase
  useEffect(() => {
    let mounted = true;

    const loadTasks = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from<Task>("tasks")
          .select("*")
          .order("created_at", { ascending: false });

        if (error) {
          console.error("Error loading tasks:", error);
          setErrorMessage("Failed to load tasks.");
        } else {
          if (mounted) setTasks(data ?? []);
        }
      } catch (err) {
        console.error("Unexpected error loading tasks:", err);
        setErrorMessage("Unexpected error loading tasks.");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadTasks();
    return () => {
      mounted = false;
    };
  }, []);

useEffect(function() {
  async function loadUserData() {
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", currentUserId)
      .single();

    setUserInfo(profile);

    const { data: notes } = await supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10);

    setNotifications(notes || []);
  }

  loadUserData();
}, [currentUserId]);

  // Add a new task (no payment)
  const handleAddTask = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!currentUserId) {
      alert("You must be logged in to post a task.");
      return;
    }

    const form = e.currentTarget;
    const formData = new FormData(form);
    const title = (formData.get("title") as string | null) ?? "";
    const category = (formData.get("category") as string | null) ?? "";
    const deadlineRaw = (formData.get("deadline") as string | null) ?? "";
    const description = (formData.get("description") as string | null) ?? "";
    const budgetRaw = (formData.get("budget") as string | null) ?? "";

    const deadline = deadlineRaw ? new Date(deadlineRaw).toISOString() : null;
    const budget = budgetRaw ? parseFloat(budgetRaw) : null;

    if (!title.trim()) {
      alert("Please provide a task title.");
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    try {
      // Insert into Supabase tasks table
      const { data: inserted, error: insertError } = await supabase
        .from<Task>("tasks")
        .insert([
          {
            poster_id: currentUserId,
            title: title.trim(),
            description: description.trim() || null,
            category: category.trim() || null,
            budget: budget,
            deadline,
            status: "open",
          },
        ])
        .select()
        .single();

      if (insertError) {
        console.error("Error creating task:", insertError);
        alert("Failed to post task. Try again.");
        setErrorMessage("Failed to post task.");
        return;
      }

      // Update UI immediately
      if (inserted) {
        setTasks((prev) => [inserted, ...prev]);
        form.reset();
        alert("Task posted successfully.");
      }
    } catch (err) {
      console.error("Unexpected error creating task:", err);
      setErrorMessage("Unexpected error posting task.");
      alert("Unexpected error posting task.");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredTasks =
    activeFilter === "All" ? tasks : tasks.filter((t) => (t.status ?? "open") === activeFilter);

  return (
    <div className="min-h-screen bg-[#000222] text-white p-6">
      <main className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Task Marketplace</h1>
          <div>
            <button
              onClick={() => {
                // quick dev helper to reload tasks
                setLoading(true);
                supabase
                  .from<Task>("tasks")
                  .select("*")
                  .order("created_at", { ascending: false })
                  .then(({ data, error }) => {
                    if (error) console.error(error);
                    else setTasks(data ?? []);
                    setLoading(false);
                  });
              }}
              className="text-sm text-gray-300 hover:text-white"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {(["All", "Pending", "In Progress", "Completed"] as const).map((name) => (
            <button
              key={name}
              onClick={() => setActiveFilter(name)}
              className={
                "text-left px-3 py-2 rounded-lg transition " +
                (activeFilter === name ? "bg-white/8 text-blue-300" : "hover:bg-white/5 text-gray-300")
              }
            >
              {name}
            </button>
          ))}
        </div>

        {/* Add Task Form */}
        <form onSubmit={handleAddTask} className="bg-white/5 p-4 rounded-lg border border-white/10 space-y-3">
          <input name="title" placeholder="Task title" className="w-full p-2 rounded bg-transparent border border-white/20" />
          <input name="category" placeholder="Category" className="w-full p-2 rounded bg-transparent border border-white/20" />
          <div className="flex gap-2">
            <input type="date" name="deadline" className="w-1/2 p-2 rounded bg-transparent border border-white/20" />
            <input type="number" step="0.0001" name="budget" placeholder="Budget (Pi)" className="w-1/2 p-2 rounded bg-transparent border border-white/20" />
          </div>
          <textarea name="description" placeholder="Description" className="w-full p-2 rounded bg-transparent border border-white/20" />
          <button type="submit" disabled={submitting} className="bg-blue-600 hover:bg-blue-700 w-full py-2 rounded-lg font-semibold">
            {submitting ? "Posting..." : "Post Task"}
          </button>
        </form>

        {errorMessage && <div className="text-red-400 text-sm">{errorMessage}</div>}

        {/* Tasks Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            <div className="col-span-full text-center text-gray-300">Loading tasks...</div>
          ) : filteredTasks.length === 0 ? (
            <div className="col-span-full text-center text-gray-400">No tasks found.</div>
          ) : (
            filteredTasks.map((t) => (
              <div key={t.id} className="p-4 rounded-lg bg-white/6 border border-white/8">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-semibold">{t.title}</h3>
                  <span
                    className={
                      "text-xs px-2 py-1 rounded " +
                      ((t.status === "completed" || t.status === "Completed")
                        ? "bg-green-500/20 text-green-400"
                        : t.status === "In Progress"
                        ? "bg-yellow-500/20 text-yellow-400"
                        : "bg-gray-500/20 text-gray-400")
                    }
                  >
                    {t.status ?? "open"}
                  </span>
                </div>

                <p className="text-sm text-gray-400">{t.description ?? ""}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {t.category ?? "General"} • Due: {t.deadline ? new Date(t.deadline).toLocaleDateString() : "—"} • Budget:{" "}
                  {t.budget != null ? (string(t.budget) + Pi) : "—"}
                </p>

                <div className="mt-3 flex gap-2 items-center">
                  <button
                    onClick={() => {
                      // simple "apply" simulation — in production you would open application modal or route
                      alert(`Applied to "${t.title}" (demo).`);
                    }}
                    className="px-3 py-1 rounded bg-blue-600 text-white text-sm"
                  >
                    Apply
                  </button>

                  <button
                    onClick={() => {
                      // open chat or contact — placeholder for now
                      alert("Open chat (not implemented in this demo).");
                    }}
                    className="px-3 py-1 rounded bg-white/5 text-sm"
                  >
                    Contact Poster
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </main>
{/* ---------- Notifications and Profile Panels ---------- */}

<div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-6">

  {/* Active Feed / Notifications */}
  <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 shadow-md">
    <h2 className="text-lg font-semibold mb-3 text-white">Active Feed</h2>
    {notifications && notifications.length > 0 ? (
      <ul className="space-y-2">
        {notifications.map(function(n, i) {
          return (
            <li key={i} className="bg-gray-800 px-3 py-2 rounded-md text-gray-200 text-sm flex justify-between items-center">
              <span>{n.message}</span>
              <span className="text-gray-500 text-xs">
                {new Date(n.created_at).toLocaleTimeString()}
              </span>
            </li>
          );
        })}
      </ul>
    ) : (
      <p className="text-gray-500 text-sm">No recent notifications.</p>
    )}
  </div>

  {/* Profile / User Info */}
  <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 shadow-md">
    <h2 className="text-lg font-semibold mb-3 text-white">My Profile</h2>

    {userInfo ? (
      <div className="space-y-2 text-gray-200 text-sm">
        <p><strong>Name:</strong> {userInfo.username || "Anonymous"}</p>
        <p><strong>Email:</strong> {userInfo.email || "—"}</p>
        <p><strong>Joined:</strong> {userInfo.created_at ? new Date(userInfo.created_at).toLocaleDateString() : "—"}</p>
        <p><strong>Pi Balance:</strong> {userInfo.balance != null ? userInfo.balance + " Pi" : "—"}</p>
        <button
          onClick={function() {
            alert("Profile editing will be added soon.");
          }}
          className="mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white text-sm"
        >
          Edit Profile
        </button>
      </div>
    ) : (
      <p className="text-gray-500 text-sm">Loading user info...</p>
    )}
  </div>
  );
}