# CHRISTMAS TRACKER

A runnable Expo/React Native prototype for the six-location outdoor circuit around ADI HQ.

**Working name:** CHRISTMAS TRACKER  
**Name status:** TBC

## What the prototype does

- Runs on iPhone and Android from one React Native codebase.
- Requests foreground precise-location access only.
- Displays a fictional Christmas-themed radar.
- Activates checkpoints strictly in this order: `1 → 2 → 3 → 4 → 5 → 6`.
- Contains no extra or non-activating wayfinding points between Locations 4 and 5.
- Shows the next checkpoint as a radar dot only inside the 10 m reveal radius.
- Unlocks after remaining inside the 10 m zone for approximately two seconds with acceptable GPS accuracy.
- Displays a popup without replacing the radar screen.
- Saves progress on the phone.

## Run it on an iPhone or Android phone

This project deliberately uses Expo SDK 54 so it can be tested in the current Expo Go app on a physical phone.

1. Install Node.js 20 or newer.
2. From this folder, install dependencies:

   ```bash
   npm install
   ```

3. Install **Expo Go** from the iOS App Store or Google Play.
4. Start the project:

   ```bash
   npx expo start
   ```

5. Keep the computer and phone on the same Wi-Fi network.
6. Scan the QR code using the iPhone Camera app or Expo Go on Android.
7. Grant precise location access while using the app.

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

Because GPS can drift near buildings, test every checkpoint on the intended iPhone before the live demo. Increase the radii only if the real device repeatedly fails to enter the 10 m zone.

## Useful checks

```bash
npm run typecheck
npm run verify-route
npx expo-doctor@latest
```

## Installable builds

Expo Go is the quickest prototype test. For a standalone install, create an Expo account and use EAS Build:

```bash
npm install --global eas-cli
eas login
eas build --profile preview --platform android
eas build --profile preview --platform ios
```

An Apple Developer account and registered test-device provisioning may be required for an internally distributed iPhone build.
