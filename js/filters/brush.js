// js/filters/brush.js
(function () {
    window.App = window.App || {};
    window.App.filtersLogic = window.App.filtersLogic || {};

    const BRUSH_TYPES = ['dodgeBurn', 'exposure', 'temperature', 'saturation'];
    const BRUSH_LABELS = {
        dodgeBurn:   'Dodge & Burn',
        exposure:    'Exposure',
        temperature: 'Temperature',
        saturation:  'Saturation'
    };
    const BRUSH_COLORS = {
        dodgeBurn:   '#f5c842',
        exposure:    '#ff7043',
        temperature: '#29b6f6',
        saturation:  '#ab47bc'
    };

    // ── Painting State ──────────────────────────────────────────────
    let isPainting = false;
    let lastPaintX = -1, lastPaintY = -1;

    // ── Cursor Canvas ───────────────────────────────────────────────
    let cursorCanvas = null, cursorCtx = null;

    function drawCursor(x, y) {
        if (!cursorCanvas || !cursorCtx) return;
        const brush = window.App.state.brush;
        cursorCtx.clearRect(0, 0, cursorCanvas.width, cursorCanvas.height);
        const r = brush.size;
        cursorCtx.beginPath();
        cursorCtx.arc(x, y, r, 0, Math.PI * 2);
        cursorCtx.strokeStyle = brush.erasing ? 'rgba(255,80,80,0.9)' : 'rgba(255,255,255,0.85)';
        cursorCtx.lineWidth = 1.5;
        cursorCtx.stroke();
        // inner dot
        cursorCtx.beginPath();
        cursorCtx.arc(x, y, 2, 0, Math.PI * 2);
        cursorCtx.fillStyle = brush.erasing ? 'rgba(255,80,80,0.9)' : 'rgba(255,255,255,0.85)';
        cursorCtx.fill();
    }

    function clearCursor() {
        if (cursorCtx) cursorCtx.clearRect(0, 0, cursorCanvas.width, cursorCanvas.height);
    }

    // ── Mask Initialization ─────────────────────────────────────────
    function ensureMask() {
        const canvasEl = window.App.canvas.el;
        const brush = window.App.state.brush;
        const w = canvasEl.width, h = canvasEl.height;
        if (brush.maskWidth !== w || brush.maskHeight !== h || !brush.mask.dodgeBurn) {
            BRUSH_TYPES.forEach(t => { brush.mask[t] = new Float32Array(w * h); });
            brush.maskWidth = w;
            brush.maskHeight = h;
        }
    }

    // ── Painting ────────────────────────────────────────────────────
    function paintAt(canvasX, canvasY) {
        const brush = window.App.state.brush;
        ensureMask();

        const mask = brush.mask[brush.activeType];
        const w = brush.maskWidth;
        const h = brush.maskHeight;
        const r = Math.max(1, brush.size);
        const rSq = r * r;
        const sigma = r / 2.5;
        const twoSigSq = 2 * sigma * sigma;

        // Strength: positive = effect forward, negative = reversed (burn/cool/desaturate)
        let targetStrength;
        if (brush.erasing) {
            targetStrength = 0;
        } else {
            // dodgeBurn and exposure: positive = dodge/brighten, negative button sets negative
            targetStrength = brush.strength;
        }

        const minX = Math.max(0, Math.floor(canvasX - r));
        const maxX = Math.min(w - 1, Math.ceil(canvasX + r));
        const minY = Math.max(0, Math.floor(canvasY - r));
        const maxY = Math.min(h - 1, Math.ceil(canvasY + r));

        for (let py = minY; py <= maxY; py++) {
            for (let px = minX; px <= maxX; px++) {
                const dx = px - canvasX;
                const dy = py - canvasY;
                const dSq = dx * dx + dy * dy;
                if (dSq > rSq) continue;
                
                const dist = Math.sqrt(dSq);
                // Linear Falloff: 1.0 at center, 0.0 at radius edge
                const normDist = dist / r;
                const w_brush = Math.max(0, 1.0 - normDist);
                
                const idx = py * w + px;
                if (brush.erasing) {
                    mask[idx] = mask[idx] * (1 - w_brush); // fade towards 0
                } else {
                    // Set intensity based on falloff. 
                    // This ensures the center point ALWAYS reflects the selected targetStrength,
                    // and prevents over-accumulation while maintaining a natural taper.
                    const val = targetStrength * w_brush;
                    if (targetStrength >= 0) {
                        mask[idx] = Math.max(mask[idx], val);
                    } else {
                        mask[idx] = Math.min(mask[idx], val);
                    }
                }
            }
        }
    }

    // Interpolate stroke for smooth coverage at any speed
    function paintInterpolated(x1, y1, x2, y2) {
        const dx = x2 - x1, dy = y2 - y1;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const step = Math.max(1, window.App.state.brush.size * 0.3);
        const steps = Math.ceil(dist / step);
        for (let i = 0; i <= steps; i++) {
            const t = steps === 0 ? 0 : i / steps;
            paintAt(x1 + dx * t, y1 + dy * t);
        }
    }

    // ── Coordinate Helper ────────────────────────────────────────────
    function getCanvasCoords(clientX, clientY) {
        const rect = window.App.canvas.el.getBoundingClientRect();
        const scaleX = window.App.canvas.el.width / rect.width;
        const scaleY = window.App.canvas.el.height / rect.height;
        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY,
            inCanvas: clientX >= rect.left && clientX <= rect.right &&
                      clientY >= rect.top  && clientY <= rect.bottom
        };
    }

    function getCursorCoords(clientX, clientY) {
        if (!cursorCanvas) return { x: 0, y: 0, inCanvas: false };
        const crect = cursorCanvas.getBoundingClientRect();
        const mrect = window.App.canvas.el.getBoundingClientRect();
        return {
            x: clientX - crect.left,
            y: clientY - crect.top,
            inCanvas: clientX >= mrect.left && clientX <= mrect.right &&
                      clientY >= mrect.top  && clientY <= mrect.bottom
        };
    }

    // ── UI Initialization ────────────────────────────────────────────
    function initBrushUI() {
        const toolBtn      = document.getElementById('btn-brush');
        const bottomBar    = document.getElementById('brush-bottom-bar');
        const cancelBtn    = document.getElementById('brush-cancel');
        const applyBtn     = document.getElementById('brush-apply');
        const eraseBtn     = document.getElementById('brush-erase');
        const viewBtn      = document.getElementById('brush-view');
        const strengthDisp = document.querySelector('[data-brush-strength="display"]');
        const sizeDisp     = document.getElementById('brush-size-value');
        const badgeType    = document.getElementById('brush-badge-type');
        const badgeStrDiv  = document.querySelector('[data-brush-strength="display"]');
        const badgePanel   = document.getElementById('brush-badge');

        cursorCanvas = document.getElementById('brush-cursor-canvas');
        if (cursorCanvas) cursorCtx = cursorCanvas.getContext('2d');

        if (!toolBtn) return;
        
        let badgeTimeout = null;
        function showBadgeBriefly() {
            if (badgePanel) {
                badgePanel.style.display = 'flex';
                badgePanel.style.opacity = '1';
                if (badgeTimeout) clearTimeout(badgeTimeout);
                badgeTimeout = setTimeout(() => {
                    badgePanel.style.opacity = '0';
                    setTimeout(() => { if (badgePanel.style.opacity === '0') badgePanel.style.display = 'none'; }, 300);
                }, 2500);
            }
        }

        const uiCallbackObj = {
            show: () => {
                bottomBar.style.display = 'flex';
                syncCursorCanvasSize();
                cursorCanvas.style.display = 'block';
                // Ensure mask arrays exist for current canvas size
                ensureMask();
                refreshUI();
            },
            hide: () => {
                bottomBar.style.display = 'none';
                if (cursorCanvas) cursorCanvas.style.display = 'none';
                if (badgePanel) badgePanel.style.display = 'none';
                clearCursor();
            }
        };

        toolBtn.addEventListener('click', () => {
            if (window.App.toolManager.activeToolId === 'btn-brush') return;
            window.App.toolManager.openTool('btn-brush', uiCallbackObj);
        });

        if (cancelBtn) cancelBtn.addEventListener('click', () => window.App.toolManager.cancelTool());
        if (applyBtn)  applyBtn.addEventListener('click',  () => window.App.toolManager.commitTool());

        // ── Brush Type Buttons ───────────────────────────────────────
        document.querySelectorAll('.brush-type-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (window.App.toolManager.activeToolId !== 'btn-brush') return;
                const type = btn.getAttribute('data-type');
                const brush = window.App.state.brush;

                // Toggle: if clicking active type switch between positive/negative strength
                if (brush.activeType === type) {
                    brush.strength = -(brush.strength);
                } else {
                    brush.activeType = type;
                    // Reset to positive strength on type switch
                    brush.strength = Math.abs(brush.strength);
                }
                brush.erasing = false;
                if (eraseBtn) eraseBtn.classList.remove('active');
                refreshUI();
                window.App.canvas.scheduleRender();
            });
        });

        // ── Erase Toggle ─────────────────────────────────────────────
        if (eraseBtn) {
            eraseBtn.addEventListener('click', () => {
                if (window.App.toolManager.activeToolId !== 'btn-brush') return;
                const brush = window.App.state.brush;
                brush.erasing = !brush.erasing;
                eraseBtn.classList.toggle('active', brush.erasing);
                refreshUI();
            });
        }

        // ── View (Mask) Toggle ──────────────────────────────────────
        if (viewBtn) {
            viewBtn.addEventListener('click', () => {
                if (window.App.toolManager.activeToolId !== 'btn-brush') return;
                const brush = window.App.state.brush;
                brush.showMask = !brush.showMask;
                viewBtn.classList.toggle('active', brush.showMask);
                window.App.canvas.scheduleRender();
            });
        }

        // ── Mouse/Touch Painting on Canvas ───────────────────────────
        const container = document.querySelector('.canvas-container');

        const onPointerDown = (e) => {
            if (window.App.toolManager.activeToolId !== 'btn-brush') return;
            const isTouch = e.type.includes('touch');
            const clientX = isTouch ? e.touches[0].clientX : e.clientX;
            const clientY = isTouch ? e.touches[0].clientY : e.clientY;

            // Only paint if click is on the canvas itself
            const coords = getCanvasCoords(clientX, clientY);
            if (!coords.inCanvas) return;

            e.preventDefault();
            isPainting = true;
            lastPaintX = coords.x;
            lastPaintY = coords.y;
            paintAt(coords.x, coords.y);
            window.App.canvas.scheduleRender();
        };

        const onPointerMove = (e) => {
            if (window.App.toolManager.activeToolId !== 'btn-brush') return;
            const isTouch = e.type.includes('touch');
            const clientX = isTouch ? (e.touches[0]?.clientX ?? 0) : e.clientX;
            const clientY = isTouch ? (e.touches[0]?.clientY ?? 0) : e.clientY;

            // Update cursor preview
            const cursorCoords = getCursorCoords(clientX, clientY);
            if (cursorCoords.inCanvas) {
                syncCursorCanvasSize();
                drawCursor(cursorCoords.x, cursorCoords.y);
            } else {
                clearCursor();
            }

            if (!isPainting) return;
            e.preventDefault();
            const coords = getCanvasCoords(clientX, clientY);
            if (!coords.inCanvas && !isPainting) return;

            paintInterpolated(lastPaintX, lastPaintY, coords.x, coords.y);
            lastPaintX = coords.x;
            lastPaintY = coords.y;
            window.App.canvas.scheduleRender();
        };

        const onPointerUp = () => {
            isPainting = false;
            lastPaintX = -1;
            lastPaintY = -1;
        };

        container.addEventListener('mousedown',  onPointerDown);
        container.addEventListener('touchstart', onPointerDown, { passive: false });
        document.addEventListener('mousemove',   onPointerMove);
        document.addEventListener('touchmove',   onPointerMove, { passive: false });
        document.addEventListener('mouseup',     onPointerUp);
        document.addEventListener('touchend',    onPointerUp);

        // Hide cursor when leaving the page
        document.addEventListener('mouseleave', clearCursor);

        // ── Scroll Wheel: Strength & Size ────────────────────────────
        // Scroll on left half of container → change strength (intensity)
        // Scroll on right half of container → change brush size (range)
        container.addEventListener('wheel', (e) => {
            if (window.App.toolManager.activeToolId !== 'btn-brush') return;
            e.preventDefault();
            const brush = window.App.state.brush;
            const delta = e.deltaY < 0 ? 1 : -1;

            const clientX = e.clientX;
            const rect = window.App.canvas.el.getBoundingClientRect();
            // Check if pointer is on the left half of the image
            const isLeft = clientX < (rect.left + rect.width / 2);

            if (!isLeft) {
                // Right side: Range (size)
                brush.size = Math.max(5, Math.min(200, brush.size + delta * 3));
            } else {
                // Left side: Intensity (strength) preserves sign direction
                const sign = brush.strength < 0 ? -1 : 1;
                let abs = Math.abs(brush.strength);
                abs = Math.max(1, Math.min(100, abs + delta * 2));
                brush.strength = sign * abs;
            }
            refreshUI();
            showBadgeBriefly();
        }, { passive: false });

        // ── Refresh UI Helper ────────────────────────────────────────
        function refreshUI() {
            const brush = window.App.state.brush;
            const absStr = Math.abs(brush.strength);
            const sign = brush.strength < 0 ? '−' : '+';
            const col = BRUSH_COLORS[brush.activeType];

            // Strength display
            if (strengthDisp) {
                strengthDisp.textContent = (brush.erasing ? 'Erasing' : sign + absStr);
                strengthDisp.style.color = brush.erasing ? '#ff6b6b' : col;
            }
            if (sizeDisp) sizeDisp.textContent = brush.size;

            // Type buttons active state
            document.querySelectorAll('.brush-type-btn').forEach(btn => {
                const t = btn.getAttribute('data-type');
                btn.classList.toggle('active', t === brush.activeType && !brush.erasing);
                if (t === brush.activeType && !brush.erasing) {
                    btn.style.borderColor = col;
                    btn.style.color = col;
                } else {
                    btn.style.borderColor = '';
                    btn.style.color = '';
                }
            });

            // Badge
            if (badgeType) {
                badgeType.textContent = brush.erasing ? 'Eraser' : BRUSH_LABELS[brush.activeType];
                badgeType.style.color = brush.erasing ? '#ff6b6b' : col;
            }
            if (badgeStrDiv) {
                badgeStrDiv.textContent = brush.erasing ? '' : (sign + absStr);
                badgeStrDiv.style.color = col;
            }
        }

        // keep size synced on window resize
        window.addEventListener('resize', syncCursorCanvasSize);
    }

    function syncCursorCanvasSize() {
        if (!cursorCanvas) return;
        const container = document.querySelector('.canvas-container');
        if (!container) return;
        const r = container.getBoundingClientRect();
        if (cursorCanvas.width !== r.width || cursorCanvas.height !== r.height) {
            cursorCanvas.width  = r.width;
            cursorCanvas.height = r.height;
        }
    }

    // ── Render-Time Pixel Processor ─────────────────────────────────
    window.App.filtersLogic.applyBrushMask = function (data, width, height) {
        const brush = window.App.state.brush;
        if (!brush || !brush.mask.dodgeBurn) return;
        if (brush.maskWidth !== width || brush.maskHeight !== height) return; // stale

        const dodgeBurnMask   = brush.mask.dodgeBurn;
        const exposureMask    = brush.mask.exposure;
        const temperatureMask = brush.mask.temperature;
        const saturationMask  = brush.mask.saturation;
        const showMask        = brush.showMask;

        for (let i = 0, pi = 0; i < width * height; i++, pi += 4) {
            const db  = dodgeBurnMask[i]   / 100;
            const ex  = exposureMask[i]    / 100;
            const tmp = temperatureMask[i] / 100;
            const sat = saturationMask[i]  / 100;

            // Early-exit for untouched pixels
            if (db === 0 && ex === 0 && tmp === 0 && sat === 0) continue;

            let R = data[pi], G = data[pi + 1], B = data[pi + 2];

            // --- Mask Debug View ---
            if (showMask) {
                // Composite all active channels into one color blend
                let maskR = 0, maskG = 0, maskB = 0, maskTotal = 0;
                if (Math.abs(db) > 0.01) {
                    // Dodge = yellow, Burn = cyan
                    const sign = db > 0 ? 1 : -1;
                    maskR += sign > 0 ? Math.abs(db) * 255 : 0;
                    maskG += sign > 0 ? Math.abs(db) * 200 : Math.abs(db) * 255;
                    maskB += sign < 0 ? Math.abs(db) * 255 : 0;
                    maskTotal += Math.abs(db);
                }
                if (Math.abs(ex) > 0.01) {
                    maskR += Math.abs(ex) * 255; maskTotal += Math.abs(ex);
                }
                if (Math.abs(tmp) > 0.01) {
                    maskR += tmp > 0 ? Math.abs(tmp) * 200 : 0;
                    maskB += tmp < 0 ? Math.abs(tmp) * 200 : 0;
                    maskTotal += Math.abs(tmp);
                }
                if (Math.abs(sat) > 0.01) {
                    maskR += sat > 0 ? Math.abs(sat) * 180 : 0;
                    maskB += Math.abs(sat) * 120;
                    maskTotal += Math.abs(sat);
                }
                const blend = Math.min(1, maskTotal * 0.9);
                if (blend > 0) {
                    data[pi]     = Math.min(255, R * (1 - blend) + (maskR / maskTotal) * blend);
                    data[pi + 1] = Math.min(255, G * (1 - blend * 0.7));
                    data[pi + 2] = Math.min(255, B * (1 - blend) + (maskB / maskTotal) * blend);
                }
                continue;
            }

            // --- Dodge & Burn ---
            if (db !== 0) {
                const w = Math.abs(db);
                if (db > 0) {
                    // Dodge: lighten (screen-blend approximation)
                    R = R + (255 - R) * w * 0.6;
                    G = G + (255 - G) * w * 0.6;
                    B = B + (255 - B) * w * 0.6;
                } else {
                    // Burn: darken (multiply-blend approximation)
                    R = R * (1 - w * 0.55);
                    G = G * (1 - w * 0.55);
                    B = B * (1 - w * 0.55);
                }
            }

            // --- Exposure ---
            if (ex !== 0) {
                const stops = ex * 1.5;
                const factor = Math.pow(2, stops);
                R = R * factor;
                G = G * factor;
                B = B * factor;
            }

            // --- Temperature ---
            if (tmp !== 0) {
                const w = Math.abs(tmp);
                if (tmp > 0) {
                    // Warm: boost red, slightly boost green, cool blue
                    R = R + (255 - R) * w * 0.35;
                    G = G + (255 - G) * w * 0.08;
                    B = B * (1 - w * 0.30);
                } else {
                    // Cool: boost blue, slightly desaturate red
                    R = R * (1 - w * 0.30);
                    G = G + (255 - G) * w * 0.04;
                    B = B + (255 - B) * w * 0.35;
                }
            }

            // --- Saturation ---
            if (sat !== 0) {
                const luma = 0.2126 * R + 0.7152 * G + 0.0722 * B;
                R = luma + (R - luma) * (1 + sat);
                G = luma + (G - luma) * (1 + sat);
                B = luma + (B - luma) * (1 + sat);
            }

            data[pi]     = Math.max(0, Math.min(255, R));
            data[pi + 1] = Math.max(0, Math.min(255, G));
            data[pi + 2] = Math.max(0, Math.min(255, B));
        }
    };

    document.addEventListener('DOMContentLoaded', () => {
        initBrushUI();
    });

})();
