---
name: repro
description: Reproduce a GitHub issue bug report. Takes a GitHub issue URL from a Sentry SDK repository, creates a self-contained reproduction, and opens a PR with backlink to the original issue.
argument-hint: <github-issue-url>
---

# GitHub Issue Reproduction Skill

This skill takes a GitHub issue URL and creates a self-contained bug reproduction in this repository.

## Input

The user provides a GitHub issue URL, e.g.:
- `https://github.com/getsentry/sentry-javascript/issues/12345`
- `github.com/owner/repo/issues/123`

## Workflow

### Step 1: Parse the GitHub Issue URL

Extract from the URL:
- **Owner**: The repository owner (e.g., `getsentry`)
- **Repo**: The repository name (e.g., `sentry-javascript`)
- **Issue Number**: The issue number (e.g., `12345`)
- **Programming Language**: The language for the SDK from the repository name `sentry-{language}` (e.g., `javascript`)

Use these to form the directory path: `{repo}/{issue-number}`

### Step 2: Fetch Issue Details

Use the GitHub CLI to get the issue content:

```bash
gh issue view <issue-number> --repo <owner>/<repo>
```

Also fetch comments if they contain reproduction details:

```bash
gh issue view <issue-number> --repo <owner>/<repo> --comments
```

### Step 3: Analyze the Issue

Read through the issue to understand:
- What is the bug/unexpected behavior?
- What is the expected behavior?
- What environment/setup is needed (Programming Language version, framework, dependencies)?
- Are there code snippets or reproduction steps provided?
- Check for any attached reproduction repositories or CodeSandbox links

### Step 4: Create the Reproduction Directory

Create the directory structure:
```
{repo}/{issue-number}/
├── README.md          # Instructions to run the reproduction
├── package.json       # Dependencies (if applicable)
├── [reproduction files]
```

### Step 5: Build the Reproduction

Create a minimal, self-contained reproduction that:
1. Demonstrates the reported bug clearly
2. Uses the minimal dependencies necessary
3. Can be run with simple commands (e.g., `npm install && npm start` or `uv run` or `bundle exec`)
4. Includes clear console output or error messages showing the bug

**Guidelines for reproductions:**
- Keep it minimal - only include what's needed to show the bug
- Install the Sentry SDK and version mentioned in the issue description.
  - Fall back to the latest version if no specific version is provided.
  - Fall back to the best fitting Sentry SDK you can detect for the reproduction.
- Configure the reproduction to read the DSN from the `SENTRY_DSN` environment variable
- **ALWAYS initialize Sentry with `debug: true`** (or language equivalent) so that event/transaction IDs are logged to console for easier retrieval
- In the README, instruct users to `export SENTRY_DSN=<their-dsn>` before running
- Use standard tooling where possible (npm, uv, bundle)
- If the issue description mentions a specific framework (django, rails, express, opentelemetry), set up that framework minimally
- Include any necessary configuration files
- Add comments in the code explaining what should happen vs what actually happens

### Step 6: Test the Reproduction

Before committing, verify the reproduction actually works:
1. Run the install commands
2. Run the reproduction
3. Confirm the bug manifests as described
4. If you get stuck, continue with Step 7 but mention it clearly in the readme and still create the PR

#### Telemetry Verification (when relevant)

For issues involving runtime behavior, errors, exceptions, or telemetry data (not build/config issues), verify with actual Sentry telemetry:

1. **Determine if verification is needed**: Analyze the issue to see if it involves:
   - Runtime errors or exceptions
   - Event capture behavior
   - Telemetry data (breadcrumbs, contexts, tags)
   - Transactions or spans

   Skip telemetry verification for:
   - Build/compilation errors
   - Configuration/setup issues
   - Documentation issues

2. **Check prerequisites for telemetry verification**:
   - Verify the `SENTRY_DSN` environment variable is set:
     ```bash
     echo $SENTRY_DSN
     ```
   - Verify Sentry MCP tools are available by attempting to use them
   - Check if Sentry MCP requires authentication

   **If any prerequisites are missing**:
   - Report the issue to the user using `AskUserQuestion`
   - Ask if they want to verify with telemetry
   - If yes, inform them what needs to be set up:
     - Missing SENTRY_DSN: "Set your Sentry DSN with `export SENTRY_DSN=<your-dsn>`"
     - Sentry MCP not installed: "Install the Sentry MCP server (provide setup instructions)"
     - Sentry MCP needs auth: "Authenticate the Sentry MCP server with your credentials"
   - If no, skip telemetry verification and document in the README that it was skipped

3. **Run with telemetry**: Execute the reproduction, which will send events to Sentry.

4. **Retrieve telemetry using Sentry MCP**:
   - Check the console output for logged event/transaction IDs (available because `debug: true`)
   - Use available MCP tools to fetch the telemetry:
     - `get_issue_details` - Retrieve Sentry issues (errors) created by the reproduction
     - `get_event_attachment` - Get event attachments if relevant
     - `get_trace_details` - Retrieve trace data for transactions/spans
     - `get_profile` - Get profiling data if applicable

   The debug output will show IDs like "Event sent: <event-id>" or "Transaction: <transaction-id>" for easier lookup.

5. **Verify against GitHub issue**: Compare the Sentry telemetry with the reported issue:
   - Does the error message match what's described in the GitHub issue?
   - Does the exception type match?
   - Are the expected stack frames present?
   - Do breadcrumbs/contexts show the expected behavior?
   - For transactions/spans, do they match the expected structure and behavior?

6. **Document results**: In the README.md, add a "Verification" section:
   - If telemetry matches: Note that the reproduction was verified with actual Sentry telemetry
   - If telemetry doesn't match: Document the discrepancy clearly - what was expected vs what was captured
   - If SENTRY_DSN not set: Note that telemetry verification was not performed

   Example:
   ```markdown
   ## Verification
   ✅ Verified with Sentry telemetry - captured error matches reported issue

   Or:

   ⚠️ Telemetry discrepancy: Expected `TypeError` but captured `ReferenceError`. See Sentry issue [link].

   Or:

   ℹ️ Telemetry verification skipped - SENTRY_DSN not set. Set your DSN and run to verify.
   ```


### Step 7: Write the README.md

The README.md in the reproduction directory should include:

````markdown
# Reproduction for [repo]#[issue-number]

**Issue:** [Link to original issue]

## Description
[Brief description of the bug being reproduced]

## Steps to Reproduce

1. Set your Sentry DSN:
   ```bash
   export SENTRY_DSN=<your-dsn>
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the reproduction:
   ```bash
   [command to run]
   ```

## Expected Behavior
[What should happen]

## Actual Behavior
[What actually happens - the bug]

## Verification
[Include telemetry verification results if performed - see Step 6]

## Environment
- Node.js: [version if relevant]
- [Package name]: [version]
- OS: [if relevant]
````

### Step 8: Commit and Create PR

1. Create a new branch:
   ```bash
   git checkout -b repro/{repo}-{issue-number}
   ```

2. Stage and commit the files:
   ```bash
   git add {repo}/{issue-number}/
   git commit -m "Add reproduction for {repo}#{issue-number}"
   ```

3. Push and create PR:
   ```bash
   git push -u origin repro/{repo}-{issue-number}
   gh pr create --title "Reproduction for {repo}#{issue-number}" --body "..."
   ```

   The PR body should include:
   - Link to the original issue
   - Brief description of what the reproduction demonstrates
   - Instructions to run it

### Step 9: Backlink to Original Issue

IMPORTANT: Only do this if you successfully reproduced the bug described in the issue!
Before posting the GitHub response on the issue, ask for permission (`AskUserQuestion` tool).

Comment on the original GitHub issue with a link to the PR:

```bash
gh issue comment <issue-number> --repo <owner>/<repo> --body "I've created a reproduction for this issue: [PR-URL]

You can run it by cloning the repo and following the instructions in the README.

[If telemetry was verified, add:]
✅ Verified with actual Sentry telemetry - the reproduction successfully captures the reported issue."

You can run it by cloning the repo and following the instructions in the README.

🤖 Generated with [Claude Code](https://claude.ai/code)"
```

## Error Handling

- If the issue URL is invalid, ask the user to provide a valid GitHub issue URL
- If the issue doesn't contain enough information to create a reproduction, note this in the README and create a partial reproduction with placeholders
- If `gh` CLI is not authenticated, prompt the user to run `gh auth login`

## Example

For issue `https://github.com/getsentry/sentry-javascript/issues/15890`:

1. Directory created: `sentry-javascript/15890/`
2. Branch: `repro/sentry-javascript-15890`
3. PR title: "Reproduction for sentry-javascript#15890"
4. Comment added to original issue linking to the PR
