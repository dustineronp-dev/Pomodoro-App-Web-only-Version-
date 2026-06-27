# Flowmodoro

A Pomodoro-style focus timer with one twist: instead of the fixed
25-minute-work / 5-minute-break split, **you set your own work length**,
and the app calculates proportional break options for you.

Built with plain HTML, CSS, and JavaScript — no frameworks, no build step —
as a learning project to practice core web development fundamentals.

## Features

- **Custom work sessions** — set any length from 1 to 240 minutes.
- **Scaled break presets** — choosing a work length generates three break
  options sized to it:
  - Short break — 15% of work time
  - Medium break — 20% of work time
  - Long break — 25% of work time

  Example: a 60-minute work session offers ~9 / 12 / 15-minute breaks.
- **Session map** — a visual strip showing the shape of your current
  work/break cycle, filling in as time passes.
- **Custom alarm sound** — upload your own audio clip to play when a
  work or break phase ends. Saved in the browser (`localStorage`) so it
  persists between visits.
- **Start / Pause / Reset / Skip** controls.

## Tech

- HTML5
- CSS3 (custom properties, flexbox, no framework)
- Vanilla JavaScript (`setInterval` timer loop, `localStorage`, `FileReader`)

## Running it locally

No build tools needed. Either:

1. Open `index.html` directly in a browser, **or**
2. Serve it locally for a cleaner experience (some browsers restrict
   `localStorage` on `file://` URLs):

   ```bash
   python3 -m http.server 8080
   ```

   then visit `http://localhost:8080`.

## Project structure

```
.
├── index.html    # markup
├── style.css     # design system + layout
├── script.js     # timer engine, break-preset logic, settings, alarm handling
└── README.md
```

## Why this project

This was built as a hands-on exercise to strengthen core JavaScript and
git fundamentals — DOM manipulation, timers, state management, and
localStorage — ahead of applying for junior developer roles. Commit
history is kept intentionally granular (structure → logic/styling →
docs/polish) to reflect how the project was actually built.

## Possible future improvements

- Notification API support for alerts when the tab isn't focused
- Daily/weekly stats on completed sessions
- Keyboard shortcuts (space to start/pause)
- Dark/light theme toggle
