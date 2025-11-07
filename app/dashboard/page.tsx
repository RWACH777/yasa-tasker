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

  // ✅ Authenticate via Pi + Supabase
  useEffect(() => {
    const initUser = async () => {
      try {
        const { data: authData } = await supabase.auth.getUser();

        if (!authData?.user) {
          // Try existing Pi session if not signed in
          const pi = (window as any).Pi;
          if (pi) {
            const scopes = ["username", "payments"];
            const authResult = await pi.authenticate(scopes, () => {});
            const piUser = authResult.user;

            const res = await fetch("/api/login", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                username: piUser.username,
                pi_uid: piUser.uid,
              }),
            });

alert("Login API response: " + JSON.stringify(data));

            const result = await res.json();
            if (!result.success) throw new Error(result.error || "Login failed");
          }
        }

        // Fetch current user profile
        const { data: currentUser } = await supabase.auth.getUser();
        if (currentUser?.user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", currentUser.user.id)
            .single();
          setUser(profile);
        }
      } catch (err) {
        console.error("Auth error:", err);
      } finally {
        setLoading(false);
      }
    };

    initUser();
  }, []);

  // ✅ Fetch tasks
  useEffect(() => {
    if (!user) return;
    fetchTasks();
  }, [user]);

  const fetchTasks = async () => {
    const query = supabase.from("tasks").select("*").order("created_at", { ascending: false });
    if (filter !== "all") query.eq("category", filter);
    const { data, error } = await query;
    if (error) console.error("Error fetching tasks:", error);
    else setTasks(data || []);
  };

  // ✅ Handle task creation
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

    const taskData = {
      poster_id: user.id,
      title: form.title,
      description: form.description,
      category: form.category,
      budget: parseFloat(form.budget),
      deadline: form.deadline,
      status: "open",
      updated_at: new Date().toISOString(),
    };

    const { error } = form.id
      ? await supabase.from("tasks").update(taskData).eq("id", form.id)
      : await supabase.from("tasks").insert([taskData]);

    if (error) {
      console.error("Task save error:", error);
      setMessage("❌ Failed to save task.");
    } else {
      setMessage("✅ Task posted successfully!");
      setForm({ id: "", title: "", description: "", category: "", budget: "", deadline: "" });
      fetchTasks();
    }
  };

  // ✅ Handle edit
  const handleEdit = (task: Task) => {
    setForm({
      id: task.id,
      title: task.title,
      description: task.description,
      category: task.category,
      budget: task.budget.toString(),
      deadline: task.deadline.split("T")[0],
    });
    setMessage("Editing task...");
  };

  // ✅ Handle delete
  const handleDelete = async (id: string) => {
    if (!confirm("Delete this task?")) return;
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) setMessage("❌ Failed to delete task.");
    else {
      setMessage("🗑 Task deleted.");
      fetchTasks();
    }
  };

  // ✅ Category filter list
  const categories = [
    "all",
    "design",
    "writing",
    "development",
    "marketing",
    "translation",
    "other",
  ];

  return (
    <div className="min-h-screen bg-[#000222] text-white flex flex-col items-center px-4 py-10">
      {/* ✅ USER PROFILE SECTION */}
      <div className="w-full max-w-3xl bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-6 text-center mb-8">
        {loading ? (
          <p>Loading profile...</p>
        ) : user ? (
          <>
            <div className="flex flex-col items-center space-y-2">
              <img
                src={
                  user.avatar_url ||
                  "https://api.dicebear.com/8.x/thumbs/svg?seed=" + user.username
                }
                alt="Avatar"
                className="w-20 h-20 rounded-full border border-white/30"
              />
              <h2 className="text-xl font-semibold">{user.username}</h2>
              <p className="text-sm text-gray-300">
                ⭐️ {user.rating || "New User"} • {user.completed_tasks || 0} Tasks Completed
              </p>
            </div>
          </>
        ) : (
          <p>⚠️ Please log in with Pi to view your profile.</p>
        )}
      </div>

      {/* ✅ POST TASK FORM */}
      <div className="w-full max-w-3xl bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-6 mb-8">
        <h2 className="text-lg font-semibold mb-4">{form.id ? "Edit Task" : "Post a Task"}</h2>
        {message && <p className="text-sm text-gray-300 mb-3">{message}</p>}

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            placeholder="Task title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-sm"
          />
          <textarea
            placeholder="Task description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-sm"
            rows={3}
          />
          <input
            type="text"
            placeholder="Category (e.g. design)"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-sm"
          />
          <input
            type="number"
            placeholder="Budget (in π)"
            value={form.budget}
            onChange={(e) => setForm({ ...form, budget: e.target.value })}
            className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-sm"
          />
          <input
            type="date"
            value={form.deadline}
            onChange={(e) => setForm({ ...form, deadline: e.target.value })}
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

      {/* ✅ FILTER + TASK FEED */}
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
                  <p className="text-gray-300 text-sm mb-2">{task.description}</p>
                  <p className="text-xs text-gray-400">
                    Category: {task.category} • Budget: {task.budget} π • Deadline:{" "}
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
    </div>
  );
}