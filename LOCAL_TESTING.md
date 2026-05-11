# Local Testing Guide for YASA Tasker

## Overview
This guide helps you test YASA Tasker locally in Chrome without the Pi Browser.

## Features for Local Testing

### 1. Mock Pi SDK
A mock Pi SDK is automatically injected when running on `localhost` or `127.0.0.1`. This allows you to:
- Simulate Pi authentication
- Test payment flows with confirmation dialogs
- Develop and debug without Pi Browser

### 2. Auto-Login for Returning Users
After first login, users are automatically redirected to dashboard on subsequent visits.

### 3. Local Development Server

### Starting Local Development

```bash
# Install dependencies (if not done)
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:3000`

## Testing Payment Flows

### Membership Payment (Local Mode)
1. Go to `/membership` page
2. Click "Pay with Pi"
3. A confirmation dialog will appear asking to simulate payment
4. Click **OK** to simulate successful payment
5. Click **Cancel** to simulate payment failure

### Task Payment (Local Mode)
1. Create a task as a tasker
2. Open chat with freelancer
3. Click "Pay & Complete"
4. Confirm in the pre-payment modal
5. Click **OK** in the mock payment dialog to simulate

## Important Notes

### Mock Payment Behavior
- **Approval**: Simulated automatically after 500ms
- **Completion**: Simulated with mock TXID after 1.5s
- **TXID Format**: `mock-txid-{timestamp}-{random}`

### Database
- Local testing uses the same Supabase database
- Mock transactions are saved with `status: "payment_submitted"`
- You can verify payments in Supabase dashboard

### Pi SDK Mock Indicator
When in mock mode, a red badge appears at top-right: "🧪 Pi MOCK MODE"

## Wallet Address for Production

Your wallet address for receiving membership payments:
```
GCU5JNKCZXFDH3EJFIH5UKCSA24ZUXJC4YB5OZ6AOSYDC4YHIIFJG4SM
```

This is configured in:
- `app/membership/page.tsx` - for membership payments
- `app/chat/page.tsx` - uses freelancer's wallet from profile

## Troubleshooting

### "Pi SDK not available" Error
- Mock SDK auto-injects on localhost
- Check browser console for "🔧 Injecting Mock Pi SDK"
- Refresh page if needed

### Payment Times Out
- Mock payment requires user confirmation via dialog
- If dialog doesn't appear, check for popup blockers
- Console will show: "🔧 Mock Pi createPayment called"

### Auto-Login Not Working
- Check browser localStorage for `pi_user`
- Verify Supabase session exists
- Clear cookies/localStorage and re-login once

## Environment Variables (Optional)

Create `.env.local` for additional configuration:

```env
# Force mock mode even on production domain (for testing)
NEXT_PUBLIC_PI_MOCK=true

# Or disable mock on localhost
NEXT_PUBLIC_PI_MOCK=false
```

## Differences from Production

| Feature | Local (Mock) | Production (Pi Browser) |
|---------|---------------|------------------------|
| Authentication | Auto-approved | Pi Authenticate API |
| Payments | Dialog confirmation | Pi Wallet interface |
| TXID | mock-txid-... | Real blockchain TXID |
| Wallet | Any address accepted | Actual Pi transfer |

## Deploying to Vercel

When ready to deploy:

```bash
# Commit all changes
git add -A
git commit -m "Ready for production"
git push origin main
```

Vercel will automatically build and deploy. The mock SDK will NOT activate on Vercel (only on localhost).

## Need Help?

Check browser console logs - all mock operations are logged with 🔧 prefix.
