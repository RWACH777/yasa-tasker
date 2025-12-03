"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Sidebar from "@/app/components/Sidebar";

interface Application {
  id: string;
  applicant_id: string;
  applicant_name: string;
  applicant_skills: string;
  applicant_experience: string;
  applicant_description: string;
  created_at: string;
}

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
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null);
  const [applicationLoading, setApplicationLoading] = useState(false);

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

  const loadApplicationDetails = async (notification: Notification) => {
    if (!notification.related_application_id) return;

    setApplicationLoading(true);
    const { data } = await supabase
      .from("applications")
      .select("*")
      .eq("id", notification.related_application_id)
      .single();

    if (data) {
      setSelectedApplication(data);
    }
    setApplicationLoading(false);
  };

  const handleNotificationClick = async (notification: Notification) => {
    setSelectedNotification(notification);
    await markAsRead(notification.id);
    
    // Load application details if it's an application notification
    if (notification.type === "application_received") {
      await loadApplicationDetails(notification);
    }
  };

  const handleApproveApplication = async (applicationId: string, applicantId: string) => {
    // Get taskId from selectedApplication if available, otherwise from notification
    let taskId = selectedNotification?.related_task_id;
    
    if (!taskId && selectedApplication) {
      // Fetch the application to get task_id
      const { data: appData } = await supabase
        .from("applications")
        .select("task_id")
        .eq("id", applicationId)
        .single();
      taskId = appData?.task_id;
    }

    if (!taskId) {
      console.error("❌ No taskId found!");
      return;
    }
    
    console.log("✅ Approving application with taskId:", taskId);

    // Update application status
    await supabase
      .from("applications")
      .update({ status: "approved" })
      .eq("id", applicationId);

    // Update task status to active
    await supabase
      .from("tasks")
      .update({ status: "active" })
      .eq("id", taskId);

    // Send notification to freelancer
    await supabase.from("notifications").insert([
      {
        user_id: applicantId,
        type: "application_approved",
        related_task_id: taskId,
        related_application_id: applicationId,
        message: `✅ Your application was approved! Check Messages to communicate with the tasker.`,
        read: false,
      },
    ]);

    // Send system message to chat
    if (user?.id) {
      const systemMessage = {
        sender_id: user.id,
        receiver_id: applicantId,
        text: "✅ Application approved - chat started",
        created_at: new Date().toISOString(),
      };
      await supabase.from("messages").insert([systemMessage]);
    }

    // Close detail view and redirect to chat
    setSelectedNotification(null);
    setSelectedApplication(null);
    
    // Redirect to chat with a slight delay to ensure all updates are processed
    setTimeout(() => {
      router.push(`/chat?user=${applicantId}&task=${taskId}`);
    }, 500);
  };

  const handleDenyApplication = async (applicationId: string) => {
    if (!selectedNotification?.related_task_id || !selectedApplication) return;

    // Update application status
    await supabase
      .from("applications")
      .update({ status: "denied" })
      .eq("id", applicationId);

    // Send notification to freelancer
    await supabase.from("notifications").insert([
      {
        user_id: selectedApplication.applicant_id,
        type: "application_denied",
        related_task_id: selectedNotification.related_task_id,
        related_application_id: applicationId,
        message: `❌ Your application was denied. Try applying to other tasks!`,
        read: false,
      },
    ]);

    // Close detail view and refresh
    setSelectedNotification(null);
    setSelectedApplication(null);
    await loadNotifications(user.id);
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

      {/* Notifications List or Detail View */}
      <div className="w-full max-w-3xl bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-6">
        {selectedNotification ? (
          // Detail View
          <div className="space-y-4">
            <button
              onClick={() => {
                setSelectedNotification(null);
                setSelectedApplication(null);
              }}
              className="px-3 py-1 bg-gray-600 hover:bg-gray-700 rounded text-sm"
            >
              ← Back
            </button>

            {selectedNotification.type === "application_received" && selectedApplication ? (
              // Application Details for Tasker
              <div className="space-y-4 mt-4">
                <div className="bg-white/10 rounded-lg p-4 space-y-4">
                  {/* Freelancer Name */}
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Freelancer Name</p>
                    <p className="text-lg font-semibold text-blue-400">{selectedApplication.applicant_name}</p>
                  </div>

                  {/* Skills */}
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Skills</p>
                    <p className="text-sm text-gray-200">{selectedApplication.applicant_skills}</p>
                  </div>

                  {/* Experience */}
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Experience</p>
                    <p className="text-sm text-gray-200">{selectedApplication.applicant_experience}</p>
                  </div>

                  {/* Application Description */}
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Application Message</p>
                    <p className="text-sm text-gray-200 bg-white/5 rounded p-3 border border-white/10">
                      {selectedApplication.applicant_description}
                    </p>
                  </div>

                  {/* Applied Date */}
                  <div>
                    <p className="text-xs text-gray-400">
                      Applied on {new Date(selectedApplication.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                {/* Approve and Deny Buttons */}
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => handleApproveApplication(selectedApplication.id, selectedApplication.applicant_id)}
                    className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-700 rounded-lg transition text-sm font-semibold"
                  >
                    ✅ Approve
                  </button>
                  <button
                    onClick={() => handleDenyApplication(selectedApplication.id)}
                    className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 rounded-lg transition text-sm font-semibold"
                  >
                    ❌ Deny
                  </button>
                </div>
              </div>
            ) : (
              // Freelancer Notification View
              <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-green-400 mb-3">
                  {selectedNotification.type === "application_approved" ? "✅ Approved" : "❌ Denied"}
                </h3>
                <p className="text-sm text-gray-300 mb-4">
                  {selectedNotification.message}
                </p>
                <p className="text-xs text-gray-500">
                  {new Date(selectedNotification.created_at).toLocaleString()}
                </p>

                {selectedNotification.type === "application_approved" && (
                  <button
                    onClick={() => handleOpenChat(selectedNotification)}
                    className="w-full mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition text-sm font-semibold"
                  >
                    💬 Open Chat
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          // List View
          <>
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
                      <button
                        onClick={() => handleNotificationClick(notif)}
                        className="flex-1 text-left hover:opacity-80 transition"
                      >
                        <p className="text-sm text-gray-300">{notif.message}</p>
                        <p className="text-xs text-gray-500 mt-2">
                          {new Date(notif.created_at).toLocaleString()}
                        </p>
                      </button>
                      <button
                        onClick={() => deleteNotification(notif.id)}
                        className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-xs font-semibold transition flex-shrink-0"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
