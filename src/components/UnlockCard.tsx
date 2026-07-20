import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

type UnlockCardProps = {
  visible: boolean;
  locationNumber: number | null;
  finalLocation: boolean;
  onDismiss: () => void;
};

export function UnlockCard({
  visible,
  locationNumber,
  finalLocation,
  onDismiss,
}: UnlockCardProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.backdrop}>
        <LinearGradient
          colors={["#123D2D", "#071B14"]}
          style={styles.card}
        >
          <Text style={styles.kicker}>✦ CHRISTMAS SIGNAL FOUND ✦</Text>
          <Text style={styles.title}>
            You've unlocked{`\n`}Location {locationNumber}
          </Text>
          <Text style={styles.body}>
            {finalLocation
              ? "All six locations are complete. Return to the start and celebrate!"
              : "Checkpoint confirmed. Your next location is now active."}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={onDismiss}
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          >
            <Text style={styles.buttonText}>
              {finalLocation ? "FINISH CIRCUIT" : "CONTINUE"}
            </Text>
          </Pressable>
        </LinearGradient>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 26,
    backgroundColor: "rgba(0, 5, 4, 0.72)",
  },
  card: {
    width: "100%",
    maxWidth: 390,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "rgba(156, 255, 197, 0.55)",
    paddingHorizontal: 24,
    paddingVertical: 28,
    alignItems: "center",
    shadowColor: "#58FF9F",
    shadowOpacity: 0.28,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 18,
  },
  kicker: {
    color: "#9DFFC6",
    fontWeight: "900",
    fontSize: 11,
    letterSpacing: 1.6,
    marginBottom: 14,
  },
  title: {
    color: "#FFFDF8",
    fontSize: 31,
    lineHeight: 36,
    fontWeight: "900",
    textAlign: "center",
  },
  body: {
    color: "#CDE8DA",
    textAlign: "center",
    fontSize: 15,
    lineHeight: 22,
    marginTop: 14,
    marginBottom: 24,
  },
  button: {
    minWidth: 190,
    alignItems: "center",
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: "#D91F45",
    borderWidth: 1,
    borderColor: "#FF8199",
  },
  buttonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 13,
    letterSpacing: 1.1,
  },
});
