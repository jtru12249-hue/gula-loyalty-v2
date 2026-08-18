# GULA EXPRESS Loyalty — Upgrade

This folder is designed so each file can be copied into the matching path in the GitHub repository.

## What changed

- Uses the current WalletWallet API: `POST /api/passes` and `PUT /api/passes/<serial>`.
- Keeps Firestore member document ID as the QR value.
- Stores WalletWallet's own `serialNumber` separately as `walletSerial`.
- Uses Firebase Admin only on the server.
- Protects the staff points endpoint with a server-side `STAFF_PIN`.
- Uses a Firestore transaction for safe concurrent point updates.
- Writes an audit record to `pointTransactions`.
- Adds an idempotency key so the same scan request cannot award points twice.
- Correctly stops camera mode before file scanning.
- Uses the back camera when available.
- Provides screenshot QR scanning fallback.
- Improves mobile UI and status/error feedback.
- Uses WalletWallet's hosted `shareUrl` for Apple/Google Wallet install.

## Required Vercel environment variables

Add these in Vercel Project Settings -> Environment Variables:

- `WALLETWALLET_API_KEY`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `STAFF_PIN`

For `FIREBASE_PRIVATE_KEY`, paste the service-account private key. If Vercel stores it with `\n` characters, the code converts them back to real newlines.

## Firebase service account

Firebase Console -> Project Settings -> Service Accounts -> Generate new private key.

From that JSON:
- `project_id` -> `FIREBASE_PROJECT_ID`
- `client_email` -> `FIREBASE_CLIENT_EMAIL`
- `private_key` -> `FIREBASE_PRIVATE_KEY`

Never commit that JSON file or your real `.env.local`.

## Install

```bash
npm install
npm run dev
```

Before deploying, test:

```bash
npm run build
```

## Firestore rules

Because all database access now goes through Firebase Admin on the server, direct browser access can be denied. Deploy the included `firestore.rules` if this project has no other client-side Firestore features that need access.

## Existing members

Old members may not have `walletSerial`. That is okay. The first successful staff scan will create a fresh WalletWallet pass and save its serial. If the customer had an older pass from the legacy API, they may need the new install link before that newly-issued pass can update on their phone.

## Important note about points

The code keeps points as whole numbers:
- $1.00 -> 10 points
- $1.25 -> 12 points
- $10.99 -> 109 points

It uses `Math.floor(spendCents / 10)`. Change that rule only if your business wants rounding or fractional points.
