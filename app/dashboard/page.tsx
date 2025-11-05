"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabaseClient";

export default function DashboardPage() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [editingTask, setEditingTask] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [message, setMessage] = useState("");

  const [form, setForm] = useState({
    title: "",
    description: "",
    budget: "",
    deadline: "",
    category: "",
  });

  // Fetch user profile
  useEffect(() => {
    const fetchProfile = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("Profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();

      if (!error && data) {
        setProfile(data);
        fetchTasks(session.user.id);
      }

      setLoading(false);
    };

    fetchProfile();
  }, []);

  // Fetch all tasks (for the feed)
  const fetchTasks = async (userId: string) => {
    const { data, error } = await supabase
      .from("Tasks")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setTasks(data);
    }
  };

  // Handle input change
  const handleChange = (e: any) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // Handle post or edit
  const handleSubmit = async (e: any) => {
    e.preventDefault();
    if (!form.title || !form.description || !form.budget) {
      setMessage("Please fill in all required fields.");
      return;
    }

    setPosting(true);
    setMessage("");

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      setMessage("You must be logged in to post or edit tasks.");
      setPosting(false);
      return;
    }

    if (editingTask) {
      // Update existing task
      const { error } = await supabase
        .from("Tasks")
        .update({
          title: form.title,
          description: form.description,
          category: form.category,
          budget: parseFloat(form.budget),
          deadline: form.deadline,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editingTask.id)
        .eq("poster_id", session.user.id);

      if (error) {
        setMessage("Failed to update task.");
      } else {
        setMessage("✅ Task updated successfully!");
        setEditingTask(null);
        fetchTasks(session.user.id);
      }
    } else {
      // Post new task
      const { error } = await supabase.from("Tasks").insert([
        {
          title: form.title,
          description: form.description,
          category: form.category,
          budget: parseFloat(form.budget),
          deadline: form.deadline,
          status: "open",
          poster_id: session.user.id,
        },
      ]);

      if (error) {
        console.error(error);
        setMessage("Failed to post task.");
      } else {
        setMessage("✅ Task posted successfully!");
        fetchTasks(session.user.id);
      }
    }

    // Reset form
    setForm({
      title: "",
      description: "",
      budget: "",
      deadline: "",
      category: "",
    });

    setPosting(false);
  };

  // Handle edit
  const handleEdit = (task: any) => {
    setEditingTask(task);
    setForm({
      title: task.title,
      description: task.description,
      budget: task.budget,
      deadline: task.deadline,
      category: task.category,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Handle delete
  const handleDelete = async (taskId: string) => {
    if (!confirm("Are you sure you want to delete this task?")) return;

    const {
      data: { session },
    } = await supabase.auth.getSession();

    const { error } = await supabase
      .from("Tasks")
      .delete()
      .eq("id", taskId)
      .eq("poster_id", session.user.id);

    if (error) {
      setMessage("Failed to delete task.");
    } else {
      setMessage("🗑 Task deleted successfully!");
      fetchTasks(session.user.id);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#000222] via-[#01012A] to-[#000222] flex flex-col items-center text-white px-4 py-10">
      {/* Header */}
      <div className="w-full max-w-3xl flex justify-between items-center mb-10 bg-white/10 backdrop-blur-xl border border-white/10 rounded-2xl px-6 py-4">
        <div className="flex items-center gap-3">
          {profile?.avatar_url ? (
            <Image
              src={profile.avatar_url}
              alt="Avatar"
              width={40}
              height={40}
              className="rounded-full border border-white/20"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 border border-white/20" />
          )}
          <div>
            <h2 className="text-lg font-semibold">
              {loading
                ? "Loading..."
                : profile?.pi_username || "Anonymous User"}
            </h2>
            <p className="text-sm text-gray-300">Welcome to Yasa Tasker 👋</p>
          </div>
        </div>
      </div>

      {/* Post Task Section */}
      <div className="w-full max-w-3xl bg-white/10 backdrop-blur-xl border border-white/10 rounded-2xl p-6 mb-8">
        <h3 className="text-lg font-semibold mb-4">
          {editingTask ? "Edit Task" : "Post a New Task"}
        </h3>

        <form className="space-y-3" onSubmit={handleSubmit}>
          <input
            type="text"
            name="title"
            value={form.title}
            onChange={handleChange}
            placeholder="Task title"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-400"
          />

          <textarea
            name="description"
            value={form.description}
            onChange={handleChange}
            placeholder="Describe your task..."
            rows={3}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-400"
          />

          <div className="grid grid-cols-2 gap-3">
            <input
              type="number"
              name="budget"
              value={form.budget}
              onChange={handleChange}
              placeholder="Budget (in Pi)"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-400"
            />
            <input
              type="date"
              name="deadline"
              value={form.deadline}
              onChange={handleChange}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-400"
            />
          </div>

          <input
            type="text"
            name="category"
            value={form.category}
            onChange={handleChange}
            placeholder="Category (e.g., Design, Writing, Code)"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-400"
          />

          <button
            type="submit"
            disabled={posting}
            className="w-full bg-blue-600/80 hover:bg-blue-700 text-white font-medium py-2 rounded-lg transition disabled:opacity-50"
          >
            {posting
              ? editingTask
                ? "Updating..."
                : "Posting..."
              : editingTask
              ? "Save Changes"
              : "Post Task"}
          </button>
        </form>

        {message && (
          <p className="text-sm text-center mt-3 text-gray-300">{message}</p>
        )}
      </div>

      {/* Task Feed */}
      <div className="w-full max-w-3xl bg-white/10 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
        <h3 className="text-lg font-semibold mb-4">Available Tasks</h3>

        {tasks.length === 0 ? (
          <p className="text-gray-300 text-sm">
            No tasks available yet. Be the first to post!
          </p>
        ) : (
          <div className="space-y-4">
            {tasks.map((task) => (
              <div
                key={task.id}
                className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col gap-2"
              >
                <div className="flex justify-between items-center">
                  <h4 className="font-semibold text-base">{task.title}</h4>
                  <span className="text-xs text-gray-400">
                    {new Date(task.created_at).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-sm text-gray-300">{task.description}</p>
                <div className="text-xs text-gray-400">
                  Category: {task.category || "N/A"} • Budget: {task.budget} Pi
                </div>
                <div className="text-xs text-gray-400">
                  Deadline:{" "}
                  {task.deadline
                    ? new Date(task.deadline).toLocaleDateString()
                    : "N/A"}
                </div>

                {profile?.id === task.poster_id && (
                  <div className="flex gap-3 mt-2">
                    <button
                      onClick={() => handleEdit(task)}
                      className="text-xs bg-blue-600/70 hover:bg-blue-700 px-3 py-1 rounded-lg transition"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(task.id)}
                      className="text-xs bg-red-600/70 hover:bg-red-700 px-3 py-1 rounded-lg transition"
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