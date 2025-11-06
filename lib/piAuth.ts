// lib/piAuth.ts
import { supabase } from "./supabaseClient"

export interface PiUser {
  username: string
  uid: string
  accessToken: string
}

// Simulated authenticate function for Pi login
export async function mockPiAuthenticate(): Promise<PiUser> {
  await new Promise((r) => setTimeout(r, 800))

  const piUser: PiUser = {
    username: "PiUser123",
    uid: "pi_001_test_user",
    accessToken: "mock_access_token_12345",
  }

  // ✅ Sign in or create a Supabase anonymous user session
  const { data, error } = await supabase.auth.signInAnonymously()
  if (error) console.error("❌ Supabase sign-in error:", error)
  else console.log("✅ Supabase anonymous sign-in:", data?.user?.id)

  // ✅ Upsert into profiles table with matching schema
  const { error: upsertError } = await supabase.from("profiles").upsert(
    email: `${piUser.uid}@pi.mock`,
    { onConflict: "id" }
  )

  if (upsertError) {
    console.error("❌ Profile upsert error:", upsertError)
  } else {
    console.log("✅ Profile upsert success for:", piUser.username)
  }

  return piUser
}