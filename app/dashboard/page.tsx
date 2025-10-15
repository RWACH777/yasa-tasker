"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useUser } from "@/context/UserContext";

export default function DashboardPage() {
  const { user } = useUser();
  const [activeTab, setActiveTab] = useState("tasks");
  const [tasks, setTasks] = useState<any[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  // Fetch tasks for the logged-in user
  useEffect(() => {
    if (!user) return;
    fetchTasks();
  }, [user]);

  async function fetchTasks() {
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("poster_id", user?.id)
      .order("created_at", { ascending: false });
    if (error) console.error("Fetch error:", error.message);
    else setTasks(data || []);
  }

  // Create a new task
  async function handlePostTask(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return alert("You must be logged in.");

    setLoading(true);
    const { error } = await supabase.from("tasks").insert([
      {
        poster_id: user.id,
        title,
        description,
      },
    ]);
    setLoading(false);

    if (error) {
      alert("Failed to post task: " + error.message);
    } else {
      alert("Task posted successfully!");
      setTitle("");
      setDescription("");
      fetchTasks();
    }
  }

  return (
    <div className="p-4 text-gray-100">
      {/* --- DASHBOARD NAV TABS --- */}
      <div className="flex space-x-4 border-b border-gray-700 mb-4">
        {["tasks", "applications", "messages", "profile"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-2 capitalize ${
              activeTab === tab
                ? "border-b-2 border-blue-500 text-blue-400"
                : ""
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* --- TASKS TAB --- */}
      {activeTab === "tasks" && (
        <div>
          <form
            onSubmit={handlePostTask}
            className="space-y-3 bg-gray-800 p-4 rounded-2xl mb-6"
          >
            <input
              type="text"
              placeholder="Task title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full p-2 rounded bg-gray-900 border border-gray-700"
              required
            />
            <textarea
              placeholder="Task description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-2 rounded bg-gray-900 border border-gray-700"
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 p-2 rounded-xl"
            >
              {loading ? "Posting..." : "Post Task"}
            </button>
          </form>

          <div className="space-y-3">
            {tasks.length === 0 ? (
              <p className="text-gray-400 text-center">
                No tasks yet. Create one above.
              </p>
            ) : (
              tasks.map((task) => (
                <div
                  key={task.id}
                  className="bg-gray-800 p-3 rounded-xl border border-gray-700"
                >
                  <h3 className="font-semibold text-lg text-blue-400">
                    {task.title}
                  </h3>
                  <p className="text-gray-300">{task.description}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* --- APPLICATIONS TAB --- */}
      {activeTab === "applications" && (
        <div className="p-4 text-gray-400">Applications will appear here.</div>
      )}

      {/* --- MESSAGES TAB --- */}
      {activeTab === "messages" && (
        <div className="p-4 text-gray-400">Messages feature coming soon.</div>
      )}

      {/* --- PROFILE TAB --- */}
      {activeTab === "profile" && (
        <div className="p-4 bg-gray-800 rounded-2xl">
          <h2 className="text-xl font-semibold mb-2 text-blue-400">
            User Profile
          </h2>
          {user ? (
            <div>
              <p>
                <span className="font-semibold">UID:</span> {user.id}
              </p>
              <p>
                <span className="font-semibold">Email:</span>{" "}
                {user.email || "N/A"}
              </p>
            </div>
          ) : (
            <p>Loading user info...</p>
          )}
        </div>
      )}
    </div>
  );
}