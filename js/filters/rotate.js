(function() {
    window.App = window.App || {};
    window.App.filtersLogic = window.App.filtersLogic || {};

    let straightenState = 0; // The active rotation angle

    window.App.filtersLogic.initRotateUI = function() {
        const rotateBtn = document.getElementById('btn-rotate');
        const bottomBar = document.getElementById('rotate-bottom-bar');
        const closeBtn = document.getElementById('rotate-close');
        const applyBtn = document.getElementById('rotate-apply');
        
        const flipBtn = document.getElementById('rotate-flip');
        const rotate90Btn = document.getElementById('rotate-90-btn');

        const overlay = document.getElementById('rotate-ui-overlay');
        const grid = document.getElementById('rotate-grid');
        const badge = document.getElementById('rotate-angle-badge');
        const container = document.querySelector('.canvas-container');

        if (!rotateBtn || !overlay) return;

        rotateBtn.addEventListener('click', () => {
            if (window.App.toolManager.activeToolId === 'btn-rotate') return;
            
            window.App.toolManager.openTool('btn-rotate', {
                show: () => {
                    bottomBar.style.display = 'flex';
                    overlay.style.display = 'block';
                    
                    // Recover straighten state from geometry snapshot
                    straightenState = window.App.state.geometry.straighten || 0;
                    badge.innerText = `Straighten Angle ${straightenState.toFixed(2)}°`;
                },
                hide: () => {
                    bottomBar.style.display = 'none';
                    overlay.style.display = 'none';
                }
            });
        });

        // Tool Commit & Cancel
        if (closeBtn) closeBtn.addEventListener('click', () => window.App.toolManager.cancelTool());
        if (applyBtn) applyBtn.addEventListener('click', () => window.App.toolManager.commitTool());

        // Basic Flip and 90-Rotations
        if (flipBtn) flipBtn.addEventListener('click', () => {
            window.App.state.geometry.flipX = !window.App.state.geometry.flipX;
            window.App.state.geometry.straightenCache = null;
            window.App.canvas.scheduleRender();
        });
        
        if (rotate90Btn) rotate90Btn.addEventListener('click', () => {
            window.App.state.geometry.rotate = (window.App.state.geometry.rotate + 90) % 360;
            window.App.state.geometry.straightenCache = null;
            window.App.canvas.fitToContainer();
            window.App.canvas.scheduleRender();
        });

        // Swipe Gesture for Straighten Angle
        let isDragging = false;
        let startX = 0;
        let initialAngle = 0;

        const onDown = (e) => {
            if (window.App.toolManager.activeToolId !== 'btn-rotate') return;
            if (e.target.closest('#rotate-bottom-bar')) return;

            e.preventDefault();
            isDragging = true;
            startX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
            initialAngle = straightenState;
            grid.style.display = 'block'; // Reveal fine grid
            
            // Invalidate OpenCV cache immediately while actively swinging
            window.App.state.geometry.straightenCache = null;
        };

        const onMove = (e) => {
            if (!isDragging) return;
            e.preventDefault();

            const currentX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
            const deltaX = currentX - startX;

            // Sensitivity configuration (pixel distance into degree tilt)
            // Approx 100 pixels = 10 degrees
            let newAngle = initialAngle + (deltaX * 0.1);
            
            // Clamp to -45 / +45
            if (newAngle > 45) newAngle = 45;
            if (newAngle < -45) newAngle = -45;

            straightenState = newAngle;
            window.App.state.geometry.straighten = straightenState;
            
            badge.innerText = `Straighten Angle ${straightenState.toFixed(2)}°`;
            window.App.canvas.scheduleRender();
        };

        const onUp = () => {
            if (!isDragging) return;
            isDragging = false;
            grid.style.display = 'none';
            
            // Kick off asynchronous corner synthesis when finger leaves screen!
            if (window.App.canvas.generateCornerFills) {
                window.App.canvas.generateCornerFills(straightenState);
            }
        };

        container.addEventListener('mousedown', onDown);
        container.addEventListener('touchstart', onDown, {passive: false});

        document.addEventListener('mousemove', onMove);
        document.addEventListener('touchmove', onMove, {passive: false});

        document.addEventListener('mouseup', onUp);
        document.addEventListener('touchend', onUp);
    };

    // ---------- Auto straighten (polished Phase A) ----------
    // Tries OpenCV Hough; falls back to JS Sobel voting. Returns angle deg (-45..45)
    window.App.filtersLogic.autoStraighten = async function(){
        const canvas = window.App.canvas && window.App.canvas.el;
        if(!canvas || !window.App.state.originalImage) return null;
        const clampA = (a)=> Math.max(-45, Math.min(45, a));
        // Try OpenCV
        try{
            if(window.cv && window.cv.Mat && window.cv.imread){
                const w = Math.min(canvas.width, 640);
                const h = Math.round(canvas.height * (w / canvas.width));
                const off=document.createElement('canvas'); off.width=w; off.height=h;
                off.getContext('2d').drawImage(canvas,0,0,w,h);
                let src = window.cv.imread(off);
                let gray = new window.cv.Mat();
                let edges = new window.cv.Mat();
                let lines = new window.cv.Mat();
                window.cv.cvtColor(src, gray, window.cv.COLOR_RGBA2GRAY, 0);
                window.cv.Canny(gray, edges, 50, 150, 3, false);
                window.cv.HoughLinesP(edges, lines, 1, Math.PI/180, 80, 80, 10);
                let angles=[];
                for(let i=0;i<lines.rows;i++){
                    const x1=lines.data32S[i*4], y1=lines.data32S[i*4+1], x2=lines.data32S[i*4+2], y2=lines.data32S[i*4+3];
                    const len=Math.hypot(x2-x1, y2-y1);
                    if(len<40) continue;
                    let ang = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
                    // normalize to -90..90
                    while(ang > 90) ang-=180;
                    while(ang < -90) ang+=180;
                    // keep near-horizontal
                    if(Math.abs(ang) < 30) angles.push({ang, len});
                }
                src.delete(); gray.delete(); edges.delete(); lines.delete();
                if(angles.length){
                    let sum=0, wsum=0;
                    angles.forEach(a=>{ sum+=a.ang*a.len; wsum+=a.len; });
                    const avg = sum/wsum;
                    return clampA(-avg*0.92); // invert, slight under-correct feels natural
                }
            }
        }catch(e){ /* fall through to JS */ }
        // JS fallback: Sobel voting at ~320px, histogram -12..12
        try{
            const w = Math.min(canvas.width, 320);
            const h = Math.round(canvas.height * (w / canvas.width));
            const off=document.createElement('canvas'); off.width=w; off.height=h;
            const ctx=off.getContext('2d'); ctx.drawImage(canvas,0,0,w,h);
            const d=ctx.getImageData(0,0,w,h).data;
            const lum=new Uint8Array(w*h);
            for(let i=0;i<w*h;i++){ lum[i]=(0.2126*d[i*4]+0.7152*d[i*4+1]+0.0722*d[i*4+2])|0; }
            const hist=new Float32Array(61); // -15..15 step 0.5 → 61
            const idxFor=(a)=> Math.round((a+15)*2);
            for(let y=1;y<h-1;y++){
                for(let x=1;x<w-1;x++){
                    const tl=lum[(y-1)*w+(x-1)], tc=lum[(y-1)*w+x], tr=lum[(y-1)*w+(x+1)];
                    const ml=lum[y*w+(x-1)], mr=lum[y*w+(x+1)];
                    const bl=lum[(y+1)*w+(x-1)], bc=lum[(y+1)*w+x], br=lum[(y+1)*w+(x+1)];
                    const gx = -tl -2*ml -bl + tr +2*mr + br;
                    const gy = -tl -2*tc -tr + bl +2*bc + br;
                    const mag=Math.sqrt(gx*gx+gy*gy);
                    if(mag < 28) continue;
                    let ang=Math.atan2(gy,gx)*180/Math.PI;
                    // horizontal lines have gradient near vertical (90°) — we map
                    // For horizon, gradient is vertical → ang ~ 90 or -90
                    // Convert to line angle: line = ang - 90
                    let lineAng = ang - 90;
                    while(lineAng>90) lineAng-=180;
                    while(lineAng<-90) lineAng+=180;
                    if(Math.abs(lineAng) > 18) continue;
                    const idx=idxFor(lineAng);
                    if(idx>=0 && idx<hist.length) hist[idx]+=mag;
                }
            }
            // find peak -15..15
            let bestIdx=-1,bestVal=-1;
            for(let i=0;i<hist.length;i++) if(hist[i]>bestVal){ bestVal=hist[i]; bestIdx=i; }
            if(bestIdx>=0 && bestVal > w*h*0.004){
                const peakAng = (bestIdx/2)-15; // -15..15
                // refine via parabola over neighbors
                const l=hist[Math.max(0,bestIdx-1)], c=hist[bestIdx], r=hist[Math.min(hist.length-1,bestIdx+1)];
                const denom=(l -2*c + r);
                let offset=0;
                if(denom!==0) offset = 0.5*(l - r)/denom;
                const refined = peakAng + offset*0.5;
                return clampA(-refined*0.88);
            }
            return 0;
        }catch(e){ return 0; }
    };

    document.addEventListener('DOMContentLoaded', () => {
        window.App.filtersLogic.initRotateUI();
    });
})();
