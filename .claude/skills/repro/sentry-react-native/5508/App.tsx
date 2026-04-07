import React, { useState } from 'react';
import { Button, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import * as Sentry from '@sentry/react-native';

// Toggle which initialization to use:
// - 'buggy': Sentry.init() is first statement after early return (drops events in prod)
// - 'workaround': console.log before Sentry.init() (works in prod)
//
// Change this value and rebuild to test each path.
const INIT_MODE: 'buggy' | 'workaround' = 'buggy';

if (INIT_MODE === 'buggy') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { initializeSentryBuggy } = require('./lib/sentry-buggy');
  initializeSentryBuggy();
} else {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { initializeSentryWorkaround } = require('./lib/sentry-workaround');
  initializeSentryWorkaround();
}

function App(): React.JSX.Element {
  const [lastAction, setLastAction] = useState<string>('No action yet');

  const sendTestEvent = () => {
    try {
      Sentry.captureException(new Error(`Test error from repro-5508 (mode: ${INIT_MODE})`));
      setLastAction(`Event sent (mode: ${INIT_MODE}) - check Sentry dashboard`);
    } catch (e) {
      setLastAction(`Error sending event: ${e}`);
    }
  };

  const sendTestMessage = () => {
    Sentry.captureMessage(`Test message from repro-5508 (mode: ${INIT_MODE})`);
    setLastAction(`Message sent (mode: ${INIT_MODE}) - check Sentry dashboard`);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Repro #5508</Text>
        <Text style={styles.subtitle}>
          Init mode: {INIT_MODE}
        </Text>
        <Text style={styles.description}>
          {INIT_MODE === 'buggy'
            ? 'BUG: Sentry.init() is first statement after guard - events may be dropped in production'
            : 'WORKAROUND: console.log before Sentry.init() - events should work'}
        </Text>

        <View style={styles.buttons}>
          <Button title="Send Test Exception" onPress={sendTestEvent} />
          <View style={styles.spacer} />
          <Button title="Send Test Message" onPress={sendTestMessage} />
        </View>

        <Text style={styles.status}>{lastAction}</Text>
        <Text style={styles.hint}>
          Check your Sentry dashboard to see if the event arrived.
          {'\n\n'}
          To test both modes, change INIT_MODE in App.tsx and rebuild.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#666', marginBottom: 16 },
  description: { fontSize: 14, color: '#333', textAlign: 'center', marginBottom: 32, paddingHorizontal: 20 },
  buttons: { marginBottom: 24 },
  spacer: { height: 12 },
  status: { fontSize: 14, fontWeight: '600', textAlign: 'center', marginBottom: 16, color: '#0066cc' },
  hint: { fontSize: 12, color: '#999', textAlign: 'center', paddingHorizontal: 20 },
});

export default Sentry.wrap(App);
