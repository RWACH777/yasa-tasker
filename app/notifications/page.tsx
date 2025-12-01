"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Sidebar from "@/app/components/Sidebar";

interface Notification {
  id: string;
  user_id: string;
  type: string;
  related_task_id?: string;
  related_application_id?: string;
  message: string;
  read: boolean;
  created_at: string;
}

export default function NotificationsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const init = async () => {
      // Check if user is logged in
      const { data } = await supabase.auth.getSession();
      if (!data.session?.user) {
        router.push("/login");
        return;
      }

      // Load user profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", data.session.user.id)
        .single();

      if (profile) {
        setUser(profile);
        await loadNotifications(data.session.user.id);
      }
      setLoading(false);
    };

    init();
  }, []);

  const loadNotifications = async (userId: string) => {
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    setNotifications(data || []);
  };

  const markAsRead = async (notificationId: string) => {
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("id", notificationId);

    setNotifications(
      notifications.map((n) =>
        n.id === notificationId ? { ...n, read: true } : n
      )
    );
  };

  const deleteNotification = async (notificationId: string) => {
    await supabase
      .from("notifications")
      .delete()
      .eq("id", notificationId);

    setNotifications(notifications.filter((n) => n.id !== notificationId));
  };

  const handleOpenChat = async (notification: Notification) => {
    // Get the tasker ID from the related task
    if (notification.related_task_id) {
      const { data: task } = await supabase
        .from("tasks")
        .select("poster_id")
        .eq("id", notification.related_task_id)
        .single();

      if (task) {
        await markAsRead(notification.id);
        router.push(`/chat?user=${task.poster_id}`);
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#000222] text-white flex items-center justify-center">
        <p>Loading notifications...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#000222] text-white flex flex-col items-center px-4 py-10">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onNotificationsClick={() => {}}
      />

      {/* Navigation Bar */}
      <div className="w-full max-w-3xl mb-4 flex justify-between items-center gap-4">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="px-4 py-2 bg-gray-600/80 hover:bg-gray-700 rounded-lg transition text-sm"
        >
          ☰ Menu
        </button>
        <h1 className="text-2xl font-bold">📬 Notifications</h1>
        <button
          onClick={() => router.push("/dashboard")}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition text-sm"
        >
          ← Dashboard
        </button>
      </div>

      {/* Notifications List */}
      <div className="w-full max-w-3xl bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-6">
        {notifications.length === 0 ? (
          <p className="text-gray-400 text-center py-8">No notifications yet</p>
        ) : (
          <div className="space-y-3">
            {notifications.map((notif) => (
              <div
                key={notif.id}
                className={`p-4 rounded-lg border transition ${
                  notif.read
                    ? "bg-white/5 border-white/10"
                    : "bg-blue-500/10 border-blue-400/50"
                }`}
              >
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1">
                    <p className="text-sm text-gray-300">{notif.message}</p>
                    <p className="text-xs text-gray-500 mt-2">
                      {new Date(notif.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {notif.type === "application_approved" && (
                      <button
                        onClick={() => handleOpenChat(notif)}
                        className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs font-semibold transition"
                      >
                        💬 Chat
                      </button>
                    )}
                    {!notif.read && (
                      <button
                        onClick={() => markAsRead(notif.id)}
                        className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-xs font-semibold transition"
                      >
                        ✓ Read
                      </button>
                    )}
                    <button
                      onClick={() => deleteNotification(notif.id)}
                      className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-xs font-semibold transition"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
