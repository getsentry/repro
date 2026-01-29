# repro

doesn't work on my machine

## Description

This repository will serve as a collection of reproductions of bugs and issues for Sentry's SDK ecosystem.

## Usage

The structure of this repository is `<sdk-name>/<issue-number-or-descriptive-name>/`. Each such directory contains a self-contained reproduction with instructions for the problem involved.

The best way to use this repository is with Claude Skills:

### `/repro` - Reproduce from GitHub Issue

Use this skill when you have a GitHub issue URL:

```
/repro https://github.com/getsentry/sentry-ruby/issues/2842
```

This will automatically:
- Parse the GitHub issue
- Create a reproduction in `sentry-ruby/2842/`
- Backlink to the original issue in a comment

### `/repro-description` - Reproduce from Description

Use this skill when you have a bug description but no GitHub issue:

```
/repro-description The HTTP status code is reported as 500 but breadcrumbs show 404...
```

This will:
- Ask which SDK is affected
- Suggest a descriptive branch name
- Create a reproduction in `{sdk}/{descriptive-name}/`
- Skip the backlink step (no issue to link to)

### Example

**From GitHub issue:**
```
/repro https://github.com/getsentry/sentry-ruby/issues/2842
```

**From description:**
```
/repro-description Rails returns 404 but Sentry reports 500 in trace data
```
