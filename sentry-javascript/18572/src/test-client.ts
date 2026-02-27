// A simple test client that hammers the endpoints to trigger the context propagation issue.
// The bug is more likely to manifest under concurrent load.

const BASE_URL = 'http://localhost:3000';

async function makeRequest(url: string, label: string): Promise<void> {
  try {
    const res = await fetch(url);
    const data = await res.json();
    console.log(`[${label}] OK:`, JSON.stringify(data));
  } catch (err) {
    console.error(`[${label}] ERROR:`, err);
  }
}

async function runTest() {
  console.log('=== Testing single gRPC call ===');
  await makeRequest(`${BASE_URL}/test-grpc`, 'single');

  console.log('\n=== Testing concurrent gRPC calls ===');
  await makeRequest(`${BASE_URL}/test-concurrent`, 'concurrent');

  console.log('\n=== Hammering with concurrent requests (to trigger context loss) ===');
  const promises: Promise<void>[] = [];
  for (let i = 0; i < 20; i++) {
    promises.push(makeRequest(`${BASE_URL}/test-grpc`, `grpc-${i}`));
    promises.push(makeRequest(`${BASE_URL}/test-concurrent`, `concurrent-${i}`));
  }
  await Promise.all(promises);

  console.log('\n=== Done. Check server logs for [CONTEXT-DEBUG] ORPHAN entries. ===');
  console.log('Orphaned spans indicate broken context propagation.');
}

runTest().catch(console.error);
