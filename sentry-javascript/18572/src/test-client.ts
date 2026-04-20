// Test client that hammers the endpoints with higher concurrency to trigger the context
// propagation issue. The reporter noted this only manifests under sustained concurrent traffic.

const BASE_URL = 'http://localhost:3000';

async function makeRequest(url: string, label: string): Promise<void> {
  try {
    const res = await fetch(url);
    const data = await res.json();
    console.log(`[${label}] OK:`, JSON.stringify(data).slice(0, 120));
  } catch (err) {
    console.error(`[${label}] ERROR:`, err);
  }
}

async function runWave(waveNum: number, concurrency: number): Promise<void> {
  console.log(`\n=== Wave ${waveNum}: ${concurrency} concurrent requests ===`);
  const promises: Promise<void>[] = [];
  for (let i = 0; i < concurrency; i++) {
    // Mix all three endpoints to stress context management across both gRPC services
    promises.push(makeRequest(`${BASE_URL}/test-grpc`, `w${waveNum}-grpc-${i}`));
    promises.push(makeRequest(`${BASE_URL}/test-concurrent`, `w${waveNum}-conc-${i}`));
    promises.push(makeRequest(`${BASE_URL}/test-cross-service`, `w${waveNum}-cross-${i}`));
  }
  await Promise.all(promises);
}

async function runTest() {
  console.log('=== Warming up with single requests ===');
  await makeRequest(`${BASE_URL}/test-grpc`, 'warmup-grpc');
  await makeRequest(`${BASE_URL}/test-concurrent`, 'warmup-concurrent');
  await makeRequest(`${BASE_URL}/test-cross-service`, 'warmup-cross');

  // Ramp up concurrency in waves to simulate production-level load
  for (let wave = 1; wave <= 5; wave++) {
    await runWave(wave, wave * 10);
  }

  // Sustained high concurrency burst
  console.log('\n=== Sustained burst: 100 concurrent requests ===');
  const burst: Promise<void>[] = [];
  for (let i = 0; i < 100; i++) {
    const endpoint = ['/test-grpc', '/test-concurrent', '/test-cross-service'][i % 3];
    burst.push(makeRequest(`${BASE_URL}${endpoint}`, `burst-${i}`));
  }
  await Promise.all(burst);

  console.log('\n=== Done. Check server logs for [CONTEXT-DEBUG] UNEXPECTED_ROOT entries. ===');
  console.log('EXPECTED_ROOT spans like "GET /..." are normal. UNEXPECTED_ROOT spans may indicate context loss.');
}

runTest().catch(console.error);
