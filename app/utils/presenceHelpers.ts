import { supabase } from "@/lib/supabaseClient";

/**
 * Set user as online
 */
export const setUserOnline = async (userId: string) => {
  try {
    const { error } = await supabase.from("presence").upsert({
      user_id: userId,
      is_online: true,
      last_seen: new Date().toISOString(),
    });

    if (error) {
      console.warn("⚠️ Could not set user online (table may not exist):", error.message);
      return false;
    } else {
      console.log("✅ User set online");
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
    const { error } = await supabase.from("presence").upsert({
      user_id: userId,
      is_online: false,
      last_seen: new Date().toISOString(),
    });

    if (error) {
      console.warn("⚠️ Could not set user offline (table may not exist):", error.message);
      return false;
    } else {
      console.log("✅ User set offline");
      return true;
    }
  } catch (err) {
    console.warn("⚠️ Error setting user offline:", err);
    return false;
  }
};

/**
 * Get user online status - considers stale data (user closed app without updating status)
 * If last_seen is more than 2 minutes ago, consider user offline even if is_online=true
 */
export const getUserOnlineStatus = async (userId: string) => {
  try {
    const { data, error } = await supabase
      .from("presence")
      .select("is_online, last_seen")
      .eq("user_id", userId)
      .single();

    if (error) {
      // Table might not exist yet, return default offline status
      console.warn("⚠️ Could not fetch user status (table may not exist):", error.message);
      return { is_online: false, last_seen: null };
    }

    if (!data) {
      return { is_online: false, last_seen: null };
    }

    // Check if last_seen is stale (more than 2 minutes ago)
    // This handles cases where user closed app without setting offline
    if (data.is_online && data.last_seen) {
      const lastSeen = new Date(data.last_seen).getTime();
      const now = Date.now();
      const twoMinutesMs = 2 * 60 * 1000;
      
      if (now - lastSeen > twoMinutesMs) {
        // Status is stale, user is actually offline
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
