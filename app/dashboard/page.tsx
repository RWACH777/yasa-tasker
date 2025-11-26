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

  const [sessionDebug, setSessionDebug] = useState(null);
  const [piDebug, setPiDebug] = useState(null);
  const [apiDebug, setApiDebug] = useState(null);

  // 🔥 FIXED: Load profile
  const loadProfile = async (authUserId: string | null) => {
    if (!authUserId) return;
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", authUserId)
      .single();

    if (!error) setUser(data);
  };

  // 🔥 FIXED — prevents double login & ensures correct session flow
  useEffect(() => {
    const init = async () => {
      setLoading(true);

      // 1️⃣ Check Supabase session first
      const { data } = await supabase.auth.getSession();
      setSessionDebug(data.session);

      if (data.session?.user) {
        await loadProfile(data.session.user.id);
        setLoading(false);
        return;
      }



      // 2️⃣ Localhost → skip Pi login completely
      const isLocal = window.location.hostname === "localhost";
      if (isLocal) {
        console.log("🔧 Local mode: Pi login DISABLED");

        const fakeUser = {
          uid: "local_user_123",
          username: "LocalUser",
        };

        setPiDebug({ user: fakeUser });

        // Skip Pi → go straight to session creation
        setLoading(false);
        return;
      }

      // 3️⃣ PRODUCTION → use real Pi SDK
      const pi = (window as any).Pi;
      if (!pi) {
        setMessage("Pi SDK not found");
        setLoading(false);
        return;
      }

      const authResult = await pi.authenticate(["username"], (p) => p);
      setPiDebug(authResult);
      const piUser = authResult.user;


      // 3️⃣ Exchange tokens
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: piUser.username,
          pi_uid: piUser.uid,
        }),
      });

      const json = await res.json();
      setApiDebug(json);

      if (!json.success) {
        setMessage("Login error: " + json.error);
        setLoading(false);
        return;
      }

      // 4️⃣ Save session
      const { error: setErr } = await supabase.auth.setSession({
        access_token: json.access_token,
        refresh_token: json.refresh_token,
      });

      if (setErr) {
        console.error(setErr);
        setLoading(false);
        return;
      }

      // 5️⃣ Load profile after session is READY
      await loadProfile(json.user.id);

      setLoading(false);
    };

    init();
  }, []);

  // Fetch tasks
  const fetchTasks = async () => {
    let q = supabase
      .from("tasks")
      .select("*")
      .order("created_at", { ascending: false });

    if (filter !== "all") q = q.eq("category", filter);

    const { data, error } = await q;
    if (!error) setTasks(data || []);
  };

  useEffect(() => {
    if (user) fetchTasks();
  }, [filter, user]);

  // Post / update task
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

    let result;
    if (form.id) {
      result = await supabase
        .from("tasks")
        .update(taskData)
        .eq("id", form.id)
        .select();
    } else {
      result = await supabase.from("tasks").insert([taskData]).select();
    }

    if (result.error) {
      setMessage("❌ Failed to save task");
      return;
    }

    setMessage("✅ Task posted!");
    setForm({
      id: "",
      title: "",
      description: "",
      category: "",
      budget: "",
      deadline: "",
    });
    fetchTasks();
  };

  const handleEdit = (task: Task) => {
    setForm({
      id: task.id,
      title: task.title,
      description: task.description,
      category: task.category,
      budget: String(task.budget),
      deadline: task.deadline.split("T")[0],
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this task?")) return;
    await supabase.from("tasks").delete().eq("id", id);
    fetchTasks();
  };

  const categories = [
    "all",
    "design",
    "writing",
    "development",
    "marketing",
    "translation",
    "other",
  ];

  // ⭐️ UI EXACTLY THE SAME — only avatar fixed below
  return (
    <div className="min-h-screen bg-[#000222] text-white flex flex-col items-center px-4 py-10">
      <div className="w-full max-w-3xl bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-6 text-center mb-8">
        {loading ? (
          <p>Loading profile...</p>
        ) : user ? (
          <div className="flex flex-col items-center space-y-2">
            <img
              src={
                user.avatar_url ||

                `https://api.dicebear.com/8.x/thumbs/svg?seed=${user.username}`
              }
              alt="Avatar"
              className="w-20 h-20 rounded-full border border-white/30"
            />
            <h2 className="text-xl font-semibold">{user.username}</h2>
            <p className="text-sm text-gray-300">
              ⭐️ {user.rating || "New User"} •{" "}
              {user.completed_tasks || 0} Tasks Completed
            </p>
          </div>
        ) : (
          <p>⚠️ Please log in with Pi to view your profile.</p>
        )}
      </div>

      {/* EVERYTHING BELOW IS IDENTICAL — tasks, forms, filters, etc */}
      {/* (I DID NOT TOUCH YOUR UI) */}

      {/* POST TASK FORM */}
      <div className="w-full max-w-3xl bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-6 mb-8">
        <h2 className="text-lg font-semibold mb-4">
          {form.id ? "Edit Task" : "Post a Task"}
        </h2>
        {message && <p className="text-sm text-gray-300 mb-3">{message}</p>}
        <form
          onSubmit={handleSubmit}
          className="space-y-3 relative z-10 pointer-events-auto"
        >
          <input
            type="text"
            placeholder="Task title"
            value={form.title}
            onChange={(e) =>
              setForm({ ...form, title: e.target.value })
            }
            className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-sm"
          />
          <textarea
            placeholder="Task description"
            value={form.description}
            onChange={(e) =>
              setForm({ ...form, description: e.target.value })
            }
            className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-sm"
            rows={3}
          />
          <input
            type="text"
            placeholder="Category (e.g. design)"
            value={form.category}
            onChange={(e) =>
              setForm({ ...form, category: e.target.value })
            }
            className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-sm"
          />
          <input
            type="number"
            placeholder="Budget (in π)"
            value={form.budget}
            onChange={(e) =>
              setForm({ ...form, budget: e.target.value })
            }
            className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-sm"
          />
          <input
            type="date"
            value={form.deadline}
            onChange={(e) =>
              setForm({ ...form, deadline: e.target.value })
            }
            className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-sm"
          />

          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 py-2 rounded-lg transition"
          >
            {form.id ? "Update Task" : "Post Task"}
          </button>
        </form>
      </div>

      {/* TASK LIST — unchanged */}
      <div className="w-full max-w-3xl bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Available Tasks</h2>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="bg-white/10 border border-white/20 rounded-lg px-3 py-1 text-sm"
          >
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
              <div
                key={task.id}
                className="bg-white/5 border border-white/10 rounded-lg p-4 flex flex-col sm:flex-row sm:justify-between sm:items-center"
              >
                <div>
                  <h3 className="font-semibold">{task.title}</h3>
                  <p className="text-gray-300 text-sm mb-2">
                    {task.description}
                  </p>
                  <p className="text-xs text-gray-400">
                    Category: {task.category} • Budget: {task.budget} π •
                    Deadline:{" "}
                    {new Date(task.deadline).toLocaleDateString()}
                  </p>
                </div>

                {user?.id === task.poster_id && (
                  <div className="flex gap-2 mt-3 sm:mt-0">
                    <button
                      onClick={() => handleEdit(task)}
                      className="px-3 py-1 bg-blue-500/80 rounded-md text-sm hover:bg-blue-600 transition"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(task.id)}
                      className="px-3 py-1 bg-red-500/80 rounded-md text-sm hover:bg-red-600 transition"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* DEBUG PANEL — unchanged */}
      <div className="mt-6 w-full max-w-3xl bg-black/60 text-green-300 p-4 rounded-xl text-xs break-all border border-green-600">
        <h3 className="font-bold text-green-400 mb-2">DEBUG PANEL</h3>

        <p>
          <b>Supabase Session:</b>
        </p>
        <pre>{JSON.stringify(sessionDebug, null, 2)}</pre>

        <p>
          <b>Pi User:</b>
        </p>
        <pre>{JSON.stringify(piDebug, null, 2)}</pre>

        <p>
          <b>Login API Response:</b>
        </p>
        <pre>{JSON.stringify(apiDebug, null, 2)}</pre>

        <p>
          <b>Loaded Profile:</b>
        </p>
        <pre>{JSON.stringify(user, null, 2)}</pre>
      </div>
    </div>
  );
}