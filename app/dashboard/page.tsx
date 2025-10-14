// app/dashboard/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useUser } from "@/context/UserContext";
import { supabase } from "@/lib/supabaseClient";
import { initPiPayment } from "@/lib/piPayment";
import ChatModal from "@/components/ChatModals";
import { useRouter } from "next/navigation";

type Task = {
  id: string;
  poster_id: string | null;
  title: string;
  description?: string | null;
  category?: string | null;
  budget?: number | null;
  deadline?: string | null;
  status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  assigned_to?: string | null;
};

type Application = {
  id: string;
  task_id: string;
  applicant_id: string;
  cover_text?: string | null;
  proposed_budget?: number | null;
  status?: string | null;
  created_at?: string | null;
};

export default function DashboardPage() {
  const { user } = useUser();
  const router = useRouter();

  // local UI state
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [filter, setFilter] = useState<"All" | "Open" | "In Progress" | "Completed">("All");
  const [form, setForm] = useState({
    title: "",
    category: "",
    deadline: "",
    description: "",
    budget: "",
  });
  const [applicationsMap, setApplicationsMap] = useState<Record<string, Application[]>>({});
  const currentUserId = user?.uid ?? null;
  const currentUsername = user?.username ?? "You";

  // Redirect if not logged in (client side guard)
  useEffect(() => {
    if (user === null) {
      router.push("/login");
    }
  }, [user, router]);

  // Load tasks and applications from Supabase
  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      try {
        const { data: tasksData, error: tasksErr } = await supabase
          .from<Task>("tasks")
          .select("*")
          .order("created_at", { ascending: false });

        if (tasksErr) throw tasksErr;
        if (!mounted) return;

        setTasks(tasksData ?? []);

        // load applications for loaded tasks
        const taskIds = (tasksData || []).map((t) => t.id);
        if (taskIds.length > 0) {
          const { data: apps, error: appsErr } = await supabase
            .from<Application>("applications")
            .select("*")
            .in("task_id", taskIds);
          if (appsErr) throw appsErr;

          const map: Record<string, Application[]> = {};
          (apps || []).forEach((a) => {
            map[a.task_id] = map[a.task_id] || [];
            map[a.task_id].push(a);
          });
          setApplicationsMap(map);
        } else {
          setApplicationsMap({});
        }
      } catch (err) {
        console.error("Failed to load tasks", err);
      } finally {
        setLoading(false);
      }
    };

    load();

    // real-time subscription for tasks
    const channel = supabase
      .channel("public:tasks")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks" },
        (payload) => {
          // small sync: refresh tasks list on any change
          load();
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  // Helpers
  const clearForm = () =>
    setForm({ title: "", category: "", deadline: "", description: "", budget: "" });

  // Create/post a task (with Pi payment step)
  const handlePostTask = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!currentUserId) {
      alert("You must be signed in to post a task.");
      return;
    }

    const title = form.title.trim();
    const deadline = form.deadline.trim();

    if (!title || !deadline) {
      alert("Please add required fields (title + deadline).");
      return;
    }

    setPosting(true);
    try {
      // ask for a small posting fee in Pi (example). If you already have internal pricing, change amount.
      // NOTE: the string below is a template literal; if pasting causes backtick removal re-add them:
      // Posting task: ${title}
      const payment = await initPiPayment(0.05, `Posting task: ${title}`, {
        title,
        category: form.category,
      });

      if (!payment) {
        alert("Payment cancelled or failed. Task not posted.");
        return;
      }

      // Insert task row to Supabase
      const { data, error } = await supabase.from("tasks").insert([
        {
          poster_id: currentUserId,
          title,
          description: form.description || null,
          category: form.category || null,
          budget: form.budget ? Number(form.budget) : null,
          deadline: form.deadline || null,
          status: "open",
        },
      ]);

      if (error) throw error;
      clearForm();
      // optimistic refresh: reload tasks via subscription will pick it up soon; ensure UI updates now
      setTasks((prev) => (data ? [data[0] as Task, ...prev] : prev));
      alert("Task posted successfully.");
    } catch (err) {
      console.error("Post task error:", err);
      alert("Failed to post task: " + (err as any)?.message ?? String(err));
    } finally {
      setPosting(false);
    }
  };

  // Apply to task
  const handleApply = async (taskId: string, coverText: string, proposedBudget?: number) => {
    if (!currentUserId) {
      alert("Sign in before applying.");
      return;
    }
    try {
      const { data, error } = await supabase.from("applications").insert([
        {
          task_id: taskId,
          applicant_id: currentUserId,
          cover_text: coverText,
          proposed_budget: proposedBudget ?? null,
          status: "pending",
        },
      ]);
      if (error) throw error;

      // update local map
      setApplicationsMap((prev) => {
        const next = { ...prev };
        next[taskId] = [...(next[taskId] || []), data[0] as Application];
        return next;
      });

      alert("Application submitted.");
    } catch (err) {
      console.error("Apply error:", err);
      alert("Failed to apply: " + (err as any)?.message ?? String(err));
    }
  };

  // Poster accepts application -> assign and set status 'in_progress'
  const acceptApplication = async (taskId: string, app: Application) => {
    if (!currentUserId) {
      alert("Sign in required.");
      return;
    }
    try {
      // Ensure current user is poster of the task
      const task = tasks.find((t) => t.id === taskId);
      if (!task) throw new Error("Task not found.");
      if (task.poster_id !== currentUserId) {
        alert("Only poster can accept applications.");
        return;
      }

      // Update task assigned_to and status
      const { error } = await supabase
        .from("tasks")
        .update({ assigned_to: app.applicant_id, status: "in_progress" })
        .eq("id", taskId);

      if (error) throw error;

      // update application status
      await supabase.from("applications").update({ status: "accepted" }).eq("id", app.id);

      alert("Application accepted — task assigned.");
      // reload tasks (subscription may also trigger)
      const { data } = await supabase.from<Task>("tasks").select("*").eq("id", taskId).single();
      setTasks((prev) => prev.map((p) => (p.id === taskId ? (data as Task) : p)));
    } catch (err) {
      console.error("Accept error:", err);
      alert("Failed to accept application: " + (err as any)?.message ?? String(err));
    }
  };

  // Mark task complete (poster confirms freelancer delivered)
  const markCompleted = async (taskId: string) => {
    try {
      const { error } = await supabase.from("tasks").update({ status: "completed" }).eq("id", taskId);
      if (error) throw error;
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: "completed" } : t)));
      alert("Marked completed.");
    } catch (err) {
      console.error("Complete error:", err);
      alert("Failed: " + (err as any)?.message ?? String(err));
    }
  };

  const deleteTask = async (taskId: string) => {
    if (!confirm("Delete this task?")) return;
    try {
      const { error } = await supabase.from("tasks").delete().eq("id", taskId);
      if (error) throw error;
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      alert("Deleted.");
    } catch (err) {
      console.error("Delete error:", err);
      alert("Failed to delete: " + (err as any)?.message ?? String(err));
    }
  };

  // UI derived values
  const totalTasks = tasks.length;
  const activeCount = tasks.filter((t) => t.status === "in_progress").length;
  const completedCount = tasks.filter((t) => t.status === "completed").length;

  // Filtered list
  const filtered = tasks.filter((t) => {
    if (filter === "All") return true;
    if (filter === "Open") return t.status === "open";
    if (filter === "In Progress") return t.status === "in_progress";
    if (filter === "Completed") return t.status === "completed";
    return true;
  });

  if (!user) return null;

  return (
    <div className="min-h-screen bg-[#000222] text-white p-6">
      <main className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Task Marketplace</h1>
            <p className="text-sm text-gray-300">
              Total: {totalTasks} • Active: {activeCount} • Completed: {completedCount}
            </p>
          </div>

          <div className="flex gap-2 items-center">
            <div className="text-sm text-gray-300">Hello, {currentUsername}</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {(["All", "Open", "In Progress", "Completed"] as const).map((name) => (
            <button
              key={name}
              onClick={() => setFilter(name)}
              className={`text-left px-3 py-2 rounded-lg transition ${
                filter === name ? "bg-white/8 text-blue-300" : "hover:bg-white/5 text-gray-300"
              }`}
            >
              {name}
            </button>
          ))}
        </div>

        {/* Post Task Form */}
        <form onSubmit={handlePostTask} className="bg-white/5 p-4 rounded-lg border border-white/10 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              name="title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Task title *"
              className="w-full p-2 rounded bg-transparent border border-white/20"
              required
            />
            <input
              name="category"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              placeholder="Category"
              className="w-full p-2 rounded bg-transparent border border-white/20"
            />
            <input
              type="date"
              name="deadline"
              value={form.deadline}
              onChange={(e) => setForm({ ...form, deadline: e.target.value })}
              className="w-full p-2 rounded bg-transparent border border-white/20"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <input
              name="budget"
              value={form.budget}
              onChange={(e) => setForm({ ...form, budget: e.target.value })}
              placeholder="Budget (Pi)"
              className="w-full p-2 rounded bg-transparent border border-white/20"
            />
            <input
              name="placeholder-empty"
              readOnly
              className="hidden md:block"
              aria-hidden
            />
            <textarea
              name="description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Description"
              className="col-span-1 md:col-span-3 w-full p-2 rounded bg-transparent border border-white/20"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={posting}
              className={`bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg font-semibold ${
                posting ? "opacity-60 cursor-not-allowed" : ""
              }`}
            >
              {posting ? "Posting..." : "Post Task (small Pi fee)"}
            </button>
            <button
              type="button"
              onClick={() => clearForm()}
              className="px-4 py-2 rounded-lg bg-white/6 hover:bg-white/8"
            >
              Reset
            </button>
          </div>
        </form>

        {/* Tasks Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            <div className="col-span-full text-center text-gray-400">Loading tasks...</div>
          ) : filtered.length === 0 ? (
            <div className="col-span-full text-center text-gray-400">No tasks yet.</div>
          ) : (
            filtered.map((t) => (
              <div key={t.id} className="p-4 rounded-lg bg-white/6 border border-white/8">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-semibold">{t.title}</h3>
                  <span
                    className={`text-xs px-2 py-1 rounded ${
                      t.status === "completed"
                        ? "bg-green-500/20 text-green-400"
                        : t.status === "in_progress"
                        ? "bg-yellow-500/20 text-yellow-400"
                        : "bg-gray-500/20 text-gray-400"
                    }`}
                  >
                    {t.status ?? "open"}
                  </span>
                </div>

                <p className="text-sm text-gray-300 mb-2">{t.description}</p>

                <p className="text-xs text-gray-400">
                  {t.category ?? "General"} • Due: {t.deadline ?? "—"} • Budget:{" "}
                  {t.budget != null ? `${t.budget} Pi` : "—"}
                </p>

                <div className="mt-3 flex gap-2 items-center">
                  {/* If current user is the poster */}
                  {t.poster_id === currentUserId ? (
                    <>
                      <button
                        onClick={() => {
                          // toggle completed
                          if (t.status === "completed") {
                            alert("Already completed.");
                          } else {
                            markCompleted(t.id);
                          }
                        }}
                        className="px-3 py-1 rounded bg-green-600 hover:bg-green-700 text-sm"
                      >
                        Mark Completed
                      </button>

                      <button
                        onClick={() => deleteTask(t.id)}
                        className="px-3 py-1 rounded bg-red-600 hover:bg-red-700 text-sm"
                      >
                        Delete
                      </button>

                      {/* show applications (if any) */}
                      <div className="ml-auto text-xs text-gray-300">
                        {applicationsMap[t.id]?.length ? ${applicationsMap[t.id].length} applications : "0 apps"}
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Not poster: show apply + contact poster */}
                      <ApplyAndContact
                        task={t}
                        currentUserId={currentUserId}
                        onApply={handleApply}
                        posterId={t.poster_id}
                      />
                    </>
                  )}
                </div>

                {/* If poster, show list of applicants with accept */}
                {t.poster_id === currentUserId && (applicationsMap[t.id] || []).length > 0 && (
                  <div className="mt-3 text-sm space-y-2">
                    {(applicationsMap[t.id] || []).map((app) => (
                      <div key={app.id} className="p-2 rounded bg-white/4 flex items-center justify-between">
                        <div>
                          <div className="font-medium">{app.applicant_id}</div>
                          <div className="text-xs text-gray-300">{app.cover_text ?? ""}</div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => acceptApplication(t.id, app)}
                            className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-700 text-sm"
                          >
                            Accept
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}

/**
 * Small subcomponent for apply + contact UI (keeps parent tidy)
 */
function ApplyAndContact({
  task,
  currentUserId,
  onApply,
  posterId,
}: {
  task: Task;
  currentUserId: string | null;
  onApply: (taskId: string, coverText: string, proposedBudget?: number) => Promise<void>;
  posterId?: string | null;
}) {
  const [cover, setCover] = useState("");
  const [proposed, setProposed] = useState<string>("");
  const [applying, setApplying] = useState(false);

  return (
    <div className="w-full">
      <div className="flex gap-2">
        <input
          placeholder="Short cover note"
          value={cover}
          onChange={(e) => setCover(e.target.value)}
          className="p-1 rounded bg-transparent border border-white/10 text-sm flex-1"
        />
        <input
          placeholder="Budget (Pi)"
          value={proposed}
          onChange={(e) => setProposed(e.target.value)}
          className="w-24 p-1 rounded bg-transparent border border-white/10 text-sm"
        />
        <button
          onClick={async () => {
            if (!currentUserId) return alert("Sign in first.");
            if (!cover.trim()) return alert("Add a short cover note.");
            setApplying(true);
            try {
              await onApply(task.id, cover.trim(), proposed ? Number(proposed) : undefined);
              setCover("");
              setProposed("");
            } finally {
              setApplying(false);
            }
          }}
          className={`px-3 py-1 rounded bg-blue-600 hover:bg-blue-700 text-sm ${applying ? "opacity-70" : ""}`}
          disabled={applying}
        >
          {applying ? "Applying..." : "Apply"}
        </button>
      </div>

      {/* Contact poster button (opens ChatModal) */}
      {posterId && currentUserId && (
        <div className="mt-2">
          <ChatModal currentUserId={currentUserId} receiverId={posterId} receiverName={"Poster"} />
        </div>
      )}
    </div>
  );
}