# Contributing

Thank you for helping improve TokenWatch.
This guide is intended to keep contributions consistent, easy to review, and safe to merge.

## Table Of Contents

- [Repository Structure](#repository-structure)
- [Coding Style](#coding-style)
- [Branch Naming](#branch-naming)
- [Commit Conventions](#commit-conventions)
- [Pull Requests](#pull-requests)
- [Issue Reporting](#issue-reporting)

## Repository Structure

Start from the ownership docs before editing:

▪️ [`project-structure.md`](project-structure.md)
▪️ [`ownership.md`](ownership.md)
▪️ [`playbooks.md`](playbooks.md)

## Coding Style

▪️ keep changes small and well-scoped
▪️ follow the existing TypeScript and React patterns in the package you are touching
▪️ preserve workspace isolation
▪️ avoid duplicate EventSource instances
▪️ prefer the owning service or route rather than adding new ad hoc logic
▪️ update documentation when behavior changes

## Branch Naming

Recommended branch format:

▪️ `feat/<short-summary>`
▪️ `fix/<short-summary>`
▪️ `docs/<short-summary>`
▪️ `chore/<short-summary>`

## Commit Conventions

Use short, descriptive commits.
Conventional Commit style is encouraged:

▪️ `docs: rewrite Telegram guide`
▪️ `fix: tighten request export filters`
▪️ `feat: add Telegram recommendation shortcut`

## Pull Requests

Include:

▪️ a clear summary
▪️ why the change is needed
▪️ screenshots for UI work
▪️ verification steps
▪️ notes about any breaking changes

Keep PRs focused. If a change touches multiple subsystems, split it into separate reviews when possible.

## Issue Reporting

When filing an issue, include:

▪️ the feature or bug description
▪️ reproduction steps
▪️ expected behavior
▪️ actual behavior
▪️ relevant logs or screenshots
▪️ environment details

## Related Docs

▪️ [`README.md`](../README.md)
▪️ [`docs/architecture.md`](architecture.md)
▪️ [`docs/security.md`](security.md)
