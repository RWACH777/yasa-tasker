import { supabase } from "./supabaseClient"

export interface PiUser {
  username: string
  uid: string
  accessToken: string
}

// 🔹 Simulated Pi authentication
export async function mockPiAuthenticate(): Promise<PiUser> {
  await new Promise((r) => setTimeout(r, 800))

  const piUser: PiUser = {
    username: "PiUser123",
    uid: "pi_001_test_user",
    accessToken: "mock_access_token_12345",
  }

  // ✅ After authenticating with Pi, sync the user to Supabase
  await syncPiUserWithSupabase(piUser)

  return piUser
}

// 🔹 Ensure the Pi user exists in Supabase and has a profile
export async function syncPiUserWithSupabase(piUser: PiUser) {
  try {
    // 1️⃣ Get or create Supabase session
    let { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) {
      const { data, error: signInError } = await supabase.auth.signInAnonymously()
      if (signInError) throw signInError
      user = data.user
    }

    // 2️⃣ Upsert profile record (create if missing)
    const { error: upsertError } = await supabase
      .from("profiles")
      .upsert(
        {
          id: user.id,
          username: piUser.username,
          email: ${piUser.username}@pi.mock,
          created_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      )

    if (upsertError) throw upsertError

    console.log("✅ Pi user synced with Supabase:", piUser.username)
    return { success: true, user }
  } catch (err) {
    console.error("❌ Failed to sync Pi user:", err)
    return { success: false, error: err }
  }
}