import React, { useEffect, useMemo, useRef } from "react";
import {
  Animated,
  Easing,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient as SvgLinearGradient,
  Path,
  Stop,
} from "react-native-svg";

import { normalizeDegrees } from "../utils/geo";

type RadarProps = {
  size: number;
  distance: number | null;
  bearing: number | null;
  heading: number | null;
  revealRadius: number;
  targetVisible: boolean;
  complete: boolean;
};

export function Radar({
  size,
  distance,
  bearing,
  heading,
  revealRadius,
  targetVisible,
  complete,
}: RadarProps) {
  const sweep = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let cancelled = false;
    let activeAnimation: Animated.CompositeAnimation | null = null;

    const runSweep = () => {
      if (cancelled) {
        return;
      }

      // Reset explicitly before every pass. This is more reliable in the web
      // preview than Animated.loop with a native-driver transform.
      sweep.setValue(0);
      activeAnimation = Animated.timing(sweep, {
        toValue: 1,
        duration: 2_700,
        easing: Easing.linear,
        useNativeDriver: Platform.OS !== "web",
      });

      activeAnimation.start(({ finished }) => {
        if (finished && !cancelled) {
          runSweep();
        }
      });
    };

    runSweep();

    return () => {
      cancelled = true;
      activeAnimation?.stop();
    };
  }, [sweep]);

  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          easing: Easing.out(Easing.quad),
          useNativeDriver: Platform.OS !== "web",
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 700,
          easing: Easing.in(Easing.quad),
          useNativeDriver: Platform.OS !== "web",
        }),
      ]),
    );
    pulseLoop.start();
    return () => pulseLoop.stop();
  }, [pulse]);

  const sweepRotation = sweep.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const dotPosition = useMemo(() => {
    if (!targetVisible || distance === null || bearing === null) {
      return null;
    }

    const radius = size * 0.38;
    const scaledDistance = Math.max(8, Math.min(distance / revealRadius, 1) * radius);
    const relativeBearing = normalizeDegrees(bearing - (heading ?? 0));
    const angle = ((relativeBearing - 90) * Math.PI) / 180;

    return {
      left: size / 2 + Math.cos(angle) * scaledDistance - 8,
      top: size / 2 + Math.sin(angle) * scaledDistance - 8,
    };
  }, [bearing, distance, heading, revealRadius, size, targetVisible]);

  const pulseScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 2.2],
  });

  const pulseOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.6, 0],
  });

  const centre = size / 2;
  const outerRadius = size * 0.46;

  return (
    <View style={[styles.shell, { width: size, height: size }]}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <SvgLinearGradient id="radarGlow" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#0A2C20" />
            <Stop offset="1" stopColor="#020A08" />
          </SvgLinearGradient>
        </Defs>
        <Circle cx={centre} cy={centre} r={outerRadius} fill="url(#radarGlow)" />
        {[0.23, 0.46, 0.69, 0.92].map((fraction) => (
          <Circle
            key={fraction}
            cx={centre}
            cy={centre}
            r={outerRadius * fraction}
            fill="none"
            stroke="rgba(104, 255, 170, 0.24)"
            strokeWidth={1}
          />
        ))}
        <Line
          x1={centre}
          y1={centre - outerRadius}
          x2={centre}
          y2={centre + outerRadius}
          stroke="rgba(104, 255, 170, 0.18)"
          strokeWidth={1}
        />
        <Line
          x1={centre - outerRadius}
          y1={centre}
          x2={centre + outerRadius}
          y2={centre}
          stroke="rgba(104, 255, 170, 0.18)"
          strokeWidth={1}
        />
        <Path
          d={`M ${centre - 10} ${centre} L ${centre} ${centre - 10} L ${
            centre + 10
          } ${centre} L ${centre} ${centre + 10} Z`}
          fill="#F4FFF9"
          opacity={0.85}
        />
      </Svg>

      <Animated.View
        pointerEvents="none"
        style={[
          styles.sweepContainer,
          {
            width: size,
            height: size,
            transform: [{ rotate: sweepRotation }],
          },
        ]}
      >
        <View
          style={[
            styles.sweepBeam,
            {
              left: size / 2,
              top: size / 2 - 1,
              width: outerRadius,
            },
          ]}
        />
        <View
          style={[
            styles.sweepGlow,
            {
              left: size / 2,
              top: size / 2 - 24,
              width: outerRadius,
            },
          ]}
        />
      </Animated.View>

      {dotPosition && (
        <View style={[styles.dotContainer, dotPosition]}>
          <Animated.View
            style={[
              styles.dotPulse,
              {
                opacity: pulseOpacity,
                transform: [{ scale: pulseScale }],
              },
            ]}
          />
          <View style={styles.dot} />
        </View>
      )}

      <View style={styles.northMarker}>
        <Text style={styles.northText}>{heading === null ? "N" : "▲"}</Text>
      </View>

      <View style={styles.radarCaption}>
        <Text style={styles.radarCaptionText}>
          {complete
            ? "CIRCUIT COMPLETE"
            : targetVisible
              ? "TARGET ACQUIRED"
              : "SCANNING"}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "rgba(114, 255, 177, 0.55)",
    shadowColor: "#45FF9B",
    shadowOpacity: 0.3,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  sweepContainer: {
    position: "absolute",
  },
  sweepBeam: {
    position: "absolute",
    height: 2,
    backgroundColor: "rgba(121, 255, 184, 0.95)",
    shadowColor: "#79FFB8",
    shadowOpacity: 0.8,
    shadowRadius: 8,
  },
  sweepGlow: {
    position: "absolute",
    height: 48,
    backgroundColor: "rgba(84, 255, 161, 0.08)",
    borderTopRightRadius: 60,
    borderBottomRightRadius: 60,
  },
  dotContainer: {
    position: "absolute",
    width: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#FF365C",
    borderWidth: 2,
    borderColor: "#FFF8F1",
    shadowColor: "#FF365C",
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 8,
  },
  dotPulse: {
    position: "absolute",
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#FF5B78",
  },
  northMarker: {
    position: "absolute",
    top: 11,
    alignItems: "center",
  },
  northText: {
    color: "#E6FFF0",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1,
  },
  radarCaption: {
    position: "absolute",
    bottom: 28,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "rgba(1, 10, 7, 0.72)",
    borderWidth: 1,
    borderColor: "rgba(121, 255, 184, 0.24)",
  },
  radarCaptionText: {
    color: "#A9FFD0",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.7,
  },
});
