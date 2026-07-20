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

type PermissionState = "checking" | "granted" | "denied" | "unavailable";

const snowflakes = [
  { left: "7%", top: "12%", size: 12, opacity: 0.35 },
  { left: "86%", top: "16%", size: 18, opacity: 0.28 },
  { left: "13%", top: "58%", size: 16, opacity: 0.18 },
  { left: "88%", top: "66%", size: 11, opacity: 0.34 },
  { left: "72%", top: "8%", size: 10, opacity: 0.2 },
  { left: "31%", top: "25%", size: 8, opacity: 0.16 },
] as const;

export default function App() {
  const { width, height } = useWindowDimensions();
  const radarSize = Math.min(width - 34, height * 0.47, 430);

  const [permissionState, setPermissionState] = useState<PermissionState>("checking");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progressLoaded, setProgressLoaded] = useState(false);
  const [position, setPosition] = useState<Location.LocationObject | null>(null);
  const [heading, setHeading] = useState<number | null>(null);
  const [popupLocation, setPopupLocation] = useState<number | null>(null);
  const [debugVisible, setDebugVisible] = useState(false);

  const dwellTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unlockingRef = useRef(false);

  const complete = currentIndex >= CHECKPOINTS.length;
  const currentCheckpoint = complete ? null : CHECKPOINTS[currentIndex];

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

  const startLocationServices = useCallback(async () => {
    setPermissionState("checking");

    const servicesEnabled = await Location.hasServicesEnabledAsync();
    if (!servicesEnabled) {
      setPermissionState("unavailable");
      return;
    }

    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== Location.PermissionStatus.GRANTED) {
      setPermissionState("denied");
      return;
    }

    setPermissionState("granted");
  }, []);

  useEffect(() => {
    startLocationServices().catch(() => setPermissionState("unavailable"));
  }, [startLocationServices]);

  useEffect(() => {
    if (permissionState !== "granted") {
      return;
    }

    let locationSubscription: Location.LocationSubscription | null = null;
    let headingSubscription: Location.LocationSubscription | null = null;
    let cancelled = false;

    async function subscribe() {
      locationSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 1_000,
          distanceInterval: 1,
          mayShowUserSettingsDialog: true,
        },
        (nextPosition) => setPosition(nextPosition),
      );

      headingSubscription = await Location.watchHeadingAsync((nextHeading) => {
        const selectedHeading =
          nextHeading.trueHeading >= 0 ? nextHeading.trueHeading : nextHeading.magHeading;
        setHeading(Number.isFinite(selectedHeading) ? selectedHeading : null);
      });

      if (cancelled) {
        locationSubscription.remove();
        headingSubscription.remove();
      }
    }

    subscribe().catch(() => setPermissionState("unavailable"));

    return () => {
      cancelled = true;
      locationSubscription?.remove();
      headingSubscription?.remove();
    };
  }, [permissionState]);

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
    accuracy !== null && accuracy <= MAX_ACCEPTABLE_ACCURACY_METRES;

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

  const resetRoute = useCallback(() => {
    Alert.alert(
      "Reset circuit?",
      "This returns the app to Location 1.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: () => {
            if (dwellTimerRef.current) {
              clearTimeout(dwellTimerRef.current);
              dwellTimerRef.current = null;
            }
            setPopupLocation(null);
            setCurrentIndex(0);
            AsyncStorage.setItem(PROGRESS_STORAGE_KEY, "0").catch(() => undefined);
          },
        },
      ],
    );
  }, []);

  const statusText = useMemo(() => {
    if (complete) {
      return "All six locations unlocked";
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
  }, [accuracy, accurateEnough, complete, currentCheckpoint?.id, position, targetVisible]);

  if (!progressLoaded || permissionState === "checking") {
    return (
      <LinearGradient colors={["#061912", "#020807"]} style={styles.loadingScreen}>
        <StatusBar style="light" />
        <ActivityIndicator color="#7AFFB6" size="large" />
        <Text style={styles.loadingText}>STARTING CHRISTMAS RADAR</Text>
      </LinearGradient>
    );
  }

  if (permissionState !== "granted") {
    return (
      <LinearGradient colors={["#071B14", "#020706"]} style={styles.permissionScreen}>
        <StatusBar style="light" />
        <Text style={styles.permissionIcon}>⌖</Text>
        <Text style={styles.permissionTitle}>Location access required</Text>
        <Text style={styles.permissionBody}>
          This prototype only checks your location while the app is open. Precise
          location is needed to unlock the six outdoor checkpoints.
        </Text>
        <Pressable style={styles.primaryButton} onPress={startLocationServices}>
          <Text style={styles.primaryButtonText}>TRY AGAIN</Text>
        </Pressable>
        {permissionState === "denied" && (
          <Pressable style={styles.secondaryButton} onPress={() => Linking.openSettings()}>
            <Text style={styles.secondaryButtonText}>OPEN PHONE SETTINGS</Text>
          </Pressable>
        )}
      </LinearGradient>
    );
  }

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
          </View>
          <Text style={styles.instructionText}>
            {complete
              ? "Circuit complete. Use the hidden test panel to reset for another demo."
              : "Follow the planned clockwise route. The next checkpoint appears only when you are within 10 metres."}
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
              <Text style={styles.metricValue}>
                {accuracy === null ? "WAIT" : `±${Math.round(accuracy)} M`}
              </Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>RADAR</Text>
              <Text style={styles.metricValue}>
                {heading === null ? "NORTH" : "HEADING"}
              </Text>
            </View>
          </View>
        </View>

        {debugVisible && (
          <View style={styles.debugPanel}>
            <Text style={styles.debugTitle}>ON-SITE TEST PANEL</Text>
            <Text style={styles.debugBody}>
              This panel is hidden during normal use. Long-press the progress badge to
              show or hide it.
            </Text>
            <View style={styles.debugButtons}>
              <Pressable
                disabled={complete}
                style={[styles.debugButton, complete && styles.debugButtonDisabled]}
                onPress={() => unlockCurrentCheckpoint()}
              >
                <Text style={styles.debugButtonText}>SIMULATE UNLOCK</Text>
              </Pressable>
              <Pressable style={styles.debugButton} onPress={resetRoute}>
                <Text style={styles.debugButtonText}>RESET ROUTE</Text>
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
    minHeight: 280,
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
    marginBottom: 24,
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
