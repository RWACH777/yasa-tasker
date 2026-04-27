# Pi Payment System Setup Guide

## Overview
This guide helps you set up the real Pi Network payment system for Yasa Tasker.

## ⚠️ IMPORTANT: This is MAINNET (Real Pi)
- All transactions will use real Pi cryptocurrency
- Test thoroughly before going live
- Ensure you have sufficient Pi balance for testing

---

## Step 1: Run Database Migrations

Run this SQL in your Supabase SQL Editor:

```sql
-- Run the create_transactions_table.sql file
-- This creates:
-- 1. transactions table (stores all payment records)
-- 2. platform_config table (stores your fee wallet)
-- 3. transaction_status_history table (audit trail)
-- 4. Updates tasks table with payment tracking columns
```

**File**: `create_transactions_table.sql`

---

## Step 2: Set Your Platform Fee Wallet

Replace `YOUR_PERSONAL_WALLET_ADDRESS_HERE` with your actual Pi wallet address:

```sql
UPDATE platform_config 
SET value = 'YOUR_ACTUAL_PI_WALLET_ADDRESS' 
WHERE key = 'platform_fee_wallet';
```

**Your wallet will receive the 5% platform fee from every payment.**

---

## Step 3: Add Environment Variables

Add these to your `.env.local` file:

```env
# Pi Network API Credentials (Get from Pi Developer Portal)
PI_API_KEY=your_pi_api_key_here
PI_APP_ID=your_pi_app_id_here

# Supabase Service Role Key (for server-side operations)
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

### Getting Pi API Credentials:

1. Go to [Pi Developer Portal](https://developers.minepi.com)
2. Create a new app or use existing app
3. Get your API Key and App ID
4. Make sure your app is approved for Mainnet payments

---

## Step 4: Configure Vercel Environment Variables

Add the same environment variables in your Vercel project settings:

1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add:
   - `PI_API_KEY`
   - `PI_APP_ID`
   - `SUPABASE_SERVICE_ROLE_KEY`

---

## Step 5: Test the Payment Flow

### Test Checklist:

- [ ] Tasker views active task with "Pay & Complete" button
- [ ] Clicking button redirects to Payment Page
- [ ] Payment Page shows wallet balance
- [ ] Pi debit card displays correctly
- [ ] Payment details are auto-filled (amount, freelancer, fee)
- [ ] Clicking "Pay" creates transaction record
- [ ] Payment API processes successfully
- [ ] Transaction is saved with status "success"
- [ ] Task status updates to "completed"
- [ ] Freelancer receives notification
- [ ] Tasker is redirected to Rating Page
- [ ] Rating can be submitted
- [ ] Both ratings complete the task fully

---

## Payment Flow

```
Tasker clicks "Pay & Complete"
         ↓
Redirect to Payment Page
         ↓
Display wallet balance + payment details
         ↓
Tasker clicks "Pay"
         ↓
Create transaction record (status: processing)
         ↓
Call Pi Payment API
         ↓
Pi Network processes payment
         ↓
Update transaction (status: success, save txid)
         ↓
Update task (payment_status: completed)
         ↓
Send notification to freelancer
         ↓
Redirect to Rating Page
         ↓
Tasker rates freelancer
         ↓
Freelancer rates tasker
         ↓
Task fully completed
```

---

## Fee Structure

- **Total Task Amount**: 100% (e.g., 10 Pi)
- **Platform Fee (5%)**: Goes to your wallet (0.5 Pi)
- **Freelancer Receives (95%)**: Goes to freelancer wallet (9.5 Pi)

---

## Security Considerations

1. **Server-side validation**: All payments are validated server-side in `/api/pi-payment`
2. **Transaction records**: Every payment is logged with full audit trail
3. **RLS policies**: Transactions table has strict RLS policies
4. **Idempotency**: Duplicate payments are prevented via transaction ID tracking

---

## Troubleshooting

### Payment fails with "API credentials not configured"
- Add `PI_API_KEY` and `PI_APP_ID` to environment variables
- Until configured, payments run in "MOCK MODE" (no real Pi transferred)

### "Invalid wallet address" error
- Verify freelancer has set their wallet address in profile
- Check wallet address format (should be 50-64 alphanumeric characters)

### Transaction not appearing in Supabase
- Check RLS policies are correctly applied
- Verify `SUPABASE_SERVICE_ROLE_KEY` is set correctly

### Payment succeeds but task not marked complete
- Check browser console for errors
- Verify task ID is correctly passed to payment page

---

## Mock Mode vs Real Mode

### Mock Mode (Default without API keys)
- No real Pi is transferred
- Used for development/testing
- All database records are created
- Good for testing UI flow

### Real Mode (With API keys configured)
- Real Pi is transferred on Mainnet
- Requires sufficient wallet balance
- Uses actual Pi Network blockchain
- Production-ready

---

## Files Created/Modified

### New Files:
- `app/payment/page.tsx` - Payment page UI
- `app/rating/page.tsx` - Rating page UI
- `app/api/pi-payment/route.ts` - Payment API endpoint
- `create_transactions_table.sql` - Database schema

### Modified Files:
- `app/chat/page.tsx` - Updated task completion button

---

## Next Steps After Setup

1. Test in MOCK mode first (without API keys)
2. Get Pi Developer Portal approval for Mainnet
3. Add real API credentials
4. Test with small amounts
5. Monitor transactions in Supabase
6. Go live!

---

## Support

For Pi Network API issues:
- [Pi Developer Documentation](https://developers.minepi.com)
- [Pi Network Discord](https://discord.gg/pinetwork)

For app-specific issues:
- Check browser console logs
- Review Supabase logs
- Verify environment variables
