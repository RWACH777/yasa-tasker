/**
 * /api/profile/wallet
 *
 * GET  — Returns the authenticated user's own wallet address (decrypted).
 * PUT  — Saves/updates the authenticated user's wallet address (encrypts before storing).
 *
 * Only the account owner can read or write their wallet address.
 * Never exposed to other users.
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  encryptWallet,
  decryptWallet,
  isValidPiWallet,
} from "@/lib/walletEncryption";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function getAdminClient() {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

async function getUserFromRequest(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.replace("Bearer ", "").trim();
  if (!token) return null;

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user } } = await userClient.auth.getUser();
  return user;
}

// GET — return own wallet address
export async function GET(req: Request) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = getAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("user_wallet_address, wallet_address, wallet_updated_at, wallet_acknowledged")
    .eq("id", user.id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Prefer manually entered address; fall back to Pi-SDK address
  let walletAddress: string | null = null;
  if (data.user_wallet_address) {
    try {
      walletAddress = decryptWallet(data.user_wallet_address);
    } catch {
      walletAddress = null;
    }
  } else if (data.wallet_address) {
    walletAddress = data.wallet_address;
  }

  return NextResponse.json({
    wallet_address: walletAddress,
    wallet_updated_at: data.wallet_updated_at,
    wallet_acknowledged: data.wallet_acknowledged,
    source: data.user_wallet_address ? "manual" : data.wallet_address ? "pi_sdk" : "none",
  });
}

// PUT — save/update wallet address
export async function PUT(req: Request) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { wallet_address, acknowledged } = body as {
    wallet_address: string;
    acknowledged?: boolean;
  };

  if (!wallet_address || !wallet_address.trim()) {
    return NextResponse.json({ error: "Wallet address is required" }, { status: 400 });
  }

  const trimmed = wallet_address.trim().toUpperCase();

  if (!isValidPiWallet(trimmed)) {
    return NextResponse.json(
      { error: "Invalid Pi wallet address. It must start with G and be 56 characters long." },
      { status: 400 }
    );
  }

  const encrypted = encryptWallet(trimmed);

  const admin = getAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({
      user_wallet_address: encrypted,
      wallet_updated_at: new Date().toISOString(),
      wallet_acknowledged: acknowledged ?? true,
    })
    .eq("id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
