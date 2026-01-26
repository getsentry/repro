import OpenAI from 'openai';

// Initialize OpenAI client
// You need to set OPENAI_API_KEY environment variable
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'dummy-key-for-demo',
});

async function testStreaming() {
  console.log('\n🚀 Starting OpenAI streaming test...\n');

  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ Error: OPENAI_API_KEY environment variable is not set');
    console.log('   Please set it with: export OPENAI_API_KEY=sk-your-key-here');
    process.exit(1);
  }

  try {
    const stream = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: 'Count from 1 to 10, with each number on a new line.',
        },
      ],
      stream: true,
    });

    console.log('📝 Streaming response:');
    console.log('---');

    let chunkCount = 0;
    let fullResponse = '';

    for await (const chunk of stream) {
      chunkCount++;
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        process.stdout.write(content);
        fullResponse += content;
      }
    }

    console.log('\n---');
    console.log(`\n✅ Streaming completed successfully!`);
    console.log(`   Total chunks received: ${chunkCount}`);
    console.log(`   Full response length: ${fullResponse.length} characters`);

    // With Sentry enabled, you might see:
    // - Very few chunks (maybe just 1-2)
    // - Only the final complete message instead of incremental updates
    // - No real-time streaming behavior

    if (chunkCount < 5) {
      console.log('\n⚠️  WARNING: Low chunk count detected!');
      console.log('   This suggests streaming may not be working properly.');
      console.log('   Expected: Multiple chunks as the response is generated');
      console.log('   Actual: Only final response chunk(s)');
    }

  } catch (error) {
    console.error('❌ Error during streaming:', error.message);
    throw error;
  }
}

// Run the test
testStreaming().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
