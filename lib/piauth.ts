// lib/piAuth.ts
// Sandbox-style mock of the Pi SDK until real credentials are issued.

export interface PiUser {
  username: string
  uid: string
  accessToken: string
}

// Simulated "authenticate" call
export async function mockPiAuthenticate(): Promise<PiUser> {
  // Pretend this takes time like the real SDK call
  await new Promise((r) => setTimeout(r, 800))

  // Return mock user data
  return {
    username: "PiUser123",
    uid: "pi_001_test_user",
    accessToken: "mock_access_token_12345",
  }
}