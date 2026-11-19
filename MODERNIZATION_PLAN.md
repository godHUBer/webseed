# Webseed UI Modernization Plan — v1.0
> **Status:** DRAFT — awaiting your confirmation before any code changes are made
> **Date:** 2026-09-04 | **Branch:** `arena/01a06ce5-webseed` | **Current base:** `9e2959d`

---

## 0. TL;DR — What I'm Proposing

Keep Webseed **100% client-side, lightweight, Snapseed-faithful** — but rebuild the UI shell from the ground up:

* **New App Shell:** top nav + collapsible left tools + centered canvas stage + contextual right inspector (instead of fixed 320px sidebar + floating white bars)
* **Design System:** single source of truth for tokens (colors, radii, spacing, motion) — kill the 60% inline styles / 40% `styles.css` split
* **Component Library:** 10 reusable components replace ~30 copy-paste popups/bottom-bars/overlays
* **Responsive first:** desktop = 3-pane, tablet = drawer, mobile = bottom sheet + gesture canvas
* **Code hygiene:** move from global `window.App.*` script soup → ES Modules + Vite build, keep vanilla JS (no React), zero added runtime weight
* **3 Phases over ~4-6 incremental PRs** so you can review each slice before the next lands

**I will NOT touch filter algorithms or the canvas render pipeline in Phase 1** — purely UI. Algorithms stay byte-identical.

---

## 1. Current-State Audit (Why it feels like crap)

I read every file (`webseed.html` 1012 LOC, `styles.css` 969 LOC, `js/ui.js` 1860 LOC, all 17 filters). Here’s the blunt breakdown:

### 1.1 Visual & UX
| Area | Problem |
|------|---------|
| **Design inconsistency** | `styles.css` defines `:root` + `[data-theme="light"]` tokens, but **~70% of visible UI is inline `style="..."`** (all popups, bottom bars, overlays). Theme toggle flips the shell but popups/bottom bars stay `#fff` / `#ededed` → jarring in dark mode. Radii are random: 6px, 10px, 14px, 18px, 24px, 999px in same view. |
| **App shell** | Fixed 320px right sidebar + centered canvas + floating toolbar + absolute history panel that **covers the photo**. No breathing room. Upload state is a tiny pill in the dead center. |
| **Tool controls** | **Each tool re-invents its own bottom bar & popup.** Tune, Crop, Rotate, Details, Selective, Curves, WB, Glamour, Grainy, B&W, Lens Blur, Vignette, Text, Frames, Brush, Healing = 16 different HTML structures, duplicated Cancel/Apply icons, duplicated SVG. No shared pattern. |
| **Popups** | `snapseed-popup` is centered `translate(-50%,-50%)`, then a draggable hack re-positions with `left/top`. Every popup has its own drag handle injected at runtime (`ensurePopupDragHandle`). Obscures canvas, no focus trap, no ESC handling. |
| **Sidebar Tabs** | LOOKS / TOOLS / EXPORT are thin text tabs with 2px underline. TOOLS grid is 4×4 cramped icons (11px labels, 24px icons) → misc-tap prone. LOOKS “QR Looks — code-based fallback” is confusing. EXPORT shows 5 near-identical cards (Save / Save a Copy / Export / Export as / Share). |
| **History / Edit Stack** | Centered top card `width: min(420px, calc(100%-32px))` floats over canvas. Undo/Redo are tiny 20px icons in `floating-toolbar` with `.disabled` opacity toggle only. No timeline scrub. |
| **Empty & loading states** | Only text: “Or drag & drop here”, badge “Synthesizing…” for rotation. No skeleton, no OpenCV loading feedback, no error toast. |
| **Iconography** | Mixed `stroke-width` 1.5 / 2, some filled circles, some emoji-like Brush type icons. No consolidated `<svg>` sprite. |
| **Motion** | Zero. Toggles snap, panels appear/disappear `display:none` ↔ `flex`. Feels cheap. |

### 1.2 Layout & Responsiveness
* **Desktop only.** `sidebar: 320px`, `canvas-area: flex:1`, no media queries at all. On <1024px the tools become unreachable; on mobile the 4-col grid is unusable and bottom bars overflow.
* Floating toolbar is `left:50% + transform` — breaks when sidebar collapses.
* Overlays: there are **legacy ghost canvases** left in DOM (`crop-ui-overlay-legacy`, `rotate-ui-overlay-legacy`, `selective-ui-overlay-legacy`, `lens-blur-ui-overlay-legacy` etc.) → dead code + z-index confusion (`z-index:10` vs `11` vs `40` vs `100`).
* The whole app is `height:100vh; overflow:hidden` → iOS Safari chrome hides content.

### 1.3 Code Health
| Symptom | Detail |
|---------|--------|
| **Monolithic HTML** | Single `webseed.html` holds the full shell + 16 tool UIs. Impossible to diff review. |
| **Style split** | Tokens in `styles.css`, overrides inline. Specificity war → `!important` drift. Light theme unreadable in places because inline white survives. |
| **JS god file** | `js/ui.js` 1860 lines does history, tabs, looks, theme, upload, sliders, tool toggles, all tool UIs (Lens Blur ~200 lines, Vignette ~200, Text ~200, etc.). No modules. |
| **Global namespace** | `window.App = window.App \|\| {}` + 10 script tags in strict order in `webseed.html`. One reorder = break. No imports. `window.transformAction` is global leak. |
| **State ↔ UI coupling** | `state.js` 761 lines + history diff/patch engine mixed with `ui.js` rendering. Tools mutate `App.state.filters.*` directly, no events. |
| **No build / no lint** | No `package.json`, no Vite/ESLint/Prettier. PRs have no guardrails. |
| **Accessibility** | Buttons lack `aria-*` (except theme toggle), popups lack `role=dialog`, sliders lack `<label>`, color contrast fails for `#888` on `#111`. No keyboard nav for popups. |
| **Performance** | Canvas `render()` runs full `getImageData` + 12 sequential filter passes on main thread per slider tick. No `requestIdleCallback`, no worker, no debounce on wheel inputs. |

### 1.4 What *does* work (keep)
* Canvas geometry/crop/rotate math is solid (orthogonal rotation handling).
* Filter pipeline & history diff/patch is clever and should be preserved.
* Looks save/load code & `localStorage` for custom looks.
* Overall Snapseed mapping is accurate — users will recognize Tools.

---

## 2. Modernization Principles

1. **Snapseed soul, 2026 skin.** Keep the mental model (Looks → Tools → Export, Tune popup with wheel, etc.) but make it feel like Lightroom / Figma / Linear — not 2015 Bootstrap.
2. **Canvas is king.** UI chrome should *frame* the photo, never cover it. Chrome is translucent / auto-hide.
3. **One way to do things.** One popup, one bottom bar, one overlay, one token set — reuse everywhere.
4. **Stay light.** No React, no 200KB framework. Target < 150KB gzipped JS+CSS total (current ~300KB uncompressed). Keep 0 backend.
5. **Mobile belongs.** Desktop is primary, but every flow must be thumb-reachable.
6. **Accessible & keyboard-first.** Full keyboard, screen-reader, and reduced-motion support.
7. **Incremental, not big-bang.** You can stop after any phase and ship.

---

## 3. Proposed Architecture

### 3.1 Tech Stack (lightest viable upgrade)
```
Before                           After
─────────────────────────────      ─────────────────────────────
10× <script src="js/...">        Vite + ES Modules
window.App global                import { state } from './state.js'
inline styles + styles.css       styles.css → CSS Modules + CSS variables + Tailwind-like utility classes (or plain custom props — your call)
No build                         npm run dev (HMR) + npm run build → dist/ for GitHub Pages
No lint/format                   ESLint + Prettier + pre-commit hook
```

> **Option A (Recommended): Vanilla + Vite + CSS Variables** — keeps stack identical to today, just modularized. Smallest risk, fastest.

> **Option B: Add Tailwind CSS** — faster styling, but adds tooling. I’ll only do this if you say yes.

Either way: **no React/Vue/Svelte**. Optional: add `vitest` for filter unit tests.

**File layout after:**
```
index.html                → Vite entry, minimal shell
src/
  styles/
    tokens.css            → design tokens (colors, radii, space, shadow, motion)
    base.css              → reset, typography
    components/           → button, slider, popup, sheet, card...
  js/
    app.js                → bootstrap
    state/                → state, history, toolManager (ESM)
    canvas/
    ui/
      shell/              → AppShell, TopBar, Sidebar, Stage
      components/         → Popup, BottomBar, Overlay, Range, etc.
      tools/              → one file per tool UI (reuses components)
    filters/              → unchanged logic, just ESM exports
```

### 3.2 Design System — Single Source of Truth

**Tokens (`tokens.css`)**
```css
--color-bg-app, --color-bg-panel, --color-bg-surface, --color-text, --color-text-muted, --color-accent, --color-border
--radius-sm: 8px; --radius-md: 12px; --radius-lg: 16px; --radius-xl: 20px; --radius-pill: 999px;
--space-1:4px; --space-2:8px; --space-3:12px; --space-4:16px; --space-6:24px; --space-8:32px;
--shadow-sm, --shadow-md, --shadow-lg
--font-sans: 'Inter', system-ui; --font-display: 'Oswald';
--ease-spring, --ease-out, --duration-quick:150ms
```
* Dark & light are **two token sets**, not overrides. Every component consumes tokens — zero inline hex colors.
* Popups/bars automatically theme correctly.

**Typography:** Inter 400/500/600 for UI, Oswald/Caveat only inside Text tool preview.

**Motion:** 150–250ms `ease-out`, panels slide + fade, canvas cross-fades between filter states (`filter` transition).

### 3.3 New App Shell Layout

```
┌─────────────────────────────────────────────────┐
│ TopBar: [Webseed wordmark] [Undo Redo | Stack] [Theme] [Export] │
├──────────────┬──────────────────────┬───────────┤
│              │                      │ Inspector │
│  ToolsNav    │   Canvas Stage       │ (context) │
│  (collapsible) │  (photo centered)  │ Shows only│
│  Search tools│  • translucent HUD   │ active tool│
│  LOOKS       │  • gesture hints     │ controls  │
│  TOOLS grid  │  • before/after      │  & history│
│  (category   │    slider            │  details  │
│   grouped)   │  • drag handles      │           │
│              │                      │           │
│              │  BottomSheet (mobile)│           │
├──────────────┴──────────────────────┴───────────┤
│ StatusBar: zoom, image size, action toast       │
└─────────────────────────────────────────────────┘
```
* **Desktop (≥1024px):** 3 columns — ToolsNav 280px | Stage flex | Inspector 320px (collapses to 0 when no tool active, Stage expands).
* **Tablet (768–1023):** ToolsNav becomes icon rail (64px) + slide-out drawer; Inspector becomes right drawer.
* **Mobile (<768):** TopBar condensed; Tools are a 2-row horizontal strip or bottom sheet; Inspector = bottom sheet that slides up when a tool is active; canvas is full-bleed with edge-to-edge gestures.
* Canvas HUD: floating undo/redo + compare (press & hold) pill, not a solid white bar.

### 3.4 Component Catalogue (the 10 primitives)

| Component | Replaces | Notes |
|-----------|----------|-------|
| **AppShell** | `.desktop-layout` | Grid + responsive breakpoints, safe-area insets |
| **TopBar** | `.app-window-bar` + `.floating-toolbar` | Glass effect, groups actions, theme toggle becomes segmented control |
| **ToolTile** | `.tool-item` | 3 states (idle/hover/active), large hit-area 56px, category headers |
| **InspectorPanel** | right `.sidebar-content` + `.workflow-panel` | Contextual; shows only active tool — no tab switching when editing |
| **Popup (Snapseed-style)** | `.snapseed-popup` ×10 | Single component: list + active indicator + value + drag handle; keyboard nav + ESC; theme-aware |
| **BottomBar / ActionBar** | 16 × `*-bottom-bar` inline divs | Single component with slots: left Cancel, center controls, right Apply; glass + safe padding |
| **Range / Slider** | raw `<input type="range">` | Custom track + thumb, value bubble, wheel + arrow key + touch |
| **CanvasOverlay** | 12 overlay divs/canvas | Single canvas layer with typed handles (center, edge, corner) + hitmap |
| **HistoryTimeline** | `.history-panel` | Vertical timeline with scrubbable cursor, branching indicator, swipe-to-delete on mobile |
| **Toast / Status** | `.workflow-status` | Auto-dismiss, error variant, action undo |
| **EmptyState / DropZone** | `#upload-prompt` | Illustration + drag zone + “Try sample image” |

All popups/bars use tokens → one CSS file, zero inline styles.

### 3.5 State & Data Flow (clean separation)

```
User gesture → ToolController → state.filters / geometry → historyManager → canvas.scheduleRender() → Toast
                    ↓
              InspectorPanel (reactive)
```
* Tools subscribe to `state.onChange` instead of direct DOM mutation.
* History stays diff/patch, but entries get **thumbnails** (tiny 64px canvas snapshot) for visual scrub.

### 3.6 Tool-by-Tool Polish (no logic change, just UI)

* **Tune / Details / WB:** single `Popup + Range` with live value + `Auto` as secondary button (not wand icon-only).
* **Crop:** handles become 24px touch targets, grid fades in on drag, presets become a horizontal pill row in Inspector (not bottom bar).
* **Rotate:** angle badge becomes HUD, straighten slider in Inspector, 90°/Flip as icon buttons.
* **Selective:** nodes render on CanvasOverlay with number badges; active params in Popup. Add “Clear all” in Inspector.
* **Curves:** card with dark checker bg, 255×255 canvas scales to container, LUT curve uses accent color, points are 10px circles.
* **Glamour / Grainy / B&W:** presets become visual chips (thumbnail + label) in Inspector, not tiny numbered circles.
* **Lens Blur / Vignette:** unified handle system; hint becomes a one-line coach mark that auto-hides after 3s.
* **Text:** inline editable text on canvas (contenteditable) + Inspector for font/size/color/opacity/style; custom font input with live preview.
* **Brush / Healing:** cursor preview uses accent ring + size label; mask view is a toggle with eye icon + hotkey `M`.

### 3.7 Accessibility Checklist
* All interactive elements: `role`, `aria-label`, `aria-pressed` / `aria-selected`, focus visible, `:focus-visible` ring uses accent.
* Popups: `role="dialog" aria-modal`, trap focus, `Esc` closes, `ArrowUp/Down` navigates, `Enter` selects.
* Sliders: `<label for>` + `aria-valuenow/min/max/text`.
* Color: contrast ≥ 4.5:1 for text; tokens tested in both themes.
* Motion: `prefers-reduced-motion` disables parallax/blur, keeps opacity fades.

### 3.8 Performance Guardrails
* Keep `canvas.js` pipeline but **debounce** `scheduleRender` + coalesce wheel events via `requestAnimationFrame`.
* Move heavy filters (Glamour blur, Grainy, Lens Blur) to `requestIdleCallback` or Web Worker in Phase 3 if needed — not Phase 1.
* OpenCV load shows progress bar in StatusBar.
* Thumbnail generation for history throttled to 1 per commit (offscreen 64px canvas).

---

## 4. Implementation Roadmap — Phased & Reviewable

### Phase 0 — Prep (no visual change, 1 PR)
* Add `package.json` + Vite + ESLint + Prettier
* Convert `js/*` to ESM exports (keep `window.App` shim temporarily for compat)
* Extract inline styles → `tokens.css` + `base.css` (visual identical)
* Add `npm run dev` + update `README` with new dev command
* **Review gate:** you see the same app, but running via `vite dev`

### Phase 1 — App Shell & Design System (biggest visual win, 1–2 PRs)
* Build new `AppShell`, `TopBar`, `ToolTile`, `InspectorPanel`, `HistoryTimeline`, `EmptyState`
* Replace fixed sidebar layout with responsive grid (desktop/tablet/mobile)
* Rebuild LOOKS / TOOLS / EXPORT panels using new components + tokens
* Replace `floating-toolbar` + `history-panel` with TopBar + Timeline drawer
* Polish upload/empty state, add sample image & drag feedback
* **Review gate:** shell looks production-grade; tools still use old popups (functional)

### Phase 2 — Unified Tool Controls (1–2 PRs)
* Ship `Popup`, `BottomBar`, `Range`, `CanvasOverlay` primitives
* Migrate tools one-by-one to primitives (batch: Tune/Details/WB/Curves → Crop/Rotate → Selective/Brush/Healing → Glamour/Grainy/B&W → LensBlur/Vignette/Text/Frames)
* Delete all inline `*-bottom-bar` divs + `*-popup` duplicates + legacy overlay canvases
* Keyboard + wheel polish, toast status
* **Review gate:** every tool uses same interaction language

### Phase 3 — Fit & Finish (1 PR, optional)
* Before/after compare (hold `C` or long-press), zoom/pan (wheel + pinch), fullscreen stage
* History thumbnails, filter search in Tools, command palette (`Cmd+K`)
* Web Worker for heavy filters, OpenCV loading state, reduced-motion polish
* GH Pages `dist` deploy workflow, Lighthouse ≥90
* **Review gate:** delights, not requirements

> **You can stop after any phase.** I’ll push each phase to `arena/01a06ce5-webseed` and open a preview — you approve before I continue.

---

## 5. What I Need From You Before I Start

Please confirm or tell me your preference:

1. **Stack choice — A (vanilla + Vite) or B (add Tailwind)?** I lean A to keep weight minimal.
2. **Visual direction:** Do you want to stay close to dark Snapseed (my plan assumes dark-first) or go light-first / more colorful?
3. **Branding:** Keep “Webseed” wordmark or rebrand? Any logo/colors you love (Linear, Lightroom, Figma…)?
4. **Mobile priority:** Must mobile be fully usable in Phase 1, or is “desktop perfect, mobile usable” enough for v1?
5. **Scope:** Are you OK with me touching `js/ui.js` heavily (split into modules) and `webseed.html` (shell rewrite) while keeping filter math untouched in Phase 1?

Reply with **“Go Phase 0 + 1 with Option A”** (or your variant) and I’ll start immediately. If you want tweaks, just say what to change.

---

## 6. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Vite breaks GitHub Pages (no build) | Keep `webseed.html` as fallback entry during migration; add `gh-pages` action that builds `dist` |
| Draggable popup math breaks on mobile | Replace ad-hoc drag with shared `useDrag` that clamps to Stage bounds |
| Old `localStorage` looks lose data | Migrate `snapseed.customLooks` → `webseed.customLooks` is already done; keep backward read |
| Canvas perf regression | No filter changes in Phase 1; benchmark `render()` before/after; debounce wheel |

---

## 7. Success Metrics (how we know it’s no longer crap)

* No inline `style="..."` in `webseed.html` except canvas sizing
* `styles.css` → token-driven, < 600 lines after de-dupe
* `js/ui.js` split into < 200 lines per tool module
* Lighthouse: Performance ≥90, Accessibility ≥95, Best Practices 100
* Works thumb-only on iPhone SE (375px) and iPad (768px)
* Zero regressions: every existing filter still pixel-identical (visual test)
