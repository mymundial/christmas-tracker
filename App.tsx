import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  useWindowDimensions,
  Vibration,
  View,
} from "react-native";

import { Radar } from "./src/components/Radar";
import { UnlockCard } from "./src/components/UnlockCard";
import {
  CHECKPOINTS,
  DWELL_TIME_MS,
  MAX_ACCEPTABLE_ACCURACY_METRES,
  PROGRESS_STORAGE_KEY,
  REVEAL_RADIUS_METRES,
  UNLOCK_RADIUS_METRES,
} from "./src/constants/checkpoints";
import { bearingDegrees, distanceMetres } from "./src/utils/geo";

type PermissionState = "checking" | "prompt" | "granted" | "denied" | "unavailable";
type LocationState = "idle" | "acquiring" | "tracking" | "timed-out" | "error" | "demo";

const GPS_TIMEOUT_MS = 30_000;
const WEB_GPS_TIMEOUT_MS = 45_000;

function isEmbeddedBrowserContext(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

const snowflakes = [
  { left: "7%", top: "12%", size: 12, opacity: 0.35 },
  { left: "86%", top: "16%", size: 18, opacity: 0.28 },
  { left: "13%", top: "58%", size: 16, opacity: 0.18 },
  { left: "88%", top: "66%", size: 11, opacity: 0.34 },
  { left: "72%", top: "8%", size: 10, opacity: 0.2 },
  { left: "31%", top: "25%", size: 8, opacity: 0.16 },
] as const;

function locationErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "The device did not return a location.";
}

function browserLocationErrorMessage(
  error: GeolocationPositionError,
  embedded: boolean,
): string {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return embedded
        ? "This embedded preview is blocking GPS. Open the site directly in Safari."
        : "Safari refused this GPS request. Tap TRY GPS; if no prompt appears, open Safari Website Settings and set Location to Allow.";
    case error.POSITION_UNAVAILABLE:
      return "GPS signal is temporarily unavailable. Tracking is still active; keep the page open and move into open sky.";
    case error.TIMEOUT:
      return "Still waiting for a GPS fix. Tracking is still active; keep the page open and try again if needed.";
    default:
      return error.message || "The phone did not return a GPS position.";
  }
}

function browserPositionToExpoLocation(position: GeolocationPosition): Location.LocationObject {
  return {
    timestamp: position.timestamp,
    coords: {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      altitude: position.coords.altitude,
      accuracy: position.coords.accuracy,
      altitudeAccuracy: position.coords.altitudeAccuracy,
      heading: position.coords.heading,
      speed: position.coords.speed,
    },
  };
}

export default function App() {
  const { width, height } = useWindowDimensions();
  const radarSize = Math.min(width - 34, height * 0.47, 430);

  const [permissionState, setPermissionState] = useState<PermissionState>("checking");
  const [locationState, setLocationState] = useState<LocationState>("idle");
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locationAttempt, setLocationAttempt] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progressLoaded, setProgressLoaded] = useState(false);
  const [position, setPosition] = useState<Location.LocationObject | null>(null);
  const [heading, setHeading] = useState<number | null>(null);
  const [popupLocation, setPopupLocation] = useState<number | null>(null);
  const [debugVisible, setDebugVisible] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [webEmbedded, setWebEmbedded] = useState(false);
  const [webErrorCode, setWebErrorCode] = useState<number | null>(null);

  const dwellTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unlockingRef = useRef(false);
  const demoModeRef = useRef(false);
  const webWatchIdRef = useRef<number | null>(null);
  const webTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const webReceivedFixRef = useRef(false);

  const complete = currentIndex >= CHECKPOINTS.length;
  const currentCheckpoint = complete ? null : CHECKPOINTS[currentIndex];

  useEffect(() => {
    demoModeRef.current = demoMode;
  }, [demoMode]);

  useEffect(() => {
    AsyncStorage.getItem(PROGRESS_STORAGE_KEY)
      .then((value) => {
        const parsed = Number.parseInt(value ?? "0", 10);
        if (Number.isFinite(parsed)) {
          setCurrentIndex(Math.max(0, Math.min(parsed, CHECKPOINTS.length)));
        }
      })
      .catch(() => {
        // The prototype still works without persistence.
      })
      .finally(() => setProgressLoaded(true));
  }, []);

  const stopWebLocation = useCallback(() => {
    if (typeof navigator !== "undefined" && webWatchIdRef.current !== null) {
      navigator.geolocation.clearWatch(webWatchIdRef.current);
      webWatchIdRef.current = null;
    }

    if (webTimeoutRef.current) {
      clearTimeout(webTimeoutRef.current);
      webTimeoutRef.current = null;
    }
  }, []);

  const startWebLocation = useCallback(() => {
    const browserWindow = typeof window === "undefined" ? null : window;
    const browserNavigator = typeof navigator === "undefined" ? null : navigator;
    const embedded = isEmbeddedBrowserContext();

    setWebEmbedded(embedded);
    setWebErrorCode(null);
    setLocationError(null);
    setLocationState("acquiring");
    setDemoMode(false);
    demoModeRef.current = false;
    webReceivedFixRef.current = false;
    stopWebLocation();

    if (!browserWindow?.isSecureContext) {
      setPermissionState("unavailable");
      setLocationState("error");
      setLocationError("Browser GPS requires an HTTPS address or localhost.");
      return;
    }

    if (!browserNavigator?.geolocation) {
      setPermissionState("unavailable");
      setLocationState("error");
      setLocationError("This browser does not provide location services.");
      return;
    }

    // Calling watchPosition directly from this button handler preserves the
    // browser's user gesture when Safari needs to show its permission prompt.
    setPermissionState("granted");

    const handleSuccess = (nextPosition: GeolocationPosition) => {
      if (demoModeRef.current) {
        return;
      }

      webReceivedFixRef.current = true;
      if (webTimeoutRef.current) {
        clearTimeout(webTimeoutRef.current);
        webTimeoutRef.current = null;
      }
      setPermissionState("granted");
      setPosition(browserPositionToExpoLocation(nextPosition));
      setLocationState("tracking");
      setLocationError(null);
      setWebErrorCode(null);

      const courseHeading = nextPosition.coords.heading;
      if (typeof courseHeading === "number" && Number.isFinite(courseHeading)) {
        setHeading(courseHeading);
      }
    };

    const handleError = (error: GeolocationPositionError) => {
      if (demoModeRef.current) {
        return;
      }

      setWebErrorCode(error.code);
      setLocationError(browserLocationErrorMessage(error, embedded));

      if (error.code === error.PERMISSION_DENIED) {
        setPermissionState("denied");
        setLocationState("error");
        stopWebLocation();
        return;
      }

      // POSITION_UNAVAILABLE and TIMEOUT do not mean the user revoked
      // permission. Keep the watcher alive so a later GPS fix can recover.
      setPermissionState("granted");
      if (!webReceivedFixRef.current) {
        setLocationState(error.code === error.TIMEOUT ? "timed-out" : "error");
      }
    };

    webWatchIdRef.current = browserNavigator.geolocation.watchPosition(
      handleSuccess,
      handleError,
      {
        enableHighAccuracy: true,
        maximumAge: 5_000,
        timeout: WEB_GPS_TIMEOUT_MS,
      },
    );

    webTimeoutRef.current = setTimeout(() => {
      if (!webReceivedFixRef.current && !demoModeRef.current) {
        setLocationState("timed-out");
        setLocationError(
          "Still waiting for a GPS fix. Tracking remains active; keep the page open and move into open sky.",
        );
      }
    }, WEB_GPS_TIMEOUT_MS);
  }, [stopWebLocation]);

  const startNativeLocationServices = useCallback(async () => {
    setPermissionState("checking");
    setLocationState("acquiring");
    setLocationError(null);
    setDemoMode(false);
    demoModeRef.current = false;

    try {
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        setPermissionState("unavailable");
        setLocationState("error");
        setLocationError("Location Services are switched off on this device.");
        return;
      }

      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== Location.PermissionStatus.GRANTED) {
        setPermissionState("denied");
        setLocationState("error");
        setLocationError("Location permission was not granted.");
        return;
      }

      setPermissionState("granted");
      setLocationAttempt((attempt) => attempt + 1);
    } catch (error) {
      setPermissionState("unavailable");
      setLocationState("error");
      setLocationError(locationErrorMessage(error));
    }
  }, []);

  useEffect(() => {
    if (Platform.OS !== "web") {
      startNativeLocationServices().catch((error) => {
        setPermissionState("unavailable");
        setLocationState("error");
        setLocationError(locationErrorMessage(error));
      });
      return;
    }

    let active = true;
    const embedded = isEmbeddedBrowserContext();
    setWebEmbedded(embedded);

    const browserWindow = typeof window === "undefined" ? null : window;
    const browserNavigator = typeof navigator === "undefined" ? null : navigator;

    if (!browserWindow?.isSecureContext) {
      setPermissionState("unavailable");
      setLocationState("error");
      setLocationError("Browser GPS requires an HTTPS address or localhost.");
      return;
    }

    if (!browserNavigator?.geolocation) {
      setPermissionState("unavailable");
      setLocationState("error");
      setLocationError("This browser does not provide location services.");
      return;
    }

    // Preserve a permission already granted to this exact website origin.
    // When the browser says "prompt" (or does not support Permissions.query),
    // wait for a visible tap so Safari can display the prompt reliably.
    const permissions = browserNavigator.permissions;
    if (!permissions?.query) {
      setPermissionState("prompt");
      setLocationState("idle");
      return;
    }

    permissions
      .query({ name: "geolocation" as PermissionName })
      .then((result) => {
        if (!active) {
          return;
        }

        if (result.state === "granted") {
          startWebLocation();
        } else {
          // Do not treat Permissions.query() as the final verdict on Safari.
          // The actual geolocation call, made from a tap, is authoritative.
          setPermissionState("prompt");
          setLocationState("idle");
          setLocationError(
            embedded
              ? "This preview may block GPS. Open the site directly in Safari."
              : null,
          );
        }
      })
      .catch(() => {
        if (active) {
          setPermissionState("prompt");
          setLocationState("idle");
        }
      });

    return () => {
      active = false;
      stopWebLocation();
    };
  }, [startNativeLocationServices, startWebLocation, stopWebLocation]);

  useEffect(() => {
    if (
      Platform.OS === "web" ||
      permissionState !== "granted" ||
      locationAttempt === 0
    ) {
      return;
    }

    let cancelled = false;
    let receivedFix = false;
    let locationSubscription: Location.LocationSubscription | null = null;
    let headingSubscription: Location.LocationSubscription | null = null;

    const timeout = setTimeout(() => {
      if (!cancelled && !receivedFix && !demoModeRef.current) {
        setLocationState("timed-out");
        setLocationError(
          "No location fix was received yet. You can retry while tracking continues.",
        );
      }
    }, GPS_TIMEOUT_MS);

    const acceptPosition = (nextPosition: Location.LocationObject) => {
      if (cancelled || demoModeRef.current) {
        return;
      }

      receivedFix = true;
      clearTimeout(timeout);
      setPosition(nextPosition);
      setLocationState("tracking");
      setLocationError(null);

      const courseHeading = nextPosition.coords.heading;
      if (typeof courseHeading === "number" && Number.isFinite(courseHeading)) {
        setHeading(courseHeading);
      }
    };

    const reportLocationError = (reason: unknown) => {
      if (cancelled || demoModeRef.current) {
        return;
      }

      setLocationError(locationErrorMessage(reason));
      if (!receivedFix) {
        setLocationState("error");
      }
    };

    async function subscribeNative() {
      try {
        const lastKnown = await Location.getLastKnownPositionAsync({
          maxAge: 2 * 60 * 1_000,
          requiredAccuracy: 500,
        });
        if (lastKnown) {
          acceptPosition(lastKnown);
        }
      } catch {
        // A cached position is optional; continue with a live request.
      }

      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
        .then(acceptPosition)
        .catch(reportLocationError);

      try {
        locationSubscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.BestForNavigation,
            timeInterval: 1_000,
            distanceInterval: 1,
            mayShowUserSettingsDialog: true,
          },
          acceptPosition,
          reportLocationError,
        );
      } catch (error) {
        reportLocationError(error);
      }

      try {
        headingSubscription = await Location.watchHeadingAsync(
          (nextHeading) => {
            const selectedHeading =
              nextHeading.trueHeading >= 0
                ? nextHeading.trueHeading
                : nextHeading.magHeading;
            setHeading(Number.isFinite(selectedHeading) ? selectedHeading : null);
          },
          () => setHeading(null),
        );
      } catch {
        setHeading(null);
      }

      if (cancelled) {
        locationSubscription?.remove();
        headingSubscription?.remove();
      }
    }

    subscribeNative().catch(reportLocationError);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      locationSubscription?.remove();
      headingSubscription?.remove();
    };
  }, [locationAttempt, permissionState]);

  const startLocationServices = useCallback(() => {
    if (Platform.OS === "web") {
      startWebLocation();
      return Promise.resolve();
    }

    return startNativeLocationServices();
  }, [startNativeLocationServices, startWebLocation]);

  const openDirectBrowserPage = useCallback(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") {
      return;
    }

    const directWindow = window.open(window.location.href, "_blank", "noopener,noreferrer");
    if (!directWindow) {
      window.location.assign(window.location.href);
    }
  }, []);

  const distance = useMemo(() => {
    if (!position || !currentCheckpoint) {
      return null;
    }
    return distanceMetres(position.coords, currentCheckpoint);
  }, [currentCheckpoint, position]);

  const bearing = useMemo(() => {
    if (!position || !currentCheckpoint) {
      return null;
    }
    return bearingDegrees(position.coords, currentCheckpoint);
  }, [currentCheckpoint, position]);

  const accuracy = position?.coords.accuracy ?? null;
  const targetVisible =
    !complete && distance !== null && distance <= REVEAL_RADIUS_METRES;
  const accurateEnough =
    demoMode ||
    (position !== null &&
      (accuracy === null
        ? Platform.OS === "web"
        : accuracy <= MAX_ACCEPTABLE_ACCURACY_METRES));

  const unlockCurrentCheckpoint = useCallback(async () => {
    if (unlockingRef.current || complete || !currentCheckpoint) {
      return;
    }

    unlockingRef.current = true;
    if (dwellTimerRef.current) {
      clearTimeout(dwellTimerRef.current);
      dwellTimerRef.current = null;
    }

    const unlockedLocation = currentCheckpoint.id;
    const nextIndex = Math.min(currentIndex + 1, CHECKPOINTS.length);

    setPopupLocation(unlockedLocation);
    setCurrentIndex(nextIndex);
    Vibration.vibrate(Platform.OS === "android" ? 120 : 80);

    try {
      await AsyncStorage.setItem(PROGRESS_STORAGE_KEY, String(nextIndex));
    } finally {
      unlockingRef.current = false;
    }
  }, [complete, currentCheckpoint, currentIndex]);

  useEffect(() => {
    const insideValidZone =
      popupLocation === null &&
      !complete &&
      distance !== null &&
      accurateEnough &&
      distance <= UNLOCK_RADIUS_METRES;

    if (!insideValidZone) {
      if (dwellTimerRef.current) {
        clearTimeout(dwellTimerRef.current);
        dwellTimerRef.current = null;
      }
      return;
    }

    if (!dwellTimerRef.current) {
      dwellTimerRef.current = setTimeout(() => {
        dwellTimerRef.current = null;
        unlockCurrentCheckpoint().catch(() => {
          unlockingRef.current = false;
        });
      }, DWELL_TIME_MS);
    }
  }, [accurateEnough, complete, distance, popupLocation, unlockCurrentCheckpoint]);

  useEffect(() => {
    return () => {
      if (dwellTimerRef.current) {
        clearTimeout(dwellTimerRef.current);
      }
    };
  }, []);

  const simulateCurrentCheckpoint = useCallback(() => {
    if (!currentCheckpoint || complete) {
      return;
    }

    if (dwellTimerRef.current) {
      clearTimeout(dwellTimerRef.current);
      dwellTimerRef.current = null;
    }

    demoModeRef.current = true;
    setPopupLocation(null);
    setDemoMode(true);
    setLocationState("demo");
    setLocationError(null);
    setHeading(0);
    setPosition({
      timestamp: Date.now(),
      coords: {
        latitude: currentCheckpoint.latitude,
        longitude: currentCheckpoint.longitude,
        altitude: null,
        accuracy: 5,
        altitudeAccuracy: null,
        heading: 0,
        speed: 0,
      },
    });
  }, [complete, currentCheckpoint]);

  const resetRoute = useCallback(() => {
    const performReset = () => {
      if (dwellTimerRef.current) {
        clearTimeout(dwellTimerRef.current);
        dwellTimerRef.current = null;
      }
      setPopupLocation(null);
      setCurrentIndex(0);
      setPosition(null);
      setDemoMode(false);
      demoModeRef.current = false;
      setLocationState(permissionState === "granted" ? "acquiring" : "idle");
      setLocationAttempt((attempt) => attempt + 1);
      AsyncStorage.setItem(PROGRESS_STORAGE_KEY, "0").catch(() => undefined);
    };

    if (Platform.OS === "web") {
      performReset();
      return;
    }

    Alert.alert("Reset circuit?", "This returns the app to Location 1.", [
      { text: "Cancel", style: "cancel" },
      { text: "Reset", style: "destructive", onPress: performReset },
    ]);
  }, [permissionState]);

  const statusText = useMemo(() => {
    if (complete) {
      return "All six locations unlocked";
    }
    if (demoMode) {
      return `Location ${currentCheckpoint?.id} detected — hold position`;
    }
    if (
      Platform.OS === "web" &&
      webEmbedded &&
      permissionState !== "granted"
    ) {
      return "Open this page directly in Safari to use GPS";
    }
    if (Platform.OS === "web" && permissionState === "prompt") {
      return "Tap START GPS to begin location tracking";
    }
    if (locationState === "timed-out" || locationState === "error") {
      return locationError ?? "Location unavailable";
    }
    if (!position) {
      return "Finding your GPS position…";
    }
    if (!accurateEnough) {
      return `Improving GPS accuracy (currently ±${Math.round(accuracy ?? 0)} m)`;
    }
    if (targetVisible) {
      return `Location ${currentCheckpoint?.id} detected — hold position`;
    }
    return `Searching for Location ${currentCheckpoint?.id}`;
  }, [
    accuracy,
    accurateEnough,
    complete,
    currentCheckpoint?.id,
    demoMode,
    locationError,
    locationState,
    permissionState,
    position,
    webEmbedded,
    targetVisible,
  ]);

  if (!progressLoaded || (Platform.OS !== "web" && permissionState === "checking")) {
    return (
      <LinearGradient colors={["#061912", "#020807"]} style={styles.loadingScreen}>
        <StatusBar style="light" />
        <ActivityIndicator color="#7AFFB6" size="large" />
        <Text style={styles.loadingText}>STARTING CHRISTMAS RADAR</Text>
      </LinearGradient>
    );
  }

  if (Platform.OS !== "web" && permissionState !== "granted") {
    return (
      <LinearGradient colors={["#071B14", "#020706"]} style={styles.permissionScreen}>
        <StatusBar style="light" />
        <Text style={styles.permissionIcon}>⌖</Text>
        <Text style={styles.permissionTitle}>Location access required</Text>
        <Text style={styles.permissionBody}>
          {Platform.OS === "web"
            ? "Allow location for this website, then try again. Use the HTTPS Vercel link or localhost."
            : "This prototype checks your precise location while the app is open so it can unlock the six outdoor checkpoints."}
        </Text>
        {locationError && <Text style={styles.permissionError}>{locationError}</Text>}
        <Pressable style={styles.primaryButton} onPress={startLocationServices}>
          <Text style={styles.primaryButtonText}>TRY AGAIN</Text>
        </Pressable>
        {permissionState === "denied" && Platform.OS !== "web" && (
          <Pressable style={styles.secondaryButton} onPress={() => Linking.openSettings()}>
            <Text style={styles.secondaryButtonText}>OPEN PHONE SETTINGS</Text>
          </Pressable>
        )}
      </LinearGradient>
    );
  }

  const gpsActionVisible =
    !demoMode &&
    (permissionState === "prompt" ||
      permissionState === "denied" ||
      permissionState === "unavailable" ||
      locationState === "timed-out" ||
      locationState === "error");
  const openDirectVisible =
    Platform.OS === "web" && webEmbedded && permissionState !== "granted";
  const gpsActionLabel = openDirectVisible
    ? "OPEN DIRECT"
    : permissionState === "prompt"
      ? "START GPS"
      : "TRY GPS";
  const gpsAction = openDirectVisible ? openDirectBrowserPage : startLocationServices;

  const gpsMetric = demoMode
    ? "DEMO"
    : permissionState === "prompt"
      ? "OFF"
      : permissionState === "denied"
        ? "BLOCKED"
        : locationState === "timed-out" || locationState === "error"
          ? "NO FIX"
          : position === null
            ? "WAIT"
            : accuracy === null
              ? "FIXED"
              : `±${Math.round(accuracy)} M`;

  return (
    <LinearGradient colors={["#08261B", "#020A08", "#07130F"]} style={styles.screen}>
      <StatusBar style="light" />
      {snowflakes.map((snowflake, index) => (
        <Text
          key={index}
          pointerEvents="none"
          style={[
            styles.snowflake,
            {
              left: snowflake.left,
              top: snowflake.top,
              fontSize: snowflake.size,
              opacity: snowflake.opacity,
            },
          ]}
        >
          ❄
        </Text>
      ))}

      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>ADI HQ OUTDOOR CIRCUIT</Text>
            <Text style={styles.appTitle}>CHRISTMAS TRACKER</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityHint="Long press to open hidden demo controls"
            delayLongPress={700}
            onLongPress={() => setDebugVisible((visible) => !visible)}
            style={styles.progressPill}
          >
            <Text style={styles.progressNumber}>{Math.min(currentIndex, 6)}/6</Text>
            <Text style={styles.progressLabel}>UNLOCKED</Text>
          </Pressable>
        </View>

        <View style={styles.radarArea}>
          <Radar
            size={radarSize}
            distance={distance}
            bearing={bearing}
            heading={heading}
            revealRadius={REVEAL_RADIUS_METRES}
            targetVisible={targetVisible}
            complete={complete}
          />
        </View>

        <View style={styles.messagePanel}>
          <View style={styles.messageTopRow}>
            <View style={[styles.statusDot, accurateEnough && styles.statusDotGood]} />
            <Text style={styles.statusText}>{statusText}</Text>
            {gpsActionVisible && (
              <Pressable style={styles.retryButton} onPress={gpsAction}>
                <Text style={styles.retryButtonText}>{gpsActionLabel}</Text>
              </Pressable>
            )}
          </View>
          <Text style={styles.instructionText}>
            {complete
              ? "Circuit complete. Reset the route to run another demo."
              : `Follow the planned clockwise route. The next checkpoint appears within ${REVEAL_RADIUS_METRES} metres and unlocks within ${UNLOCK_RADIUS_METRES} metres.`}
          </Text>
          <View style={styles.metricsRow}>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>NEXT</Text>
              <Text style={styles.metricValue}>
                {complete ? "DONE" : `LOCATION ${currentCheckpoint?.id}`}
              </Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>GPS</Text>
              <Text style={styles.metricValue}>{gpsMetric}</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>DISTANCE</Text>
              <Text style={styles.metricValue}>
                {distance === null ? "--" : `${Math.round(distance)} M`}
              </Text>
            </View>
          </View>
        </View>

        {debugVisible && (
          <View style={styles.debugPanel}>
            <Text style={styles.debugTitle}>DEMO CONTROLS</Text>
            <Text style={styles.debugBody}>
              Simulate the active checkpoint to show its radar dot and unlock popup after two seconds.
              {Platform.OS === "web"
                ? ` Web: ${webEmbedded ? "embedded" : "direct"}; permission: ${permissionState}; error code: ${webErrorCode ?? "none"}.`
                : ""}
            </Text>
            <View style={styles.debugButtons}>
              <Pressable
                disabled={complete}
                style={[styles.debugButton, complete && styles.debugButtonDisabled]}
                onPress={simulateCurrentCheckpoint}
              >
                <Text style={styles.debugButtonText}>SIMULATE NEXT</Text>
              </Pressable>
              <Pressable style={styles.debugButton} onPress={startLocationServices}>
                <Text style={styles.debugButtonText}>REAL GPS</Text>
              </Pressable>
              <Pressable style={styles.debugButton} onPress={resetRoute}>
                <Text style={styles.debugButtonText}>RESET</Text>
              </Pressable>
            </View>
          </View>
        )}
      </SafeAreaView>

      <UnlockCard
        visible={popupLocation !== null}
        locationNumber={popupLocation}
        finalLocation={popupLocation === CHECKPOINTS.length}
        onDismiss={() => setPopupLocation(null)}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: 17,
  },
  snowflake: {
    position: "absolute",
    color: "#E9FFF4",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 8,
  },
  eyebrow: {
    color: "#78DCA7",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.7,
  },
  appTitle: {
    marginTop: 3,
    color: "#FFFDF7",
    fontSize: 23,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  progressPill: {
    minWidth: 70,
    alignItems: "center",
    borderRadius: 16,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 104, 130, 0.52)",
    backgroundColor: "rgba(144, 12, 43, 0.25)",
  },
  progressNumber: {
    color: "#FFF8F2",
    fontSize: 17,
    lineHeight: 18,
    fontWeight: "900",
  },
  progressLabel: {
    color: "#FF96AA",
    fontSize: 7,
    fontWeight: "900",
    letterSpacing: 1.1,
    marginTop: 2,
  },
  radarArea: {
    flex: 1,
    minHeight: 260,
    alignItems: "center",
    justifyContent: "center",
  },
  messagePanel: {
    borderRadius: 20,
    padding: 16,
    marginBottom: 10,
    backgroundColor: "rgba(7, 31, 23, 0.9)",
    borderWidth: 1,
    borderColor: "rgba(111, 255, 174, 0.22)",
  },
  messageTopRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    marginRight: 9,
    backgroundColor: "#FFBE4B",
  },
  statusDotGood: {
    backgroundColor: "#54F59A",
  },
  statusText: {
    flex: 1,
    color: "#F3FFF8",
    fontWeight: "800",
    fontSize: 14,
  },
  retryButton: {
    marginLeft: 10,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: "rgba(122, 255, 182, 0.38)",
    backgroundColor: "rgba(122, 255, 182, 0.1)",
  },
  retryButtonText: {
    color: "#A8FFCF",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  instructionText: {
    color: "#AFCDBE",
    fontSize: 12,
    lineHeight: 17,
    marginTop: 8,
  },
  metricsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 14,
    paddingTop: 13,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(188, 255, 216, 0.18)",
  },
  metric: {
    flex: 1,
    alignItems: "center",
  },
  metricDivider: {
    width: StyleSheet.hairlineWidth,
    height: 27,
    backgroundColor: "rgba(188, 255, 216, 0.2)",
  },
  metricLabel: {
    color: "#668D79",
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  metricValue: {
    marginTop: 3,
    color: "#DFFFF0",
    fontSize: 11,
    fontWeight: "900",
  },
  debugPanel: {
    marginBottom: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 205, 92, 0.48)",
    backgroundColor: "rgba(58, 41, 4, 0.94)",
    padding: 13,
  },
  debugTitle: {
    color: "#FFE296",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.4,
  },
  debugBody: {
    color: "#D5C89D",
    fontSize: 11,
    lineHeight: 15,
    marginTop: 5,
  },
  debugButtons: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  debugButton: {
    flex: 1,
    alignItems: "center",
    borderRadius: 10,
    paddingVertical: 10,
    backgroundColor: "rgba(255, 221, 126, 0.14)",
    borderWidth: 1,
    borderColor: "rgba(255, 221, 126, 0.28)",
  },
  debugButtonDisabled: {
    opacity: 0.35,
  },
  debugButtonText: {
    color: "#FFE8A6",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.7,
  },
  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    color: "#AEFFD1",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.8,
    marginTop: 18,
  },
  permissionScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
  },
  permissionIcon: {
    color: "#7AFFB6",
    fontSize: 64,
    marginBottom: 16,
  },
  permissionTitle: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 28,
    textAlign: "center",
  },
  permissionBody: {
    color: "#BBD7C8",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginTop: 12,
    marginBottom: 12,
  },
  permissionError: {
    color: "#FFB7C4",
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center",
    marginBottom: 20,
  },
  primaryButton: {
    width: "100%",
    maxWidth: 340,
    alignItems: "center",
    paddingVertical: 15,
    borderRadius: 999,
    backgroundColor: "#D91F45",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    letterSpacing: 1.1,
  },
  secondaryButton: {
    marginTop: 12,
    padding: 10,
  },
  secondaryButtonText: {
    color: "#9AFFC5",
    fontWeight: "800",
    fontSize: 12,
  },
});
