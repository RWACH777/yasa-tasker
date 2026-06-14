import { supabase } from "@/lib/supabaseClient";

/**
 * Set user as online
 */
export const setUserOnline = async (userId: string) => {
  try {
    const { error } = await supabase.from("presence").upsert(
      { user_id: userId, is_online: true, last_seen: new Date().toISOString() },
      { onConflict: "user_id" }
    );

    if (error) {
      console.warn("⚠️ Could not set user online (table may not exist):", error.message);
      return false;
    } else {
      return true;
    }
  } catch (err) {
    console.warn("⚠️ Error setting user online:", err);
    return false;
  }
};

/**
 * Set user as offline
 */
export const setUserOffline = async (userId: string) => {
  try {
    const { error } = await supabase.from("presence").upsert(
      { user_id: userId, is_online: false, last_seen: new Date().toISOString() },
      { onConflict: "user_id" }
    );

    if (error) {
      console.warn("⚠️ Could not set user offline (table may not exist):", error.message);
      return false;
    } else {
      return true;
    }
  } catch (err) {
    console.warn("⚠️ Error setting user offline:", err);
    return false;
  }
};

/**
 * Get user online status.
 * Considers stale data: if last_seen is more than 3 minutes ago the user
 * is treated as offline even if is_online=true (handles closed-tab cases).
 * Heartbeat runs every 20s, so 3 min gives ~9 missed beats of buffer.
 */
export const getUserOnlineStatus = async (userId: string) => {
  try {
    const { data, error } = await supabase
      .from("presence")
      .select("is_online, last_seen")
      .eq("user_id", userId)
      .single();

    if (error) {
      console.warn("⚠️ Could not fetch user status (table may not exist):", error.message);
      return { is_online: false, last_seen: null };
    }

    if (!data) {
      return { is_online: false, last_seen: null };
    }

    if (data.is_online && data.last_seen) {
      const lastSeen = new Date(data.last_seen).getTime();
      const staleMs = 3 * 60 * 1000; // 3 minutes
      if (Date.now() - lastSeen > staleMs) {
        return { is_online: false, last_seen: data.last_seen };
      }
    }

    return data;
  } catch (err) {
    console.warn("⚠️ Error getting user status:", err);
    return { is_online: false, last_seen: null };
  }
};

/**
 * Subscribe to user online status changes
 */
export const subscribeToUserStatus = (
  userId: string,
  callback: (isOnline: boolean) => void
) => {
  const subscription = supabase
    .channel(`presence:${userId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "presence",
        filter: `user_id=eq.${userId}`,
      },
      (payload: any) => {
        callback(payload.new?.is_online || false);
      }
    )
    .subscribe();

  return subscription;
};
