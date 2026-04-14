// js/filters/curves.js
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
            // check closeness
            selectedPoint = points.find(p => Math.abs(p.x - pos.x) < 15 && Math.abs(p.y - pos.y) < 15);
            
            if (!selectedPoint) {
                // Add new point, keep it sorted
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
                // constrain X to not cross neighbors
                const idx = points.indexOf(selectedPoint);
                const minX = idx > 0 ? points[idx-1].x + 1 : 0;
                const maxX = idx < points.length - 1 ? points[idx+1].x - 1 : 255;
                
                selectedPoint.x = Math.max(minX, Math.min(maxX, pos.x));
                selectedPoint.y = pos.y;
                
                // End points lock X axis
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
        
        // Double click to remove
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
    }

    // 1D Monotonic Cubic Interpolation approximation
    function updateLUT() {
        const lut = window.App.state.curvesLUT;
        const pts = points;
        
        // Piecewise linear or simple spline mapping to LUT[0..255]
        for (let x = 0; x <= 255; x++) {
            // Find which segment x falls into
            let segBegin = 0;
            for(let i=0; i<pts.length-1; i++) {
                if (x >= pts[i].x && x <= pts[i+1].x) {
                    segBegin = i;
                    break;
                }
            }
            
            const p0 = pts[segBegin];
            const p1 = pts[segBegin + 1];
            
            if (p1.x === p0.x) {
                lut[x] = p0.y;
                continue;
            }
            
            // Linear iterpolation for now (can be upgraded to cubic)
            const t = (x - p0.x) / (p1.x - p0.x);
            
            // Smoothstep hermite interpolation (gives pseudo-curve without overshoots)
            const tSmooth = t * t * (3 - 2 * t);
            
            let val = p0.y + (p1.y - p0.y) * tSmooth;
            lut[x] = Math.max(0, Math.min(255, val));
        }
    }

    function drawGraph() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
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

    window.App.filtersLogic.initCurvesUI = function() {
        const curvesBtn = document.getElementById('btn-curves');
        const popup = document.getElementById('curves-popup');
        const bottomBar = document.getElementById('curves-bottom-bar');
        const applyBtn = document.getElementById('curves-apply');
        const closeBtn = document.getElementById('curves-close');
        
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
                        setTimeout(initCurvesCanvas, 10);
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
    };

    window.App.filtersLogic.applyCurves = function(data) {
        const lut = window.App.state.curvesLUT;
        // Optimization: if linear 1:1, skip
        if (points.length === 2 && points[0].y === 0 && points[1].y === 255) return;

        for (let i = 0; i < data.length; i += 4) {
            data[i] = lut[data[i]];           // R
            data[i+1] = lut[data[i+1]];       // G
            data[i+2] = lut[data[i+2]];       // B
        }
    };
})();
