import React, { ErrorInfo, ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

type Props = {
  children: ReactNode;
};

type State = {
  error: Error | null;
};

export class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("CHRISTMAS TRACKER failed to render", error, info.componentStack);
  }

  private reload = () => {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <View style={styles.screen}>
        <Text style={styles.kicker}>CHRISTMAS TRACKER</Text>
        <Text style={styles.title}>The prototype could not start</Text>
        <Text style={styles.body}>
          Reload the page. If this remains visible, open the browser console and copy the
          first red error message.
        </Text>
        <Pressable style={styles.button} onPress={this.reload}>
          <Text style={styles.buttonText}>RELOAD APP</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
    backgroundColor: "#03110D",
  },
  kicker: {
    color: "#78DCA7",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.8,
  },
  title: {
    marginTop: 10,
    color: "#FFFFFF",
    fontSize: 26,
    fontWeight: "900",
    textAlign: "center",
  },
  body: {
    maxWidth: 460,
    marginTop: 12,
    color: "#BBD7C8",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
  button: {
    marginTop: 22,
    borderRadius: 999,
    paddingHorizontal: 24,
    paddingVertical: 14,
    backgroundColor: "#D91F45",
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    letterSpacing: 1,
  },
});
