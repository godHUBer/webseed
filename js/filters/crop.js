(function() {
    window.App = window.App || {};
    window.App.filtersLogic = window.App.filtersLogic || {};

    let cropState = { x: 0, y: 0, w: 1, h: 1 };
    let currentRatio = 'free'; // 'free', 'original', '1', '1.5', '1.333', '1.777' etc.
    let isLandscape = true; 

    // UI elements
    let overlay, topMask, bottomMask, leftMask, rightMask, cropBox, grid;
    let canvasEl;

    const updateMasks = () => {
        if (!canvasEl) return;
        
        // Align overlay perfectly with canvas
        overlay.style.left = canvasEl.offsetLeft + 'px';
        overlay.style.top = canvasEl.offsetTop + 'px';
        overlay.style.width = canvasEl.offsetWidth + 'px';
        overlay.style.height = canvasEl.offsetHeight + 'px';

        const W = canvasEl.offsetWidth;
        const H = canvasEl.offsetHeight;

        let boxLeft = cropState.x * W;
        let boxTop = cropState.y * H;
        let boxW = cropState.w * W;
        let boxH = cropState.h * H;

        cropBox.style.left = boxLeft + 'px';
        cropBox.style.top = boxTop + 'px';
        cropBox.style.width = boxW + 'px';
        cropBox.style.height = boxH + 'px';

        topMask.style.height = boxTop + 'px';
        bottomMask.style.height = Math.max(0, H - (boxTop + boxH)) + 'px';
        
        leftMask.style.top = boxTop + 'px';
        leftMask.style.height = boxH + 'px';
        leftMask.style.width = boxLeft + 'px';

        rightMask.style.top = boxTop + 'px';
        rightMask.style.height = boxH + 'px';
        rightMask.style.left = (boxLeft + boxW) + 'px';
        rightMask.style.width = Math.max(0, W - (boxLeft + boxW)) + 'px';
    };

    const applyRatioConstraint = (ratioStr) => {
        if (ratioStr === 'free') {
            currentRatio = 'free';
            return;
        }

        let targetAspect = 1.0;
        if (ratioStr === 'original') {
            const img = window.App.state.originalImage;
            if (img) targetAspect = img.width / img.height;
        } else {
            targetAspect = parseFloat(ratioStr);
        }

        if (!isLandscape) {
            targetAspect = 1.0 / targetAspect;
        }

        // We snap the current crop box to this aspect ratio, keeping it centered if possible
        const W = canvasEl.offsetWidth;
        const H = canvasEl.offsetHeight;

        // Current physical size
        let pw = cropState.w * W;
        let ph = cropState.h * H;
        let centerPx = cropState.x * W + pw / 2;
        let centerPy = cropState.y * H + ph / 2;

        let newPw = pw;
        let newPh = ph;

        if (pw / ph > targetAspect) {
            // too wide, snap width
            newPw = ph * targetAspect;
        } else {
            // too tall, snap height
            newPh = pw / targetAspect;
        }

        // write back
        cropState.w = newPw / W;
        cropState.h = newPh / H;
        cropState.x = (centerPx - newPw / 2) / W;
        cropState.y = (centerPy - newPh / 2) / H;

        // Safety clamps
        if (cropState.x < 0) cropState.x = 0;
        if (cropState.y < 0) cropState.y = 0;
        if (cropState.x + cropState.w > 1) { cropState.w = 1 - cropState.x; cropState.h = (cropState.w * W / targetAspect) / H; }
        if (cropState.y + cropState.h > 1) { cropState.h = 1 - cropState.y; cropState.w = (cropState.h * H * targetAspect) / W; }

        currentRatio = ratioStr;
        updateMasks();
    };

    window.App.filtersLogic.initCropUI = function() {
        const cropBtn = document.getElementById('btn-crop');
        const bottomBar = document.getElementById('crop-bottom-bar');
        const closeBtn = document.getElementById('crop-close');
        const applyBtn = document.getElementById('crop-apply');
        const flipBtn = document.getElementById('crop-flip-aspect');
        const presetBtns = bottomBar ? bottomBar.querySelectorAll('.crop-preset') : [];
        
        overlay = document.getElementById('crop-ui-overlay');
        topMask = document.getElementById('crop-mask-top');
        bottomMask = document.getElementById('crop-mask-bottom');
        leftMask = document.getElementById('crop-mask-left');
        rightMask = document.getElementById('crop-mask-right');
        cropBox = document.getElementById('crop-box');
        grid = document.getElementById('crop-grid');
        canvasEl = document.getElementById('editor-canvas');

        if (!cropBtn || !overlay) return;

        cropBtn.addEventListener('click', () => {
            if (window.App.toolManager.activeToolId === 'btn-crop') return;
            
            window.App.toolManager.openTool('btn-crop', {
                show: () => {
                    bottomBar.style.display = 'flex';
                    overlay.style.display = 'block';
                    
                    // Load current crop state from global geometry snapshot (or reset)
                    const geomCrop = window.App.state.geometry.crop;
                    if (geomCrop) {
                        cropState = { ...geomCrop };
                    } else {
                        cropState = { x: 0, y: 0, w: 1, h: 1 };
                    }
                    
                    setTimeout(updateMasks, 10);
                },
                hide: () => {
                    bottomBar.style.display = 'none';
                    overlay.style.display = 'none';
                }
            });
        });

        if (closeBtn) closeBtn.addEventListener('click', () => window.App.toolManager.cancelTool());
        if (applyBtn) applyBtn.addEventListener('click', () => {
            // Commit bounds to geometry and rebuild canvas
            window.App.state.geometry.crop = { ...cropState };
            window.App.canvas.fitToContainer();
            window.App.canvas.scheduleRender();
            window.App.toolManager.commitTool();
        });

        if (flipBtn) flipBtn.addEventListener('click', () => {
            if (currentRatio !== 'free' && currentRatio !== '1') {
                isLandscape = !isLandscape;
                applyRatioConstraint(currentRatio);
            }
        });

        const rotateBtn = document.getElementById('crop-rotate-90');
        if (rotateBtn) {
            rotateBtn.addEventListener('click', () => {
                const W = canvasEl.offsetWidth;
                const H = canvasEl.offsetHeight;

                // Current Physical Size and Center
                const pw = cropState.w * W;
                const ph = cropState.h * H;
                const cx = cropState.x * W + pw / 2;
                const cy = cropState.y * H + ph / 2;

                // Rotate 90: Swap Physical Width and Height
                const newPw = ph;
                const newPh = pw;

                // Map back to fractions
                cropState.w = newPw / W;
                cropState.h = newPh / H;
                cropState.x = (cx - newPw / 2) / W;
                cropState.y = (cy - newPh / 2) / H;

                // Toggle internal landscape tracker
                isLandscape = !isLandscape;

                // Clamp to screen edges
                if (cropState.x < 0) cropState.x = 0;
                if (cropState.y < 0) cropState.y = 0;
                if (cropState.x + cropState.w > 1) { cropState.x = 1 - cropState.w; }
                if (cropState.y + cropState.h > 1) { cropState.y = 1 - cropState.h; }
                
                // If it's still too large (e.g. rotating a wide banner in a narrow portrait canvas)
                if (cropState.w > 1) { cropState.w = 1; cropState.x = 0; }
                if (cropState.h > 1) { cropState.h = 1; cropState.y = 0; }

                updateMasks();
            });
        }

        presetBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                presetBtns.forEach(b => b.classList.remove('active', 'text-blue-500'));
                btn.classList.add('active');
                
                // Color updates based on custom Snapseed CSS 
                presetBtns.forEach(b => { b.style.color = '#777'; });
                btn.style.color = '#4285F4';

                const ratio = btn.getAttribute('data-ratio');
                applyRatioConstraint(ratio);
            });
        });

        // Setup Dragging Logic
        let isDragging = false;
        let dragMode = null; // 'nw', 'n', 'c' (center), etc.
        let startX, startY;
        let startCrop;

        const handles = cropBox.querySelectorAll('.crop-handle');
        handles.forEach(handle => {
            const onDown = (e) => {
                e.preventDefault();
                e.stopPropagation();
                isDragging = true;
                dragMode = handle.getAttribute('data-dir');
                startX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
                startY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;
                startCrop = { ...cropState };
                grid.style.display = 'block'; // Show rule of thirds
            };
            handle.addEventListener('mousedown', onDown);
            handle.addEventListener('touchstart', onDown, {passive: false});
        });

        // Center drag (moving)
        const onBoxDown = (e) => {
            if (e.target.classList.contains('crop-handle')) return;
            e.preventDefault();
            isDragging = true;
            dragMode = 'c';
            startX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
            startY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;
            startCrop = { ...cropState };
            grid.style.display = 'block';
        };
        cropBox.addEventListener('mousedown', onBoxDown);
        cropBox.addEventListener('touchstart', onBoxDown, {passive: false});

        const onMove = (e) => {
            if (!isDragging || !dragMode) return;
            e.preventDefault();

            const clientX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
            const clientY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;

            const W = canvasEl.offsetWidth;
            const H = canvasEl.offsetHeight;

            const dx = (clientX - startX) / W;
            const dy = (clientY - startY) / H;

            let nx = startCrop.x;
            let ny = startCrop.y;
            let nw = startCrop.w;
            let nh = startCrop.h;

            if (dragMode === 'c') {
                nx += dx;
                ny += dy;
                // clamp
                if (nx < 0) nx = 0;
                if (ny < 0) ny = 0;
                if (nx + nw > 1) nx = 1 - nw;
                if (ny + nh > 1) ny = 1 - nh;
            } else {
                // Free edges
                if (dragMode.includes('w')) { nx += dx; nw -= dx; }
                if (dragMode.includes('e')) { nw += dx; }
                if (dragMode.includes('n')) { ny += dy; nh -= dy; }
                if (dragMode.includes('s')) { nh += dy; }

                // Ratio locking
                if (currentRatio !== 'free') {
                    let targetAspect = 1.0;
                    if (currentRatio === 'original' && window.App.state.originalImage) {
                        targetAspect = window.App.state.originalImage.width / window.App.state.originalImage.height;
                    } else if (currentRatio !== 'original') {
                        targetAspect = parseFloat(currentRatio);
                    }
                    if (!isLandscape && currentRatio !== '1') targetAspect = 1.0 / targetAspect;

                    // If dragged a corner, dominate one axis to enforce ratio
                    // Simple approach: force Width to match Height's drag
                    let expectedWidth = (nh * H * targetAspect) / W;
                    let expectedHeight = (nw * W / targetAspect) / H;

                    // Depending on handle, adjust the opposing side
                    if (['n','s'].includes(dragMode)) {
                        nw = expectedWidth;
                        nx = startCrop.x + (startCrop.w - nw) / 2; // grow from center horizontally
                    } else if (['e','w'].includes(dragMode)) {
                        nh = expectedHeight;
                        ny = startCrop.y + (startCrop.h - nh) / 2;
                    } else {
                        // Corners
                        if (Math.abs(dx * W) > Math.abs(dy * H)) {
                            // width dominant
                            nh = expectedHeight;
                            if (dragMode.includes('n')) ny = (startCrop.y + startCrop.h) - nh;
                        } else {
                            // height dominant
                            nw = expectedWidth;
                            if (dragMode.includes('w')) nx = (startCrop.x + startCrop.w) - nw;
                        }
                    }
                }

                // Clamps minimum sizes
                if (nw < 0.1) { nw = 0.1; if (dragMode.includes('w')) nx = startCrop.x + startCrop.w - 0.1; }
                if (nh < 0.1) { nh = 0.1; if (dragMode.includes('n')) ny = startCrop.y + startCrop.h - 0.1; }

                // Clamp to borders
                if (nx < 0) { nw += nx; nx = 0; }
                if (ny < 0) { nh += ny; ny = 0; }
                if (nx + nw > 1) { nw = 1 - nx; }
                if (ny + nh > 1) { nh = 1 - ny; }
            }

            cropState.x = nx;
            cropState.y = ny;
            cropState.w = nw;
            cropState.h = nh;

            updateMasks();
        };

        const onUp = () => {
            isDragging = false;
            dragMode = null;
            grid.style.display = 'none'; // Hide rule of thirds when letting go
        };

        document.addEventListener('mousemove', onMove);
        document.addEventListener('touchmove', onMove, {passive: false});
        document.addEventListener('mouseup', onUp);
        document.addEventListener('touchend', onUp);
    };

    // Auto-initialize when file loads into the global bundle
    document.addEventListener('DOMContentLoaded', () => {
        window.App.filtersLogic.initCropUI();
    });
})();
