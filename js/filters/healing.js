// js/filters/healing.js
(function () {
    window.App = window.App || {};
    window.App.filtersLogic = window.App.filtersLogic || {};

    let isPainting = false;
    let currentPath = [];
    let cursorCanvas, cursorCtx;
    let badgePanel, sizeDisp, undoBtn;

    // The single accumulator overlay for non-destructive healing mapping to current canvas bounds
    // stored in App.state.healing.overlayCanvas
    
    function initHealingUI() {
        const toolBtn = document.getElementById('btn-healing');
        const bottomBar = document.getElementById('healing-bottom-bar');
        const cancelBtn = document.getElementById('healing-cancel');
        const applyBtn = document.getElementById('healing-apply');
        undoBtn = document.getElementById('healing-undo');
        
        cursorCanvas = document.getElementById('healing-cursor-canvas');
        if (cursorCanvas) cursorCtx = cursorCanvas.getContext('2d');
        
        badgePanel = document.getElementById('healing-badge');
        sizeDisp = document.getElementById('healing-size-value');

        if (!toolBtn) return;

        const uiCallbackObj = {
            show: () => {
                bottomBar.style.display = 'flex';
                syncCanvasSize();
                cursorCanvas.style.display = 'block';
                if (!window.App.state.healing.overlayCanvas) {
                    const el = window.App.canvas.el;
                    const oc = document.createElement('canvas');
                    oc.width = el.width;
                    oc.height = el.height;
                    window.App.state.healing.overlayCanvas = oc;
                }
                updateUndoState();
            },
            hide: () => {
                bottomBar.style.display = 'none';
                if (cursorCanvas) cursorCanvas.style.display = 'none';
                if (badgePanel) badgePanel.style.display = 'none';
                clearCursor();
            }
        };

        toolBtn.addEventListener('click', () => {
            if (window.App.toolManager.activeToolId === 'btn-healing') return;
            window.App.toolManager.openTool('btn-healing', uiCallbackObj);
        });

        if (cancelBtn) cancelBtn.addEventListener('click', () => window.App.toolManager.cancelTool());
        if (applyBtn)  applyBtn.addEventListener('click',  () => window.App.toolManager.commitTool());

        if (undoBtn) {
            undoBtn.addEventListener('click', () => {
                if (window.App.toolManager.activeToolId !== 'btn-healing') return;
                const patches = window.App.state.healing.patches;
                if (patches.length > 0) {
                    patches.pop(); // remove current state
                    const oc = window.App.state.healing.overlayCanvas;
                    const ctx = oc.getContext('2d');
                    if (patches.length > 0) {
                        ctx.putImageData(patches[patches.length - 1], 0, 0);
                    } else {
                        ctx.clearRect(0, 0, oc.width, oc.height);
                    }
                    updateUndoState();
                    window.App.canvas.scheduleRender();
                }
            });
        }

        // --- Interaction ---
        const container = document.querySelector('.canvas-container');

        const getCoords = (e) => {
            const isTouch = e.type.includes('touch');
            const clientX = isTouch ? (e.touches[0]?.clientX || 0) : e.clientX;
            const clientY = isTouch ? (e.touches[0]?.clientY || 0) : e.clientY;
            
            const mrect = window.App.canvas.el.getBoundingClientRect();
            // Local to canvas resolution
            const rx = (clientX - mrect.left) * (window.App.canvas.el.width / mrect.width);
            const ry = (clientY - mrect.top) * (window.App.canvas.el.height / mrect.height);
            
            const crect = cursorCanvas.getBoundingClientRect();
            const cx = clientX - crect.left;
            const cy = clientY - crect.top;

            return {
                x: rx, y: ry,
                cx: cx, cy: cy,
                inCanvas: rx >= 0 && rx <= window.App.canvas.el.width && ry >= 0 && ry <= window.App.canvas.el.height
            };
        };

        const onPointerDown = (e) => {
            if (window.App.toolManager.activeToolId !== 'btn-healing') return;
            const coords = getCoords(e);
            if (!coords.inCanvas) return;
            e.preventDefault();
            
            isPainting = true;
            currentPath = [{ x: coords.x, y: coords.y }];
            
            // Push current pristine state to undo history before starting
            if (window.App.state.healing.patches.length === 0) {
                const oc = window.App.state.healing.overlayCanvas;
                const blank = new ImageData(oc.width, oc.height);
                window.App.state.healing.patches.push(blank);
            }
        };

        const onPointerMove = (e) => {
            if (window.App.toolManager.activeToolId !== 'btn-healing') return;
            const coords = getCoords(e);
            
            // Cursor
            if (coords.inCanvas) {
                syncCanvasSize();
                drawCursor(coords.cx, coords.cy);
            } else {
                clearCursor();
            }

            if (!isPainting) return;
            e.preventDefault();
            
            currentPath.push({ x: coords.x, y: coords.y });
            drawGhostPreview(currentPath);
        };

        const onPointerUp = async (e) => {
            if (!isPainting) return;
            isPainting = false;
            
            if (currentPath.length < 2) {
                // Just a click, usually not enough for reliable stroke, but we'll accept it
                if (currentPath.length === 0) return;
            }
            
            // Execute Healing
            await processHealingStroke(currentPath);
            currentPath = [];
            clearCursor();
        };

        container.addEventListener('mousedown',  onPointerDown);
        container.addEventListener('touchstart', onPointerDown, { passive: false });
        document.addEventListener('mousemove',   onPointerMove);
        document.addEventListener('touchmove',   onPointerMove, { passive: false });
        document.addEventListener('mouseup',     onPointerUp);
        document.addEventListener('touchend',    onPointerUp);
        document.addEventListener('mouseleave',  clearCursor);

        // Size adjustment with wheel (left/right canvas doesn't matter for healing)
        container.addEventListener('wheel', (e) => {
            if (window.App.toolManager.activeToolId !== 'btn-healing') return;
            e.preventDefault();
            const delta = e.deltaY < 0 ? 1 : -1;
            window.App.state.healing.size = Math.max(5, Math.min(200, window.App.state.healing.size + delta * 2));
            if (sizeDisp) sizeDisp.textContent = window.App.state.healing.size;
            showBadgeBriefly();
            
            const coords = getCoords(e);
            if (coords.inCanvas) {
                drawCursor(coords.cx, coords.cy);
            }
        }, { passive: false });

        // Bracket keys support
        document.addEventListener('keydown', (e) => {
            if (window.App.toolManager.activeToolId !== 'btn-healing') return;
            if (e.key === '[' || e.key === ']') {
                const delta = e.key === ']' ? 1 : -1;
                window.App.state.healing.size = Math.max(5, Math.min(200, window.App.state.healing.size + delta * 5));
                if (sizeDisp) sizeDisp.textContent = window.App.state.healing.size;
                showBadgeBriefly();
            }
        });
    }

    let badgeTimeout = null;
    function showBadgeBriefly() {
        if (badgePanel) {
            badgePanel.style.display = 'flex';
            setTimeout(() => badgePanel.style.opacity = '1', 10);
            if (badgeTimeout) clearTimeout(badgeTimeout);
            badgeTimeout = setTimeout(() => {
                badgePanel.style.opacity = '0';
                setTimeout(() => { if (badgePanel.style.opacity === '0') badgePanel.style.display = 'none'; }, 300);
            }, 1500);
        }
    }

    function syncCanvasSize() {
        if (!cursorCanvas) return;
        const container = document.querySelector('.canvas-container');
        if (!container) return;
        const r = container.getBoundingClientRect();
        if (cursorCanvas.width !== r.width || cursorCanvas.height !== r.height) {
            cursorCanvas.width  = r.width;
            cursorCanvas.height = r.height;
        }
    }

    function drawCursor(x, y) {
        if (!cursorCtx) return;
        cursorCtx.clearRect(0, 0, cursorCanvas.width, cursorCanvas.height);
        const r = window.App.state.healing.size;
        
        cursorCtx.beginPath();
        cursorCtx.arc(x, y, r, 0, Math.PI * 2);
        cursorCtx.strokeStyle = 'rgba(255,255,255,0.9)';
        cursorCtx.lineWidth = 1;
        cursorCtx.stroke();
        
        cursorCtx.beginPath();
        cursorCtx.arc(x, y, r, 0, Math.PI * 2);
        cursorCtx.strokeStyle = 'rgba(0,0,0,0.5)';
        cursorCtx.lineWidth = 1;
        // outer ring effect
        cursorCtx.stroke();
        
        cursorCtx.beginPath();
        cursorCtx.arc(x, y, 2, 0, Math.PI * 2);
        cursorCtx.fillStyle = 'rgba(255,255,255,0.9)';
        cursorCtx.fill();
    }

    function drawGhostPreview(path) {
        if (!cursorCtx || path.length < 2) return;
        syncCanvasSize();
        
        // Scale path points back to display coordinates
        const mrect = window.App.canvas.el.getBoundingClientRect();
        const crect = cursorCanvas.getBoundingClientRect();
        const scaleX = mrect.width / window.App.canvas.el.width;
        const scaleY = mrect.height / window.App.canvas.el.height;

        cursorCtx.clearRect(0, 0, cursorCanvas.width, cursorCanvas.height);
        cursorCtx.beginPath();
        cursorCtx.moveTo(path[0].x * scaleX, path[0].y * scaleY);
        for(let i=1; i<path.length; i++) {
            cursorCtx.lineTo(path[i].x * scaleX, path[i].y * scaleY);
        }
        cursorCtx.lineCap = 'round';
        cursorCtx.lineJoin = 'round';
        cursorCtx.lineWidth = window.App.state.healing.size * scaleX * 2;
        cursorCtx.strokeStyle = 'rgba(234, 67, 53, 0.4)'; // translucent red
        cursorCtx.stroke();
    }

    function clearCursor() {
        if (cursorCtx) cursorCtx.clearRect(0, 0, cursorCanvas.width, cursorCanvas.height);
    }

    async function processHealingStroke(path) {
        const cw = window.App.canvas.el.width;
        const ch = window.App.canvas.el.height;
        const hlSize = window.App.state.healing.size;

        if (typeof cv === 'undefined') {
            console.warn("OpenCV not ready");
            return;
        }

        // 1. Setup Offscreen context to draw mask locally
        const maskCanvas = document.createElement('canvas');
        maskCanvas.width = cw;
        maskCanvas.height = ch;
        const mctx = maskCanvas.getContext('2d', { willReadFrequently: true });
        
        mctx.fillStyle = 'black';
        mctx.fillRect(0, 0, cw, ch);
        
        mctx.beginPath();
        mctx.moveTo(path[0].x, path[0].y);
        for(let i=1; i<path.length; i++) mctx.lineTo(path[i].x, path[i].y);
        mctx.lineCap = 'round';
        mctx.lineJoin = 'round';
        mctx.lineWidth = hlSize * 2;
        mctx.strokeStyle = 'white';
        mctx.stroke();

        const maskData = mctx.getImageData(0, 0, cw, ch);
        
        // 2. Prepare Source Image
        // It must composite the base geometry rendering + any prior healing overlays
        const srcCanvas = document.createElement('canvas');
        srcCanvas.width = cw;
        srcCanvas.height = ch;
        const sctx = srcCanvas.getContext('2d', { willReadFrequently: true });
        
        if (window.App.canvas.baseImageData) {
            sctx.putImageData(window.App.canvas.baseImageData, 0, 0);
        }
        if (window.App.state.healing.overlayCanvas) {
            sctx.drawImage(window.App.state.healing.overlayCanvas, 0, 0);
        }
        
        const srcData = sctx.getImageData(0, 0, cw, ch);

        // Optional: show a processing overlay if it takes long
        cursorCtx.clearRect(0, 0, cursorCanvas.width, cursorCanvas.height);
        cursorCtx.fillStyle = 'rgba(0,0,0,0.2)';
        cursorCtx.fillRect(0,0,cursorCanvas.width, cursorCanvas.height);
        cursorCtx.fillStyle = 'white';
        cursorCtx.font = "14px sans-serif";
        cursorCtx.textAlign = "center";
        cursorCtx.fillText("Healing...", cursorCanvas.width/2, cursorCanvas.height/2);

        // Force browser paint before thread locking
        await new Promise(r => setTimeout(r, 20));

        let srcMat = null;
        let pMaskMat = null;
        let dstMat = null;
        
        try {
            const rawSrc = cv.matFromImageData(srcData);
            srcMat = new cv.Mat();
            cv.cvtColor(rawSrc, srcMat, cv.COLOR_RGBA2RGB);
            rawSrc.delete();
            
            pMaskMat = new cv.Mat(srcMat.rows, srcMat.cols, cv.CV_8UC1);
            let requiresInpaint = false;
            
            // Find bounds of mask to minimize OpenCV processing area using ROI
            let minX = cw, minY = ch, maxX = 0, maxY = 0;

            for (let i = 0; i < ch; i++) {
                for (let j = 0; j < cw; j++) {
                    let p = i * cw + j;
                    // maskData drawn as white on black (R=255)
                    if (maskData.data[p * 4] > 128) { 
                        pMaskMat.data[p] = 255;
                        requiresInpaint = true;
                        if (j < minX) minX = j;
                        if (i < minY) minY = i;
                        if (j > maxX) maxX = j;
                        if (i > maxY) maxY = i;
                    } else {
                        pMaskMat.data[p] = 0;
                    }
                }
            }

            if (!requiresInpaint) throw new Error("Empty mask");

            // Expand ROI slightly to give proper context for telea
            const pPad = Math.min(80, Math.max(30, hlSize * 2));
            minX = Math.max(0, minX - pPad);
            minY = Math.max(0, minY - pPad);
            maxX = Math.min(cw, maxX + pPad);
            maxY = Math.min(ch, maxY + pPad);

            const roiw = maxX - minX;
            const roih = maxY - minY;
            const roiRect = new cv.Rect(minX, minY, roiw, roih);

            const srcRoi = srcMat.roi(roiRect);
            const maskRoi = pMaskMat.roi(roiRect);
            dstMat = new cv.Mat();

            // Run inpainting only on localized ROI for max performance
            cv.inpaint(srcRoi, maskRoi, dstMat, 3, cv.INPAINT_TELEA);

            cv.cvtColor(dstMat, dstMat, cv.COLOR_RGB2RGBA);
            
            // 3. Composite output into the Overlay Canvas
            const oc = window.App.state.healing.overlayCanvas;
            const octx = oc.getContext('2d', { willReadFrequently: true });
            const overlayImgData = octx.getImageData(0, 0, cw, ch);

            const dstDataRaw = dstMat.data;
            let patchPxIdx = 0;
            
            // Iterate over the ROI and splice ONLY masked pixels to overlay wrapper
            for (let i = 0; i < roih; i++) {
                for (let j = 0; j < roiw; j++) {
                    const localPx = i * roiw + j;
                    const globalPx = (minY + i) * cw + (minX + j);
                    
                    if (pMaskMat.data[globalPx] > 0) { // If part of healed region
                        overlayImgData.data[globalPx * 4] = dstDataRaw[localPx * 4];
                        overlayImgData.data[globalPx * 4 + 1] = dstDataRaw[localPx * 4 + 1];
                        overlayImgData.data[globalPx * 4 + 2] = dstDataRaw[localPx * 4 + 2];
                        overlayImgData.data[globalPx * 4 + 3] = 255; // Completely opaque patch
                    }
                }
            }

            octx.putImageData(overlayImgData, 0, 0);

            // 4. Save state for Undo
            window.App.state.healing.patches.push(overlayImgData);
            updateUndoState();

            srcRoi.delete(); maskRoi.delete();

        } catch (e) {
            console.error("Healing failed: ", e);
        } finally {
            if (srcMat) srcMat.delete();
            if (pMaskMat) pMaskMat.delete();
            if (dstMat) dstMat.delete();
            clearCursor();
            window.App.canvas.scheduleRender();
        }
    }

    function updateUndoState() {
        if (!undoBtn) return;
        const patches = window.App.state.healing.patches;
        // The first patch is the empty/base array pushed on absolute down
        // If there's 1 patch, it means no edits have completed yet.
        const canUndo = patches.length > 1;
        undoBtn.style.opacity = canUndo ? '1' : '0.5';
        undoBtn.style.pointerEvents = canUndo ? 'auto' : 'none';
    }

    // Connect to canvas render pipeline
    window.App.filtersLogic.applyHealing = function (data, width, height) {
        const healing = window.App.state.healing;
        if (!healing || !healing.overlayCanvas) return;
        
        // Ensure sizes match before compositing
        if (healing.overlayCanvas.width !== width || healing.overlayCanvas.height !== height) return;

        const octx = healing.overlayCanvas.getContext('2d', { willReadFrequently: true });
        const odata = octx.getImageData(0, 0, width, height).data;
        
        // Apply overlay pixels over source data non-destructively
        for (let i = 0; i < data.length; i += 4) {
            if (odata[i + 3] > 0) {
                data[i]     = odata[i];
                data[i + 1] = odata[i + 1];
                data[i + 2] = odata[i + 2];
            }
        }
    };
    
    // Internal API to resync state when tool action is canceled natively via ToolManager
    window.App.filtersLogic.rebuildHealingOverlay = function() {
        const healing = window.App.state.healing;
        if (!healing.overlayCanvas || healing.patches.length === 0) return;
        const octx = healing.overlayCanvas.getContext('2d');
        const latest = healing.patches[healing.patches.length - 1];
        if (latest) octx.putImageData(latest, 0, 0);
    }

    document.addEventListener('DOMContentLoaded', () => {
        initHealingUI();
    });
})();
