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

// Component to display application details from notification
function ApplicationDetailView({
  notification,
  onApprove,
  onDeny,
  onMarkAsRead,
}: {
  notification: Notification;
  onApprove?: (applicationId: string, applicantId: string) => void;
  onDeny?: (applicationId: string) => void;
  onMarkAsRead?: () => void;
}) {
  const [application, setApplication] = useState<Application | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadApplication = async () => {
      console.log("🔍 Loading application for notification:", notification);
      console.log("📌 Related Application ID:", notification.related_application_id);
      
      if (!notification.related_application_id) {
        console.warn("⚠️ No related_application_id found");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("applications")
        .select("*")
        .eq("id", notification.related_application_id)
        .single();

      console.log("📦 Application data:", data);
      console.log("❌ Application error:", error);

      if (data) {
        setApplication(data);
      }
      setLoading(false);
    };

    loadApplication();
  }, [notification.related_application_id]);

  if (loading) {
    return <p className="text-gray-400">Loading application details...</p>;
  }

  if (!application) {
    return <p className="text-gray-400">Application details not found</p>;
  }

  return (
    <div className="space-y-4 mt-4">
      <div className="bg-white/10 rounded-lg p-4 space-y-4">
        {/* Freelancer Name */}
        <div>
          <p className="text-xs text-gray-400 mb-1">Freelancer Name</p>
          <p className="text-lg font-semibold text-blue-400">{application.applicant_name}</p>
        </div>

        {/* Skills */}
        <div>
          <p className="text-xs text-gray-400 mb-1">Skills</p>
          <p className="text-sm text-gray-200">{application.applicant_skills}</p>
        </div>

        {/* Experience */}
        <div>
          <p className="text-xs text-gray-400 mb-1">Experience</p>
          <p className="text-sm text-gray-200">{application.applicant_experience}</p>
        </div>

        {/* Application Description */}
        <div>
          <p className="text-xs text-gray-400 mb-1">Application Message</p>
          <p className="text-sm text-gray-200 bg-white/5 rounded p-3 border border-white/10">
            {application.applicant_description}
          </p>
        </div>

        {/* Applied Date */}
        <div>
          <p className="text-xs text-gray-400">
            Applied on {new Date(application.created_at).toLocaleDateString()}
          </p>
        </div>
      </div>

      {/* Approve and Deny Buttons */}
      <div className="flex gap-3 pt-4">
        <button
          onClick={() => {
            if (onMarkAsRead) onMarkAsRead();
            if (onApprove) {
              onApprove(application.id, application.applicant_id);
            }
          }}
          className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-700 rounded-lg transition text-sm font-semibold"
        >
          ✅ Approve
        </button>
        <button
          onClick={() => {
            if (onMarkAsRead) onMarkAsRead();
            if (onDeny) {
              onDeny(application.id);
            }
          }}
          className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 rounded-lg transition text-sm font-semibold"
        >
          ❌ Deny
        </button>
      </div>
    </div>
  );
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
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadNotifications();
    }
  }, [isOpen]);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      console.log("📬 Loading notifications for user:", userId);
      // Load notifications from notifications table
      const { data: notifs, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      console.log("📬 Notifications loaded:", notifs);
      console.log("❌ Notifications error:", error);

      if (notifs) {
        console.log("✅ Setting notifications:", notifs.length, "items");
        setNotifications(notifs as Notification[]);
      }
    } catch (error) {
      console.error("Error loading notifications:", error);
    }
    setLoading(false);
  };

  const markAsRead = async (notificationId: string) => {
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("id", notificationId);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-2xl bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">
            {userRole === "tasker" ? "📬 Applications" : "✅ Notifications"}
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
          // Detail view - Full application details
          <div className="space-y-4">
            <button
              onClick={() => setSelectedNotification(null)}
              className="px-3 py-1 bg-gray-600 hover:bg-gray-700 rounded text-sm"
            >
              ← Back
            </button>
            
            {userRole === "tasker" ? (
              // Tasker view - show application details with approve/deny buttons
              <ApplicationDetailView 
                notification={selectedNotification}
                onApprove={onApprove}
                onDeny={onDeny}
                onMarkAsRead={() => markAsRead(selectedNotification.id)}
              />
            ) : (
              // Freelancer notification view
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
                    onClick={() => {
                      if (onOpenChat) {
                        const taskId = selectedNotification.related_task_id;
                        supabase.from("tasks").select("poster_id").eq("id", taskId).single().then(({ data }) => {
                          if (data?.poster_id) {
                            onOpenChat(data.poster_id);
                            setSelectedNotification(null);
                          }
                        });
                      }
                    }}
                    className="w-full mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition text-sm font-semibold"
                  >
                    💬 Open Chat
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          // List view
          <div className="space-y-3">
            {notifications.map((notif) => (
              <button
                key={notif.id}
                onClick={() => {
                  setSelectedNotification(notif);
                  markAsRead(notif.id);
                }}
                className={`w-full text-left rounded-lg p-4 hover:bg-white/10 transition ${
                  notif.read ? "bg-white/5 border border-white/10" : "bg-blue-900/30 border border-blue-500/50"
                }`}
              >
                {userRole === "tasker" ? (
                  <>
                    <p className="font-semibold text-blue-400">
                      {notif.type === "application_received" ? "📋 New Application" : "Other"}
                    </p>
                    <p className="text-sm text-gray-300 mt-1 line-clamp-2">{notif.message}</p>
                    <p className="text-xs text-gray-500 mt-2">
                      {new Date(notif.created_at).toLocaleDateString()}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-semibold text-green-400">
                      {notif.type === "application_approved" ? "✅ Approved" : "❌ Denied"}
                    </p>
                    <p className="text-sm text-gray-300 mt-1 line-clamp-2">{notif.message}</p>
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
