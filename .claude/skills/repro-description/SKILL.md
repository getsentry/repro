---
name: repro-description
description: Create a self-contained bug reproduction from a description. Asks which Sentry SDK is affected and suggests a descriptive branch name.
argument-hint: <bug-description>
---

# Description-Based Reproduction Skill

This skill creates a self-contained bug reproduction from a description (without requiring a GitHub issue URL).

## Input

The user provides a bug description, which can include:
- The unexpected behavior
- The expected behavior
- SDK version
- Framework being used
- Code snippets or configuration
- Environment details

## Workflow

### Step 1: Gather Information

Use the `AskUserQuestion` tool to collect:

1. **Which Sentry SDK is affected?**
   - Options: sentry-ruby, sentry-python, sentry-javascript, sentry-rust, sentry-java, sentry-dotnet, sentry-php, etc.

2. **Suggest a descriptive branch name** based on the bug description
   - Format: `repro/{sdk}-{descriptive-name}`
   - Example: `repro/sentry-ruby-error-page-status-mismatch`
   - Ask user to confirm or provide alternative

### Step 2: Analyze the Description

Read through the description to understand:
- What is the bug/unexpected behavior?
- What is the expected behavior?
- What environment/setup is needed (language version, framework, dependencies)?
- What SDK version is mentioned (if any)?
- Are there code snippets or configuration examples provided?

### Step 3: Create the Reproduction Directory

Create the directory structure:
```
{sdk}/{descriptive-name}/
├── README.md          # Instructions to run the reproduction
├── [package manager files]  # Dependencies (package.json, Gemfile, requirements.txt, etc.)
├── [reproduction files]
```

Directory naming:
- Extract SDK name from the full SDK identifier (e.g., `sentry-ruby` → `ruby`)
- Use the descriptive name provided/confirmed by the user
- Example: `sentry-ruby/error-page-status-mismatch/`

### Step 4: Build the Reproduction

Create a minimal, self-contained reproduction that:
1. Demonstrates the reported bug clearly
2. Uses the minimal dependencies necessary
3. Can be run with simple commands (e.g., `npm install && npm start` or `uv run` or `bundle exec`)
4. Includes clear console output or error messages showing the bug

**Guidelines for reproductions:**
- Keep it minimal - only include what's needed to show the bug
- Install the Sentry SDK version mentioned in the description
  - Fall back to a recent/stable version if no specific version is provided
- Keep the DSN for Sentry empty and remind users to `export SENTRY_DSN=` in the instructions
- Use standard tooling where possible (npm, uv, bundle, pip, cargo, etc.)
- If the description mentions a specific framework (Django, Rails, Express, Flask, etc.), set up that framework minimally
- Include any necessary configuration files
- Add comments in the code explaining what should happen vs what actually happens
- Consider using Spotlight (https://spotlightjs.com/) for local Sentry event inspection where applicable

### Step 5: Test the Reproduction

Before committing, verify the reproduction actually works:
1. Run the install commands
2. Run the reproduction
3. Confirm the bug manifests as described
4. If you get stuck, continue with Step 6 but mention it clearly in the README and still create the PR

### Step 6: Write the README.md

The README.md in the reproduction directory should include:

````markdown
# Reproduction for {sdk} {descriptive-name}

**SDK:** {sdk-name} v{version}

## Description

[Brief description of the bug being reproduced]

## Steps to Reproduce

1. Install dependencies:
   ```bash
   [install command]
   ```

2. (Optional) Start Spotlight for event inspection:
   ```bash
   npx @spotlightjs/spotlight
   ```

3. Run the reproduction:
   ```bash
   [command to run]
   ```

## Expected Behavior

[What should happen]

## Actual Behavior

[What actually happens - the bug]

## Reproduction Evidence

[If applicable, show console output, logs, or screenshots demonstrating the bug]

## Environment

- [Language]: [version if relevant]
- {sdk-name}: [version]
- [Framework]: [version if relevant]
- OS: [if relevant]

## Notes

[Any additional context or observations]
````

### Step 7: Commit and Create PR

1. Create a new branch (if not already created):
   ```bash
   git checkout -b repro/{sdk}-{descriptive-name}
   ```

2. Stage and commit the files:
   ```bash
   git add {sdk}/{descriptive-name}/
   git commit -m "Add reproduction for {sdk} {descriptive-name}"
   ```

3. Push and create PR:
   ```bash
   git push -u origin repro/{sdk}-{descriptive-name}
   gh pr create --title "Reproduction for {sdk} {descriptive-name}" --body "..."
   ```

   The PR body should include:
   - Summary of the bug
   - Evidence from the reproduction (console output, logs, etc.)
   - Instructions to run it
   - Note that this is a description-based reproduction (no associated GitHub issue)

### Step 8: No Backlink (Skip for Description-Based)

Since there's no GitHub issue, skip the backlink step. The reproduction stands alone as a demonstration of the bug.

## Error Handling

- If the description is too vague, ask the user for more details about:
  - Expected vs actual behavior
  - SDK version
  - Framework being used
  - Any error messages or symptoms
- If the SDK is not specified, ask the user which SDK is affected

## Example

For a description about "Rails 404 errors reported as 500 in Sentry trace data":

1. SDK: `sentry-ruby`
2. Descriptive name: `error-page-status-mismatch`
3. Directory: `sentry-ruby/error-page-status-mismatch/`
4. Branch: `repro/sentry-ruby-error-page-status-mismatch`
5. PR title: "Reproduction for sentry-ruby error-page-status-mismatch"

## When to Use This Skill

Use this skill when:
- The user provides a bug description without a GitHub issue URL
- You want to create a standalone reproduction for testing or demonstration
- The bug hasn't been filed as an issue yet
- You're exploring a potential bug that needs a concrete example

Use the regular `repro` skill when:
- The user provides a GitHub issue URL
- You want to link the reproduction back to an existing issue
