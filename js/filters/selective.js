(function() {
    window.App = window.App || {};
    window.App.filtersLogic = window.App.filtersLogic || {};

    let addMode = false;
    let isDraggingNode = false;
    let draggedNodeIndex = -1;

    let isPinching = false;
    let initialPinchDist = 0;
    let initialPinchRadius = 0;

    let isSwiping = false;
    let startX = 0, startY = 0;
    let initialFilterValue = 0;
    let startSwipeTime = 0;

    const PARAMS = ['radius', 'brightness', 'contrast', 'saturation', 'structure'];
    const PARAM_BADGES = {
        'radius': 'R',
        'brightness': 'B',
        'contrast': 'C',
        'saturation': 'S',
        'structure': 'St'
    };

    // --- Lab helpers (Phase B: true U-Point in Lab) ---
    function srgbToLinear(c){ c/=255; return c<=0.04045 ? c/12.92 : Math.pow((c+0.055)/1.055, 2.4); }
    function rgbToXyz(r,g,b){
        const R=srgbToLinear(r), G=srgbToLinear(g), B=srgbToLinear(b);
        // D65
        const X = R*0.4124 + G*0.3576 + B*0.1805;
        const Y = R*0.2126 + G*0.7152 + B*0.0722;
        const Z = R*0.0193 + G*0.1192 + B*0.9505;
        return [X,Y,Z];
    }
    function xyzToLab(X,Y,Z){
        const refX=0.95047, refY=1, refZ=1.08883;
        let x=X/refX, y=Y/refY, z=Z/refZ;
        const eps=0.008856, kappa=903.3;
        const f=(t)=> t>eps ? Math.cbrt(t) : (kappa*t+16)/116;
        const fx=f(x), fy=f(y), fz=f(z);
        const L = 116*fy -16;
        const a = 500*(fx - fy);
        const b2 = 200*(fy - fz);
        return [L,a,b2];
    }
    function rgbToLab(r,g,b){ const [X,Y,Z]=rgbToXyz(r,g,b); return xyzToLab(X,Y,Z); }
    function deltaE(lab1, lab2){
        const dl=lab1[0]-lab2[0], da=lab1[1]-lab2[1], db=lab1[2]-lab2[2];
        return Math.sqrt(dl*dl + da*da + db*db);
    }

    function generateNodeId() {
        return 'selective-node-' + Date.now() + Math.random().toString(36).substr(2, 5);
    }

    function captureColorAt(fx, fy) {
        if (!window.App.canvas || !window.App.canvas.ctx) return {r:128, g:128, b:128, lab:[50,0,0]};
        let w = window.App.canvas.el.width;
        let h = window.App.canvas.el.height;
        let px = Math.floor(fx * w);
        let py = Math.floor(fy * h);
        px = Math.max(0, Math.min(w - 1, px));
        py = Math.max(0, Math.min(h - 1, py));
        const ctx = window.App.canvas.ctx;
        const data = ctx.getImageData(px, py, 1, 1).data;
        const lab = rgbToLab(data[0], data[1], data[2]);
        return {r: data[0], g: data[1], b: data[2], lab};
    }

    function initSelectiveUI() {
        const btn = document.getElementById('btn-selective');
        if (!btn) return;

        const bottomBar = document.getElementById('selective-bottom-bar');
        const overlay = document.getElementById('selective-ui-overlay');
        const addBtn = document.getElementById('selective-add');
        const viewBtn = document.getElementById('selective-view');
        const applyBtn = document.getElementById('selective-apply');
        const closeBtn = document.getElementById('selective-close');
        const popup = document.getElementById('selective-popup');
        const container = document.querySelector('.canvas-container');

        let uiCallbackObj = {
            show: () => {
                bottomBar.style.display = 'flex';
                overlay.style.display = 'block';
                updateNodesUI();
            },
            hide: () => {
                bottomBar.style.display = 'none';
                overlay.style.display = 'none';
                popup.style.display = 'none';
                addMode = false;
                addBtn.style.background = '#fff';
            }
        };

        btn.addEventListener('click', () => {
            if (window.App.toolManager.activeToolId === 'btn-selective') return;
            window.App.toolManager.openTool('btn-selective', uiCallbackObj);
        });

        // Add Mode Toggle
        addBtn.addEventListener('click', () => {
            addMode = !addMode;
            addBtn.style.background = addMode ? '#e8f0fe' : '#fff';
        });

        // View Mode Toggle (Debugging Mask)
        viewBtn.addEventListener('click', () => {
            let sel = window.App.state.selective;
            sel.showMask = !sel.showMask;
            viewBtn.style.color = sel.showMask ? '#4285F4' : '#777';
            window.App.canvas.scheduleRender();
        });

        if (closeBtn) closeBtn.addEventListener('click', () => window.App.toolManager.cancelTool());
        if (applyBtn) applyBtn.addEventListener('click', () => window.App.toolManager.commitTool());

        function getPinchDistance(touches) {
            let dx = touches[0].clientX - touches[1].clientX;
            let dy = touches[0].clientY - touches[1].clientY;
            return Math.sqrt(dx * dx + dy * dy);
        }

        // Render nodes to DOM
        function updateNodesUI() {
            let sel = window.App.state.selective;
            if (!sel || !sel.points) return;
            
            overlay.innerHTML = '';
            
            if (!window.App.canvas || !window.App.canvas.el) return;
            let cvsRect = window.App.canvas.el.getBoundingClientRect();
            let overlayRect = overlay.getBoundingClientRect();

            sel.points.forEach((pt, index) => {
                let div = document.createElement('div');
                div.className = 'selective-node';
                let isActive = (sel.activePointId === pt.id);
                
                // Position based on canvas exact positioning inside container
                let px = (cvsRect.left - overlayRect.left) + pt.x * cvsRect.width;
                let py = (cvsRect.top - overlayRect.top) + pt.y * cvsRect.height;

                div.style.position = 'absolute';
                div.style.left = px + 'px';
                div.style.top = py + 'px';
                div.style.width = '36px';
                div.style.height = '36px';
                div.style.transform = 'translate(-50%, -50%)';
                div.style.borderRadius = '50%';
                div.style.display = 'flex';
                div.style.alignItems = 'center';
                div.style.justifyContent = 'center';
                div.style.fontWeight = 'bold';
                div.style.fontSize = '14px';
                div.style.pointerEvents = 'auto'; // Make clickable
                div.style.transition = 'background 0.2s, box-shadow 0.2s';
                div.style.userSelect = 'none';

                if (isActive) {
                    div.style.border = '2px solid #4285F4';
                    div.style.background = 'rgba(66, 133, 244, 0.2)';
                    div.style.color = '#4285F4';
                    div.style.boxShadow = '0 0 8px rgba(66,133,244,0.5)';
                    div.innerText = PARAM_BADGES[sel.activeParam];
                } else {
                    div.style.border = '2px solid #fff';
                    div.style.background = 'rgba(255, 255, 255, 0.2)';
                    div.style.color = '#fff';
                    div.style.boxShadow = '0 2px 4px rgba(0,0,0,0.5)';
                    div.innerText = '';
                }

                div.setAttribute('data-id', pt.id);
                
                // Node Selection logic
                div.addEventListener('mousedown', (e) => onNodeDown(e, pt.id));
                div.addEventListener('touchstart', (e) => onNodeDown(e, pt.id), {passive: false});

                overlay.appendChild(div);
            });
        }

        // Active node logic
        function onNodeDown(e, id) {
            if (addMode) return;
            if (window.App.toolManager.activeToolId !== 'btn-selective') return;
            e.preventDefault();
            e.stopPropagation(); 
            
            let sel = window.App.state.selective;
            sel.activePointId = id;
            updateNodesUI();

            isDraggingNode = true;
            draggedNodeIndex = sel.points.findIndex(p => p.id === id);
            
            let activePt = sel.points.find(p => p.id === sel.activePointId);
            if (activePt) updatePopupUI(activePt);
        }

        const onDown = (e) => {
            if (window.App.toolManager.activeToolId !== 'btn-selective') return;
            if (e.target.closest('#selective-bottom-bar') || e.target.closest('#selective-popup')) return;
            
            e.preventDefault();
            let sel = window.App.state.selective;

            let clientX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
            let clientY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;

            // Add Node Mode
            if (addMode) {
                let cvsRect = window.App.canvas.el.getBoundingClientRect();
                let fx = (clientX - cvsRect.left) / cvsRect.width;
                let fy = (clientY - cvsRect.top) / cvsRect.height;
                
                if (fx >= 0 && fx <= 1 && fy >= 0 && fy <= 1) {
                    if(sel.points.length >= (sel.maxPoints||8)){
                        if(window.App.ui) window.App.ui.showToast('Max 8 points — delete one to add','error');
                        addMode=false; addBtn.style.background='#fff';
                        return;
                    }
                    let color = captureColorAt(fx, fy);
                    let newPoint = {
                        id: generateNodeId(),
                        x: fx, y: fy,
                        radius: 0.25,
                        color: color,
                        filters: { brightness: 0, contrast: 0, saturation: 0, structure: 0 }
                    };
                    sel.points.push(newPoint);
                    sel.activePointId = newPoint.id;
                    addMode = false;
                    addBtn.style.background = '#fff';
                    updateNodesUI();
                    updatePopupUI(newPoint);
                    window.App.canvas.scheduleRender();
                }
                return;
            }
        };

        const onMove = (e) => {
            if (window.App.toolManager.activeToolId !== 'btn-selective') return;

            let sel = window.App.state.selective;

            let clientX = e.type.includes('mouse') ? e.clientX : (e.touches ? e.touches[0].clientX : 0);
            let clientY = e.type.includes('mouse') ? e.clientY : (e.touches ? e.touches[0].clientY : 0);

            // Node Dragging
            if (isDraggingNode && draggedNodeIndex !== -1) {
                e.preventDefault();
                let cvsRect = window.App.canvas.el.getBoundingClientRect();
                let fx = (clientX - cvsRect.left) / cvsRect.width;
                let fy = (clientY - cvsRect.top) / cvsRect.height;
                
                sel.points[draggedNodeIndex].x = Math.max(0, Math.min(1, fx));
                sel.points[draggedNodeIndex].y = Math.max(0, Math.min(1, fy));
                
                let c = captureColorAt(sel.points[draggedNodeIndex].x, sel.points[draggedNodeIndex].y);
                sel.points[draggedNodeIndex].color = c;
                
                updateNodesUI();
                window.App.canvas.scheduleRender();
                return;
            }
        };

        const onUp = (e) => {
            if (isDraggingNode) {
                isDraggingNode = false;
                draggedNodeIndex = -1;
            }
        };

        container.addEventListener('mousedown', onDown);
        container.addEventListener('touchstart', onDown, {passive: false});
        document.addEventListener('mousemove', onMove);
        document.addEventListener('touchmove', onMove, {passive: false});
        document.addEventListener('mouseup', onUp);
        document.addEventListener('touchend', onUp);
        
        let isPopupInit = false;
        
        function updatePopupUI(activePt) {
            let sel = window.App.state.selective;
            if (!activePt) return;

            popup.style.display = 'block';

            // Ensure popup is positioned appropriately so it doesn't block entirely
            if (!popup.style.top || popup.style.top === '50%') {
                popup.style.right = '20px';
                popup.style.top = '100px';
                popup.style.left = 'auto';
                popup.style.transform = 'none';
            }
            
            let items = popup.querySelectorAll('.popup-item');
            
            items.forEach(item => {
                let filterType = item.getAttribute('data-filter');
                let valNode = item.querySelector('.popup-value');
                
                let val = (filterType === 'radius') ? Math.round(activePt.radius * 100) : (activePt.filters[filterType] || 0);
                valNode.innerText = val > 0 && filterType !== 'radius' ? '+' + val : val;
                
                if (filterType === sel.activeParam) {
                    item.classList.add('active');
                } else {
                    item.classList.remove('active');
                }

                // Attach wheel events exactly once per item
                if (!isPopupInit) {
                    item.addEventListener('mouseenter', () => {
                        items.forEach(i => i.classList.remove('active'));
                        item.classList.add('active');
                        sel.activeParam = filterType;
                        updateNodesUI(); // Update UI letters
                    });

                    item.addEventListener('wheel', (e) => {
                        e.preventDefault();
                        let targetPt = window.App.state.selective.points.find(p => p.id === window.App.state.selective.activePointId);
                        if (!targetPt) return;

                        const step = filterType === 'radius' ? 1 : 2; 
                        const delta = e.deltaY < 0 ? step : -step;
                        
                        if (filterType === 'radius') {
                            let r = (targetPt.radius * 100) + delta;
                            targetPt.radius = Math.max(5, Math.min(150, r)) / 100;
                            valNode.innerText = Math.round(targetPt.radius * 100);
                            
                            // Briefly flash mask during wheel zoom
                            window.App.state.selective.showMask = true;
                            if (targetPt._maskTimeout) clearTimeout(targetPt._maskTimeout);
                            targetPt._maskTimeout = setTimeout(() => {
                                window.App.state.selective.showMask = false;
                                window.App.canvas.scheduleRender();
                            }, 300);
                        } else {
                            let val = (targetPt.filters[filterType] || 0) + delta;
                            targetPt.filters[filterType] = Math.max(-100, Math.min(100, val));
                            valNode.innerText = targetPt.filters[filterType] > 0 ? '+' + targetPt.filters[filterType] : targetPt.filters[filterType];
                        }
                        
                        window.App.canvas.scheduleRender();
                    });
                }
            });
            isPopupInit = true;

            // Make the popup draggable
            const dragHandle = popup.querySelector('.popup-drag-handle');
            if (dragHandle && !dragHandle._hasSetupDrag) {
                dragHandle._hasSetupDrag = true;
                let isDragging = false;
                let sX, sY, iLeft, iTop;
                
                dragHandle.addEventListener('mousedown', (e) => {
                    isDragging = true;
                    sX = e.clientX; sY = e.clientY;
                    let rect = popup.getBoundingClientRect();
                    iLeft = rect.left; iTop = rect.top;
                    popup.style.left = iLeft + 'px';
                    popup.style.top = iTop + 'px';
                    popup.style.right = 'auto'; // release from right-dock
                    popup.style.transform = 'none';
                });
                document.addEventListener('mousemove', (e) => {
                    if (!isDragging) return;
                    popup.style.left = iLeft + (e.clientX - sX) + 'px';
                    popup.style.top = iTop + (e.clientY - sY) + 'px';
                });
                document.addEventListener('mouseup', () => isDragging = false);
            }
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        initSelectiveUI();
    });

    window.App.filtersLogic.applySelective = function(data, width, height) {
        let sel = window.App.state.selective;
        if (!sel || !sel.points || sel.points.length === 0) return;

        const threshold = typeof sel.threshold==='number'? sel.threshold : 32;
        const feather = typeof sel.feather==='number'? sel.feather : 48;
        // spatial sigma scales with feather: 0..100 -> 0.45..0.95 of radius
        const spatialSigmaFactor = 0.42 + (feather/100)*0.42;

        let processedPoints = sel.points.map(pt => {
            let pxc = pt.x * width;
            let pyc = pt.y * height;
            let radiusPx = pt.radius * Math.max(width, height);
            // ensure lab cached
            let lab = pt.color.lab || rgbToLab(pt.color.r, pt.color.g, pt.color.b);
            if(!pt.color.lab) pt.color.lab = lab;
            return {
                ...pt,
                lab,
                pxc, pyc, radiusPx, radiusPxSq: radiusPx * radiusPx,
                minX: Math.max(0, Math.floor(pxc - radiusPx)),
                maxX: Math.min(width, Math.ceil(pxc + radiusPx)),
                minY: Math.max(0, Math.floor(pyc - radiusPx)),
                maxY: Math.min(height, Math.ceil(pyc + radiusPx))
            };
        });

        // For performance, we process at 1x but with early exits; Lab per pixel is okay for 720p preview
        for (let pt of processedPoints) {
            let bLevel = pt.filters.brightness / 100.0;
            let cLevel = pt.filters.contrast / 100.0;
            let sLevel = pt.filters.saturation / 100.0;
            let stLevel = pt.filters.structure / 100.0;
            let showMask = sel.showMask && sel.activePointId === pt.id;
            let baseLab = pt.lab;
            // color sigma derived from threshold: Lab ΔE sigma
            const colorSigma = Math.max(8, Math.min(45, threshold * 0.95));
            const spatialSigma = Math.max(6, pt.radiusPx * spatialSigmaFactor);
            const twoSpatial = 2*spatialSigma*spatialSigma;
            const twoColor = 2*colorSigma*colorSigma;

            for (let y = pt.minY; y < pt.maxY; y++) {
                for (let x = pt.minX; x < pt.maxX; x++) {
                    let dx = x - pt.pxc;
                    let dy = y - pt.pyc;
                    let distSq = dx*dx + dy*dy;
                    if (distSq > pt.radiusPxSq) continue;
                    let geoWeight = Math.exp(-distSq / twoSpatial);
                    if (geoWeight < 0.012) continue;
                    let i = (y * width + x) * 4;
                    let R = data[i], G = data[i+1], B = data[i+2];
                    // Lab color distance — true U-Point
                    const lab = rgbToLab(R,G,B);
                    const de = deltaE(baseLab, lab);
                    const colorWeight = Math.exp(-(de*de) / twoColor);
                    let weight = geoWeight * colorWeight;
                    if (weight <= 0.01) continue;
                    // feather softens edge: weight pow
                    if(feather < 45) weight = Math.pow(weight, 1.18);
                    if (showMask) {
                        data[i]   = Math.min(255, R + (255 - R) * weight * 0.85);
                        data[i+1] = G * (1 - weight * 0.7);
                        data[i+2] = B * (1 - weight * 0.7);
                        continue; 
                    }
                    let actR = R, actG = G, actB = B;
                    if (bLevel !== 0) { actR += 255 * bLevel; actG += 255 * bLevel; actB += 255 * bLevel; }
                    if (cLevel !== 0) {
                        const amount = Math.tan((cLevel + 1) * Math.PI / 4);
                        actR = ((actR / 255 - 0.5) * amount + 0.5) * 255;
                        actG = ((actG / 255 - 0.5) * amount + 0.5) * 255;
                        actB = ((actB / 255 - 0.5) * amount + 0.5) * 255;
                    }
                    if (sLevel !== 0) {
                        let max = Math.max(actR, actG, actB);
                        let min = Math.min(actR, actG, actB);
                        let l = (max + min) / 2;
                        actR = actR + (actR - l) * sLevel;
                        actG = actG + (actG - l) * sLevel;
                        actB = actB + (actB - l) * sLevel;
                    }
                    if (stLevel !== 0) {
                        let luma = 0.299 * R + 0.587 * G + 0.114 * B;
                        actR += (actR - luma) * stLevel;
                        actG += (actG - luma) * stLevel;
                        actB += (actB - luma) * stLevel;
                    }
                    data[i]   = Math.max(0, Math.min(255, R + (actR - R) * weight));
                    data[i+1] = Math.max(0, Math.min(255, G + (actG - G) * weight));
                    data[i+2] = Math.max(0, Math.min(255, B + (actB - B) * weight));
                }
            }
        }
    };

})();
