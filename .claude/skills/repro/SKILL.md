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
- Keep the DSN for Sentry empty and remind users to `export SENTRY_DSN=` in the instructions
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


### Step 7: Write the README.md

The README.md in the reproduction directory should include:

````markdown
# Reproduction for [repo]#[issue-number]

**Issue:** [Link to original issue]

## Description
[Brief description of the bug being reproduced]

## Steps to Reproduce

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run the reproduction:
   ```bash
   [command to run]
   ```

## Expected Behavior
[What should happen]

## Actual Behavior
[What actually happens - the bug]

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

IMPORTANT: Only do this, if you successfully reproduced the bug described in the issue!
Before posting the github response on the issue, ask for permission (`AskUserQuestion` tool).

Comment on the original GitHub issue with a link to the PR:

```bash
gh issue comment <issue-number> --repo <owner>/<repo> --body "I've created a reproduction for this issue: [PR-URL]

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
