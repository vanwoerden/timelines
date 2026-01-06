# Timeline Editor - Framework Comparison

This project contains three implementations of a timeline editor, each using a different technology stack:

1. **Vanilla JS + GSAP** (`/vanilla-gsap/`) - Native web technologies with GreenSock animations
2. **Vanilla JS + Interact.js** (`/vanilla-interact/`) - Minimal dependencies with Interact.js for interactions
3. **Svelte** (`/svelte/`) - Reactive framework with built-in transitions

## Getting Started

### Prerequisites
- Node.js and npm installed

### Installation

1. Install dependencies for the Svelte version:
```bash
cd svelte
npm install
```

2. For the vanilla versions, no build step is required - they can be served directly.

### Running the Applications

#### Option 1: Use Vite (Recommended)
From the root directory:
```bash
npm install
npm run dev
```
This will serve the landing page at `http://localhost:3000` with links to all three versions.

#### Option 2: Run Each Version Separately

**Vanilla + GSAP:**
```bash
cd vanilla-gsap
npx serve -p 3000
```
Access at: `http://localhost:3000`

**Vanilla + Interact.js:**
```bash
cd vanilla-interact
npx serve -p 3001
```
Access at: `http://localhost:3001`

**Svelte:**
```bash
cd svelte
npm install
npm run dev
```
Access at: `http://localhost:3002`

## Features

All three implementations include:

- **Blocks**: Resizable rectangular items representing time periods
- **Milestones**: Vertical lines with dots representing single points in time
- **Drag and Drop**: Reorder items on the timeline or move them to off-timeline lists
- **Resize**: Resize blocks by dragging the right edge (snaps to time intervals)
- **Inline Editing**: Click on items to edit their labels
- **Zoom and Pan**: Zoom in/out with buttons, keyboard shortcuts, or mouse wheel
- **View Toggle**: Switch between days and weeks view
- **Save/Load**: Export timeline as JSON file and load it back

## Fonts

The Kollektif font is referenced in the CSS but will fall back to system fonts if the font files are not present. To use the Kollektif font:

1. Place `Kollektif.woff2` and `Kollektif.woff` in:
   - `/vanilla-gsap/assets/fonts/`
   - `/vanilla-interact/assets/fonts/`
   - `/svelte/public/fonts/`

## Project Structure

```
timelines/
├── index.html              # Landing page
├── package.json            # Root package.json
├── vite.config.js         # Vite config for serving
├── vanilla-gsap/           # Option 1: Vanilla + GSAP
│   ├── index.html
│   ├── styles/
│   ├── scripts/
│   └── assets/
├── vanilla-interact/       # Option 2: Vanilla + Interact.js
│   ├── index.html
│   ├── styles/
│   ├── scripts/
│   └── assets/
└── svelte/                 # Option 3: Svelte
    ├── index.html
    ├── src/
    │   ├── App.svelte
    │   ├── components/
    │   ├── stores/
    │   └── utils/
    └── public/
```

## Notes

- The implementations are functionally equivalent but use different approaches
- Each version can be tested independently
- All versions use the same data model structure for compatibility

