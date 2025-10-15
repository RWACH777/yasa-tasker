"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useUser } from "@/context/UserContext";

export default function Dashboard() {
  const { user } = useUser();
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", category: "" });
  const [showForm, setShowForm] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [activeTab, setActiveTab] = useState("tasks");
  const [notifications, setNotifications] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    fetchTasks();
    fetchProfile();
  }, []);

  async function fetchTasks() {
    try {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTasks(data || []);
    } catch (e: any) {
      console.error("Error loading tasks:", e);
      setErrorMsg(e.message);
    }
  }

  async function fetchProfile() {
    if (!user?.uid) return;
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.uid)
        .single();

      if (error && error.code !== "PGRST116") throw error;
      setProfile(data || { username: user.username, id: user.uid });
    } catch (e: any) {
      console.error("Error loading profile:", e);
    }
  }

  async function postTask(e: any) {
    e.preventDefault();
    if (!form.title || !form.description) {
      setErrorMsg("Please fill in all fields");
      return;
    }
    if (!user?.uid) {
      setErrorMsg("User not authenticated");
      return;
    }
    setLoading(true);
    setErrorMsg("");

    try {
      const { error } = await supabase.from("tasks").insert([
        {
          poster_id: user.uid,
          title: form.title,
          description: form.description,
          category: form.category,
        },
      ]);

      if (error) throw error;

      setForm({ title: "", description: "", category: "" });
      setShowForm(false);
      await fetchTasks();
    } catch (e: any) {
      console.error("Task posting error:", e);
      setErrorMsg(e.message || "Failed to post. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleApply(task: any) {
    alert("Applied to task: " + task.title);
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-200 p-4">
      <h1 className="text-2xl font-semibold mb-4">Yasa Tasker Dashboard</h1>

      {/* --- Navigation Tabs --- */}
      <div className="flex space-x-4 border-b border-gray-700 mb-4">
        <button
          onClick={() => setActiveTab("tasks")}
          className={pb-2 ${activeTab === "tasks" ? "border-b-2 border-blue-500 text-blue-400" : ""}}
        >
          Tasks
        </button>
        <button
          onClick={() => setActiveTab("notifications")}
          className={pb-2 ${activeTab === "notifications" ? "border-b-2 border-blue-500 text-blue-400" : ""}}
        >
          Notifications
        </button>
        <button
          onClick={() => setActiveTab("profile")}
          className={pb-2 ${activeTab === "profile" ? "border-b-2 border-blue-500 text-blue-400" : ""}}
        >
          Profile
        </button>
      </div>

      {/* --- TASKS TAB --- */}
      {activeTab === "tasks" && (
        <div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-blue-600 px-4 py-2 rounded mb-4 hover:bg-blue-700"
          >
            {showForm ? "Close Form" : "Post a New Task"}
          </button>

          {showForm && (
            <form
              onSubmit={postTask}
              className="bg-gray-900 p-4 rounded-lg shadow-lg mb-6"
            >
              <input
                type="text"
                placeholder="Title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full mb-2 p-2 rounded bg-gray-800 border border-gray-700"
              />
              <textarea
                placeholder="Description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full mb-2 p-2 rounded bg-gray-800 border border-gray-700"
              />
              <input
                type="text"
                placeholder="Category"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full mb-3 p-2 rounded bg-gray-800 border border-gray-700"
              />
              <button
                type="submit"
                disabled={loading}
                className="bg-green-600 px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
              >
                {loading ? "Posting..." : "Post Task"}
              </button>
            </form>
          )}

          {errorMsg && (
            <div className="text-red-400 bg-gray-800 p-2 rounded mb-3">
              {errorMsg}
            </div>
          )}

          <div className="space-y-3">
            {tasks.map((t) => (
              <div
                key={t.id}
                className="bg-gray-900 p-4 rounded-lg shadow-md flex justify-between items-center"
              >
                <div>
                  <h2 className="font-semibold text-lg">{t.title}</h2>
                  <p className="text-gray-400">{t.description}</p>
                  <p className="text-sm text-gray-500 mt-1">Category: {t.category || "N/A"}</p>
                </div>
                <button
                  onClick={() => handleApply(t)}
                  className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                >
                  Apply
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --- NOTIFICATIONS TAB --- */}
      {activeTab === "notifications" && (
        <div className="bg-gray-900 p-4 rounded-lg">
          <h2 className="text-lg font-semibold mb-3">Notifications</h2>
          {notifications.length === 0 ? (
            <p className="text-gray-400">No new notifications</p>
          ) : (
            notifications.map((n, i) => (
              <div key={i} className="p-2 border-b border-gray-700">
                {n.message}
              </div>
            ))
          )}
        </div>
      )}

      {/* --- PROFILE TAB --- */}
      {activeTab === "profile" && (
        <div className="bg-gray-900 p-4 rounded-lg">
          <h2 className="text-lg font-semibold mb-3">Your Profile</h2>
          {profile ? (
            <div>
              <p><strong>Username:</strong> {profile.username}</p>
              <p><strong>ID:</strong> {profile.id}</p>
            </div>
          ) : (
            <p className="text-gray-400">No profile found.</p>
          )}
        </div>
      )}
    </div>
  );
}