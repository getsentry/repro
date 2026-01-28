# repro

doesn't work on my machine

## Description

This repository will serve as a collection of reproductions of bugs and issues for Sentry's SDK ecosystem.

## Usage

The structure of this repository is `<sdk-repository>/<issue-number>/`. Each such directory contains a self-contained reproduction with instructions for the problem involved.

The best way to use this repository is with the Claude Skill `/repro <github-issue-url>`.

### Example

In your Claude session, invoke:

```
/repro https://github.com/getsentry/sentry-ruby/issues/2842
```

This will automatically parse the issue, try to create a reproduction with instructions in this repository and backlink to the original issue in a comment.
