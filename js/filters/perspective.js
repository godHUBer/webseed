// js/filters/perspective.js — Phase C: 4-point perspective + OpenCV warp
window.App = window.App || {};
window.App.filtersLogic = window.App.filtersLogic || {};
(function(){
    let overlay, canvas, ctx, hint;
    let isDragging = -1; // corner index 0..3
    let dragStart = null;

    const getNormCorners = () => window.App.state.perspective.corners;
    const setCorners = (corners) => { window.App.state.perspective.corners = corners; window.App.state.perspective.enabled = true; };

    const syncOverlay = () => {
        const editor = window.App.canvas && window.App.canvas.el;
        if(!overlay || !canvas || !editor) return false;
        const rect = editor.getBoundingClientRect();
        const oRect = overlay.getBoundingClientRect();
        if(rect.width<1) return false;
        canvas.width = Math.max(1, Math.round(rect.width));
        canvas.height = Math.max(1, Math.round(rect.height));
        canvas.style.position='absolute';
        canvas.style.left = (rect.left - oRect.left)+'px';
        canvas.style.top = (rect.top - oRect.top)+'px';
        canvas.style.width = rect.width+'px';
        canvas.style.height = rect.height+'px';
        return true;
    };

    const draw = () => {
        if(!canvas || !overlay || overlay.style.display==='none') return;
        if(!syncOverlay()) return;
        ctx.clearRect(0,0,canvas.width,canvas.height);
        const corners = getNormCorners();
        const pts = corners.map(c=>({x:c.x*canvas.width, y:c.y*canvas.height}));
        // grid 10x10
        if(window.App.state.perspective.gridVisible){
            ctx.strokeStyle='rgba(255,255,255,0.12)'; ctx.lineWidth=1;
            ctx.beginPath();
            for(let i=1;i<10;i++){
                const t=i/10;
                // lerp top & bottom edges, left & right edges to draw grid
                const top={x: pts[0].x*(1-t)+pts[1].x*t, y: pts[0].y*(1-t)+pts[1].y*t};
                const bottom={x: pts[3].x*(1-t)+pts[2].x*t, y: pts[3].y*(1-t)+pts[2].y*t};
                const left={x: pts[0].x*(1-t)+pts[3].x*t, y: pts[0].y*(1-t)+pts[3].y*t};
                const right={x: pts[1].x*(1-t)+pts[2].x*t, y: pts[1].y*(1-t)+pts[2].y*t};
                ctx.moveTo(top.x, top.y); ctx.lineTo(bottom.x, bottom.y);
                ctx.moveTo(left.x, left.y); ctx.lineTo(right.x, right.y);
            }
            ctx.stroke();
        }
        // quad
        ctx.strokeStyle='rgba(255,255,255,0.94)'; ctx.lineWidth=2;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for(let i=1;i<4;i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.closePath(); ctx.stroke();
        ctx.setLineDash([6,6]); ctx.strokeStyle='rgba(255,255,255,0.55)';
        ctx.stroke(); ctx.setLineDash([]);
        // handles
        pts.forEach((p, i)=>{
            const active = i===isDragging;
            ctx.beginPath(); ctx.arc(p.x,p.y, active?9:7,0,Math.PI*2);
            ctx.fillStyle = active? '#4285F4' : '#fff';
            ctx.fill(); ctx.lineWidth=2; ctx.strokeStyle= active? '#fff':'#4285F4'; ctx.stroke();
            // label
            ctx.fillStyle='rgba(0,0,0,0.55)'; ctx.font='10px Inter'; ctx.textAlign='center';
            // no label needed
        });
        if(hint){
            const hasCv = !!(window.cv && window.cv.Mat);
            hint.textContent = hasCv ? 'Drag corners to fix perspective • Pinch to scale' : 'Drag corners (OpenCV warp needs loading) • Auto unavailable';
        }
    };

    const getPointer = (e)=>{
        if(!syncOverlay()) return null;
        const rect = canvas.getBoundingClientRect();
        return {
            x: (e.clientX||(e.touches&&e.touches[0].clientX)||0)-rect.left,
            y: (e.clientY||(e.touches&&e.touches[0].clientY)||0)-rect.top
        };
    };

    const hitTest = (p)=>{
        const corners = getNormCorners();
        const pts = corners.map(c=>({x:c.x*canvas.width, y:c.y*canvas.height}));
        for(let i=0;i<pts.length;i++){
            if(Math.hypot(p.x-pts[i].x, p.y-pts[i].y)<14) return i;
        }
        return -1;
    };

    window.App.filtersLogic.initPerspectiveUI = function(){
        overlay = document.getElementById('perspective-ui-overlay');
        canvas = document.getElementById('perspective-interactive-canvas');
        hint = document.getElementById('perspective-hint');
        if(!overlay || !canvas) return;
        ctx = canvas.getContext('2d');
        const btn = document.getElementById('btn-perspective');
        const bottomBar = document.getElementById('perspective-bottom-bar');
        const closeBtn = document.getElementById('perspective-close');
        const applyBtn = document.getElementById('perspective-apply');
        const autoBtn = document.getElementById('perspective-auto');
        const gridBtn = document.getElementById('perspective-grid-toggle');

        const show = ()=>{
            overlay.style.display='block';
            if(bottomBar) bottomBar.style.display='flex';
            setTimeout(draw, 30);
        };
        const hide = ()=>{
            overlay.style.display='none';
            if(bottomBar) bottomBar.style.display='none';
        };
        window.App.filtersLogic.hidePerspectiveUI = hide;

        if(btn){
            btn.addEventListener('click', ()=>{
                if(window.App.toolManager.activeToolId==='btn-perspective') return;
                window.App.toolManager.openTool('btn-perspective', {show, hide});
            });
        }
        if(closeBtn) closeBtn.addEventListener('click', ()=> window.App.toolManager.cancelTool());
        if(applyBtn) applyBtn.addEventListener('click', ()=> window.App.toolManager.commitTool());
        if(gridBtn){
            gridBtn.addEventListener('click', ()=>{
                window.App.state.perspective.gridVisible = !window.App.state.perspective.gridVisible;
                gridBtn.style.color = window.App.state.perspective.gridVisible? 'var(--accent)':'';
                draw();
            });
        }
        if(autoBtn){
            autoBtn.addEventListener('click', async ()=>{
                // try OpenCV auto: detect largest quad via Canny + approxPoly
                try{
                    if(window.cv && window.cv.Mat){
                        const editor = window.App.canvas && window.App.canvas.el;
                        if(!editor){ if(window.App.ui) window.App.ui.showToast('Load an image first','error'); return; }
                        autoBtn.textContent='…';
                        // sample at 320px
                        const w=Math.min(editor.width, 400);
                        const h=Math.round(editor.height * (w/editor.width));
                        const off=document.createElement('canvas'); off.width=w; off.height=h;
                        off.getContext('2d').drawImage(editor,0,0,w,h);
                        let src=window.cv.imread(off);
                        let gray=new window.cv.Mat(); let edges=new window.cv.Mat();
                        window.cv.cvtColor(src,gray,window.cv.COLOR_RGBA2GRAY);
                        window.cv.Canny(gray,edges,60,140);
                        let contours=new window.cv.MatVector(); let hier=new window.cv.Mat();
                        window.cv.findContours(edges,contours,hier,window.cv.RETR_EXTERNAL, window.cv.CHAIN_APPROX_SIMPLE);
                        let best=null, bestArea=0;
                        for(let i=0;i<contours.size();i++){
                            const cnt=contours.get(i);
                            const peri=window.cv.arcLength(cnt,true);
                            const approx=new window.cv.Mat();
                            window.cv.approxPolyDP(cnt,approx,0.02*peri,true);
                            if(approx.rows===4){
                                const area=window.cv.contourArea(cnt);
                                if(area>bestArea){ bestArea=area; best=approx; } else approx.delete();
                            } else approx.delete();
                        }
                        if(best && bestArea > w*h*0.08){
                            const pts=[];
                            for(let i=0;i<4;i++){ pts.push({x:best.data32S[i*2]/w, y:best.data32S[i*2+1]/h}); }
                            // sort pts to tl,tr,br,bl via sum/diff
                            pts.sort((a,b)=> (a.y-b.y) || (a.x-b.x));
                            const top = pts.slice(0,2).sort((a,b)=>a.x-b.x);
                            const bot = pts.slice(2,4).sort((a,b)=>a.x-b.x);
                            const ordered=[top[0], top[1], bot[1], bot[0]];
                            setCorners(ordered);
                            if(window.App.canvas) window.App.canvas.scheduleRender();
                            draw();
                            if(window.App.ui) window.App.ui.showToast('Auto perspective found','success');
                        } else {
                            if(window.App.ui) window.App.ui.showToast('No quad found — drag manually','error');
                        }
                        src.delete(); gray.delete(); edges.delete(); contours.delete(); hier.delete(); if(best) best.delete();
                        autoBtn.innerHTML='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v4M12 21v-4M4 12h4M20 12h-4"/><circle cx="12" cy="12" r="3"/></svg><span style="font-size:10px; font-weight:700; margin-left:4px;">Auto</span>';
                    } else {
                        if(window.App.ui) window.App.ui.showToast('OpenCV not ready — drag manually','error');
                    }
                }catch(e){
                    if(window.App.ui) window.App.ui.showToast('Auto failed — drag manually','error');
                    autoBtn.innerHTML='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v4M12 21v-4M4 12h4M20 12h-4"/><circle cx="12" cy="12" r="3"/></svg><span style="font-size:10px; font-weight:700; margin-left:4px;">Auto</span>';
                }
            });
        }

        const onDown=(e)=>{
            if(window.App.toolManager.activeToolId!=='btn-perspective') return;
            const p=getPointer(e);
            if(!p) return;
            const hit=hitTest(p);
            if(hit!==-1){
                isDragging=hit;
                e.preventDefault();
            }
        };
        const onMove=(e)=>{
            if(window.App.toolManager.activeToolId!=='btn-perspective') return;
            const p=getPointer(e);
            if(!p) return;
            if(isDragging!==-1){
                e.preventDefault();
                const x=Math.max(0,Math.min(1, p.x / canvas.width));
                const y=Math.max(0,Math.min(1, p.y / canvas.height));
                const corners=getNormCorners();
                corners[isDragging]={x,y};
                window.App.state.perspective.enabled=true;
                draw();
                if(window.App.canvas) window.App.canvas.scheduleRender();
                return;
            }
            // cursor feedback
            const hit=hitTest(p);
            canvas.style.cursor = hit!==-1 ? 'grab' : 'crosshair';
        };
        const onUp=()=>{ isDragging=-1; };

        canvas.addEventListener('mousedown', onDown);
        canvas.addEventListener('touchstart', onDown, {passive:false});
        document.addEventListener('mousemove', onMove);
        document.addEventListener('touchmove', onMove, {passive:false});
        document.addEventListener('mouseup', onUp);
        document.addEventListener('touchend', onUp);
        window.addEventListener('resize', draw);

        // pinch to scale uniform
        let lastDist=0;
        canvas.addEventListener('touchstart', (e)=>{
            if(e.touches.length===2){
                const dx=e.touches[0].clientX-e.touches[1].clientX;
                const dy=e.touches[0].clientY-e.touches[1].clientY;
                lastDist=Math.hypot(dx,dy);
            }
        }, {passive:true});
        canvas.addEventListener('touchmove', (e)=>{
            if(e.touches.length===2){
                e.preventDefault();
                const dx=e.touches[0].clientX-e.touches[1].clientX;
                const dy=e.touches[0].clientY-e.touches[1].clientY;
                const dist=Math.hypot(dx,dy);
                if(lastDist){
                    const scale=dist/lastDist;
                    const corners=getNormCorners();
                    const cx=0.5, cy=0.5;
                    const newCorners=corners.map(c=>({x: cx + (c.x-cx)*scale, y: cy + (c.y-cy)*scale}));
                    // clamp
                    newCorners.forEach(c=>{ c.x=Math.max(0,Math.min(1,c.x)); c.y=Math.max(0,Math.min(1,c.y)); });
                    setCorners(newCorners);
                    draw();
                    if(window.App.canvas) window.App.canvas.scheduleRender();
                }
                lastDist=dist;
            }
        }, {passive:false});
        canvas.addEventListener('touchend', ()=>{ lastDist=0; });

        // expose draw for canvas render hook
        window.App.filtersLogic.drawPerspectiveOverlay = draw;
    };

    // Apply perspective warp — Snapseed-style tilt: corners warp the photo, missing areas filled by edge replicate
    window.App.filtersLogic.applyPerspective = function(data, width, height){
        const pers = window.App.state && window.App.state.perspective;
        if(!pers || !pers.enabled) return;
        const corners = pers.corners;
        if(!corners) return;
        const isIdentity = Math.abs(corners[0].x)<0.02 && Math.abs(corners[0].y)<0.02 &&
                           Math.abs(corners[1].x-1)<0.02 && Math.abs(corners[1].y)<0.02 &&
                           Math.abs(corners[2].x-1)<0.02 && Math.abs(corners[2].y-1)<0.02 &&
                           Math.abs(corners[3].x)<0.02 && Math.abs(corners[3].y-1)<0.02;
        if(isIdentity) return;
        // Snapseed tilt model: perspective is a 4-point free warp plus tiltX/Y as small shears
        // We bake via OpenCV warpPerspective for preview; if CV not ready, do a cheap 2D shear approx
        if(window.cv && window.cv.Mat && window.cv.getPerspectiveTransform && window.cv.warpPerspective){
            try{
                // Build ImageData wrapper
                const imgData = new ImageData(new Uint8ClampedArray(data), width, height);
                const src = window.cv.matFromImageData(imgData);
                const dst = new window.cv.Mat();
                const srcTri = window.cv.matFromArray(4, 1, window.cv.CV_32FC2, [0,0, width,0, width,height, 0,height]);
                const dstTri = window.cv.matFromArray(4, 1, window.cv.CV_32FC2, [
                    corners[0].x*width, corners[0].y*height,
                    corners[1].x*width, corners[1].y*height,
                    corners[2].x*width, corners[2].y*height,
                    corners[3].x*width, corners[3].y*height
                ]);
                const M = window.cv.getPerspectiveTransform(srcTri, dstTri);
                window.cv.warpPerspective(src, dst, M, new window.cv.Size(width, height), window.cv.INTER_LINEAR, window.cv.BORDER_REPLICATE, new window.cv.Scalar());
                // copy back
                const outData = new Uint8ClampedArray(dst.data);
                // OpenCV dst is RGBA after conversion? matFromImageData gives RGBA, warp preserves 4 channels
                // dst.data is Uint8Array, but we need to ensure we copy correctly
                for(let i=0;i<data.length;i++) data[i]=outData[i];
                src.delete(); dst.delete(); srcTri.delete(); dstTri.delete(); M.delete();
                return;
            }catch(e){
                // fall through to JS approx
                console.warn('perspective CV warp failed', e);
            }
        }
        // JS fallback: simple affine tilt via canvas 2D (shear) — approximates perspective for small tilts
        try{
            const off = document.createElement('canvas'); off.width=width; off.height=height;
            const octx = off.getContext('2d');
            const srcData = new ImageData(new Uint8ClampedArray(data), width, height);
            // draw original to offscreen
            const tmp = document.createElement('canvas'); tmp.width=width; tmp.height=height;
            tmp.getContext('2d').putImageData(srcData,0,0);
            octx.clearRect(0,0,width,height);
            // use setTransform to approximate: scale via corners bounding box
            // simplest: drawImage with perspective approximated by drawing quadrilateral via manual subdivision
            // We do a simple 4-corner bilinear subdivision into 20 strips
            const strips = 20;
            for(let i=0;i<strips;i++){
                const t0=i/strips, t1=(i+1)/strips;
                // lerp top and bottom edges at t0,t1
                const top0 = {x: (1-t0)*corners[0].x*width + t0*corners[1].x*width, y: (1-t0)*corners[0].y*height + t0*corners[1].y*height};
                const top1 = {x: (1-t1)*corners[0].x*width + t1*corners[1].x*width, y: (1-t1)*corners[0].y*height + t1*corners[1].y*height};
                const bot0 = {x: (1-t0)*corners[3].x*width + t0*corners[2].x*width, y: (1-t0)*corners[3].y*height + t0*corners[2].y*height};
                const bot1 = {x: (1-t1)*corners[3].x*width + t1*corners[2].x*width, y: (1-t1)*corners[3].y*height + t1*corners[2].y*height};
                // source strip
                const sx = t0*width, sw = (t1-t0)*width;
                // draw strip as quadrilateral
                octx.save();
                octx.beginPath();
                octx.moveTo(top0.x, top0.y);
                octx.lineTo(top1.x, top1.y);
                octx.lineTo(bot1.x, bot1.y);
                octx.lineTo(bot0.x, bot0.y);
                octx.closePath();
                octx.clip();
                octx.drawImage(tmp, 0,0);
                octx.restore();
            }
            const out = octx.getImageData(0,0,width,height).data;
            for(let i=0;i<data.length;i++) data[i]=out[i];
        }catch(e){}
    };

    document.addEventListener('DOMContentLoaded', ()=> window.App.filtersLogic.initPerspectiveUI());
})();
