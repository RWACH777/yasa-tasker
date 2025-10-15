"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/context/UserContext";
import { supabase } from "@/lib/supabaseClient";
import ChatModals from "../../components/ChatModals";

type Task = {
  id: string;
  poster_id: string | null;
  title: string;
  description: string | null;
  category: string | null;
  budget: number | null;
  deadline: string | null;
  status: string | null;
  created_at: string | null;
};

type Application = {
  id: string;
  task_id: string;
  applicant_id: string;
  cover_text: string | null;
  proposed_budget: number | null;
  status: string | null;
  created_at: string | null;
};

export default function DashboardPage() {
  const router = useRouter();
  const userCtx = useUser();
  const user = (userCtx as any)?.user ?? null;
  const setUser = (userCtx as any)?.setUser ?? (() => {});

  const [hydratedUser, setHydratedUser] = useState(user);
  const [activeTab, setActiveTab] = useState("All");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);

  // form state
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [deadline, setDeadline] = useState("");
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState<number | "">("");
  const [isPosting, setIsPosting] = useState(false);

  const [applicationsMap, setApplicationsMap] = useState<Record<string, Application[]>>({});
  const [notifications, setNotifications] = useState<string[]>([]);

  // hydrate user from context on mount
  useEffect(() => {
    if (!hydratedUser && user) {
      setHydratedUser(user);
    } else if (!hydratedUser && typeof window !== "undefined") {
      const raw = localStorage.getItem("piUser");
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed) setHydratedUser(parsed);
        } catch (e) {
          console.warn("Failed to parse local piUser:", e);
        }
      }
    }
  }, [user, hydratedUser]);

  // load tasks
  const loadTasks = async () => {
    setLoadingTasks(true);
    try {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) console.error("Error loading tasks:", error);
      else setTasks(data || []);
    } catch (err) {
      console.error("Unexpected loadTasks error:", err);
    } finally {
      setLoadingTasks(false);
    }
  };

  // load applications
  const loadApplications = async () => {
    try {
      const { data, error } = await supabase
        .from("applications")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) {
        console.error("Error loading applications:", error);
        return;
      }
      const map: Record<string, Application[]> = {};
      (data || []).forEach((a: Application) => {
        if (!map[a.task_id]) map[a.task_id] = [];
        map[a.task_id].push(a);
      });
      setApplicationsMap(map);
    } catch (err) {
      console.error("Unexpected loadApplications error:", err);
    }
  };

  // load notifications
  const loadNotifications = async () => {
    try {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);
      if (!error && data) {
        const notes = (data as any[]).map(function(t) {
          return "Tx: " + (t.txid ||  "unknown") + " — " + (t.status  || "pending") + " — " + String(t.amount || 0) + " Pi";
        });
        setNotifications(notes);
      }
    } catch (err) {
      console.error("Error loading notifications:", err);
    }
  };

  useEffect(() => {
    loadTasks();
    loadApplications();
    loadNotifications();
    const id = setInterval(() => {
      loadTasks();
      loadApplications();
      loadNotifications();
    }, 30000);
    return () => clearInterval(id);
  }, []);

  const resolvePosterId = () => hydratedUser?.uid || null;

  async function ensureUserRow(uid: string | null, username: string | null) {
    if (!uid) return;
    try {
      const row = { id: uid, username: username || uid };
      const { error } = await supabase.from("users").upsert(row, { onConflict: "id" });
      if (error) console.warn("Failed upserting user row:", error.message);
      else console.log("✅ User row ensured:", row);
    } catch (err) {
      console.error("❌ Error ensuring user exists:", err);
    }
  }

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !deadline) {
      alert("Please fill required fields: title and deadline.");
      return;
    }
    const posterId = resolvePosterId();
    if (!posterId) {
      alert("You must be logged in with Pi to post tasks.");
      return;
    }
    setIsPosting(true);
    try {
      await ensureUserRow(posterId, hydratedUser?.username || null);
      const taskRow = {
        poster_id: posterId,
        title,
        description: description || null,
        category: category || null,
        budget: budget === "" ? null : Number(budget),
        deadline: deadline || null,
        status: "open",
      };
      const { data, error } = await supabase.from("tasks").insert([taskRow]).select().single();
      if (error) {
        console.error("Supabase insert error:", error);
        alert("Failed to post task: " + error.message);
        return;
      }
      setTasks(prev => [data as Task].concat(prev));
      setTitle("");
      setCategory("");
      setDeadline("");
      setDescription("");
      setBudget("");
      setNotifications(n => ["Task posted: " + (data as any).title].concat(n));
    } catch (err: any) {
      console.error("Unexpected error posting task:", err);
      alert("Failed to post task: " + (err?.message || JSON.stringify(err)));
    } finally {
      setIsPosting(false);
    }
  };

  const handleApply = async (taskId: string) => {
    const applicantId = resolvePosterId();
    if (!applicantId) {
      alert("Please log in with Pi to apply.");
      return;
    }
    try {
      await ensureUserRow(applicantId, hydratedUser?.username || null);
      const { data, error } = await supabase.from("applications").insert([
        {
          task_id: taskId,
          applicant_id: applicantId,
          cover_text: "I'd like to apply — please contact me.",
          proposed_budget: null,
        },
      ]);
      if (error) {
        console.error("Apply error:", error);
        alert("Failed to apply: " + (error.message || JSON.stringify(error)));
        return;
      }
      const newApp: Application = (data as Application[])[0];
      setApplicationsMap(m => {
        const copy = { ...m };
        copy[taskId] = (copy[taskId] || []).concat(newApp);
        return copy;
      });
      setNotifications(n => ["Applied to task"].concat(n));
      alert("Applied to task. Open Chat to contact poster.");
    } catch (err: any) {
      console.error("Unexpected apply error:", err);
      alert("Failed to apply: " + (err?.message || JSON.stringify(err)));
    }
  };

  const formatBudget = (b: number | null) => (b != null ? String(b) + " Pi" : "—");
  const filteredTasks = activeTab === "All" ? tasks : tasks.filter(t => (t.status || "open") === activeTab);

  return (
    <div className="min-h-screen bg-[#000222] text-white p-6">
      <main className="max-w-6xl mx-auto space-y-8">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Task Marketplace</h1>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-sm text-gray-300">{hydratedUser?.username || "Guest"}</div>
              <div className="text-xs text-gray-500">UID: {hydratedUser?.uid || "—"}</div>
            </div>
            <div className="w-12 h-12 bg-white/6 rounded-full flex items-center justify-center text-sm">
              {hydratedUser?.username ? hydratedUser.username.charAt(0).toUpperCase() : "U"}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glass p-4 rounded-2xl border border-white/8">
            <h2 className="font-semibold mb-2">Profile</h2>
            <p className="text-sm text-gray-300">Name: {hydratedUser?.username || "—"}</p>
            <p className="text-sm text-gray-300">Pi UID: {hydratedUser?.uid || "—"}</p>
            <p className="text-sm text-gray-300">Role: both</p>
            <div className="mt-3">
              <button className="px-3 py-2 bg-blue-600 rounded-lg text-sm" onClick={() => alert("Profile editing coming soon")}>Edit Profile</button>
            </div>
          </div>

          <div className="glass p-4 rounded-2xl border border-white/8">
            <h2 className="font-semibold mb-2">Notifications</h2>
            {notifications.length === 0 ? <div className="text-sm text-gray-400">No notifications</div> : <ul className="space-y-2 text-sm">{notifications.map((n, i) => <li key={i} className="text-gray-300 bg-white/3 p-2 rounded">{n}</li>)}</ul>}
          </div>

          <div className="glass p-4 rounded-2xl border border-white/8">
            <h2 className="font-semibold mb-2">Overview</h2>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div><div className="text-xl font-bold">{tasks.length}</div><div className="text-xs text-gray-400">Total Tasks</div></div>
              <div><div className="text-xl font-bold">{Object.keys(applicationsMap).reduce((sum, k) => sum + (applicationsMap[k]?.length || 0), 0)}</div><div className="text-xs text-gray-400">Applications</div></div>
              <div><div className="text-xl font-bold">{notifications.length}</div><div className="text-xs text-gray-400">Alerts</div></div>
            </div>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2">
          {["All", "open", "in_review", "completed"].map(name => (
            <button key={name} onClick={() => setActiveTab(name)} className={"text-left px-3 py-2 rounded-lg transition " + (activeTab === name ? "bg-white/8 text-blue-300" : "hover:bg-white/5 text-gray-300")}>
              {name}
            </button>
          ))}
        </div>

        <form onSubmit={handleAddTask} className="bg-white/5 p-4 rounded-lg border border-white/10 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Task title" className="w-full p-2 rounded bg-transparent border border-white/20" />
            <input value={category} onChange={e => setCategory(e.target.value)} placeholder="Category" className="w-full p-2 rounded bg-transparent border border-white/20" />
            <input value={deadline} onChange={e => setDeadline(e.target.value)} type="date" className="w-full p-2 rounded bg-transparent border border-white/20" />
          </div>
          <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Description" className="w-full p-2 rounded bg-transparent border border-white/20" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <input value={budget} onChange={e => setBudget(e.target.value === "" ? "" : Number(e.target.value))} placeholder="Budget (Pi)" type="number" className="w-full p-2 rounded bg-transparent border border-white/20" />
            <div />
            <button type="submit" disabled={isPosting} className={"bg-blue-600 hover:bg-blue-700 w-full py-2 rounded-lg font-semibold " + (isPosting ? "opacity-60 cursor-not-allowed" : "")}>
              {isPosting ? "Posting..." : "Post Task"}
            </button>
          </div>
        </form>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loadingTasks ? <div className="text-gray-300">Loading tasks...</div> : filteredTasks.length === 0 ? <div className="text-gray-400">No tasks found.</div> : filteredTasks.map(t => (
            <div key={t.id} className="p-4 rounded-lg bg-white/6 border border-white/8">
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-semibold">{t.title}</h3>
                <span className={"text-xs px-2 py-1 rounded " + ((t.status === "completed") ? "bg-green-500/20 text-green-400" : (t.status === "in_review") ? "bg-yellow-500/20 text-yellow-400" : "bg-gray-500/20 text-gray-400")}>
                  {t.status || "open"}
                </span>
              </div>
              <p className="text-sm text-gray-400">{t.description || "No description"}</p>
              <p className="text-xs text-gray-500 mt-1">{(t.category  "General") + " • Due: " + (t.deadline  "—") + " • Budget: " + formatBudget(t.budget)}</p>
              <div className="mt-3 flex gap-2 items-center">
                <button onClick={() => handleApply(t.id)} className="px-3 py-1 rounded bg-blue-600 text-white text-sm">Apply</button>
                <ChatModals currentUserId={hydratedUser?.uid  ""} receiverId={t.poster_id  ""} receiverName={t.poster_id ? t.poster_id : "Poster"} />
                <div className="ml-auto text-xs text-gray-300">{applicationsMap[t.id] && applicationsMap[t.id].length ? String(applicationsMap[t.id].length) + " applications" : "0 apps"}</div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}