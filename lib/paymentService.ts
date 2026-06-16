/**
 * paymentService.ts
 * Payment abstraction layer for YASA Tasker.
 *
 * All payment logic routes through PaymentService so that switching
 * from manual payments to Pi A2U requires only changing the active
 * implementation behind this interface — no app-wide rewrites.
 *
 * Current active implementation: ManualPaymentService
 * Future:                         A2UPaymentService (disabled via feature flag)
 */

// ─── Feature Flags ────────────────────────────────────────────────────────────
export const PAYMENT_FLAGS = {
  /** Manual Pi transfers: tasker sends Pi directly from Pi wallet to freelancer */
  ENABLE_MANUAL_PAYMENTS: true,

  /** App-to-User automatic Pi transfers — disabled until Pi Network enables A2U */
  ENABLE_A2U: false,

  /** Wallet format verification against Pi blockchain — placeholder */
  ENABLE_WALLET_VERIFICATION: false,
} as const;

// ─── Shared Types ─────────────────────────────────────────────────────────────

export type PaymentStatus =
  | "pending"
  | "awaiting_payment"
  | "payment_sent"
  | "payment_confirmed"
  | "disputed"
  | "cancelled";

export interface PaymentRequest {
  taskId: string;
  taskerId: string;
  freelancerId: string;
  amountPi: number;
  memo?: string;
}

export interface PaymentResult {
  success: boolean;
  ledgerEntryId?: string;
  transactionReference?: string;
  error?: string;
}

export interface LedgerUpdateResult {
  success: boolean;
  error?: string;
}

// ─── PaymentService Interface ─────────────────────────────────────────────────

export interface IPaymentService {
  /** Initialise a new payment record in the ledger when a task is approved */
  initiatePayment(req: PaymentRequest): Promise<PaymentResult>;

  /** Tasker marks they have sent Pi (manual TXID entry) */
  markPaymentSent(ledgerEntryId: string, txReference: string, taskerConfirm: boolean): Promise<LedgerUpdateResult>;

  /** Freelancer confirms they received payment */
  confirmPaymentReceived(ledgerEntryId: string): Promise<LedgerUpdateResult>;

  /** Raise a dispute on a payment */
  raiseDispute(ledgerEntryId: string, notes: string): Promise<LedgerUpdateResult>;

  /** Cancel a payment record */
  cancelPayment(ledgerEntryId: string, reason: string): Promise<LedgerUpdateResult>;
}

// ─── ManualPaymentService ─────────────────────────────────────────────────────
// Current production implementation.
// Tasker sends Pi manually from their Pi app; app records the TXID for audit.

export class ManualPaymentService implements IPaymentService {
  private supabaseAdmin: any;

  constructor(supabaseAdmin: any) {
    this.supabaseAdmin = supabaseAdmin;
  }

  async initiatePayment(req: PaymentRequest): Promise<PaymentResult> {
    const { data, error } = await this.supabaseAdmin
      .from("payment_ledger")
      .insert({
        task_id: req.taskId,
        tasker_id: req.taskerId,
        freelancer_id: req.freelancerId,
        amount_pi: req.amountPi,
        currency: "PI",
        payment_status: "awaiting_payment",
        notes: req.memo || null,
      })
      .select("id")
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, ledgerEntryId: data.id };
  }

  async markPaymentSent(
    ledgerEntryId: string,
    txReference: string,
    taskerConfirm: boolean
  ): Promise<LedgerUpdateResult> {
    const { error } = await this.supabaseAdmin
      .from("payment_ledger")
      .update({
        payment_status: "payment_sent",
        transaction_reference: txReference,
        confirmed_by_tasker: taskerConfirm,
        updated_at: new Date().toISOString(),
      })
      .eq("id", ledgerEntryId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  }

  async confirmPaymentReceived(ledgerEntryId: string): Promise<LedgerUpdateResult> {
    const { error } = await this.supabaseAdmin
      .from("payment_ledger")
      .update({
        payment_status: "payment_confirmed",
        confirmed_by_freelancer: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", ledgerEntryId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  }

  async raiseDispute(ledgerEntryId: string, notes: string): Promise<LedgerUpdateResult> {
    const { error } = await this.supabaseAdmin
      .from("payment_ledger")
      .update({
        payment_status: "disputed",
        notes,
        updated_at: new Date().toISOString(),
      })
      .eq("id", ledgerEntryId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  }

  async cancelPayment(ledgerEntryId: string, reason: string): Promise<LedgerUpdateResult> {
    const { error } = await this.supabaseAdmin
      .from("payment_ledger")
      .update({
        payment_status: "cancelled",
        notes: reason,
        updated_at: new Date().toISOString(),
      })
      .eq("id", ledgerEntryId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  }
}

// ─── FutureA2UPaymentService ──────────────────────────────────────────────────
// Placeholder — all methods throw until Pi Network enables A2U on mainnet.
// Enable by setting PAYMENT_FLAGS.ENABLE_A2U = true and implementing methods.

export class FutureA2UPaymentService implements IPaymentService {
  async initiatePayment(_req: PaymentRequest): Promise<PaymentResult> {
    throw new Error("A2U payments are not yet available on Pi mainnet.");
  }
  async markPaymentSent(_id: string, _tx: string, _confirm: boolean): Promise<LedgerUpdateResult> {
    throw new Error("A2U payments are not yet available on Pi mainnet.");
  }
  async confirmPaymentReceived(_id: string): Promise<LedgerUpdateResult> {
    throw new Error("A2U payments are not yet available on Pi mainnet.");
  }
  async raiseDispute(_id: string, _notes: string): Promise<LedgerUpdateResult> {
    throw new Error("A2U payments are not yet available on Pi mainnet.");
  }
  async cancelPayment(_id: string, _reason: string): Promise<LedgerUpdateResult> {
    throw new Error("A2U payments are not yet available on Pi mainnet.");
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createPaymentService(supabaseAdmin: any): IPaymentService {
  if (PAYMENT_FLAGS.ENABLE_A2U) {
    return new FutureA2UPaymentService();
  }
  return new ManualPaymentService(supabaseAdmin);
}
