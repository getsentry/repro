import React, { useEffect, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  Button,
} from 'react-native';
import * as Sentry from '@sentry/react-native';

// Counter to track getRandomValues calls
let getRandomValuesCallCount = 0;
const callStacks: string[] = [];

// Monkey-patch crypto.getRandomValues to count calls and capture stack traces
const originalGetRandomValues = global.crypto?.getRandomValues;
if (originalGetRandomValues) {
  global.crypto.getRandomValues = function(...args: any[]) {
    getRandomValuesCallCount++;

    // Capture stack trace to see where calls are coming from
    const stack = new Error().stack || '';
    const relevantStack = stack
      .split('\n')
      .slice(2, 6) // Skip first 2 lines (Error and this function)
      .map(line => line.trim())
      .join('\n  ');

    if (getRandomValuesCallCount <= 5 || getRandomValuesCallCount % 20 === 0) {
      console.log(`[getRandomValues] Call #${getRandomValuesCallCount}`);
      console.log(`  Stack:\n  ${relevantStack}`);
    }

    callStacks.push(relevantStack);

    return originalGetRandomValues.apply(this, args);
  };
}

// Initialize Sentry
Sentry.init({
  dsn: process.env.SENTRY_DSN || '', // Set SENTRY_DSN env var or leave empty for testing
  environment: __DEV__ ? 'development' : 'production',

  // Keep disabled to avoid attaching stacktraces to non-exception events
  attachStacktrace: false,

  // Generic targets
  tracePropagationTargets: ['localhost', 'httpbin.org'],

  // Keep the same behavior as the original wrapper
  tracesSampleRate: 1,

  integrations: [
    Sentry.reactNativeTracingIntegration?.({ idleTimeoutMs: 1500 }),
  ].filter(Boolean),
});

function App(): React.JSX.Element {
  const [callCount, setCallCount] = useState(0);
  const [fetchStatus, setFetchStatus] = useState('');

  useEffect(() => {
    // Update call count every 100ms
    const interval = setInterval(() => {
      setCallCount(getRandomValuesCallCount);
    }, 100);

    // Automatically run a test after 2 seconds
    const timeout = setTimeout(() => {
      console.log('[Auto-test] Running automatic fetch test...');
      makeRequest();
    }, 2000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, []);

  const makeRequest = async () => {
    // Reset counter before the request
    const beforeCount = getRandomValuesCallCount;
    const stacksBefore = callStacks.length;
    console.log(`\n[Test] Starting fetch request. Current getRandomValues calls: ${beforeCount}`);
    setFetchStatus('Making request...');

    try {
      // Make a simple HTTP request
      const response = await fetch('https://httpbin.org/get');
      const data = await response.json();

      const afterCount = getRandomValuesCallCount;
      const callsDuringRequest = afterCount - beforeCount;

      console.log(`\n[Test] Fetch completed. getRandomValues calls during this request: ${callsDuringRequest}`);

      // Analyze the call stacks to find patterns
      const stacksDuringRequest = callStacks.slice(stacksBefore);
      const uniqueStacks = new Set(stacksDuringRequest);

      console.log(`\n[Analysis] Unique call patterns: ${uniqueStacks.size}`);
      console.log(`[Analysis] Total calls: ${callsDuringRequest}`);
      console.log(`[Analysis] Duplicated calls: ${callsDuringRequest - uniqueStacks.size}`);

      // Show a few unique stack patterns
      let i = 0;
      for (const stack of uniqueStacks) {
        if (i < 3) {
          console.log(`\n[Pattern ${i + 1}]:\n  ${stack}`);
        }
        i++;
      }

      setFetchStatus(`Request completed. getRandomValues calls: ${callsDuringRequest} (${uniqueStacks.size} unique patterns)`);
    } catch (error) {
      console.error('[Test] Fetch error:', error);
      const afterCount = getRandomValuesCallCount;
      const callsDuringRequest = afterCount - beforeCount;
      setFetchStatus(`Request failed. getRandomValues calls: ${callsDuringRequest}`);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.scrollView}>
        <View style={styles.content}>
          <Text style={styles.title}>
            Sentry React Native getRandomValues Test
          </Text>

          <Text style={styles.description}>
            This app demonstrates the excessive getRandomValues calls issue.
            Each fetch request should create ~2-3 spans but may trigger 90+ getRandomValues calls.
          </Text>

          <View style={styles.statsBox}>
            <Text style={styles.statsTitle}>
              Total getRandomValues calls:
            </Text>
            <Text style={styles.statsValue}>{callCount}</Text>
          </View>

          {fetchStatus ? (
            <View style={styles.statusBox}>
              <Text style={styles.statusText}>{fetchStatus}</Text>
            </View>
          ) : null}

          <Button title="Make HTTP Request" onPress={makeRequest} />

          <View style={styles.instructions}>
            <Text style={styles.instructionsTitle}>Instructions:</Text>
            <Text style={styles.instructionsText}>
              1. Open React Native debugger or Metro logs{'\n'}
              2. Click "Make HTTP Request"{'\n'}
              3. Check the console for getRandomValues call counts{'\n'}
              4. Expected: ~2-5 calls per request{'\n'}
              5. Actual: ~90+ calls per request
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollView: {
    flexGrow: 1,
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
  },
  statsBox: {
    backgroundColor: '#f0f0f0',
    padding: 20,
    borderRadius: 10,
    marginBottom: 20,
    alignItems: 'center',
  },
  statsTitle: {
    fontSize: 16,
    marginBottom: 10,
  },
  statsValue: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#e74c3c',
  },
  statusBox: {
    backgroundColor: '#e8f4f8',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
  },
  statusText: {
    fontSize: 14,
    color: '#2c3e50',
  },
  instructions: {
    marginTop: 30,
    padding: 15,
    backgroundColor: '#fff3cd',
    borderRadius: 8,
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  instructionsText: {
    fontSize: 14,
    lineHeight: 20,
  },
});

export default App;
