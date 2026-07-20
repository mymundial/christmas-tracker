# CHRISTMAS TRACKER

A runnable Expo/React Native prototype for the six-location outdoor circuit around ADI HQ.

**Working name:** CHRISTMAS TRACKER  
**Name status:** TBC

## What the prototype does

- Runs on iPhone, Android, and the web from one React Native codebase.
- Requests foreground precise-location access only.
- Displays a fictional Christmas-themed radar with a continuous sweep.
- Activates checkpoints strictly in this order: `1 → 2 → 3 → 4 → 5 → 6`.
- Contains no extra or non-activating wayfinding points between Locations 4 and 5.
- Shows the next checkpoint as a radar dot only inside the 10 m reveal radius.
- Unlocks after remaining inside the 10 m zone for approximately two seconds with acceptable GPS accuracy.
- Displays a popup without replacing the radar screen.
- Saves progress on the device/browser.

## Install dependencies

From the project folder:

```bash
npm install
```

## Preview in VS Code

Start the browser version:

```bash
npm run web
```

Or start Expo and press `w`:

```bash
npx expo start
```

The source HTML template is:

```text
public/index.html
```

Expo injects the compiled application into `<div id="root"></div>` when it starts or exports the web app.

## Create the production website

```bash
npm run build:web
```

The deployable website is generated in:

```text
dist/
  index.html
  _expo/
```

Test the production export locally with:

```bash
npm run serve:web
```

## Vercel blank-screen fix

The Vercel configuration deliberately has no catch-all rewrite. Expo's generated JavaScript lives under `/_expo/`; rewriting every request to `/` causes those JavaScript files to return HTML and leaves the page looking black.

After replacing an older deployment, force a fresh build with:

```bash
rm -rf dist .expo
npm install
npm run build:web
npx vercel@latest --prod --force
```

## Deploy to Vercel

The included `vercel.json` tells Vercel to build the Expo web app and serve `dist`.

### Git deployment

Push the whole source project to GitHub/GitLab/Bitbucket, import that repository into Vercel, and deploy. Do not upload the original source ZIP as a static file.

### Vercel CLI

```bash
npx vercel@latest
```

Vercel will run `npm run build:web`, generate `dist/index.html`, and publish the result.

### Manual static upload

Run `npm run build:web`, then upload the contents of `dist`, not the source folder or ZIP.

Browser location access requires HTTPS in production. Vercel provides HTTPS automatically.

## Run it on an iPhone or Android phone

1. Install **Expo Go** from the iOS App Store or Google Play.
2. Start the project:

   ```bash
   npx expo start
   ```

3. Scan the QR code using the iPhone Camera app or Expo Go on Android.
4. Grant precise location access while using the app.

For an outdoor test, keep the app open and walk the route in order. The app is foreground-only and does not track in the background.

## Hidden on-site test panel

Long-press the `0/6 UNLOCKED` progress badge for about one second. The panel lets you:

- Simulate the current unlock without travelling to the coordinate.
- Reset the circuit to Location 1.

Long-press the badge again to hide it.

## Checkpoint coordinates

| Location | Latitude | Longitude |
|---|---:|---:|
| 1 | 53.79633786619898 | -2.687974626151308 |
| 2 | 53.797347568037175 | -2.6878622116685604 |
| 3 | 53.798629694088056 | -2.689792639658523 |
| 4 | 53.79765665559433 | -2.692083569227235 |
| 5 | 53.79560518751338 | -2.688040524247785 |
| 6 | 53.79629207415533 | -2.6867845831301898 |

## Tuning the on-site behaviour

All activation settings are in:

```text
src/constants/checkpoints.ts
```

The current values are:

```ts
REVEAL_RADIUS_METRES = 10
UNLOCK_RADIUS_METRES = 10
DWELL_TIME_MS = 2000
MAX_ACCEPTABLE_ACCURACY_METRES = 30
```

Because GPS can drift near buildings, test every checkpoint on the intended iPhone before the live demo.

## Useful checks

```bash
npm run typecheck
npm run verify-route
npx expo-doctor@latest
```

## Installable native builds

Use `npx eas-cli@latest` so a global installation is not required:

```bash
npx eas-cli@latest login
npx eas-cli@latest build --profile preview --platform android
npx eas-cli@latest build --profile preview --platform ios
```

An Apple Developer account and registered test-device provisioning may be required for an internally distributed iPhone build.
