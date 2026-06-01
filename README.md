# 🥁 Snare Accents

A static web app that randomly generates a single **4/4 bar of sixteenth notes** for
snare drum, where each note is either **accented** (louder) or **unaccented**. The bar is
rendered in hand-drawn-style drum notation, alongside a kick-drum metronome and controls to
regenerate the pattern.

Inspired by the interpretation practice in Ted Reed's _Syncopation for the Modern Drummer_.

## How it works

- In common **4/4** time, a bar of sixteenth notes has 4 notes per quarter-note pulse, so a
  full bar contains **16 sixteenth notes**.
- Each of those 16 notes is binary — accented or unaccented — giving **2¹⁶ = 65,536**
  possible accent patterns for a single bar.
- The app draws one of those patterns at random and renders it in standard drum notation.

## Features

- **Randomize** — generate a fresh accent pattern for the bar.
- **Play / Stop** — hear the bar with a kick-drum-like metronome marking each pulse.
- **Adjustable BPM** — step the tempo by ±1 and ±5.
- **Mute unaccented** — practice only the accents (on by default).
- **Info** — an in-page explanation of how to read the notation.

All audio (snare hits + metronome) is generated in the browser with the **Web Audio API**.

## Tech stack

- **Astro 6** — static site output.
- **@astrojs/cloudflare** — deployed to Cloudflare Workers static assets.
- **Fontsource** (Patrick Hand, Caveat) — self-hosted fonts via Astro's Fonts API.
- **pnpm** — package manager.

## Commands

All commands are run from the root of the project:

| Command         | Action                                       |
| :-------------- | :------------------------------------------- |
| `pnpm install`  | Install dependencies                         |
| `pnpm dev`      | Start the local dev server at `localhost:4321` |
| `pnpm build`    | Build the production site to `./dist/`       |
| `pnpm preview`  | Build, then preview locally with Wrangler    |
| `pnpm deploy`   | Build and deploy to Cloudflare               |

## Project structure

- `src/pages/index.astro` — the single landing page, its markup and styles.
- `src/scripts/drum.ts` — random bar generator, hand-drawn SVG notation, Web Audio engine, and the playback scheduler.
- `src/consts.ts` — site title and description.
- `public/favicon.svg` — the 🥁 icon.
