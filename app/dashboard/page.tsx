"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
  freelancer_username?: string;
  rating?: number;
  completed_tasks?: number;
}

export default function DashboardPage() {
  const router = useRouter();
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

  const [freelancerUsername, setFreelancerUsername] = useState("");

  // New state for features
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileTasks, setProfileTasks] = useState({ active: [], pending: [], completed: [] });
  const [userApplications, setUserApplications] = useState<any[]>([]);

  const handleContactTasker = async (task: Task) => {
    if (!user?.id) {
      setMessage("⚠️ You must be logged in to contact a tasker.");
      return;
    }

    if (!task.poster_id) {
      setMessage("⚠️ Unable to contact tasker. Please try again.");
      return;
    }

    router.push("/messages?user=" + task.poster_id);
  };

  // 🔥 FIXED: Load profile
  const loadProfile = async (authUserId: string | null) => {
    if (!authUserId) return;
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", authUserId)
      .single();

    if (!error) {
      setUser(data);
      setLoading(false);
    }
  };

  // 🔥 FIXED — prevents double login & ensures correct session flow + session persistence on refresh
  useEffect(() => {
    const init = async () => {
      setLoading(true);

      // 1️⃣ Check Supabase session first
      const { data } = await supabase.auth.getSession();

      if (data.session?.user) {
        await loadProfile(data.session.user.id);
        return;
      }

      // 2️⃣ Localhost → use fake Pi user but still call API
      const isLocal = window.location.hostname === "localhost";
      let piUser;

      if (isLocal) {
        console.log("🔧 Local mode: Using fake Pi user");
        piUser = {
          uid: "local_user_123",
          username: "LocalUser",
        };
      } else {
        // 3️⃣ PRODUCTION → use real Pi SDK
        const pi = (window as any).Pi;
        if (!pi) {
          setMessage("Pi SDK not found");
          setLoading(false);
          return;
        }

        const authResult = await pi.authenticate(["username"], (p) => p);
        piUser = authResult.user;
      }

      // 4️⃣ Exchange tokens via API (works for both localhost and production)
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: piUser.username,
          pi_uid: piUser.uid,
        }),
      });

      const json = await res.json();

      if (!json.success) {
        setMessage("Login error: " + json.error);
        setLoading(false);
        return;
      }

      // 5️⃣ Save session with proper format
      console.log("🔐 Setting session with tokens:", {
        access_token: json.access_token?.substring(0, 20) + "...",
        refresh_token: json.refresh_token?.substring(0, 20) + "...",
      });

      const { error: setErr } = await supabase.auth.setSession({
        access_token: json.access_token,
        refresh_token: json.refresh_token,
      });

      if (setErr) {
        console.error("❌ Session error:", setErr);
        console.error("Full error details:", JSON.stringify(setErr));
        setMessage("Session error: " + setErr.message);
        setLoading(false);
        return;
      }

      console.log("✅ Session set successfully");

      // 6️⃣ Wait a moment for session to persist, then load profile
      await new Promise((resolve) => setTimeout(resolve, 500));
      await loadProfile(json.user.id);
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

    // Generate UUID for new tasks
    const generateUUID = () => {
      return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    };

    const taskData = {
      id: form.id || generateUUID(), // Generate UUID if new task
      poster_id: user.id,
      title: form.title,
      description: form.description,
      category: form.category,
      budget: parseFloat(form.budget),
      deadline: deadlineIso,
      status: "open",
      updated_at: new Date().toISOString(),
    };

    console.log("📝 Submitting task with data:", taskData);
    console.log("👤 Current user ID:", user.id);

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
      console.error("❌ Task save error:", result.error);
      console.error("Full error details:", JSON.stringify(result.error, null, 2));
      setMessage(
        "❌ Failed to save task: " +
          (result.error.message || result.error.code || JSON.stringify(result.error))
      );
      return;
    }

    console.log("✅ Task saved successfully:", result.data);
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

  // Load profile tasks and applications
  const loadProfileTasks = async () => {
    if (!user?.id) return;

    // Load user's posted tasks grouped by status
    const { data: tasks } = await supabase
      .from("tasks")
      .select("*")
      .eq("poster_id", user.id);

    if (tasks) {
      const active = tasks.filter((t) => t.status === "active");
      const pending = tasks.filter((t) => t.status === "open");
      const completed = tasks.filter((t) => t.status === "completed");
      setProfileTasks({ active, pending, completed });
    }

    // Load applications for user's tasks
    const { data: apps } = await supabase
      .from("applications")
      .select("*")
      .eq("applicant_id", user.id);

    if (apps) setUserApplications(apps);
  };

  // Apply to a task
  const handleApplyToTask = async (taskId: string) => {
    if (!user?.id) {
      setMessage("⚠️ You must be logged in to apply.");
      return;
    }

    // Generate UUID for applications
    const generateUUID = () => {
      return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    };

    const { error } = await supabase.from("applications").insert([
      {
        id: generateUUID(),
        task_id: taskId,
        applicant_id: user.id,
        status: "pending",
        created_at: new Date().toISOString(),
      },
    ]);

    if (error) {
      setMessage("❌ Failed to apply: " + error.message);
    } else {
      setMessage("✅ Applied to task!");
      loadProfileTasks();
    }
  };

  // Update freelancer username
  const handleUpdateFreelancerUsername = async () => {
    if (!user?.id || !freelancerUsername.trim()) {
      setMessage("⚠️ Please enter a valid freelancer username.");
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({ freelancer_username: freelancerUsername })
      .eq("id", user.id);

    if (error) {
      setMessage("❌ Failed to update username: " + error.message);
    } else {
      setUser({ ...user, freelancer_username: freelancerUsername });
      setFreelancerUsername("");
      setMessage("✅ Freelancer username updated!");
    }
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
      {/* Navigation Bar */}
      <div className="w-full max-w-3xl mb-4 flex justify-end gap-3">
        <a
          href="/messages"
          className="px-4 py-2 bg-purple-600/80 hover:bg-purple-700 rounded-lg transition text-sm"
        >
          💬 Messages
        </a>
      </div>
      <div
        onClick={() => {
          if (user?.id) {
            loadProfileTasks();
            setShowProfileModal(true);
          }
        }}
        className="w-full max-w-3xl bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-6 text-center mb-6 cursor-pointer hover:bg-white/20 transition"
      >
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
              ⭐️ {user.rating || 0} • {user.completed_tasks || 0} Tasks Completed
            </p>
            <p className="text-xs text-gray-400">Click to view profile details</p>
          </div>
        ) : (
          <p>⚠️ Please log in with Pi to view your profile.</p>
        )}
      </div>

      {/* PROFILE MODAL */}
      {showProfileModal && user && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-2xl bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">{user.username}'s Profile</h2>
              <button
                onClick={() => setShowProfileModal(false)}
                className="text-gray-400 hover:text-white text-2xl"
              >
                ✕
              </button>
            </div>

            {/* Avatar Section */}
            <div className="flex flex-col items-center mb-6 pb-6 border-b border-white/10">
              <img
                src={
                  user.avatar_url ||
                  `https://api.dicebear.com/8.x/thumbs/svg?seed=${user.username}`
                }
                alt="Avatar"
                className="w-24 h-24 rounded-full border border-white/30 mb-4"
              />
              <div className="flex flex-col gap-3 w-full">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Profile Picture URL</label>
                  <input
                    type="text"
                    placeholder="Enter image URL"
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm mb-2"
                    onBlur={(e) => {
                      const url = e.target.value.trim();
                      if (url) {
                        supabase
                          .from("profiles")
                          .update({ avatar_url: url })
                          .eq("id", user.id)
                          .then(({ error }) => {
                            if (!error) {
                              setUser({ ...user, avatar_url: url });
                              setMessage("✅ Profile picture updated!");
                            }
                          });
                      }
                    }}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Freelancer Username (what others see)</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Your freelancer username"
                      value={freelancerUsername || user.freelancer_username || ""}
                      onChange={(e) => setFreelancerUsername(e.target.value)}
                      className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm"
                    />
                    <button
                      onClick={handleUpdateFreelancerUsername}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition text-sm"
                    >
                      Update
                    </button>
                  </div>
                  {user.freelancer_username && (
                    <p className="text-xs text-green-400 mt-1">✓ Current: {user.freelancer_username}</p>
                  )}
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-3">⭐️ Rating: {user.rating || 0} • Completed: {user.completed_tasks || 0}</p>
            </div>

            {/* Tasks Sections */}
            <div className="space-y-6">
              {/* Active Tasks */}
              <div>
                <h3 className="text-lg font-semibold mb-3 text-green-400">Active Tasks ({profileTasks.active.length})</h3>
                {profileTasks.active.length === 0 ? (
                  <p className="text-gray-400 text-sm">No active tasks</p>
                ) : (
                  <div className="space-y-2">
                    {profileTasks.active.map((task) => (
                      <div key={task.id} className="bg-white/5 border border-white/10 rounded-lg p-3">
                        <p className="font-semibold text-sm">{task.title}</p>
                        <p className="text-xs text-gray-400">Budget: {task.budget} π</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Pending Tasks */}
              <div>
                <h3 className="text-lg font-semibold mb-3 text-yellow-400">Pending Tasks ({profileTasks.pending.length})</h3>
                {profileTasks.pending.length === 0 ? (
                  <p className="text-gray-400 text-sm">No pending tasks</p>
                ) : (
                  <div className="space-y-2">
                    {profileTasks.pending.map((task) => (
                      <div key={task.id} className="bg-white/5 border border-white/10 rounded-lg p-3">
                        <p className="font-semibold text-sm">{task.title}</p>
                        <p className="text-xs text-gray-400">Budget: {task.budget} π</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Completed Tasks */}
              <div>
                <h3 className="text-lg font-semibold mb-3 text-blue-400">Completed Tasks ({profileTasks.completed.length})</h3>
                {profileTasks.completed.length === 0 ? (
                  <p className="text-gray-400 text-sm">No completed tasks</p>
                ) : (
                  <div className="space-y-2">
                    {profileTasks.completed.map((task) => (
                      <div key={task.id} className="bg-white/5 border border-white/10 rounded-lg p-3">
                        <p className="font-semibold text-sm">{task.title}</p>
                        <p className="text-xs text-gray-400">Budget: {task.budget} π</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

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
          <select
            value={form.category}
            onChange={(e) =>
              setForm({ ...form, category: e.target.value })
            }
            className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-sm"
          >
            <option value="">Select a category</option>
            {categories.filter(cat => cat !== "all").map((cat) => (
              <option key={cat} value={cat}>
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </option>
            ))}
          </select>
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
                <div className="flex-1">
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

                <div className="flex gap-2 mt-3 sm:mt-0 flex-wrap sm:flex-nowrap">
                  {user?.id === task.poster_id ? (
                    <>
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
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => handleApplyToTask(task.id)}
                        className="px-3 py-1 bg-green-600/80 rounded-md text-sm hover:bg-green-700 transition"
                      >
                        Apply
                      </button>
                      <button
                        onClick={() => handleContactTasker(task)}
                        className="px-3 py-1 bg-purple-600/80 rounded-md text-sm hover:bg-purple-700 transition"
                      >
                        💬 Contact
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}