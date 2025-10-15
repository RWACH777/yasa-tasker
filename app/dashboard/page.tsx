"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useUser } from "@/context/UserContext";

export default function DashboardPage() {
  const { user } = useUser();
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [activeTab, setActiveTab] = useState("tasks");
  const [alert, setAlert] = useState<{ type: string; message: string } | null>(
    null
  );

  // Load all tasks from Supabase
  const fetchTasks = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setAlert({ type: "error", message: "Failed to load tasks." });
    } else {
      setTasks(data || []);
    }
    setLoading(false);
  };

  // Create a new task
  const handlePostTask = async () => {
    if (!title.trim() || !description.trim()) {
      setAlert({ type: "error", message: "Please fill in all fields." });
      return;
    }
    if (!user) {
      setAlert({ type: "error", message: "You must be logged in." });
      return;
    }

    const { error } = await supabase.from("tasks").insert([
      {
        poster_id: user.id,
        title,
        description,
      },
    ]);

    if (error) {
      console.error(error);
      setAlert({
        type: "error",
        message: error.message || "Error posting task.",
      });
    } else {
      setAlert({ type: "success", message: "✅ Task posted successfully!" });
      setTitle("");
      setDescription("");
      fetchTasks();
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [user]);

  return (
    <div className="p-6 bg-gray-950 min-h-screen text-gray-100">
      <h1 className="text-2xl font-bold mb-6 text-center text-blue-400">
        Dashboard
      </h1>

      {/* Alert Message */}
      {alert && (
        <div
          className={`mb-4 text-center p-3 rounded-lg ${
            alert.type === "error"
              ? "bg-red-900 text-red-200"
              : "bg-green-900 text-green-200"
          }`}
        >
          {alert.message}
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="flex justify-center space-x-6 border-b border-gray-700 mb-6">
        <button
          onClick={() => setActiveTab("tasks")}
          className={`pb-2 ${
            activeTab === "tasks"
              ? "border-b-2 border-blue-500 text-blue-400"
              : "text-gray-400"
          }`}
        >
          Tasks
        </button>
        <button
          onClick={() => setActiveTab("post")}
          className={`pb-2 ${
            activeTab === "post"
              ? "border-b-2 border-blue-500 text-blue-400"
              : "text-gray-400"
          }`}
        >
          Post a Task
        </button>
      </div>

      {/* --- TASKS TAB --- */}
      {activeTab === "tasks" && (
        <div>
          {loading ? (
            <p className="text-center text-gray-400">Loading tasks...</p>
          ) : tasks.length === 0 ? (
            <p className="text-center text-gray-400">No tasks available yet.</p>
          ) : (
            <div className="grid gap-4">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className="p-4 bg-gray-900 rounded-xl shadow border border-gray-800 hover:border-blue-500 transition"
                >
                  <h2 className="text-lg font-semibold text-blue-400">
                    {task.title}
                  </h2>
                  <p className="text-gray-300 mt-2">{task.description}</p>
                  <p className="text-xs text-gray-500 mt-3">
                    Posted by: {task.poster_id}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* --- POST TASK TAB --- */}
      {activeTab === "post" && (
        <div className="max-w-md mx-auto bg-gray-900 p-6 rounded-xl shadow border border-gray-800">
          <h2 className="text-lg font-semibold mb-4 text-blue-400">
            Post a New Task
          </h2>
          <input
            type="text"
            placeholder="Task title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full mb-3 p-2 rounded bg-gray-800 text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <textarea
            placeholder="Task description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full mb-3 p-2 rounded bg-gray-800 text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={4}
          />
          <button
            onClick={handlePostTask}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg"
          >
            Post Task
          </button>
        </div>
      )}
    </div>
  );
}