// lib/piAuth.ts
import { supabase } from "./supabaseClient";

export interface PiUser {
  username: string;
  uid: string;
  accessToken: string;
}

// Simulated authenticate function for Pi login
export async function mockPiAuthenticate(): Promise<PiUser> {
  await new Promise((r) => setTimeout(r, 800));

  const piUser: PiUser = {
    username: "PiUser123",
    uid: "pi_001_test_user",
    accessToken: "mock_access_token_12345",
  };

  // ✅ Sign in or create a matching Supabase user (anonymously)
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) console.error("Supabase sign-in error:", error);

  // ✅ Upsert into profiles table
  const { error: upsertError } = await supabase.from("profiles").upsert(
    {
      id: data?.user?.id,                     // uuid from Supabase auth
      username: piUser.username,              // mock Pi username
      email: `${piUser.uid}@pi.mock`,         // fake email
      created_at: new Date().toISOString(),   // timestamp
    },
    { onConflict: "id" }
  );

  if (upsertError) console.error("❌ Supabase upsert error:", upsertError);
  else console.log("✅ Profile upserted successfully");

  return piUser;
}