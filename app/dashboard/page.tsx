"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/SupabaseClient";
import { formatBudget } from "../../utils/format";
import ChatModals from "../../components/ChatModals";

interface Transaction {
  id: string;
  txid?: string;
  status?: string;
  amount?: number;
  description?: string;
  category?: string;
  deadline?: string;
  poster_id?: string;
  budget?: number;
}

export default function DashboardPage() {
  const [notifications, setNotifications] = useState<string[]>([]);
  const [tasks, setTasks] = useState<Transaction[]>([]);
  const [hydratedUser, setHydratedUser] = useState<any>(null);

  useEffect(() => {
    // Load hydrated user from localStorage if not provided via context
    if (typeof window !== "undefined") {
      const storedUser = localStorage.getItem("piUser");
      if (storedUser) {
        setHydratedUser(JSON.parse(storedUser));
      }
    }

    // Fetch latest transactions for notifications
    const fetchNotifications = async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);

      if (!error && data) {
        const notes = (data as any[]).map((t) => {
          // <-- ADD BACKTICKS HERE
          return `Tx: ${t.txid || "unknown"} — ${t.status || "pending"} — ${String(t.amount || 0)} Pi`;
        });
        setNotifications(notes);
      }
    };

    // Fetch latest tasks
    const fetchTasks = async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);

      if (!error && data) {
        setTasks(data as Transaction[]);
      }
    };

    fetchNotifications();
    fetchTasks();
  }, []);

  const handleApply = async (taskId: string) => {
    // Dummy apply function
    alert(`Applied to task ${taskId}`); // <-- ADD BACKTICKS HERE
  };

  return (
    <div className="p-6 bg-black text-white min-h-screen">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">
          Welcome, {hydratedUser?.username || "Guest"}
        </h1>
        <div className="mt-2">
          {notifications.length > 0 ? (
            notifications.map((note, index) => (
              <p key={index} className="text-sm text-gray-400">{note}</p>
            ))
          ) : (
            <p className="text-sm text-gray-400">No recent transactions</p>
          )}
        </div>
      </header>

      <section>
        <h2 className="text-xl font-semibold mb-4">Available Tasks</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tasks.length > 0 ? (
            tasks.map((t) => (
              <div key={t.id} className="p-4 bg-gray-800 rounded-md shadow">
                <div className="flex justify-between items-center">
                  <span className="font-medium">{t.description || "No description"}</span>
                </div>
                <p className="text-sm text-gray-400 mt-1">{t.description || "No description"}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {/* <-- ADD BACKTICKS HERE */}
                  {`${t.category || "General"} • Due: ${t.deadline || "—"} • Budget: ${formatBudget(t.budget)}`}
                </p>
                <div className="mt-3 flex gap-2 items-center">
                  <button
                    onClick={() => handleApply(t.id)}
                    className="px-3 py-1 rounded bg-blue-600 text-white text-sm"
                  >
                    Apply
                  </button>
                  {/* <-- ADD BACKTICKS HERE if needed for ChatModals props */}
                  <ChatModals
                    currentUserId={hydratedUser?.uid || ""}
                    receiverId={t.poster_id || ""}
                    receiverName={t.poster_id ? t.poster_id : "Poster"}
                  />
                </div>
              </div>
            ))
          ) : (
            <p className="text-gray-400">No tasks available</p>
          )}
        </div>
      </section>
    </div>
  );
}