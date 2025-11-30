import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);

/**
 * Send notification to freelancer when application is approved
 */
export const sendApprovalNotification = async (
  freelancerId: string,
  taskId: string,
  applicationId: string,
  taskTitle: string
) => {
  const message = `✅ Your application for "${taskTitle}" was approved! Check Messages to communicate with the tasker.`;

  const { error } = await supabase.from("notifications").insert([
    {
      user_id: freelancerId,
      type: "application_approved",
      related_task_id: taskId,
      related_application_id: applicationId,
      message,
      read: false,
    },
  ]);

  if (error) {
    console.error("❌ Failed to send approval notification:", error);
  } else {
    console.log("✅ Approval notification sent to freelancer");
  }

  return !error;
};

/**
 * Send notification to freelancer when application is denied
 */
export const sendDenialNotification = async (
  freelancerId: string,
  taskId: string,
  applicationId: string,
  taskTitle: string
) => {
  const message = `❌ Your application for "${taskTitle}" was denied. Try applying to other tasks!`;

  const { error } = await supabase.from("notifications").insert([
    {
      user_id: freelancerId,
      type: "application_denied",
      related_task_id: taskId,
      related_application_id: applicationId,
      message,
      read: false,
    },
  ]);

  if (error) {
    console.error("❌ Failed to send denial notification:", error);
  } else {
    console.log("✅ Denial notification sent to freelancer");
  }

  return !error;
};

/**
 * Send notification to both tasker and freelancer when task is completed
 */
export const sendCompletionNotification = async (
  taskerId: string,
  freelancerId: string,
  taskId: string,
  taskTitle: string
) => {
  const taskerMessage = `✅ Task "${taskTitle}" marked as completed!`;
  const freelancerMessage = `✅ Task "${taskTitle}" completed! Great work!`;

  // Send to tasker
  await supabase.from("notifications").insert([
    {
      user_id: taskerId,
      type: "task_completed",
      related_task_id: taskId,
      message: taskerMessage,
      read: false,
    },
  ]);

  // Send to freelancer
  await supabase.from("notifications").insert([
    {
      user_id: freelancerId,
      type: "task_completed",
      related_task_id: taskId,
      message: freelancerMessage,
      read: false,
    },
  ]);

  console.log("✅ Completion notifications sent to both parties");
};

/**
 * Load notifications for a user
 */
export const loadNotifications = async (userId: string) => {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("❌ Failed to load notifications:", error);
    return [];
  }

  return data || [];
};

/**
 * Mark notification as read
 */
export const markNotificationAsRead = async (notificationId: string) => {
  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("id", notificationId);

  if (error) {
    console.error("❌ Failed to mark notification as read:", error);
  }

  return !error;
};

/**
 * Delete notification
 */
export const deleteNotification = async (notificationId: string) => {
  const { error } = await supabase
    .from("notifications")
    .delete()
    .eq("id", notificationId);

  if (error) {
    console.error("❌ Failed to delete notification:", error);
  }

  return !error;
};
