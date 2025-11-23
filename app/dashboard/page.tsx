"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

interface Task {
  id: string;
  poster_id: string;
  title: string;
  description: string;
  category: string;
  budget: number;
  deadline: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface Profile {
  id: string;
  username: string;
  avatar_url?: string;
  rating?: number;
  completed_tasks?: number;
}

export default function DashboardPage() {
  const [user, setUser] = useState<Profile | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [form, setForm] = useState({
    id: "",
    title: "",
    description: "",
    category: "",
    budget: "",
    deadline: "",
  });
  const [message, setMessage] = useState("");
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  // -------------------------
  // helper: load profile by auth user id
  // -------------------------
  const loadProfile = async (authUserId: string | null) => {
    if (!authUserId) {
      setUser(null);
      return;
    }
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", authUserId)
      .single();
    if (error) {
      console.error("Failed to load profile:", error);
      setUser(null);
    } else {
      setUser(data);
    }
  };

  // -------------------------
  // Listen for Supabase auth changes so UI updates when session is set/cleared
  // -------------------------
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("Auth event:", event);
      const userId = session?.user?.id ?? null;
      if (userId) {
        loadProfile(userId).then(() => {
          fetchTasks(); // refresh tasks once we have profile
        });
      } else {
        setUser(null);
        setTasks([]);
      }
    });

    // cleanup
    return () => {
      subscription?.unsubscribe();
    };
    // we only want to mount this once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -------------------------
  // First mount: check existing session -> otherwise call Pi once
  // -------------------------
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        // 1) check if Supabase already restored a session
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.user) {
          // session exists -> load profile from DB
          await loadProfile(session.user.id);
          setLoading(false);
          return;
        }

        // 2) no session -> call Pi.authenticate ONCE (only in Pi Browser)
        const Pi = (window as any).Pi;
        if (!Pi) {
          // Not in Pi Browser — skip Pi auth silently (user can still login via Pi Browser)
          console.warn("Pi SDK not present on window. Open in Pi Browser to login.");
          setLoading(false);
          return;
        }

        // Request only the username scope here
        const authResult = await Pi.authenticate(["username"], (payment: any) => {
          // ignore payment callback here
          console.log("Pi payment callback (ignored):", payment);
        });

        const piUser = authResult?.user;
        if (!piUser) throw new Error("Pi authentication returned no user");

        // 3) Exchange Pi user for Supabase session via your API
        const res = await fetch("/api/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: piUser.username, pi_uid: piUser.uid }),
        });

        const json = await res.json();
        if (!res.ok || !json.success) {
          const errMsg = json?.error || `Login route failed with status ${res.status}`;
          throw new Error(errMsg);
        }

        // 4) Set the Supabase session on the client
        await supabase.auth.setSession({
          access_token: json.access_token,
          refresh_token: json.refresh_token,
        });

        // 5) Load profile
        await loadProfile(json.user.id);

        // 6) fetch tasks
        fetchTasks();
      } catch (err: any) {
        console.error("Init/dashboard error:", err);
        setMessage("⚠️ " + (err?.message || "Initialization error"));
      } finally {
        setLoading(false);
      }
    };

    init();
    // run once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -------------------------
  // Fetch tasks (by category filter)
  // -------------------------
  const fetchTasks = async () => {
    try {
      let q = supabase.from("tasks").select("*").order("created_at", { ascending: false });
      if (filter !== "all") q = q.eq("category", filter);
      const { data, error } = await q;
      if (error) {
        console.error("Error fetching tasks:", error);
        setMessage("⚠️ Failed fetching tasks");
      } else {
        setTasks(data || []);
      }
    } catch (err) {
      console.error("Unexpected fetchTasks error:", err);
      setMessage("⚠️ Failed fetching tasks");
    }
  };

  useEffect(() => {
    // if user exists, fetch tasks; otherwise clear them
    if (user) fetchTasks();
    else setTasks([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, user]);

  // -------------------------
  // Create / Update Task
  // -------------------------
  const handleSubmit = async (e: any) => {
    e.preventDefault();

    if (!user?.id) {
      setMessage("⚠️ You must be logged in to post a task.");
      return;
    }
    if (
  !form.title ||
  !form.description ||
  !form.category ||
  !form.budget ||
  !form.deadline
) {
  setMessage("⚠️ Please fill in all fields.");
  return;
}

    // Convert deadline (date input) to ISO timestamp so DB timestamptz is correct
    const deadlineIso = new Date(form.deadline).toISOString();

    const taskData = {
      poster_id: user.id,
      title: form.title,
      description: form.description,
      category: form.category,
      budget: parseFloat(form.budget),
      deadline: deadlineIso,
      status: "open",
      updated_at: new Date().toISOString(),
    };

    try {
      let result;
      if (form.id) {
        result = await supabase.from("tasks").update(taskData).eq("id", form.id).select();
      } else {
        result = await supabase.from("tasks").insert([taskData]).select();
      }
      if (result.error) {
        console.error("Task save error:", result.error);
        setMessage("❌ Failed to save task: " + (result.error.message || JSON.stringify(result.error)));
        return;
      }
      setMessage("✅ Task posted successfully!");
      setForm({ id: "", title: "", description: "", category: "", budget: "", deadline: "" });
      fetchTasks();
    } catch (err: any) {
      console.error("Unexpected task save error:", err);
      setMessage("❌ Failed to save task: " + (err?.message || String(err)));
    }
  };

  // -------------------------
  // Edit / Delete
  // -------------------------
  const handleEdit = (task: Task) => {
    setForm({
      id: task.id,
      title: task.title,
      description: task.description,
      category: task.category,
      budget: String(task.budget),
      deadline: task.deadline.split("T")[0],
    });
    setMessage("Editing task...");
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this task?")) return;
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) {
      console.error("Delete error:", error);
      setMessage("❌ Failed to delete task.");
    } else {
      setMessage("🗑 Task deleted.");
      fetchTasks();
    }
  };

  const categories = ["all", "design", "writing", "development", "marketing", "translation", "other"];

  // -------------------------
  // Render
  // -------------------------
  return (
    <div className="min-h-screen bg-[#000222] text-white flex flex-col items-center px-4 py-10">
      {/* USER PROFILE SECTION - glass card */}
      <div className="w-full max-w-3xl bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-6 text-center mb-8">
        {loading ? (
          <p>Loading profile...</p>
        ) : user ? (
          <div className="flex flex-col items-center space-y-2">
            <img
              src={user.avatar_url || `https://api.dicebear.com/8.x/thumbs/svg?seed=${user.username}`}
              alt="Avatar"
              className="w-20 h-20 rounded-full border border-white/30"
            />
            <h2 className="text-xl font-semibold">{user.username}</h2>
            <p className="text-sm text-gray-300">
              ⭐️ {user.rating || "New User"} • {user.completed_tasks || 0} Tasks Completed
            </p>
          </div>
        ) : (
          <p>⚠️ Please log in with Pi to view your profile.</p>
        )}
      </div>

      {/* POST TASK FORM - glass card */}
      <div className="w-full max-w-3xl bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-6 mb-8">
        <h2 className="text-lg font-semibold mb-4">{form.id ? "Edit Task" : "Post a Task"}</h2>
        {message && <p className="text-sm text-gray-300 mb-3">{message}</p>}
        <form onSubmit={handleSubmit} className="space-y-3 relative z-10 pointer-events-auto">
          <input type="text" placeholder="Task title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-sm" />
          <textarea placeholder="Task description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-sm" rows={3} />
          <input type="text" placeholder="Category (e.g. design)" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-sm" />
          <input type="number" placeholder="Budget (in π)" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-sm" />
          <input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-sm" />
          <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 py-2 rounded-lg transition">{form.id ? "Update Task" : "Post Task"}</button>
        </form>
      </div>

      {/* FILTER + TASK FEED - glass card */}
      <div className="w-full max-w-3xl bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Available Tasks</h2>
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className="bg-white/10 border border-white/20 rounded-lg px-3 py-1 text-sm">
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </option>
            ))}
          </select>
        </div>

        {tasks.length === 0 ? (
          <p className="text-gray-400 text-sm">No tasks found.</p>
        ) : (
          <div className="space-y-4">
            {tasks.map((task) => (
              <div key={task.id} className="bg-white/5 border border-white/10 rounded-lg p-4 flex flex-col sm:flex-row sm:justify-between sm:items-center">
                <div>
                  <h3 className="font-semibold">{task.title}</h3>
                  <p className="text-gray-300 text-sm mb-2">{task.description}</p>
                  <p className="text-xs text-gray-400">Category: {task.category} • Budget: {task.budget} π • Deadline: {new Date(task.deadline).toLocaleDateString()}</p>
                </div>
                {user?.id === task.poster_id && (
                  <div className="flex gap-2 mt-3 sm:mt-0">
                    <button onClick={() => handleEdit(task)} className="px-3 py-1 bg-blue-500/80 rounded-md text-sm hover:bg-blue-600 transition">Edit</button>
                    <button onClick={() => handleDelete(task.id)} className="px-3 py-1 bg-red-500/80 rounded-md text-sm hover:bg-red-600 transition">Delete</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}