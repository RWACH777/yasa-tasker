"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/context/UserContext";
import { supabase } from "@/lib/supabaseClient";
import ChatModals from "../../components/ChatModals";

export default function DashboardPage() {
  const router = useRouter();
  const { user, setUser } = useUser() as any;

  const [activeTab, setActiveTab] = useState("All");
  const [tasks, setTasks] = useState<any[]>([]);
  const [applicationsMap, setApplicationsMap] = useState<Record<string, any[]>>({});
  const [notifications, setNotifications] = useState<string[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);

  // Task form
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [deadline, setDeadline] = useState("");
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState<number | "">("");
  const [isPosting, setIsPosting] = useState(false);

  // restore Pi user from localStorage
  useEffect(() => {
    if (!user && typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("piUser");
        if (saved) {
          const parsed = JSON.parse(saved);
          setUser?.(parsed);
        }
      } catch (e) {
        console.warn("Failed to restore Pi user:", e);
      }
    }
  }, [user, setUser]);

  // fetch tasks
  const loadTasks = async () => {
    setLoadingTasks(true);
    const { data, error } = await supabase.from("tasks").select("*").order("created_at", { ascending: false });
    if (!error && data) setTasks(data);
    setLoadingTasks(false);
  };

  const loadApplications = async () => {
    const { data, error } = await supabase.from("applications").select("*");
    if (!error && data) {
      const map: Record<string, any[]> = {};
      data.forEach((a) => {
        if (!map[a.task_id]) map[a.task_id] = [];
        map[a.task_id].push(a);
      });
      setApplicationsMap(map);
    }
  };

  const loadNotifications = async () => {
  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(10);

  if (!error && data) {
    const notes = data.map(
      (t) => `Tx: ${t.txid || "unknown"} — ${t.status || "pending"} — ${t.amount || 0} Pi`
    );
    setNotifications(notes);
  }
};

  useEffect(() => {
    loadTasks();
    loadApplications();
    loadNotifications();
  }, []);

  const resolveUser = () => {
    if (user?.uid) return user.uid;
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("piUser");
      if (saved) return JSON.parse(saved)?.uid;
    }
    return null;
  };

  const ensureUserRow = async (uid: string | null, username: string | null) => {
    if (!uid) return;
    const row = { pi_uid: uid, username: username || uid };
    await supabase.from("users").upsert(row, { onConflict: "pi_uid" });
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !deadline) return alert("Please fill required fields");

    const uid = resolveUser();
    if (!uid) return alert("Login with Pi to post");

    setIsPosting(true);
    const username = user?.usern JSON.parse(localStorage.getItem("piUser") ) || "{}").username || null;
    await ensureUserRow(uid, username);

    const { data, error } = await supabase.from("tasks").insert([
      {
        poster_id: uid,
        title,
        description,
        category,
        budget: budget === "" ? null : Number(budget),
        deadline,
        status: "open",
      },
    ]).select().single();

    if (error) alert("Error posting task: " + error.message);
    else {
      setTasks((prev) => [data, ...prev]);
      setNotifications((n) => [Task posted: ${data.title}, ...n]);
      setTitle("");
      setCategory("");
      setDeadline("");
      setDescription("");
      setBudget("");
    }
    setIsPosting(false);
  };

  const handleApply = async (taskId: string) => {
    const uid = resolveUser();
    if (!uid) return alert("Login with Pi to apply");
    const username = user?.usern JSON.parse(localStorage.getItem("piUser") ) || "{}").username || null;
    await ensureUserRow(uid, username);

    const { data, error } = await supabase.from("applications").insert([
      { task_id: taskId, applicant_id: uid, cover_text: "I'd like to apply", proposed_budget: null },
    ]).select();

    if (error) alert("Error applying: " + error.message);
    else {
      setApplicationsMap((m) => ({ ...m, [taskId]: [...(m[taskId] || []), data[0]] }));
      setNotifications((n) => ["Applied to task", ...n]);
    }
  };

  const filtered = activeTab === "All" ? tasks : tasks.filter((t) => t.status === activeTab);
  const formatBudget = (b: number | null) => (b != null ? ${b} Pi : "—");

  return (
    <div className="min-h-screen bg-[#000222] text-white p-6">
      <main className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Task Marketplace</h1>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-sm text-gray-300">
                {user?.username ||
                  JSON.parse(localStorage.getItem("piUse "{}").username e ||
                  "Guest"}
              </div>
              <div className="text-xs text-gray-500">
                UID: {user?.uid ||
                  JSON.parse(localStorage.getItem("piUse "{}").uid d ||
                  "—"}
              </div>
            </div>
            <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center text-sm">
              {(user?.username ||
                JSON.parse(localStorage.getItem("piUse "{}").username e ||
                "U").charAt(0).toUpperCase()}
            </div>
          </div>
        </div>

        {/* Panels */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glass p-4 rounded-2xl border border-white/8">
            <h2 className="font-semibold mb-2">Profile</h2>
            <p className="text-sm text-gray-300">Name: {user?.username || "—"}</p>
            <p className="text-sm text-gray-300">Pi UID: {user?.uid || "—"}</p>
            <p className="text-sm text-gray-300">Role: both</p>
          </div>

          <div className="glass p-4 rounded-2xl border border-white/8">
            <h2 className="font-semibold mb-2">Notifications</h2>
            {notifications.length === 0 ? (
              <div className="text-sm text-gray-400">No notifications</div>
            ) : (
              <ul className="space-y-2 text-sm">
                {notifications.map((n, i) => (
                  <li key={i} className="text-gray-300 bg-white/5 p-2 rounded">
                    {n}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="glass p-4 rounded-2xl border border-white/8">
            <h2 className="font-semibold mb-2">Overview</h2>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-xl font-bold">{tasks.length}</div>
                <div className="text-xs text-gray-400">Tasks</div>
              </div>
              <div>
                <div className="text-xl font-bold">
                  {Object.values(applicationsMap).reduce((s, a) => s + a.length, 0)}
                </div>
                <div className="text-xs text-gray-400">Applications</div>
              </div>
              <div>
                <div className="text-xl font-bold">{notifications.length}</div>
                <div className="text-xs text-gray-400">Alerts</div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {["All", "open", "in_review", "completed"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={px-3 py-2 rounded-lg ${
                activeTab === tab ? "bg-white/10 text-blue-400" : "hover:bg-white/5 text-gray-300"
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Post Task Form */}
        <form
          onSubmit={handleAddTask}
          className="bg-white/5 p-4 rounded-lg border border-white/10 space-y-3"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title"
              className="w-full p-2 rounded bg-transparent border border-white/20"
            />
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Category"
              className="w-full p-2 rounded bg-transparent border border-white/20"
            />
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full p-2 rounded bg-transparent border border-white/20"
            />
          </div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description"
            className="w-full p-2 rounded bg-transparent border border-white/20"
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <input
              type="number"
              value={budget}
              onChange={(e) =>
                setBudget(e.target.value === "" ? "" : Number(e.target.value))
              }
              placeholder="Budget (Pi)"
              className="w-full p-2 rounded bg-transparent border border-white/20"
            />
            <div />
            <button
              type="submit"
              disabled={isPosting}
              className={bg-blue-600 hover:bg-blue-700 w-full py-2 rounded-lg font-semibold ${
                isPosting ? "opacity-50" : ""
              }}
            >
              {isPosting ? "Posting..." : "Post Task"}
            </button>
          </div>
        </form>

        {/* Tasks */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loadingTasks ? (
            <div className="text-gray-300">Loading tasks...</div>
          ) : filtered.length === 0 ? (
            <div className="text-gray-400">No tasks found.</div>
          ) : (
            filtered.map((t) => (
              <div key={t.id} className="p-4 rounded-lg bg-white/10 border border-white/10">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-semibold">{t.title}</h3>
                  <span
                    className={`text-xs px-2 py-1 rounded ${
                      t.status === "completed"
                        ? "bg-green-500/20 text-green-400"
                        : t.status === "in_review"
                        ? "bg-yellow-500/20 text-yellow-400"
                        : "bg-gray-500/20 text-gray-400"
                    }`}
                  >
                    {t.status || "open"}
                  </span>
                </div>
                <p className="text-sm text-gray-400">{t.description || "No description"}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {(t.category || "General") +
                    " • Due: " +
                    (t.deadline || "—") +
                    " • Budget: " +
                    formatBudget(t.budget)}
                </p>
                <div className="mt-3 flex gap-2 items-center">
                  <button
                    onClick={() => handleApply(t.id)}
                    className="px-3 py-1 rounded bg-blue-600 text-white text-sm"
                  >
                    Apply
                  </button>
                  <ChatModals
                    currentUserId={resolveUser() || ""}
                    receiverId={t.poster_id || ""}
                    receiverName={t.poster_id || "Poster"}
                  />
                  <div className="ml-auto text-xs text-gray-300">
                    {applicationsMap[t.id]?.length || 0} apps
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}