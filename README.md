# CHRISTMAS TRACKER

A runnable Expo/React Native prototype for the six-location outdoor circuit around ADI HQ.

**Working name:** CHRISTMAS TRACKER  
**Name status:** TBC

## Open the browser prototype

From the project root:

```bash
npm install
npm run web
```

Open the localhost address printed by Expo. Do not open an HTML file directly and do not use VS Code Live Server.

## GPS behaviour

The app now obtains location in three ways:

1. Loads a recent cached location when available.
2. Requests a fresh one-time position.
3. Starts continuous foreground position updates.

Compass acquisition is separate, so a browser compass failure cannot stop GPS updates. If no position is returned after 12 seconds, the app displays a useful GPS error instead of remaining indefinitely on **Finding your GPS position**.

Browser location requires localhost or an HTTPS deployment and permission for the site. On macOS, also check:

```text
System Settings → Privacy & Security → Location Services
```

Ensure location is enabled for the browser being used.

## Browser demo controls

The web version now shows a visible **BROWSER TEST CONTROLS** panel.

- **TEST NEXT LOCATION** places the demo at the active checkpoint.
- The radar dot appears immediately.
- After the real two-second dwell timer, the normal unlock popup appears.
- Dismiss the popup, then press **TEST NEXT LOCATION** again to test the next checkpoint.
- **RETRY GPS** leaves demo mode and starts a fresh GPS request.
- **RESET** returns progress to Location 1.

These controls only appear on web. The installed iPhone and Android app continues using real foreground GPS.

## Production web build

```bash
rm -rf dist .expo
npm run build:web
npm run serve:web
```

Expo generates the deployable site in `dist`.

## Deploy to Vercel

```bash
npx vercel@latest --prod
```

Vercel is configured to:

- build the Expo web export;
- serve `dist`;
- allow same-origin browser geolocation through its Permissions-Policy header.

## Prototype behaviour

- iPhone, Android and web support.
- Foreground location only.
- Checkpoint order: `1 → 2 → 3 → 4 → 5 → 6`.
- No extra waypoint between Locations 4 and 5.
- Target appears within 10 m.
- Unlock occurs after two seconds within the 10 m zone.
- Progress is saved locally.
- Continuous radar sweep.

## Checkpoint coordinates

| Location | Latitude | Longitude |
|---|---:|---:|
| 1 | 53.79633786619898 | -2.687974626151308 |
| 2 | 53.797347568037175 | -2.6878622116685604 |
| 3 | 53.798629694088056 | -2.689792639658523 |
| 4 | 53.79765665559433 | -2.692083569227235 |
| 5 | 53.79560518751338 | -2.688040524247785 |
| 6 | 53.79629207415533 | -2.6867845831301898 |
