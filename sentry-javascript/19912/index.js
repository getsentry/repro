require("./instrument");

const Anthropic = require("@anthropic-ai/sdk");

const client = new Anthropic.default();

async function main() {
  try {
    // Bug: .withResponse() is not a function when Sentry Anthropic instrumentation is active
    // Sentry wraps the return value in a regular Promise, losing the APIPromise methods
    const result = await client.messages
      .create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 50,
        messages: [{ role: "user", content: "Say hello in one word." }],
      })
      .withResponse();

    console.log("Status:", result.response.status);
    console.log("Content:", result.data.content);
  } catch (error) {
    console.error("Error:", error.message);
  }
}

main();
