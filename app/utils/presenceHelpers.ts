import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);

/**
 * Set user as online
 */
export const setUserOnline = async (userId: string) => {
  const { error } = await supabase.from("presence").upsert({
    user_id: userId,
    is_online: true,
    last_seen: new Date().toISOString(),
  });

  if (error) {
    console.error("❌ Failed to set user online:", error);
  } else {
    console.log("✅ User set online");
  }

  return !error;
};

/**
 * Set user as offline
 */
export const setUserOffline = async (userId: string) => {
  const { error } = await supabase.from("presence").upsert({
    user_id: userId,
    is_online: false,
    last_seen: new Date().toISOString(),
  });

  if (error) {
    console.error("❌ Failed to set user offline:", error);
  } else {
    console.log("✅ User set offline");
  }

  return !error;
};

/**
 * Get user online status
 */
export const getUserOnlineStatus = async (userId: string) => {
  const { data, error } = await supabase
    .from("presence")
    .select("is_online, last_seen")
    .eq("user_id", userId)
    .single();

  if (error) {
    console.error("❌ Failed to get user status:", error);
    return { is_online: false, last_seen: null };
  }

  return data || { is_online: false, last_seen: null };
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
