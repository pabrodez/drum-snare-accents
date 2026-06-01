# AGENTS.md

Project-specific context for AI agents. For behavioral guidelines, see @CLAUDE.md.

## Project

Drum Snare Accents — a static web page that randomly generates a single 4/4 bar of
sixteenth notes for snare drum, where each note is either **accented** (louder) or
**unaccented**. The bar is rendered in hand-drawn-style drum notation on the landing
page, alongside a metronome and controls to regenerate the pattern.

## Stack

- **Framework:** Astro 5 (`astro` 5.16.9) — static site output.
- **Runtime:** Cloudflare Workers via the `@astrojs/cloudflare` adapter (`wrangler`).
- **Audio:** Web Audio API (snare hits + metronome), generated in the browser.
- **Package manager:** pnpm.

## Core concepts

- In common 4/4 time, a bar of **sixteenth notes** has 4 notes per quarter-note pulse,
  so a full bar contains **16 sixteenth notes**.
- Each of those 16 notes is binary — it is either accented or unaccented. With two
  states across 16 positions, there are **2^16 = 65,536** possible accent permutations
  for a single bar.
- The app randomly selects one of those permutations and presents it to the player.
- Inspired by **Ted Reed's _Syncopation for the Modern Drummer_**: the practice of
  reading and interpreting rhythmic/accent patterns from notation on the snare drum.

## Features

- **Landing page** displays one randomly generated bar with its accents.
- **Generate button** produces a new random bar (a fresh accent permutation).
- **Metronome pulse** acts as the timekeeper, using a deep, **kick-drum-like** sound.
- **Adjustable BPM** with buttons to increase or decrease the tempo in steps of **1**
  and **5**.

## Audio

Use the **Web Audio API** for all sounds:

- **Snare** — accented notes play louder (higher velocity) than unaccented notes.
- **Metronome** — a deep, kick-drum-like tone marking each pulse.

## Notation

The generated bar must use **correct standard drum notation** (snare on the staff,
accent marks above accented notes, beamed sixteenths) and be rendered with a
**hand-drawn** aesthetic.

## Domain skills

Consult the relevant skill in `.claude/skills/` before working in these areas:

- **passkeys** — WebAuthn registration/authentication, PRF extension.
- **sessions** — session management and cookies.
- **csp** — Content Security Policy.
- **cloudflare** / **workers-best-practices** / **wrangler** — Workers platform, config, and CLI.
- **durable-objects** — stateful coordination on Workers.
