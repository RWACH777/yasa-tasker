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
  onNotificationCountChange?: (count: number) => void;
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
      if (!notification.related_application_id) {
        setLoading(false);
        return;
      }

      try {
        const { data } = await supabase
          .from("applications")
          .select("*")
          .eq("id", notification.related_application_id)
          .single();

        if (data) {
          setApplication(data);
        }
      } catch (error) {
        console.error("Error loading application:", error);
      } finally {
        setLoading(false);
      }
    };

    loadApplication();
  }, [notification.related_application_id]);

  if (loading) {
    return <p className="glass-text-muted">Loading application details...</p>;
  }

  if (!application) {
    return <p className="glass-text-muted">Application details not found</p>;
  }

  return (
    <div className="space-y-4 mt-4">
      <div className="glass-panel p-4 space-y-4">
        {/* Freelancer Name */}
        <div>
          <p className="text-xs glass-text-muted mb-1">Freelancer Name</p>
          <p className="text-lg font-semibold glass-text-accent">{application.applicant_name}</p>
        </div>

        {/* Skills */}
        <div>
          <p className="text-xs glass-text-muted mb-1">Skills</p>
          <p className="text-sm glass-text">{application.applicant_skills}</p>
        </div>

        {/* Experience */}
        <div>
          <p className="text-xs glass-text-muted mb-1">Experience</p>
          <p className="text-sm glass-text">{application.applicant_experience}</p>
        </div>

        {/* Application Description */}
        <div>
          <p className="text-xs glass-text-muted mb-1">Application Message</p>
          <p className="text-sm glass-text glass-list-item p-3">
            {application.applicant_description}
          </p>
        </div>

        {/* Applied Date */}
        <div>
          <p className="text-xs glass-text-muted">
            Applied on {new Date(application.created_at).toLocaleDateString()}
          </p>
        </div>
      </div>

      {/* Approve and Deny Buttons - Only show if callbacks are provided (tasker only) */}
      {(onApprove || onDeny) && (
        <div className="flex gap-3 pt-4">
          {onApprove && (
            <button
              onClick={() => {
                if (onMarkAsRead) onMarkAsRead();
                if (onApprove) {
                  onApprove(application.id, application.applicant_id);
                }
              }}
              className="flex-1 glass-button glass-button-success px-4 py-3 text-sm font-semibold"
            >
              ✅ Approve
            </button>
          )}
          {onDeny && (
            <button
              onClick={() => {
                if (onMarkAsRead) onMarkAsRead();
                if (onDeny) {
                  onDeny(application.id);
                }
              }}
              className="flex-1 glass-button glass-button-danger px-4 py-3 text-sm font-semibold"
            >
              ❌ Deny
            </button>
          )}
        </div>
      )}
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
  onNotificationCountChange,
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
      const { data: notifs } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (notifs) {
        setNotifications(notifs as Notification[]);
        const unreadCount = notifs.filter((n) => !n.read).length;
        if (onNotificationCountChange) {
          onNotificationCountChange(unreadCount);
        }
      }
    } catch (error) {
      // Silently fail
    }
    setLoading(false);
  };

  const markAsRead = async (notificationId: string) => {
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("id", notificationId);
    
    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
    );
    
    const unreadCount = notifications.filter((n) => !n.read && n.id !== notificationId).length;
    if (onNotificationCountChange) {
      onNotificationCountChange(unreadCount);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="w-full max-w-2xl glass-modal p-6 mx-auto my-4">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold glass-text">
            {userRole === "tasker" ? "📬 Applications" : "✅ Notifications"}
          </h2>
          <button
            onClick={onClose}
            className="glass-close"
          >
            ✕
          </button>
        </div>

        {loading ? (
          <p className="glass-text-muted text-center py-8">Loading...</p>
        ) : notifications.length === 0 ? (
          <p className="glass-text-muted text-center py-8">
            {userRole === "tasker"
              ? "No pending applications"
              : "No notifications yet"}
          </p>
        ) : selectedNotification ? (
          // Detail view - Full application details
          <div className="space-y-4">
            <button
              onClick={() => {
                setSelectedNotification(null);
              }}
              className="glass-button px-3 py-1 text-sm"
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
              <div className="glass-panel p-4">
                <h3 className="text-lg font-semibold glass-text-accent mb-3">
                  {selectedNotification.type === "application_approved" ? "✅ Approved" : "❌ Denied"}
                </h3>
                <p className="text-sm glass-text-muted mb-4">
                  {selectedNotification.message}
                </p>
                <p className="text-xs glass-text-muted opacity-70">
                  {new Date(selectedNotification.created_at).toLocaleString()}
                </p>
                
                {selectedNotification.type === "application_approved" && (
                  <button
                    onClick={async () => {
                      if (onOpenChat) {
                        const taskId = selectedNotification.related_task_id;
                        try {
                          const { data } = await supabase.from("tasks").select("poster_id").eq("id", taskId).single();
                          if (data?.poster_id) {
                            onOpenChat(data.poster_id);
                            setSelectedNotification(null);
                          }
                        } catch (err) {
                          // Silently fail
                        }
                      }
                    }}
                    className="w-full mt-4 glass-button glass-button-primary px-4 py-2 text-sm font-semibold"
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
                className={`w-full text-left transition ${
                  notif.read 
                    ? "glass-list-item p-4" 
                    : "glass-list-item p-4 border-blue-400/50 bg-gradient-to-r from-blue-500/20 to-transparent"
                }`}
              >
                {userRole === "tasker" ? (
                  <>
                    <p className="font-semibold glass-text-accent">
                      {notif.type === "application_received" ? "📋 New Application" : "Other"}
                    </p>
                    <p className="text-sm glass-text-muted mt-1 line-clamp-2">{notif.message}</p>
                    <p className="text-xs glass-text-muted opacity-60 mt-2">
                      {new Date(notif.created_at).toLocaleDateString()}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-semibold glass-text-accent">
                      {notif.type === "application_approved" ? "✅ Approved" : "❌ Denied"}
                    </p>
                    <p className="text-sm glass-text-muted mt-1 line-clamp-2">{notif.message}</p>
                    <p className="text-xs glass-text-muted opacity-60 mt-2">
                      {new Date(notif.created_at).toLocaleDateString()}
                    </p>
                  </>
                )}
              </button>
            ))}
          </div>
        )}
    </div>
  );
}
