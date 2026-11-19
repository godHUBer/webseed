# Webseed × Snapseed — Tool Polish Plan
### Audit of all 18 tools in the toolbox & a buildable upgrade path to beat the current “basic” implementations

**Date:** 2026-09-04 • **Branch:** `arena/01a06ce5-webseed` • **Basis:** Snapseed 2026 (Google, 30+ tools, U-Point) • **Goal:** every tool feels like a real photo tool, not a demo slider

---

## 0) How this plan was built

- Enumerated the actual toolbox DOM: 16 visible buttons + 2 hidden (`btn-perspective`, `btn-expand`) → 18 filters implemented under `js/filters/` [checked via `grep id="btn-` in `webseed.html`].
- Traced each filter file (`tune.js`, `details.js`, `curves.js`, `whitebalance.js`, `crop.js`, `rotate.js`, `selective.js`, `brush.js`, `healing.js`, `lensblur.js`, `vignette.js`, `glamour.js`, `grainyfilm.js`, `blackandwhite.js`, `text.js`, `frames.js`, `raw.js`).
- Researched Snapseed intent from current guides and Google Play listings via web search, then mapped gaps.

> **Snapseed mental model:** global tone/color first (`Tune Image` → `Details` → `Curves` → `White Balance`), then geometry (`Crop` / `Rotate` / `Perspective` / `Expand`), then local (`Selective` / `Brush` / `Healing`), then creative/DOF (`Lens Blur` / `Vignette` / `Glamour Glow` / `Grainy Film` / `Black & White`) and finishing (`Text` / `Frames` / `Looks`). [1](https://iphonephotographyschool.com/snapseed/) [2](https://www.photoworkout.com/how-to-edit-photos-in-snapseed/) [3](https://play.google.com/store/apps/details?id=com.niksoftware.snapseed&hl=en_US)

---

## 1) Global design contract for every polished tool

Apply to **all** tools unless noted:

- **Gesture contract (Snapseed-faithful):** vertical swipe = switch parameter, horizontal swipe = adjust value, pinch = radius/scale, double-tap = reset, long-press = show original, two-finger drag = pan when zoomed [1](https://www.photoworkout.com/how-to-edit-photos-in-snapseed/) [2](https://www.fredericpaulussen.be/guide-to-editing-photos-in-snapseed/). Keep but **add** a visible segmented control in the popup as fallback (a11y + discoverability).
- **Before/after:** every tool shows hold-to-compare badge (already exists) + split-slider on long-press. Keep `compareOriginal` path but skip filters more cheaply (bypass `apply*` pipeline, don’t re-decode).
- **Stack discipline:** one `beforeSnapshot` on `openTool`, histogram/preview snapshot at 720p, `recordEdit` only on commit; cancel restores snapshot + mask buffers. No live `recordEdit` thrash.
- **Performance:** all pixel loops on `OffscreenCanvas` + `requestAnimationFrame` batching; WASM/OpenCV path for blur/heal/perspective kept behind `Module.onRuntimeInitialized` with the fixed 3.5s dismissible pill.
- **UI shell:** dark glass bottom-bar + popup (already fixed for light theme), histogram strip when relevant, reset button per parameter, value shown as `+12` not `12.0`.
- **Phase order:** Phase A — Tune/Crop/Rotate/White Balance/Details, Phase B — Curves/Selective/Brush/Healing, Phase C — Lens Blur/Vignette/Creative (Glamour/Grain/BW/Text/Frames/Perspective/Expand).

---

## 2) Tool-by-tool

### 2.1 Tune Image — *the starting point for any photo*
**Snapseed intent:** single entry for global light & color: **Brightness** (overall), **Contrast**, **Saturation**, **Ambiance** (depth via local contrast + saturation), **Highlights** (recover brights), **Shadows** (open darks), **Warmth** (yellow↔blue) [1](https://www.photoworkout.com/how-to-edit-photos-in-snapseed/) [2](https://www.fredericpaulussen.be/guide-to-editing-photos-in-snapseed/) [4](https://serenalissy.com/photography-apps-snapseed/) [5](https://iphonephotographyschool.com/snapseed/). Small combined moves > one big push; Auto via magic wand as starting point [2](https://www.fredericpaulussen.be/guide-to-editing-photos-in-snapseed/).

**Current Webseed:** 7 popup items mapping to `state.filters` floats; `tune.js` does naive per-pixel add/mul: brightness `+ val`, contrast via `259*(c+255)/255*(259-c)`, saturation via mix toward luma, ambiance as mild contrast+saturation tweak, highlights/shadows as linear masks from `lum/128`, warmth as R/B shift. No histogram, auto-tune is random `±` jitter, no highlight reconstruction.

**Gaps:** highlights/shadows clip; ambiance not local; warmth not temperature; no auto; no clipping warning; no histogram so blind.

**Polished proposal:**
- **Algorithm:** rewrite to scene-referred 4-step pipe: (1) exposure (EV via `pow2`), (2) highlight reconstruction (luma-weighted `highlightMask = smoothstep(0.5,1, lum)` → desat + compress), (3) shadows `shadowMask = 1 - smoothstep(0,0.5, lum)`, (4) true Ambiance = local contrast via 5×5 blurred luma + unsharp + saturation linked (`ambiance = lumaLocal * 0.35 + sat*0.6`), contrast via S-curve LUT, warmth via 2-axis (Temp blue↔yellow via `R+=k, B-=k` plus Tint green↔magenta via `G`), all clamped to avoid clipping.
- **Auto:** histogram analysis — median brightness → target 0.45, contrast → expand to 5/95th percentile, highlights → if 99th > 240 pull -25, shadows → if 1st < 25 lift +30; one-tap `Auto-Tune` replaces random.
- **UX:** histogram strip under slider (16-bin), clipping overlay toggle (Z), `Auto` wand icon + `Reset` per row, value badge with `±`, wheel `Shift` = 0.2-step fine grain; holds `C` to compare (already).
- **Polish:** LUT cache per session (256-entry), WebGL fallback via fragment shader if available; otherwise tiled `Uint8ClampedArray` with `requestIdleCallback`.

### 2.2 Details — *Structure & Sharpening*
**Intent:** **Structure** = medium-detail texture/macro-contrast, **Sharpening** = edge acutance; structure more useful for phone photos +20–40, sharpen sparingly to avoid halos [6](https://www.wallpics.com/blogs/news/snapseed-guide-how-to-create-stunning-edits-with-snapseed) [7](https://www.newsbytesapp.com/news/science/elevate-your-photos-with-snapseed/story) [8](https://www.mobiography.net/apps/snapseed-app-tutorial/) [9](https://www.photoworkout.com/how-to-edit-photos-in-snapseed/).

**Current:** two items `structure`/`sharpen`; `details.js` does single-pass unsharp (blur kernel 3) plus trivial sharpen.

**Gaps:** no halo suppression, no radius control, structure affects edges too (should not); no preview at 100%.

**Polished:**
- Implement true structure = high-pass filtered local contrast (DoG radius 2→8) blended by amount, edge mask stops sharpening on strong edges (Sobel mask >threshold → blend 0.3). Two sliders + Radius (hidden long-press).
- Loupe 100% overlay on touch (120×120 px near finger), halo demo with `compare` split.
- Range -100..+100 with 0 deadzone ±2.

### 2.3 Curves — *surgical tone & color*
**Intent:** diagonal tone curve per channel; `RGB` = master exposure/contrast, `Luminance` = exposure without saturation crush, `R/G/B` = color by opposing (R↔Cyan, G↔Magenta, B↔Yellow), `S-curve` lifts highlights/deepens shadows, lifted blacks = faded film, histogram behind curve static [10](https://www.creativepadmedia.com/how-to-use-the-curves-tool-in-snapseed-beginners-tutorial/) [11](https://vayce.app/tools/image-curves-adjustment/) [12](https://www.linkedin.com/pulse/snapseed-curves-tool-enhances-colour-tones-makes-your-mike-james) [13](https://www.linkedin.com/pulse/snapseed-using-curves-tool-edit-your-images-catriona-corrigan).

**Current:** graph canvas 256×256 with cubic Bezier through pins, RGB + R/G/B + Luminance, presets 2, no histogram, pins sometimes single.

**Gaps:** no real LUT, quantization banding, no Mix/Preserve-luma, histogram not updating, small hit area on mobile.

**Polished:**
- Full pipeline per [11](https://vayce.app/tools/image-curves-adjustment/): build 256 LUT per channel + master + `preserveLuma` flag (luma = 0.2126R+0.7152G+0.0722B), then `Mix%` slider (60–90% sweet spot). Nodes are Bezier with tangents, deletion via double-tap, snap to grid, 44px touch radius.
- Live 128-bin histogram drawn faint behind curve (read from current `ImageData`), not static.
- Presets: Soft Contrast, Hard Contrast, Lifted Blacks, Film Fade, Plus per-channel orange skin saver. Import/export as 16-point array for Looks.

### 2.4 White Balance — *make whites white*
**Intent:** fix casts: **Temperature** blue↔yellow (CT), **Tint** green↔magenta, plus AWB eye-dropper [14](https://www.fredericpaulussen.be/guide-to-editing-photos-in-snapseed/) [15](https://rawpedia.rawtherapee.com/White_Balance) [16](https://serenalissy.com/photography-apps-snapseed/) [17](https://www.creativepadmedia.com/how-to-use-the-white-balance-tool-in-snapseed-beginners-tutorial/). Tap AWB to neutralize gray patch.

**Current:** two items temperature/tint via simple channel multipliers; no eye-dropper.

**Gaps:** no gray picker, no AWB algorithm, multipliers clip.

**Polished:**
- Add **Auto** button: gray-world + white-patch hybrid (sample 7% center, compute channel gains `gR = avgG/avgR`, `gB = avgG/avgB`, clamp 0.6–1.7 as in RawPedia [15](https://rawpedia.rawtherapee.com/White_Balance)).
- **Picker:** tap canvas → 11×11 patch → gains from patch; show magnifier loupe.
- Sliders: Temp -100..+100 mapped to ±3500K (via `log` curve), Tint -100..+100 as `G-M` shift. Before/after chip shows patch color.

### 2.5 Crop — *cut distractions, nail aspect*
**Intent:** free + standard presets (1:1, 3:2, 4:3, 16:9), straighten subsumed under Rotate, but Crop must keep rule-of-thirds grid [18](https://iphonephotographyschool.com/snapseed/).

**Current:** overlay with masks + handles N/S/E/W/Corners, presets Free/Original/Square/3:2/4:3, flip aspect, drag works, 3×3 grid on drag.

**Gaps:** only 5 ratios, no 16:9/5:4/21:9, no golden ratio, no rotation sync, no canvas-relative vs image-relative bug.

**Polished:**
- Add 8 presets: Free, Original, 1:1, 5:4, 4:3, 3:2, 16:9, 21:9; golden spiral overlay toggle.
- Persistent handles 40×40 with 16px inner corner marks (already) + edge handles 20×; inertia drag, aspect lock icon.
- Commit rewrites `geometry.crop` as normalized `x,y,w,h`; cancel restores. Integration with Rotate: crop box rotates with canvas.

### 2.6 Rotate — *straighten & 90°*
**Intent:** auto-straighten horizon, ±~15° fine, 90° in either direction, Flip H [18](https://iphonephotographyschool.com/snapseed/) [19](https://www.capcut.com/resource/snapseed-photo-editing-app).

**Current:** `rotate.js` supports straighten via drag `dx→angle`, 90° button, flipX, grid overlay, badge angle, OpenCV cache invalidation.

**Gaps:** no auto-detect, straighten fill leaves black edges (needs auto-crop or content-aware).

**Polished:**
- Add **Auto** button: Hough horizon detection via OpenCV `Canny → HoughLinesP` (reuse `opencv.js`), snap to -10°..+10°.
- Straighten modes: `Crop to fill` (scale to remove edges, default) vs `Expand` (adds white); show edge preview. Snap 0.1° + haptics. Keep Flip H + Rotate 90 both dirs.

### 2.7 Perspective — *fix converging lines*
**Intent:** pull building horizons/skews; 4-point free + tilt/rotate bias; crucial for architecture [20](https://www.newsbytesapp.com/news/science/elevate-your-photos-with-snapseed/story) [21](https://play.google.com/store/apps/details?id=com.niksoftware.snapseed&view=zertifikate&hl=en_SG).

**Current:** `btn-perspective` hidden, no JS attached.

**Gaps:** entire tool missing.

**Polished (new build):**
- 4 draggable corner pins + tilt X/Y sliders + Rotate; `Auto` via `findChessboard` fallback or line detection.
- Warp via OpenCV `getPerspectiveTransform` + `warpPerspective` (INTER_LINEAR, BORDER_REPLICATE); preview via stretched canvas quad; if no cv, fallback bilinear JS warp at 0.5× preview then upsample.
- Grid overlay 10×10 with vanishing indicator; pinch to scale uniform.

### 2.8 Expand — *grow the canvas*
**Intent:** increase border by smart fill / reflect / white to fix too-tight crop [21](https://play.google.com/store/apps/details?id=com.niksoftware.snapseed&view=zertifikate&hl=en_SG).

**Current:** `btn-expand` hidden, no logic.

**Polished:**
- 4 handles (up/down/left/right) dragging expands 0–40% per side; modes: Smart (inpaint border via OpenCV `inpaint` + texture synthesis), White, Black, Reflect.
- Preview as extended canvas with original shown; commit resizes `ImageData` and `geometry.expand`.

### 2.9 Selective — *U-Point, Snapseed’s killer*
**Intent:** place 1–8 **Control Points**; each selects similar color/texture via radius (pinch to grow, red overlay shows extent), then swipe B/C/S/St (Brightness/Contrast/Saturation/Structure) [2](https://www.photoworkout.com/how-to-edit-photos-in-snapseed/) [22](https://support.google.com/snapseed/answer/3111701?hl=en) [23](https://apps.apple.com/fm/app/snapseed/id439438619).

**Current:** `selective.js` 4 items (R,B,C,S,St) per point, add/+ button, view mask toggle, pinch radius, red highlight only via circle not U-Point similarity.

**Gaps:** radius is uniform circle, not color similarity; mask not edge-aware; max points unclear; no copy/paste.

**Polished:**
- True U-Point approximation: per-point Gaussian in `Lab` space (radius → sigma) + spatial sigma, weighted blend `w = exp(-ΔE²/σ²) * exp(-d²/ρ²)`. Show precise red overlay via low-res 160×160 mask upsampled with edge-aware guided filter (fast).
- Up to 8 points, drag to move, tap to cycle B/C/S/St, copy/paste via long-press menu (Reset/Cut/Copy/Delete/Paste) as per [22](https://support.google.com/snapseed/answer/3111701?hl=en). Threshold slider for similarity.
- Performance: mask cache per point at 0.25×, update on pinch end only.

### 2.10 Brush — *paint edits*
**Intent:** freehand paint **Exposure, Temperature, Saturation, Dodge&Burn** over exact pixels; opacity builds with strokes; eraser to subtract [24](https://filmora.wondershare.com/video-editor-review/snapseed-photo-editing-review.html) [25](https://iphonephotographyschool.com/snapseed/).

**Current:** `brush.js` 4 types + size + erasing via `Float32Array` mask per type, Gaussian brush falloff `sigma=r/2.5`, cursor overlay, undo via mask reset — fairly complete.

**Gaps:** no hardness, flow, auto-edge, preview lag on large images, mask is per-type not per-stroke undo.

**Polished:**
- Add **Hardness** (0–100 → sigma 0.7–4.2), **Flow** 10–100, pressure curve for stylus; edge-aware toggle (guided filter on mask).
- Stroke history: push `ImageBitmap` diff per stroke for per-stroke undo (currently only full clear). Show mask at 30% onion when `view` on, with ×.
- Use `PaintWorklet`-style tiling: render brush into 256×256 tiles, composite to full mask only on `scheduleRender`.

### 2.11 Healing — *remove distractions*
**Intent:** paint over unwanted object → algorithm fills from surroundings; great for power lines, trash [26](https://www.mobiography.net/apps/snapseed-app-tutorial/) [27](https://www.photoworkout.com/how-to-edit-photos-in-snapseed/).

**Current:** `healing.js` + `opencv_process.js` does Telea `inpaint` for radius brush.

**Gaps:** single radius, no source picking, no retry, coarse mask.

**Polished:**
- Size + hardness, two modes: **Healing** (inpaint, texture-aware) and **Clone** (stamp from dragged source). Preview feather. Undo per dab.
- If no cv, fallback to JS `patchMatch` at 0.5×. Before committing, show magnified loupe (2×) at cursor.

### 2.12 Lens Blur — *fake shallow DOF with bokeh*
**Intent:** elliptical/linear focus area + transition + bokeh shape; mimics f/1.4 background softening [28](https://www.zero-one-kiramager.com/mastering-blur-effects-in-snapseed) [29](https://www.newsbytesapp.com/news/science/elevate-your-photos-with-snapseed/story) [30](https://shotkit.com/snapseed-beginners-guide/).

**Current:** fairly rich: elliptical center `x,y`, `focusScaleX/Y`, outer feather via `transition`, 11 bokeh shapes with weighted samples, elliptical vs linear toggle, bottom bar + shape popup. Interactive canvas with move/resize handles.

**Gaps:** blur strength not spatially varying well at edges, shape rotation missing, transition is uniform.

**Polished:**
- Add **Focus transition** as annulus width controlling `smoothstep` between focus ellipse and outer; blur strength as variable radius (samples scaled by distance field).
- Add **Bokeh rotation** slider + aperture blade count mimic; vignetteStrength ties to blur to darken background like real lens [28](https://www.zero-one-kiramager.com/mastering-blur-effects-in-snapseed).
- Use separable box blur approximation (horizontal then vertical) with shape kernel via summed-area table for speed; fallback to stack blur for no-cv.

### 2.13 Vignette — *draw eye to center*
**Intent:** **Inner Brightness** + **Outer Brightness** (darken corners classic look) [31](https://iphonephotographyschool.com/snapseed/) [32](https://shotkit.com/snapseed-beginners-guide/).

**Current:** `vignette.js` with `innerBrightness`/`outerBrightness` + center `anchor` and radius, hints and wheel Shift behavior.

**Gaps:** shape is circular only, no oval control, no color, hard edge.

**Polished:**
- Add elliptical radii `radiusX/Y` (match Lens Blur handles) + feather 0–100, color tint (warm vignette). Outer can be +ve (bright edges) or -ve.
- Algorithm: radial distance normalized via ellipse, `v = smoothstep(0, feather, |d-0.5|)` then `col *= 1 + v*outer + (1-v)*inner`.
- Loupe center dot + outer ring handles (already similar).

### 2.14 Glamour Glow — *soft fashion bloom*
**Intent:** soft glow around brights; presets 1–5, then manual Glow/Saturation/Warmth; great for portrait [33](https://play.google.com/store/apps/details?id=com.niksoftware.snapseed&view=zertifikate&hl=en_SG) [34](https://www.zero-one-kiramager.com/mastering-blur-effects-in-snapseed).

**Current:** 5 presets hard-coded, 3 popup sliders, bottom bar fine.

**Gaps:** preset mapping crude, no highlight threshold, bloom is naive blur.

**Polished:**
- True bloom: threshold luma > 0.6, blur threshold layer with 13×13 Gaussian, blend `screen` with amount = glow, then sat/warmth on bloom layer only — preserves skin.
- 5 presets remapped from Snapseed values (verify via export), add `Highlights` control, `Grain` optional.

### 2.15 Grainy Film — *analog soul, 19 stocks*
**Intent:** emulate historic stocks (F1–F5, X1–X5, A1–A4, B1–B4): each = contrast/luma curve + color LUT + grain size [35](https://onewebcare.com/blog/3-best-free-vintage-filters-retro-photo-effects-for-stunning-images) [36](https://www.photoworkout.com/how-to-edit-photos-in-snapseed/).

**Current:** `grainyfilm.js` lists 19 presets but all map to grain + styleStrength only, no color shift.

**Gaps:** preset LUTs missing, grain is white noise not filmic.

**Polished:**
- Per-preset 3×256 LUT for R/G/B + grain params (size 1.2–3.8,软硬). Generate via measured film curves (pre-baked). Slider `Grain` controls grain amount + size jitter via Perlin.
- Grain generation: tiled 512×512 `filmGrain` texture (value noise + blue-yellow scatter) blended `overlay` at 12–35%. Cache per stock.

### 2.16 Black & White — *darkroom classics with filters*
**Intent:** B&W with colored lens simulation: Red/Orange/Yellow/Green/Blue darken sky/brighten skin; styles Neutral/Contrast/Bright/Dark/Film/Sky etc., plus Brightness/Contrast/Grain [37](https://play.google.com/store/apps/details?id=com.niksoftware.snapseed&hl=en_US).

**Current:** `blackandwhite.js` has 6 style dims + 4 filters, brightness/contrast/grain logic, but `bwEnabled` heuristic fragile.

**Gaps:** filter mixing not photometric, grain weak.

**Polished:**
- Proper channel mixer: `gray = dot(RGB, lens)` where lens = normalized filter vector (e.g., Red 0.8,0.15,0.05), then style curve: Contrast → S-curve, Bright → linear lift, Dark → gamma 0.85, Film → lifted blacks + desat mid, Sky → blue-aware.
- Add `bwEnabled` flag explicit in state, toggled on first popup open; histogram for B&W luma.

### 2.17 Text — *caption with style*
**Intent:** add wordmark/caption with fonts, color, opacity, placement; Snapseed has limited but useful text [38](https://play.google.com/store/apps/details?id=com.niksoftware.snapseed&view=zertifikate&hl=en_IN).

**Current:** `text.js` supports 6 styles B1/B2/N1/N2/L1/H1, custom font family, invert, drag + rotate + scale, opacity popup + color palette.

**Gaps:** no line wrap measurement, no kerning/alignment, no shadow.

**Polished:**
- Add alignment (left/center/right), line spacing, letter spacing (0..30), shadow/outline toggles, 8 more fonts (system stack + Google Fonts already loaded Sora/Oswald/Caveat/Inter). Palette shows recent colors.
- Interaction: double-tap to edit textarea (already) + drag handles for box width, rotate via knob 12px outside corner.

### 2.18 Frames — *finish like print*
**Intent:** border around photo 20+ frames (thin white, black, wood, etc.) with width [39](https://play.google.com/store/apps/details?id=com.niksoftware.snapseed&hl=en_IN).

**Current:** `frames.js` 8 frames styles 1,2,6,7,13,14,19,20, width slider, canvas interaction via `frames-interactive-overlay` ew-resize.

**Gaps:** only 8 of 23, no preview thumbnail, width UX odd.

**Polished:**
- Expand to 18 styles (add shadow, polaroid, rough, etc.) with thumbnail strip (swipe), width 0–80px with aspect-aware corner miter, background bleed option.
- Render via 9-patch: draw frame texture clipped then inset image.

---

## 3) Cross-tool polish that makes the difference

- **Looks ↔ Tools bridge:** saving a Look captures full `getLookSnapshot()` (filters + vignette + lensBlur + geometry cropped state); applying replays with undo entry “Look: X”.
- **Stack UX:** history panel already shows 44px thumb; add per-entry `… → Revisit` that reopens that tool’s popup at committed value (like Snapseed Stack).
- **Shortcuts:** keep Phase-3 shortcuts (Ctrl+Z/Y, +/-/0, H, C, F, ⌘K) and add `,`/`.` to cycle popup rows.
- **Mobile:** bottom-sheet for sidebar on <880px, thumb row for tools (already grid 4), bottom-bar always above keyboard (visualViewport).

---

## 4) Build plan (no-code until you approve — per your rule)

This document is the plan. If you confirm:

**Phase A (1–2 days) — globals:**
- Tune (LUT+hist), White Balance (picker+auto), Details (DoG), Crop (8 presets), Rotate (auto detection)
- Unit: test each on 4K image <180ms via tiling, verify render pipeline + history

**Phase B (2–3 days) — locals:**
- Curves (LUT+hist), Selective (Lab U-Point), Brush (hardness/flow), Healing (clone mode)
- Needs OpenCV path fallback verified under slow CDN (re-use 3.5s pill logic)

**Phase C (2 days) — creative & geometry:**
- Lens Blur (kernel), Vignette (ellipse), Glamour/Grain/BW LUTs, Text/Frames, Perspective/Expand (OpenCV warp)
- Final pass: light-theme contrast audit (already fixed but re-check all new popups), reduce-motion polish

All phases keep bundle <150KB gz, vanilla+Vite, no React.

---

## 5) Risks & mitigations

| Risk | Mitigation |
|---|---|
| OpenCV CDNs flap → heal/persp fail | Pill 3.5s auto-dismiss + statusbar; JS fallback blur/heal at half-res |
| White-image contrast regressions | Dark glass rule stays — every new bottom-bar/popup inherits the 2026-09-04 CSS override |
| Per-pixel loops jank on 4K | Tile 1024×1024 + LUT caching + OffscreenCanvas; show progress in toast if >400ms |
| Tool state bleed (e.g., BW turning on) | Explicit `toolEnabled` flags, `isToolOpen` heuristic removed |

---

## 6) Acceptance checklist

- [ ] Each of the 18 tools opens, shows its dedicated popup + bottom-bar, pinch/wheel/drag work, Esc cancels, Enter commits, and appears as a thumb in History
- [ ] Light + dark themes both have ≥4.5:1 contrast on every overlay over a pure white test image
- [ ] No centered pill blocks canvas >3.5s
- [ ] Build `dist/webseed.html` <100KB gz, total CSS+JS <150KB gz

---

### References
Snapseed tool intents as cited inline; Google Play listing enumerating 30+ tools [3](https://play.google.com/store/apps/details?id=com.niksoftware.snapseed&hl=en_US) / [21](https://play.google.com/store/apps/details?id=com.niksoftware.snapseed&view=zertifikate&hl=en_SG), Selective U-Point patent flow [22](https://support.google.com/snapseed/answer/3111701?hl=en), Curves luminance discussion [11](https://vayce.app/tools/image-curves-adjustment/), Levels vs Curves nuance [12](https://www.linkedin.com/pulse/snapseed-curves-tool-enhances-colour-tones-makes-your-mike-james), etc.

— end of plan — ask for “go” before any code changes.
