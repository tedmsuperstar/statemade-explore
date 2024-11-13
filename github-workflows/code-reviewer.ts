import { OpenAIClient, AzureKeyCredential } from "@azure/openai";
import { Octokit } from "octokit";

// Define environment variables with type annotations
const githubToken: string = process.env.GITHUB_TOKEN!;
const octokit = new Octokit({
  auth: githubToken,
});

const { GITHUB_REPOSITORY, GITHUB_PR_NUMBER } = process.env;
if (!GITHUB_REPOSITORY || !GITHUB_PR_NUMBER) {
  throw new Error('Missing environment variables GITHUB_REPOSITORY or GITHUB_PR_NUMBER');
}
const [owner, repo] = GITHUB_REPOSITORY.split("/");

// API credentials
const endpoint: string = process.env.OPEN_AI_AZURE_ENDPOINT!;
const azureApiKey: string = process.env.OPEN_AI_AZURE_KEY!;
const client = new OpenAIClient(endpoint, new AzureKeyCredential(azureApiKey));
const deploymentId: string = process.env.OPEN_AI_AZURE_DEPLOYMENT_ID!;

// Utility function to delay execution
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Function to rate-limit calls
async function rateLimitedFetch(inputArray: string[], limit: number, delayTime: number): Promise<string> {
  let response = "";
  const queue: Promise<void>[] = [];

  // Helper function to process a single chunk
  async function processChunk(chunk: string): Promise<void> {
    try {
      const eventsForDiff = await client.streamChatCompletions(deploymentId, [
        {
          role: "user",
          content: chunk
        }],
        { maxTokens: 2000 });

      for await (const event of eventsForDiff) {
        for (const choice of event.choices) {
          response += choice.delta?.content ?? "";
        }
      }
    } catch (err) {
      console.error("client.streamChatCompletions encountered an error:", err);
    }
  }

  for (const chunk of inputArray) {
    const promise = processChunk(chunk).finally(() => {
      queue.splice(queue.indexOf(promise), 1);
    });
    queue.push(promise);

    if (queue.length >= limit) {
      await Promise.race(queue);
    }

    // Introduce a delay between requests to enforce rate-limiting
    console.log("sleeping for " + delayTime + "ms");
    await delay(delayTime);
  }

  // Wait for all remaining promises to complete
  await Promise.all(queue);

  return response;
}

async function commentOnPR(body: string): Promise<void> {
  console.log("commenting on PR", `${GITHUB_PR_NUMBER}|${owner}|${repo}|${body}`);

  await octokit.rest.issues.createComment({
    owner,
    repo,
    issue_number: parseInt(GITHUB_PR_NUMBER!), // Ensure PR number is an integer
    body,
  });
}

function breakIntoSubstrings(str: string, size: number): string[] {
  const result: string[] = [];
  for (let i = 0; i < str.length; i += size) {
    result.push(str.slice(i, i + size));
  }
  return result;
}

async function main(): Promise<void> {
  console.log("== Code Review Prototype ==");

  // This will hold the data from the stdin
  let input = '';

  // Set the encoding for the input stream
  process.stdin.setEncoding('utf8');

  // Collect data chunks from stdin
  process.stdin.on('data', (chunk: string) => {
    input += chunk;
  });

  process.stdin.on('end', async () => {
    console.log("data size: " + input.length);

    if (input.length > 50000) {
      await commentOnPR("The PR is too large for Open AI. Max size for the diff is 50000 characters.");
      return;
    }
    const inputArray = breakIntoSubstrings(input, 4000);

    console.log("input array length", inputArray.length);
    console.log("sleeping for 2000ms");
    await delay(2000);
    console.log("input array item 1", inputArray[0].length);

    inputArray.push("The code is ready for your review. Please provide feedback on the code above.");

    const client = new OpenAIClient(endpoint, new AzureKeyCredential(azureApiKey));

    try {
      const events = await client.streamChatCompletions(
        deploymentId,
        [
          { role: "system", content: "You are a senior software engineer." },
          { role: "user", content: "I'm going to paste in a diff file for a GitHub branch. This represents a pull request. The diff may take several messages for me to share the entire thing. After the messages are complete, I'd like you, as a senior engineer, to review the above code and provide feedback." }
        ],
        { maxTokens: 2000 }
      );

      let responses = "";
      console.log("events returned");
      for await (const event of events) {
        for (const choice of event.choices) {
          responses += choice.delta?.content ?? "";
        }
      }
      console.log("responses", responses);
    } catch (err) {
      console.error("client.streamChatCompletions encountered an error:", err);
    }

    rateLimitedFetch(inputArray, 2, 1000)
      .then(response => {
        console.log("responses", response);
        return commentOnPR(response);
      })
      .catch(err => {
        console.error("An error occurred while processing the promises:", err);
      });
  });
}

main().catch((err) => {
  console.error("main encountered an error:", err);
});
