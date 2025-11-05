"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabaseClient"
import { mockPiAuthenticate } from "@/lib/piAuth"

interface Task {
  id: string
  poster_id: string
  title: string
  description: string
  category: string
  budget: number
  deadline: string
  status: string
  created_at: string
  updated_at: string
}

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [form, setForm] = useState({
    id: "",
    title: "",
    description: "",
    category: "",
    budget: "",
    deadline: "",
  })
  const [message, setMessage] = useState("")
  const [loading, setLoading] = useState(true)

  // ✅ Authenticate Pi user and sync with Supabase
  useEffect(() => {
    const initUser = async () => {
      try {
        const { data: existing } = await supabase.auth.getUser()

        if (!existing.user) {
          const piUser = await mockPiAuthenticate()
          const { data: sessionData, error: loginError } = await supabase.auth.signInAnonymously()
          if (loginError) console.error("Supabase login error:", loginError)
          setUser({ ...piUser, id: sessionData.user?.id })
        } else {
          setUser(existing.user)
        }
      } catch (err) {
        console.error("Auth init error:", err)
      } finally {
        setLoading(false)
      }
    }

    initUser()
  }, [])

  // ✅ Fetch tasks
  useEffect(() => {
    if (!user) return
    fetchTasks()
  }, [user])

  const fetchTasks = async () => {
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .order("created_at", { ascending: false })
    if (error) console.error("Error fetching tasks:", error)
    else setTasks(data || [])
  }

  // ✅ Handle form submit (create or edit)
  const handleSubmit = async (e: any) => {
    e.preventDefault()

    if (!user) {
      setMessage("⚠️ You must be logged in to post a task.")
      return
    }

    if (!form.title || !form.description || !form.category || !form.budget || !form.deadline) {
      setMessage("⚠️ Please fill in all required fields.")
      return
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
    }

    const { error } = form.id
      ? await supabase.from("tasks").update(taskData).eq("id", form.id)
      : await supabase.from("tasks").insert([taskData])

    if (error) {
      console.error("Task submit error:", error)
      setMessage("❌ Failed to save task.")
    } else {
      setMessage("✅ Task saved successfully.")
      setForm({ id: "", title: "", description: "", category: "", budget: "", deadline: "" })
      fetchTasks()
    }
  }

  // ✅ Edit existing task
  const handleEdit = (task: Task) => {
    setForm({
      id: task.id,
      title: task.title,
      description: task.description,
      category: task.category,
      budget: task.budget.toString(),
      deadline: task.deadline.split("T")[0],
    })
    setMessage("Editing task...")
  }

  // ✅ Delete task
  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this task?")) return
    const { error } = await supabase.from("tasks").delete().eq("id", id)
    if (error) {
      console.error("Delete error:", error)
      setMessage("❌ Failed to delete task.")
    } else {
      setMessage("🗑 Task deleted.")
      fetchTasks()
    }
  }

  return (
    <div className="min-h-screen bg-[#000222] text-white flex flex-col items-center px-4 py-10">
      {/* Header */}
      <div className="w-full max-w-3xl bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-6 text-center mb-10">
        <h1 className="text-2xl font-semibold">
          {loading
  ? "Loading..."
  : user
  ? `Welcome to YASA Tasker, ${user.username || "Pi User"}!`
  : "Welcome to YASA Tasker!"}
        </h1>
      </div>

      {/* Task Form */}
      <div className="w-full max-w-3xl bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-6 mb-8">
        <h2 className="text-lg font-semibold mb-4">{form.id ? "Edit Task" : "Post a New Task"}</h2>
        {message && <p className="text-sm text-gray-300 mb-3">{message}</p>}

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            placeholder="Task title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-400"
          />
          <textarea
            placeholder="Task description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-400"
            rows={3}
          />
          <input
            type="text"
            placeholder="Category"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-400"
          />
          <input
            type="number"
            placeholder="Budget (in Pi)"
            value={form.budget}
            onChange={(e) => setForm({ ...form, budget: e.target.value })}
            className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-400"
          />
          <input
            type="date"
            value={form.deadline}
            onChange={(e) => setForm({ ...form, deadline: e.target.value })}
            className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-400"
          />

          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-lg transition"
          >
            {form.id ? "Update Task" : "Post Task"}
          </button>
        </form>
      </div>

      {/* Task Feed */}
      <div className="w-full max-w-3xl bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-6">
        <h2 className="text-lg font-semibold mb-4">Available Tasks</h2>
        {tasks.length === 0 ? (
          <p className="text-gray-400 text-sm">No tasks yet. Post one above!</p>
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
  )
}