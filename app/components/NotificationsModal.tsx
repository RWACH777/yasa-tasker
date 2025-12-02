"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

interface Application {
  id: string;
  task_id: string;
  applicant_id: string;
  applicant_name: string;
  applicant_skills: string;
  applicant_experience: string;
  applicant_description: string;
  status: string;
  created_at: string;
  task_title?: string;
}

interface Notification {
  id: string;
  user_id: string;
  type: string;
  related_task_id: string;
  related_application_id?: string;
  message: string;
  read: boolean;
  created_at: string;
}

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userRole: "tasker" | "freelancer";
  onApprove?: (applicationId: string, applicantId: string) => void;
  onDeny?: (applicationId: string) => void;
  onOpenChat?: (applicantId: string) => void;
}

export default function NotificationsModal({
  isOpen,
  onClose,
  userId,
  userRole,
  onApprove,
  onDeny,
  onOpenChat,
}: NotificationsModalProps) {
  const [notifications, setNotifications] = useState<(Application | Notification)[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<(Application | Notification) | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadNotifications();
    }
  }, [isOpen]);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      if (userRole === "tasker") {
        // Load notifications from notifications table for tasker
        const { data: notifs } = await supabase
          .from("notifications")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false });

        if (notifs) {
          setNotifications(notifs as any);
        }
      } else {
        // Load notifications for this freelancer from notifications table
        const { data: notifs } = await supabase
          .from("notifications")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false });
        
        setNotifications(notifs as any);
      }
    } catch (error) {
      console.error("Error loading notifications:", error);
    }
    setLoading(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-2xl bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">
            {userRole === "tasker" ? "📬 Applications" : "✅ Approved Tasks"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl"
          >
            ✕
          </button>
        </div>

        {loading ? (
          <p className="text-gray-400 text-center py-8">Loading...</p>
        ) : notifications.length === 0 ? (
          <p className="text-gray-400 text-center py-8">
            {userRole === "tasker"
              ? "No pending applications"
              : "No notifications yet"}
          </p>
        ) : selectedNotification ? (
          // Detail view
          <div className="space-y-4">
            <button
              onClick={() => setSelectedNotification(null)}
              className="px-3 py-1 bg-gray-600 hover:bg-gray-700 rounded text-sm"
            >
              ← Back
            </button>
            <div className="bg-white/5 border border-white/10 rounded-lg p-4">
              {userRole === "tasker" ? (
                <>
                  <h3 className="text-lg font-semibold text-blue-400 mb-3">
                    {(selectedNotification as Notification).message}
                  </h3>
                  <p className="text-sm text-gray-300 mb-4">
                    Type: {(selectedNotification as Notification).type === "application_submitted" ? "📋 New Application" : "Other"}
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Date((selectedNotification as Notification).created_at).toLocaleString()}
                  </p>
                </>
              ) : (
                <>
                  <h3 className="text-lg font-semibold text-green-400 mb-3">
                    {(selectedNotification as Notification).type === "application_approved" ? "✅ Approved" : "❌ Denied"}
                  </h3>
                  <p className="text-sm text-gray-300 mb-4">
                    {(selectedNotification as Notification).message}
                  </p>
                  {(selectedNotification as Notification).type === "application_approved" && (
                    <button
                      onClick={() => {
                        if (onOpenChat) {
                          // Get tasker ID from the related task
                          const taskId = (selectedNotification as Notification).related_task_id;
                          // We need to fetch the tasker ID from the task
                          supabase.from("tasks").select("poster_id").eq("id", taskId).single().then(({ data }) => {
                            if (data?.poster_id) {
                              onOpenChat(data.poster_id);
                              setSelectedNotification(null);
                            }
                          });
                        }
                      }}
                      className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition text-sm font-semibold"
                    >
                      💬 Open Chat
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        ) : (
          // List view
          <div className="space-y-3">
            {notifications.map((notif) => (
              <button
                key={notif.id}
                onClick={() => setSelectedNotification(notif)}
                className="w-full text-left bg-white/5 border border-white/10 rounded-lg p-4 hover:bg-white/10 transition"
              >
                {userRole === "tasker" ? (
                  <>
                    <p className="font-semibold text-blue-400">
                      {(notif as Notification).type === "application_submitted" ? "📋 New Application" : "Other"}
                    </p>
                    <p className="text-sm text-gray-300 mt-1 line-clamp-2">{(notif as Notification).message}</p>
                    <p className="text-xs text-gray-500 mt-2">
                      {new Date(notif.created_at).toLocaleDateString()}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-semibold text-green-400">
                      {(notif as Notification).type === "application_approved" ? "✅ Approved" : "❌ Denied"}
                    </p>
                    <p className="text-sm text-gray-300 mt-1 line-clamp-2">{(notif as Notification).message}</p>
                    <p className="text-xs text-gray-500 mt-2">
                      {new Date(notif.created_at).toLocaleDateString()}
                    </p>
                  </>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
