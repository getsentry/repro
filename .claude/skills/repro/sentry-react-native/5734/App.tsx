import React, { useEffect } from "react";
import { Button, Text, View, StyleSheet } from "react-native";
import * as Sentry from "@sentry/react-native";

// Using the public DSN from the sentry-react-native Expo sample for testing
const DSN = "https://1df17bd4e543fdb31351dee1768bb679@o447951.ingest.sentry.io/5428561";

Sentry.init({
  dsn: DSN,
  debug: true, // Check console for "[Sentry]" logs
  tracesSampleRate: 1.0,
  spotlight: true,
  // NOTE: We do NOT set enableNative or autoInitializeNativeSdk here.
  // The presence of sentry.options.json (from useNativeInit + options in app.json)
  // causes the SDK to auto-set autoInitializeNativeSdk=false via __SENTRY_OPTIONS__.
});

function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Repro #5734</Text>
      <Text style={styles.subtitle}>
        SDK doesn't work on Expo Go when useNativeInit: true
      </Text>

      <View style={styles.spacer} />

      <Button
        title="Capture Error"
        onPress={() => {
          console.log("[Repro] Capturing error...");
          Sentry.captureException(new Error("Test error from repro #5734"));
          console.log("[Repro] Error captured - check sentry.io");
        }}
      />

      <View style={styles.spacer} />

      <Button
        title="Capture Message"
        onPress={() => {
          console.log("[Repro] Capturing message...");
          Sentry.captureMessage("Test message from repro #5734");
          console.log("[Repro] Message captured - check sentry.io");
        }}
      />

      <View style={styles.spacer} />

      <Text style={styles.info}>
        1. Set SENTRY_DSN env var{"\n"}
        2. Run: npx expo run:android (dev build){"\n"}
        3. Tap buttons above{"\n"}
        4. Events should appear on sentry.io{"\n"}
        {"\n"}
        Bug: Events show in Spotlight but NOT on sentry.io{"\n"}
        when useNativeInit: true is set in app.json
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20 },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 8 },
  subtitle: { fontSize: 14, color: "#666", textAlign: "center", marginBottom: 20 },
  spacer: { height: 12 },
  info: { fontSize: 12, color: "#999", textAlign: "center", marginTop: 30 },
});

export default Sentry.wrap(App);
