"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useUser } from "@/context/UserContext";

export default function DashboardPage() {
  const { user } = useUser();
  const [tasks, setTasks] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState("all");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  const [notifications, setNotifications] = useState<string[]>([]);

  // Load tasks
  useEffect(() => {
    loadTasks();
  }, [activeTab]);

  const loadTasks = async () => {
    let query = supabase.from("tasks").select("*").order("created_at", { ascending: false });

    if (activeTab !== "all") query = query.eq("status", activeTab);

    const { data, error } = await query;
    if (error) console.error("Error loading tasks:", error.message);
    else setTasks(data || []);
  };

  // Ensure user row in profile table
  const ensureUserRow = async (uid: string, username: string | null) => {
    const { data, error } = await supabase.from("profiles").select("*").eq("id", uid).single();

    if (!data && !error) {
      await supabase.from("profiles").insert([{ id: uid, username }]);
    }
  };

  // Post a new task
  const postTask = async () => {
    if (!user) return alert("Login with Pi to post");
    const uid = user?.id;
    if (!uid) return alert("Login with Pi to post");

    setIsPosting(true);
    const username =
      user?.username  JSON.parse(localStorage.getItem("piUser")  "{}").username || null;

    await ensureUserRow(uid, username);

    const { data, error } = await supabase.from("tasks").insert([
      {
        poster_id: uid,
        title,
        category,
        description,
        status: "pending",
      },
    ]).select().single();

    if (error) alert("Error posting task: " + error.message);
    else {
      setTasks((prev) => [data, ...prev]);
      setNotifications((n) => [Task posted: ${data.title}, ...n]);
      setTitle("");
      setCategory("");
      setDescription("");
    }

    setIsPosting(false);
  };

  return (
    <div className="min-h-screen bg-[#050827] text-white p-6">
      <h1 className="text-3xl font-bold mb-6">My Tasks</h1>

      {/* --- DASHBOARD NAV TABS --- */}
      <div className="flex space-x-4 border-b border-gray-700 mb-4">
        {["all", "pending", "in progress", "completed"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-2 capitalize ${
              activeTab === tab
                ? "border-b-2 border-blue-500 text-blue-400"
                : "text-gray-400 hover:text-blue-300"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* --- TASK FORM (Glass Card) --- */}
      <div className="bg-white/5 backdrop-blur-md rounded-2xl shadow-lg p-6 mb-6 border border-white/10 max-w-md">
        <input
          type="text"
          placeholder="Task title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full mb-3 bg-transparent border border-white/20 rounded-lg p-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-400"
        />

        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full mb-3 bg-transparent border border-white/20 rounded-lg p-2 text-white focus:outline-none focus:border-blue-400"
        >
          <option value="" disabled className="text-gray-400 bg-[#050827]">
            Category
          </option>
          <option value="design" className="bg-[#050827]">Design</option>
          <option value="development" className="bg-[#050827]">Development</option>
          <option value="testing" className="bg-[#050827]">Testing</option>
        </select>

        <textarea
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full mb-3 bg-transparent border border-white/20 rounded-lg p-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-400"
          rows={3}
        />

        <button
          onClick={postTask}
          disabled={isPosting}
          className={w-full py-2 rounded-lg font-semibold ${
            isPosting ? "bg-blue-400/50 cursor-wait" : "bg-blue-600 hover:bg-blue-700"
          } transition}
        >
          {isPosting ? "Posting..." : "Add Task"}
        </button>
      </div>

      {/* --- TASK LIST --- */}
      <div className="space-y-3">
        {tasks.length === 0 && (
          <p className="text-gray-400 text-sm">No tasks yet. Add your first one!</p>
        )}
        {tasks.map((task) => (
          <div
            key={task.id}
            className="bg-white/5 backdrop-blur-md border border-white/10 rounded-xl p-4 flex flex-col"
          >
            <div className="flex justify-between items-center mb-1">
              <h3 className="font-semibold text-lg">{task.title}</h3>
              <span
                className={`text-xs capitalize px-2 py-1 rounded ${
                  task.status === "completed"
                    ? "bg-green-500/20 text-green-300"
                    : task.status === "in progress"
                    ? "bg-yellow-500/20 text-yellow-300"
                    : "bg-blue-500/20 text-blue-300"
                }`}
              >
                {task.status}
              </span>
            </div>
            <p className="text-gray-400 text-sm mb-2">{task.description}</p>
            <span className="text-xs text-gray-500">{task.category || "General"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}