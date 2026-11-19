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
            if (window.App.toolManager.activeToolId === 'btn-healing') { window.App.toolManager.cancelTool(); return; }
            window.App.toolManager.openTool('btn-healing', uiCallbackObj);
        });

        if (cancelBtn) cancelBtn.addEventListener('click', () => window.App.toolManager.cancelTool());
        if (applyBtn)  applyBtn.addEventListener('click',  () => window.App.toolManager.commitTool());

        if (undoBtn) {
            undoBtn.addEventListener('click', () => {
                if (window.App.toolManager.activeToolId !== 'btn-healing') return;
                const patches = window.App.state.healing.patches;
                if (patches.length > 0) {
                    patches.pop();
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
        // --- Phase B: hardness + mode (heal/clone) ---
        const hardnessEl = document.getElementById('healing-hardness');
        const hardnessVal = document.getElementById('healing-hardness-val');
        const modeBtns = document.querySelectorAll('.healing-mode-btn');
        const syncHealingUI = ()=>{
            const h=window.App.state.healing;
            if(hardnessEl){ hardnessEl.value=h.hardness; if(hardnessVal) hardnessVal.textContent=h.hardness; }
            modeBtns.forEach(b=> b.classList.toggle('active', b.getAttribute('data-mode')===h.mode));
            if(sizeDisp) sizeDisp.textContent=h.size;
        };
        if(hardnessEl){
            hardnessEl.addEventListener('input', (e)=>{
                window.App.state.healing.hardness=parseInt(e.target.value,10);
                if(hardnessVal) hardnessVal.textContent=e.target.value;
                showBadgeBriefly();
            });
        }
        modeBtns.forEach(btn=>{
            btn.addEventListener('click', ()=>{
                const m=btn.getAttribute('data-mode');
                window.App.state.healing.mode=m;
                modeBtns.forEach(b=>b.classList.remove('active'));
                btn.classList.add('active');
                if(m==='clone' && !window.App.state.healing.source){
                    if(window.App.ui) window.App.ui.showToast('Clone: Alt+click to set source','success');
                } else if(window.App.ui) window.App.ui.showToast(m==='clone'?'Clone mode':'Heal mode','success');
            });
        });

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
            // Alt+click sets clone source
            if(window.App.state.healing.mode==='clone' && e.altKey){
                window.App.state.healing.source={x: coords.x, y: coords.y};
                if(window.App.ui) window.App.ui.showToast('Clone source set','success');
                drawCursor(coords.cx, coords.cy);
                e.preventDefault();
                return;
            }
            if(window.App.state.healing.mode==='clone' && !window.App.state.healing.source){
                if(window.App.ui) window.App.ui.showToast('Alt+click to set clone source first','error');
                return;
            }
            e.preventDefault();
            isPainting = true;
            currentPath = [{ x: coords.x, y: coords.y }];
            if (window.App.state.healing.patches.length === 0) {
                const oc = window.App.state.healing.overlayCanvas;
                const blank = new ImageData(oc.width, oc.height);
                window.App.state.healing.patches.push(blank);
            }
        };

        const onPointerMove = (e) => {
            if (window.App.toolManager.activeToolId !== 'btn-healing') return;
            const coords = getCoords(e);
            if (coords.inCanvas) {
                syncCanvasSize();
                drawCursor(coords.cx, coords.cy);
                updateLoupe(coords.cx, coords.cy);
            } else {
                clearCursor(); hideLoupe();
            }
            if (!isPainting) return;
            e.preventDefault();
            currentPath.push({ x: coords.x, y: coords.y });
            drawGhostPreview(currentPath);
        };

        const onPointerUp = async (e) => {
            if (!isPainting) return;
            isPainting = false;
            hideLoupe();
            if (currentPath.length < 2) {
                if (currentPath.length === 0) return;
            }
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

        // Size / hardness with wheel
        container.addEventListener('wheel', (e) => {
            if (window.App.toolManager.activeToolId !== 'btn-healing') return;
            e.preventDefault();
            const delta = e.deltaY < 0 ? 1 : -1;
            if(e.altKey){
                window.App.state.healing.hardness = Math.max(0, Math.min(100, (window.App.state.healing.hardness||72)+delta*4));
                const he=document.getElementById('healing-hardness'); const hv=document.getElementById('healing-hardness-val');
                if(he) he.value=window.App.state.healing.hardness; if(hv) hv.textContent=window.App.state.healing.hardness;
                showBadgeBriefly();
            } else {
                window.App.state.healing.size = Math.max(5, Math.min(200, window.App.state.healing.size + delta * 2));
                if (sizeDisp) sizeDisp.textContent = window.App.state.healing.size;
                showBadgeBriefly();
            }
            const coords = getCoords(e);
            if (coords.inCanvas) drawCursor(coords.cx, coords.cy);
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
        const hardness = typeof window.App.state.healing.hardness==='number'? window.App.state.healing.hardness : 72;
        const mode = window.App.state.healing.mode || 'heal';
        // outer
        cursorCtx.beginPath();
        cursorCtx.arc(x, y, r, 0, Math.PI * 2);
        cursorCtx.strokeStyle = mode==='clone' ? 'rgba(66,133,244,0.92)' : 'rgba(255,255,255,0.9)';
        cursorCtx.lineWidth = 1.5;
        cursorCtx.stroke();
        // hardness inner
        const inner = r * (0.28 + (hardness/100)*0.52);
        cursorCtx.beginPath();
        cursorCtx.arc(x, y, inner, 0, Math.PI * 2);
        cursorCtx.strokeStyle = mode==='clone' ? 'rgba(66,133,244,0.38)' : 'rgba(255,255,255,0.32)';
        cursorCtx.setLineDash([3,3]);
        cursorCtx.lineWidth=1;
        cursorCtx.stroke();
        cursorCtx.setLineDash([]);
        // clone source indicator
        if(mode==='clone' && window.App.state.healing.source){
            const s=window.App.state.healing.source;
            // map source canvas coords to cursor coords
            const mrect=window.App.canvas.el.getBoundingClientRect();
            const crect=cursorCanvas.getBoundingClientRect();
            const scaleX=mrect.width/window.App.canvas.el.width;
            const scaleY=mrect.height/window.App.canvas.el.height;
            const sx = s.x*scaleX - (window.App.canvas.el.getBoundingClientRect().left - crect.left);
            const sy = s.y*scaleY - (window.App.canvas.el.getBoundingClientRect().top - crect.top);
            // draw line to source
            cursorCtx.beginPath();
            cursorCtx.moveTo(x,y); cursorCtx.lineTo(sx, sy);
            cursorCtx.strokeStyle='rgba(66,133,244,0.55)';
            cursorCtx.setLineDash([4,4]);
            cursorCtx.stroke();
            cursorCtx.setLineDash([]);
            cursorCtx.beginPath(); cursorCtx.arc(sx,sy, 6,0,Math.PI*2);
            cursorCtx.strokeStyle='rgba(66,133,244,0.9)'; cursorCtx.stroke();
        }
        cursorCtx.beginPath();
        cursorCtx.arc(x, y, 2, 0, Math.PI * 2);
        cursorCtx.fillStyle = mode==='clone' ? 'rgba(66,133,244,0.95)' : 'rgba(255,255,255,0.9)';
        cursorCtx.fill();
    }
    function updateLoupe(x, y){
        const loupe=document.getElementById('healing-loupe');
        if(!loupe || !window.App.canvas || !window.App.canvas.el) return;
        const cvs=window.App.canvas.el;
        const rect=cvs.getBoundingClientRect();
        const scaleX=cvs.width/rect.width, scaleY=cvs.height/rect.height;
        const cx = (x - (cursorCanvas.getBoundingClientRect().left - rect.left) - rect.left) *0 +0; // dummy
        // Use pointer client
        // Loupe shows 2x magnified 48px radius around cursor
        const mx = ( (x + cursorCanvas.getBoundingClientRect().left) - rect.left) * scaleX;
        const my = ( (y + cursorCanvas.getBoundingClientRect().top) - rect.top) * scaleY;
        if(mx<0||my<0||mx>=cvs.width||my>=cvs.height){ loupe.style.display='none'; return; }
        loupe.style.display='block';
        loupe.style.left = (x+18)+'px';
        loupe.style.top = (y-52)+'px';
        // draw magnified
        if(!loupe._c){
            loupe._c=document.createElement('canvas'); loupe._c.width=96; loupe._c.height=96; loupe.appendChild(loupe._c);
        }
        const lctx=loupe._c.getContext('2d');
        lctx.imageSmoothingEnabled=false;
        lctx.clearRect(0,0,96,96);
        lctx.drawImage(cvs, Math.max(0, mx-12), Math.max(0, my-12), 24,24, 0,0,96,96);
        // crosshair
        lctx.strokeStyle='rgba(255,255,255,0.85)'; lctx.lineWidth=1;
        lctx.beginPath(); lctx.moveTo(48, 0); lctx.lineTo(48, 96); lctx.moveTo(0,48); lctx.lineTo(96,48); lctx.stroke();
    }
    function hideLoupe(){ const l=document.getElementById('healing-loupe'); if(l) l.style.display='none'; }

    function drawGhostPreview(path) {
        if (!cursorCtx || path.length < 2) return;
        syncCanvasSize();
        const mrect = window.App.canvas.el.getBoundingClientRect();
        const crect = cursorCanvas.getBoundingClientRect();
        const scaleX = mrect.width / window.App.canvas.el.width;
        const scaleY = mrect.height / window.App.canvas.el.height;
        const offX = mrect.left - crect.left;
        const offY = mrect.top - crect.top;
        cursorCtx.clearRect(0, 0, cursorCanvas.width, cursorCanvas.height);
        cursorCtx.beginPath();
        cursorCtx.moveTo(path[0].x * scaleX + offX, path[0].y * scaleY + offY);
        for(let i=1; i<path.length; i++) {
            cursorCtx.lineTo(path[i].x * scaleX + offX, path[i].y * scaleY + offY);
        }
        cursorCtx.lineCap = 'round';
        cursorCtx.lineJoin = 'round';
        cursorCtx.lineWidth = window.App.state.healing.size * scaleX * 2;
        cursorCtx.strokeStyle = 'rgba(234, 67, 53, 0.52)';
        cursorCtx.stroke();
    }

    function clearCursor() {
        if (cursorCtx) cursorCtx.clearRect(0, 0, cursorCanvas.width, cursorCanvas.height);
    }

    async function processHealingStroke(path) {
        const cw = window.App.canvas.el.width;
        const ch = window.App.canvas.el.height;
        const hlSize = window.App.state.healing.size;
        const hardness = typeof window.App.state.healing.hardness==='number'? window.App.state.healing.hardness : 72;
        const mode = window.App.state.healing.mode || 'heal';

        if (typeof cv === 'undefined' && mode!=='clone') {
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
        const feather = (100 - hardness)/100;
        if(feather>0.05){ mctx.shadowBlur = Math.max(0, hlSize*0.35*feather); mctx.shadowColor='white'; }
        mctx.beginPath();
        mctx.moveTo(path[0].x, path[0].y);
        for(let i=1; i<path.length; i++) mctx.lineTo(path[i].x, path[i].y);
        mctx.lineCap = 'round';
        mctx.lineJoin = 'round';
        mctx.lineWidth = hlSize * 2;
        mctx.strokeStyle = 'white';
        mctx.stroke();
        if(feather>0.05) mctx.shadowBlur=0;

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

            // --- Phase B: clone stamp path (no OpenCV) ---
            if(mode==='clone' && window.App.state.healing.source){
                // Clone directly without cv ROI
                const src = window.App.state.healing.source;
                const dx = path[0].x - src.x;
                const dy = path[0].y - src.y;
                // Need source ImageData from base + overlay before clone
                const sctx = document.createElement('canvas').getContext('2d');
                // reuse srcMat data? Instead read from composited srcData we already built below? But srcData not yet built — build here:
                // For clone we compose from baseImageData + overlayCanvas as source
                const tmpCanvas=document.createElement('canvas'); tmpCanvas.width=cw; tmpCanvas.height=ch;
                const tctx=tmpCanvas.getContext('2d', { willReadFrequently:true });
                if(window.App.canvas.baseImageData) tctx.putImageData(window.App.canvas.baseImageData,0,0);
                if(window.App.state.healing.overlayCanvas) tctx.drawImage(window.App.state.healing.overlayCanvas,0,0);
                const img = tctx.getImageData(0,0,cw,ch);
                const oc = window.App.state.healing.overlayCanvas;
                const octx = oc.getContext('2d', { willReadFrequently: true });
                const overlayImgData = octx.getImageData(0, 0, cw, ch);
                for(let y=Math.max(0,minY-2); y<Math.min(ch, maxY+2); y++){
                    for(let x=Math.max(0,minX-2); x<Math.min(cw, maxX+2); x++){
                        const p=y*cw+x;
                        const a = pMaskMat.data[p]/255;
                        if(a<0.04) continue;
                        const sx = Math.round(x - dx);
                        const sy = Math.round(y - dy);
                        if(sx<0||sy<0||sx>=cw||sy>=ch) continue;
                        const sp=(sy*cw+sx)*4;
                        const dp=p*4;
                        const mix = a * (hardness>88 ? 1 : (0.82 + 0.18*a));
                        overlayImgData.data[dp]= img.data[dp]*(1-mix) + img.data[sp]*mix;
                        overlayImgData.data[dp+1]= img.data[dp+1]*(1-mix) + img.data[sp+1]*mix;
                        overlayImgData.data[dp+2]= img.data[dp+2]*(1-mix) + img.data[sp+2]*mix;
                        overlayImgData.data[dp+3]= 255;
                    }
                }
                octx.putImageData(overlayImgData,0,0);
                window.App.state.healing.patches.push(overlayImgData);
                updateUndoState();
                // cleanup mats that may be allocated
                if(srcMat) { try{srcMat.delete();}catch(e){} srcMat=null; }
                if(pMaskMat) { try{pMaskMat.delete();}catch(e){} pMaskMat=null; }
                // skip inpaint path: jump to finally by throwing sentinel
                throw { __cloneDone:true };
            }

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

            // hardness influences inpaint radius: softer => smaller radius for feathered blend
            const inpRadius = Math.max(1, 3 * (0.6 + (100-hardness)/180));
            cv.inpaint(srcRoi, maskRoi, dstMat, inpRadius, cv.INPAINT_TELEA);

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
            if(e && e.__cloneDone){ /* clone path already handled, not an error */ }
            else console.error("Healing failed: ", e);
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
    
    window.App.filtersLogic.rebuildHealingOverlay = function() {
        const healing = window.App.state.healing;
        if (!healing.overlayCanvas) return;
        const octx = healing.overlayCanvas.getContext('2d');
        if (!healing.patches || healing.patches.length === 0) {
            octx.clearRect(0,0, healing.overlayCanvas.width, healing.overlayCanvas.height);
            return;
        }
        const latest = healing.patches[healing.patches.length - 1];
        if (latest) octx.putImageData(latest, 0, 0);
        else octx.clearRect(0,0, healing.overlayCanvas.width, healing.overlayCanvas.height);
        if(window.App.canvas) window.App.canvas.scheduleRender();
    }

    document.addEventListener('DOMContentLoaded', () => {
        initHealingUI();
    });
})();
