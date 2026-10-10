# Kinetics skill discovery

The three operator-imported Kinetics documents now participate in local skill
recommendations. A request such as “Create a border beam on this card” finds
**Surface and Motion Skills / Border Beam**. The existing review dialog offers
that pattern, shows its source/version and byte count, and preserves Continue
without a skill and Cancel. Selecting it sends only shared adaptation guidance
and the complete selected pattern (prompt, CSS and any supplied React), not all
51 patterns in its category. No lookup makes a model request.

## Content and matching

`commands/kinetics-catalog.json` indexes 153 patterns in the three source
categories, with names, purposes, upstream synonyms and exact imported-document
SHA-256 values. It is derived from ckissi/kinetics commit
`017498f8ae0e728ce7461852070d22601dd0a46e`, linked by
https://kinetics.colorion.co/#library. The website declares MIT licensing; the
pinned repository has no standalone LICENSE file. Original attribution and that
limitation are preserved in each imported document.

Exact normalized names take priority. Synonym matching requires UI/motion context
and either a multiword alias or multiple keyword signals. Up to three matches
are offered in deterministic order. This is bounded local lexical retrieval,
not semantic AI ranking. Ambiguous requests remain choices rather than silently
loading several effects. No installed document, no match. Changed document hashes
must be reviewed and added to the catalog before becoming eligible; arbitrary
imported prose cannot enroll itself in automatic application.

## Application boundary

Existing Taste/daisyUI behavior is unchanged. Motion patterns have a separate
approval scope that binds the stored skill hash, pattern identifier, selected
excerpt hash, exact task, request ID, route, session and expiry. Consumption
recomputes the match from the current saved document and is one-use. Guidance is
quoted user-level data for the current request, grants no tool authority, and is
not written into standing system instructions or model history.

The checked-in fixture documents contain all three exact native imports so tests
exercise every pattern and the real extraction boundaries without reading the
operator's database. They are test inputs, not an automatic library installation.

## Codex

The matching local skill folders have `SKILL.md`, a synonym index at
`references/pattern-index.json`, and one reference per pattern. Implicit selection
is enabled. Their descriptions name the intended effect families; `AGENTS.md`
directs interface-motion work to search the indexes before inventing an effect.
The operator's local installation is under `C:\Users\kevpe\.codex\skills`.
Discovery depends on the host loading these skills; reopen Codex if a fresh chat
does not list them. The runtime Armory and Codex folders remain separate stores.

## Delivery and verification

This source change requires rebuilding the native desktop application before
Olympus's installed assistant can use the new matcher. Browser preview has no
native assistant or shared SQLite store. Unit tests verify all 153 names, specific
synonyms, unrelated requests, missing/changed documents, bounded exact excerpts,
and approval replay/task/route/session/expiry failures. No live provider request
is needed to verify discovery; provider acceptance is a separate check.
