# CHRISTMAS TRACKER — runnable prototype

React Native / Expo prototype for the six-location ADI HQ outdoor circuit.

## Run in a browser

```bash
npm install
npm run web
```

Open the localhost URL printed by Expo. Browser location requires localhost or HTTPS.

The normal screen contains no visible diagnostic or browser-test box. The app requests location automatically. If a fix cannot be obtained, a small **RETRY** control appears inside the existing status panel.

## Hidden demo controls

Long-press the **0/6 UNLOCKED** badge for about one second. Select **SIMULATE NEXT**. The target dot appears immediately and the unlock popup appears after the configured two-second hold. Repeat after dismissing each popup.

## Production web build

```bash
npm run build:web
npm run serve:web
```

The compiled website is written to `dist`.

## Vercel

```bash
npx vercel@latest --prod
```

The included `vercel.json` builds the Expo web export and serves `dist`.

## Phone testing

```bash
npx expo start
```

Scan the QR code with Expo Go. The app uses foreground location only while it is open.
