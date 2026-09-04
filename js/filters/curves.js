// js/filters/curves.js — Phase B: histogram + Mix + per-channel prep
window.App = window.App || {};
window.App.filtersLogic = window.App.filtersLogic || {};

(function() {
    const defaultPoints = [ {x: 0, y: 0}, {x: 255, y: 255} ];
    let points = [...defaultPoints];
    let selectedPoint = null;
    let canvas, ctx;
    
    // Config
    const padding = 10;
    const w = 200, h = 200; // Inner working area setup for 255 scale

    function initCurvesCanvas() {
        canvas = document.getElementById('curves-graph');
        if (!canvas) return;
        ctx = canvas.getContext('2d');

        updateLUT();
        drawGraph();

        // Interaction
        let isDragging = false;

        const getPos = (e) => {
            const rect = canvas.getBoundingClientRect();
            // Scale logical coords to 0-255 domain
            const cx = e.clientX - rect.left - padding;
            const cy = e.clientY - rect.top - padding;
            const px = Math.max(0, Math.min(255, (cx / w) * 255));
            const py = Math.max(0, Math.min(255, 255 - (cy / h) * 255));
            return {x: px, y: py};
        };

        canvas.addEventListener('mousedown', (e) => {
            const pos = getPos(e);
            selectedPoint = points.find(p => Math.abs(p.x - pos.x) < 15 && Math.abs(p.y - pos.y) < 15);
            
            if (!selectedPoint) {
                if (pos.x > 0 && pos.x < 255) {
                    const newPt = {x: pos.x, y: pos.y};
                    points.push(newPt);
                    points.sort((a,b) => a.x - b.x);
                    selectedPoint = newPt;
                }
            }
            isDragging = true;
            updateLUT();
            drawGraph();
        });

        canvas.addEventListener('mousemove', (e) => {
            if (isDragging && selectedPoint) {
                const pos = getPos(e);
                const idx = points.indexOf(selectedPoint);
                const minX = idx > 0 ? points[idx-1].x + 1 : 0;
                const maxX = idx < points.length - 1 ? points[idx+1].x - 1 : 255;
                
                selectedPoint.x = Math.max(minX, Math.min(maxX, pos.x));
                selectedPoint.y = pos.y;
                
                if (idx === 0) selectedPoint.x = 0;
                if (idx === points.length - 1) selectedPoint.x = 255;

                updateLUT();
                drawGraph();
                window.App.canvas.scheduleRender();
            }
        });

        const release = () => { isDragging = false; selectedPoint = null; };
        canvas.addEventListener('mouseup', release);
        canvas.addEventListener('mouseleave', release);
        
        canvas.addEventListener('dblclick', (e) => {
            const pos = getPos(e);
            const pt = points.find(p => Math.abs(p.x - pos.x) < 15 && Math.abs(p.y - pos.y) < 15);
            if (pt && points.indexOf(pt) !== 0 && points.indexOf(pt) !== points.length - 1) {
                points = points.filter(p => p !== pt);
                updateLUT();
                drawGraph();
                window.App.canvas.scheduleRender();
            }
        });

        // ensure histogram updates when image changes
        if (window.App.canvas && window.App.canvas.el) {
            // observe canvas renders via scheduleRender hook — simply redraw on next frame once
            const origSchedule = window.App.canvas.scheduleRender.bind(window.App.canvas);
            // we don't monkey patch here; instead listen to a custom event or poll via requestAnimationFrame
        }
    }

    // 1D Monotonic Cubic Interpolation approximation
    function updateLUT() {
        const lut = window.App.state.curvesLUT;
        const pts = points;
        const isStraight = pts.length===2 && pts[0].x===0 && pts[0].y===0 && pts[1].x===255 && pts[1].y===255;
        for (let x = 0; x <= 255; x++) {
            let segBegin = 0;
            for(let i=0; i<pts.length-1; i++) {
                if (x >= pts[i].x && x <= pts[i+1].x) { segBegin = i; break; }
            }
            const p0 = pts[segBegin];
            const p1 = pts[segBegin + 1];
            if (p1.x === p0.x) { lut[x] = p0.y; continue; }
            const t = (x - p0.x) / (p1.x - p0.x);
            let val;
            if(isStraight){
                // straight diagonal at initial — no smoothing, pixel-perfect
                val = p0.y + (p1.y - p0.y) * t;
            } else {
                const tSmooth = t * t * (3 - 2 * t);
                val = p0.y + (p1.y - p0.y) * tSmooth;
            }
            lut[x] = Math.max(0, Math.min(255, val));
        }
    }

    function getHistogram() {
        const el = window.App.canvas && window.App.canvas.el;
        if (!el || !el.width) return null;
        try {
            const cw = el.width, ch = el.height;
            const sm = Math.min(cw, 320);
            const sh = Math.round(ch * (sm / cw));
            const off = document.createElement('canvas'); off.width = sm; off.height = sh;
            off.getContext('2d').drawImage(el, 0, 0, sm, sh);
            const d = off.getContext('2d').getImageData(0,0,sm,sh).data;
            const hist = new Uint32Array(256);
            for (let i=0;i<d.length;i+=4) {
                const lum = (0.2126*d[i]+0.7152*d[i+1]+0.0722*d[i+2])|0;
                hist[lum]++;
            }
            let max=1; for(let i=0;i<256;i++) if(hist[i]>max) max=hist[i];
            return {hist, max};
        } catch(e){ return null; }
    }

    function drawGraph() {
        if (!ctx || !canvas) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // faint histogram behind grid
        const hData = getHistogram();
        if (hData) {
            const {hist, max} = hData;
            ctx.fillStyle = 'rgba(255,255,255,0.07)';
            ctx.beginPath();
            for(let i=0;i<256;i++){
                const x = padding + (i/255)*w;
                const y = padding + h - (hist[i]/max)*(h*0.92) - h*0.04;
                if(i===0) ctx.moveTo(x, padding+h);
                ctx.lineTo(x, y);
            }
            ctx.lineTo(padding+w, padding+h);
            ctx.lineTo(padding, padding+h);
            ctx.closePath();
            ctx.fill();
            // subtle stroke top of hist
            ctx.strokeStyle = 'rgba(255,255,255,0.09)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            for(let i=0;i<256;i++){
                const x = padding + (i/255)*w;
                const y = padding + h - (hist[i]/max)*(h*0.92) - h*0.04;
                if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
            }
            ctx.stroke();
        }

        // Grid
        ctx.strokeStyle = '#38383a';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for(let i=1; i<4; i++) {
            ctx.moveTo(padding + (w/4)*i, padding);
            ctx.lineTo(padding + (w/4)*i, padding + h);
            ctx.moveTo(padding, padding + (h/4)*i);
            ctx.lineTo(padding + w, padding + (h/4)*i);
        }
        ctx.stroke();

        const tsX = (v) => padding + (v/255) * w;
        const tsY = (v) => padding + h - (v/255) * h;

        // Line
        ctx.strokeStyle = '#0a84ff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(tsX(0), tsY(window.App.state.curvesLUT[0]));
        for(let i=1; i<=255; i++) {
            ctx.lineTo(tsX(i), tsY(window.App.state.curvesLUT[i]));
        }
        ctx.stroke();

        // Points
        points.forEach(p => {
            ctx.fillStyle = (p === selectedPoint) ? '#fff' : '#0a84ff';
            ctx.beginPath();
            ctx.arc(tsX(p.x), tsY(p.y), 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1;
            ctx.stroke();
        });
    }

    // expose for external refresh (e.g., after image load or Mix change)
    window.App.filtersLogic.refreshCurvesGraph = drawGraph;
    window.App.filtersLogic.getCurvesPoints = () => points.map(p=>({...p}));
    window.App.filtersLogic.setCurvesPoints = (newPts) => {
        if(Array.isArray(newPts) && newPts.length>=2){
            points = newPts.map(p=>({x:Math.max(0,Math.min(255,p.x)), y:Math.max(0,Math.min(255,p.y))})).sort((a,b)=>a.x-b.x);
            points[0].x=0; points[points.length-1].x=255;
            updateLUT(); drawGraph(); if(window.App.canvas) window.App.canvas.scheduleRender();
        }
    };

    window.App.filtersLogic.initCurvesUI = function() {
        const curvesBtn = document.getElementById('btn-curves');
        const popup = document.getElementById('curves-popup');
        const bottomBar = document.getElementById('curves-bottom-bar');
        const applyBtn = document.getElementById('curves-apply');
        const closeBtn = document.getElementById('curves-close');
        
        // Inject Mix slider + presets once
        const ensureExtras = () => {
            if (!popup) return;
            if (popup.querySelector('#curves-mix-wrap')) return;
            const wrap = document.createElement('div');
            wrap.id = 'curves-mix-wrap';
            wrap.style.cssText = 'padding:10px 12px 12px; border-top:1px solid var(--border); display:flex; flex-direction:column; gap:8px; background:rgba(255,255,255,0.02);';
            wrap.innerHTML = `
                <div style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
                    <span style="font-size:11px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:var(--text-muted);">Mix</span>
                    <span id="curves-mix-val" style="font-size:12px; font-weight:700; font-variant-numeric:tabular-nums; color:var(--accent);">100%</span>
                </div>
                <input id="curves-mix" type="range" min="0" max="100" value="${window.App.state.curvesMix||100}" style="width:100%;">
                <div style="display:flex; gap:6px; flex-wrap:wrap; padding-top:4px;">
                    <button class="workflow-action compact" data-curves-preset="linear" style="flex:1; min-width:64px;">Linear</button>
                    <button class="workflow-action compact" data-curves-preset="soft" style="flex:1; min-width:64px;">Soft</button>
                    <button class="workflow-action compact" data-curves-preset="strong" style="flex:1; min-width:64px;">Strong</button>
                    <button class="workflow-action compact" data-curves-preset="lifted" style="flex:1; min-width:64px;">Lifted</button>
                </div>
            `;
            popup.appendChild(wrap);
            const mix = wrap.querySelector('#curves-mix');
            const val = wrap.querySelector('#curves-mix-val');
            const sync = () => {
                const v = parseInt(mix.value,10);
                window.App.state.curvesMix = v;
                val.textContent = v+'%';
                if(window.App.canvas) window.App.canvas.scheduleRender();
            };
            mix.addEventListener('input', sync);
            mix.addEventListener('change', sync);
            // presets
            const presets = {
                linear: [{x:0,y:0},{x:255,y:255}],
                soft: [{x:0,y:0},{x:64,y:56},{x:192,y:200},{x:255,y:255}],
                strong: [{x:0,y:0},{x:64,y:42},{x:192,y:214},{x:255,y:255}],
                lifted: [{x:0,y:18},{x:64,y:72},{x:192,y:196},{x:255,y:255}],
            };
            wrap.querySelectorAll('[data-curves-preset]').forEach(btn=>{
                btn.addEventListener('click', ()=>{
                    const id=btn.getAttribute('data-curves-preset');
                    const pts=presets[id];
                    if(pts){ points=[...pts.map(p=>({...p}))]; updateLUT(); drawGraph(); if(window.App.canvas) window.App.canvas.scheduleRender(); }
                });
            });
        };

        if (curvesBtn && popup) {
            curvesBtn.addEventListener('click', () => {
                if (window.App.toolManager.activeToolId === 'btn-curves') return;
                
                window.App.toolManager.openTool('btn-curves', {
                    show: () => {
                        if (popup) {
                            popup.style.display = 'block';
                            if (!popup.style.top || popup.style.top === '50%') {
                                popup.style.transform = 'translate(-50%, -50%)';
                                popup.style.left = '50%';
                                popup.style.top = '50%';
                            }
                        }
                        if (bottomBar) bottomBar.style.display = 'flex';
                        ensureExtras();
                        // sync mix slider to state
                        const mixEl = document.getElementById('curves-mix');
                        const valEl = document.getElementById('curves-mix-val');
                        if(mixEl){ mixEl.value = window.App.state.curvesMix; if(valEl) valEl.textContent = mixEl.value+'%'; }
                        setTimeout(()=>{ initCurvesCanvas(); ensureExtras(); }, 10);
                    },
                    hide: () => {
                        if (popup) popup.style.display = 'none';
                        if (bottomBar) bottomBar.style.display = 'none';
                    }
                });
            });

            // Handle dragging
            const dragHandle = popup.querySelector('.popup-drag-handle');
            let isDragging = false;
            let startX, startY, initialLeft, initialTop;

            if (dragHandle) {
                dragHandle.addEventListener('mousedown', (e) => {
                    isDragging = true;
                    startX = e.clientX;
                    startY = e.clientY;
                    const rect = popup.getBoundingClientRect();
                    const parentRect = popup.parentElement.getBoundingClientRect();
                    popup.style.transform = 'none';
                    initialLeft = rect.left - parentRect.left;
                    initialTop = rect.top - parentRect.top;
                    popup.style.left = initialLeft + 'px';
                    popup.style.top = initialTop + 'px';
                });

                document.addEventListener('mousemove', (e) => {
                    if (!isDragging) return;
                    let newLeft = initialLeft + (e.clientX - startX);
                    let newTop = initialTop + (e.clientY - startY);
                    
                    const parentRect = popup.parentElement.getBoundingClientRect();
                    const rect = popup.getBoundingClientRect();
                    
                    newLeft = Math.max(0, Math.min(parentRect.width - rect.width, newLeft));
                    newTop = Math.max(0, Math.min(parentRect.height - rect.height, newTop));
                    
                    popup.style.left = newLeft + 'px';
                    popup.style.top = newTop + 'px';
                });

                document.addEventListener('mouseup', () => { isDragging = false; });
            }

            if (applyBtn) applyBtn.addEventListener('click', () => window.App.toolManager.commitTool());
            if (closeBtn) closeBtn.addEventListener('click', () => window.App.toolManager.cancelTool());
        } else {
            initCurvesCanvas();
        }

        // refresh histogram when image changes
        const origRender = window.App.canvas && window.App.canvas.scheduleRender;
        if (origRender && !window.App.canvas._curvesHistHook) {
            window.App.canvas._curvesHistHook = true;
            // use mutation observer on canvas? simpler: poll on open tool — already handled
        }
    };

    window.App.filtersLogic.applyCurves = function(data) {
        const lut = window.App.state.curvesLUT;
        const mix = (typeof window.App.state.curvesMix==='number'? window.App.state.curvesMix : 100)/100;
        const isIdentity = points.length === 2 && points[0].y === 0 && points[1].y === 255 && mix===1;
        if (isIdentity) {
            // still check if LUT is identity
            let id=true; for(let i=0;i<256;i++) if(lut[i]!==i){ id=false; break; }
            if(id) return;
        }
        const channel = window.App.state.curvesChannel || 'rgb';
        // For now only rgb; future: handle 'luminance' via luma preserve
        const doLumaPreserve = channel==='luminance';
        for (let i = 0; i < data.length; i += 4) {
            let r=data[i], g=data[i+1], b=data[i+2];
            let nr = lut[r], ng = lut[g], nb = lut[b];
            if (doLumaPreserve) {
                // preserve luma: scale by luma ratio
                const luma = 0.2126*r+0.7152*g+0.0722*b;
                const luma2 = 0.2126*nr+0.7152*ng+0.0722*nb;
                const ratio = luma2>1 ? luma/luma2 : 1;
                nr = nr*ratio; ng = ng*ratio; nb = nb*ratio;
            }
            if (mix < 0.999) {
                data[i]   = r + (nr - r)*mix;
                data[i+1] = g + (ng - g)*mix;
                data[i+2] = b + (nb - b)*mix;
            } else {
                data[i]=nr; data[i+1]=ng; data[i+2]=nb;
            }
        }
    };
})();
