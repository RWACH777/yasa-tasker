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
  const [notifications, setNotifications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<Application | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadNotifications();
    }
  }, [isOpen]);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      if (userRole === "tasker") {
        // Load applications for tasks posted by this user
        const { data: userTasks } = await supabase
          .from("tasks")
          .select("id, title")
          .eq("poster_id", userId);

        if (userTasks && userTasks.length > 0) {
          const taskIds = userTasks.map((t) => t.id);
          const { data: apps } = await supabase
            .from("applications")
            .select("*")
            .in("task_id", taskIds)
            .eq("status", "pending")
            .order("created_at", { ascending: false });

          if (apps) {
            const enriched = apps.map((app) => ({
              ...app,
              task_title: userTasks.find((t) => t.id === app.task_id)?.title,
            }));
            setNotifications(enriched);
          }
        }
      } else {
        // Load approved applications for this freelancer
        const { data: apps } = await supabase
          .from("applications")
          .select("*")
          .eq("applicant_id", userId)
          .eq("status", "approved")
          .order("created_at", { ascending: false });

        if (apps) {
          const enriched = await Promise.all(
            apps.map(async (app) => {
              const { data: task } = await supabase
                .from("tasks")
                .select("title")
                .eq("id", app.task_id)
                .single();
              return { ...app, task_title: task?.title };
            })
          );
          setNotifications(enriched);
        }
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
              : "No approved tasks yet"}
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
              <h3 className="text-lg font-semibold text-blue-400 mb-3">
                {selectedNotification.applicant_name}
              </h3>
              <p className="text-sm text-gray-300 mb-2">
                <span className="font-semibold">Task:</span> {selectedNotification.task_title}
              </p>
              <p className="text-sm text-gray-300 mb-2">
                <span className="font-semibold">Skills:</span> {selectedNotification.applicant_skills}
              </p>
              <p className="text-sm text-gray-300 mb-2">
                <span className="font-semibold">Experience:</span>{" "}
                {selectedNotification.applicant_experience}
              </p>
              <p className="text-sm text-gray-300 mb-4">
                <span className="font-semibold">About:</span>
              </p>
              <p className="text-sm text-gray-400 bg-white/5 p-3 rounded border border-white/10 mb-4">
                {selectedNotification.applicant_description}
              </p>

              {userRole === "tasker" && selectedNotification.status === "pending" && (
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      if (onApprove) {
                        onApprove(selectedNotification.id, selectedNotification.applicant_id);
                        setSelectedNotification(null);
                      }
                    }}
                    className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition text-sm font-semibold"
                  >
                    ✓ Approve
                  </button>
                  <button
                    onClick={() => {
                      if (onDeny) {
                        onDeny(selectedNotification.id);
                        setSelectedNotification(null);
                      }
                    }}
                    className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition text-sm font-semibold"
                  >
                    ✗ Deny
                  </button>
                </div>
              )}

              {userRole === "freelancer" && selectedNotification.status === "approved" && (
                <button
                  onClick={() => {
                    if (onOpenChat) {
                      onOpenChat(selectedNotification.applicant_id);
                      setSelectedNotification(null);
                    }
                  }}
                  className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition text-sm font-semibold"
                >
                  💬 Open Chatroom
                </button>
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
                <p className="font-semibold text-blue-400">{notif.applicant_name}</p>
                <p className="text-sm text-gray-300 mt-1">Task: {notif.task_title}</p>
                <p className="text-xs text-gray-500 mt-2">
                  {new Date(notif.created_at).toLocaleDateString()}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
