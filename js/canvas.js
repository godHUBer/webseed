// js/canvas.js
window.App = window.App || {};

window.App.canvas = {
    el: null,
    ctx: null,
    container: null,
    renderTimeout: null,

    init() {
        this.el = document.getElementById('editor-canvas');
        this.ctx = this.el.getContext('2d');
        this.container = document.querySelector('.canvas-container');
    },

    // Phase 3: zoom-aware fit
    _baseFit: { w: 0, h: 0, scale: 1, logicalW: 0, logicalH: 0 },
    fitToContainer(preserveZoom) {
        const img = window.App.state.originalImage;
        const geom = window.App.state.geometry;
        if (!img || !this.container || !this.el) return;

        // Base image dimensions
        let baseW = img.width;
        let baseH = img.height;

        // Account for crop fractional bounds if they exist
        if (geom.crop) {
            let r = ((geom.rotate % 360) + 360) % 360;
            let oc = { ...geom.crop };
            if (r === 90)  oc = {x: geom.crop.y, y: 1 - (geom.crop.x + geom.crop.w), w: geom.crop.h, h: geom.crop.w};
            if (r === 180) oc = {x: 1 - (geom.crop.x + geom.crop.w), y: 1 - (geom.crop.y + geom.crop.h), w: geom.crop.w, h: geom.crop.h};
            if (r === 270) oc = {x: 1 - (geom.crop.y + geom.crop.h), y: geom.crop.x, w: geom.crop.h, h: geom.crop.w};
            baseW = img.width * oc.w;
            baseH = img.height * oc.h;
        }
        // Expand handling — grow base dimensions for preview (up to 40% per side)
        const exp = window.App.state.expand;
        let expandPad = {top:0,right:0,bottom:0,left:0};
        let hasExpand = false;
        if(exp && exp.enabled){
            expandPad = exp.pad || expandPad;
            hasExpand = Object.values(expandPad).some(v=> (v||0) > 0.005);
            if(hasExpand){
                baseW = baseW * (1 + (expandPad.left||0) + (expandPad.right||0));
                baseH = baseH * (1 + (expandPad.top||0) + (expandPad.bottom||0));
            }
        }
        const isRotatedOrthogonal = Math.abs(geom.rotate) % 180 === 90;
        const logicalW = isRotatedOrthogonal ? baseH : baseW;
        const logicalH = isRotatedOrthogonal ? baseW : baseH;
        const padding = 48;
        const maxWidth = Math.max(1, this.container.clientWidth - padding);
        const maxHeight = Math.max(1, this.container.clientHeight - padding);
        const imgRatio = logicalW / logicalH;
        const containerRatio = maxWidth / maxHeight;
        let finalWidth, finalHeight;
        if (imgRatio > containerRatio) {
            finalWidth = maxWidth;
            finalHeight = maxWidth / imgRatio;
        } else {
            finalHeight = maxHeight;
            finalWidth = maxHeight * imgRatio;
        }
        this._baseFit = { w: finalWidth, h: finalHeight, scale: finalWidth / logicalW, logicalW, logicalH };
        const cfg = window.App.state.canvasConfig;
        if (preserveZoom === true) {
            if (cfg.userZoom == null) cfg.userZoom = 1;
        } else if (preserveZoom === false) {
            cfg.userZoom = 1;
        } else {
            // default: preserve existing zoom if set, otherwise 1
            if (cfg.userZoom == null) cfg.userZoom = 1;
        }
        cfg.baseFitScale = this._baseFit.scale;
        this.applyZoom();
        this.updateZoomLabel();
    },

    applyZoom() {
        const cfg = window.App.state.canvasConfig;
        if (!this._baseFit || !this._baseFit.w) return;
        const userZoom = Math.max(0.5, Math.min(4, cfg.userZoom || 1));
        cfg.userZoom = userZoom;
        const w = Math.round(this._baseFit.w * userZoom);
        const h = Math.round(this._baseFit.h * userZoom);
        cfg.previewScale = this._baseFit.scale * userZoom;
        this.el.width = w;
        this.el.height = h;
        // pan: when zoomed, allow container scroll
        if (userZoom > 1.05) {
            this.container.style.overflow = 'auto';
            this.container.style.justifyContent = 'flex-start';
            this.container.style.alignItems = 'flex-start';
            this.container.style.padding = '18px';
            // center via margin when larger than viewport
            this.el.style.margin = 'auto';
        } else {
            this.container.style.overflow = 'hidden';
            this.container.style.justifyContent = 'center';
            this.container.style.alignItems = 'center';
            cfg.panX = 0; cfg.panY = 0;
            this.el.style.margin = '';
        }
        this.updateZoomLabel();
        this.scheduleRender();
    },

    setZoom(factor, pivot) {
        const cfg = window.App.state.canvasConfig;
        const prev = cfg.userZoom || 1;
        const next = Math.max(0.5, Math.min(4, factor));
        cfg.userZoom = next;
        this.applyZoom();
        // try to keep pivot point stable when zooming with wheel
        if (pivot && this.container && next > 1) {
            // approximate: scroll to keep pointer position
            // no-op for simplicity — container scroll preserved
        }
        if (next === prev) this.updateZoomLabel();
    },

    zoomIn() { this.setZoom((window.App.state.canvasConfig.userZoom || 1) * 1.25); },
    zoomOut() { this.setZoom((window.App.state.canvasConfig.userZoom || 1) / 1.25); },
    zoomFit() { window.App.state.canvasConfig.userZoom = 1; this.applyZoom(); if (this.container) { this.container.scrollLeft = 0; this.container.scrollTop = 0; } },
    updateZoomLabel() {
        const lbl = document.getElementById('zoom-label');
        const s = document.getElementById('status-zoom');
        const pct = Math.round((window.App.state.canvasConfig.userZoom || 1) * 100);
        if (lbl) lbl.textContent = pct + '%';
        if (s) {
            const img = window.App.state.originalImage;
            const info = img ? `${img.width}×${img.height}` : '—';
            s.textContent = pct + '% • ' + info;
        }
    },

    scheduleRender() {
        if (this.renderTimeout) cancelAnimationFrame(this.renderTimeout);
        this.renderTimeout = requestAnimationFrame(() => this.render());
    },

    render() {
        const img = window.App.state.originalImage;
        const geom = window.App.state.geometry;
        if (!img) return;

        // Prepare Transform Matrix Draw
        this.ctx.clearRect(0, 0, this.el.width, this.el.height);
        this.ctx.save();
        
        // Move to center of canvas for origin-based rotation
        this.ctx.translate(this.el.width / 2, this.el.height / 2);

        // Apply rotation (base 90-degree steps + manual straighten angle)
        let totalRotation = geom.rotate || 0;
        if (geom.straighten) totalRotation += geom.straighten;
        this.ctx.rotate((totalRotation * Math.PI) / 180);

        // Apply flips
        this.ctx.scale(geom.flipX ? -1 : 1, geom.flipY ? -1 : 1);

        // The size to draw is the scaled "base" dimensions.
        const isRotatedOrthogonal = Math.abs(geom.rotate) % 180 === 90;
        const scale = window.App.state.canvasConfig.previewScale;
        
        let drawW = (isRotatedOrthogonal ? this.el.height : this.el.width);
        let drawH = (isRotatedOrthogonal ? this.el.width : this.el.height);

        // Source coordinates mapping from original image based on fractional crop
        let sx = 0, sy = 0, sw = img.width, sh = img.height;
        if (geom.crop) {
            let r = ((geom.rotate % 360) + 360) % 360;
            let oc = { ...geom.crop };
            if (r === 90)  oc = {x: geom.crop.y, y: 1 - (geom.crop.x + geom.crop.w), w: geom.crop.h, h: geom.crop.w};
            if (r === 180) oc = {x: 1 - (geom.crop.x + geom.crop.w), y: 1 - (geom.crop.y + geom.crop.h), w: geom.crop.w, h: geom.crop.h};
            if (r === 270) oc = {x: 1 - (geom.crop.y + geom.crop.h), y: geom.crop.x, w: geom.crop.h, h: geom.crop.w};

            sx = img.width * oc.x;
            sy = img.height * oc.y;
            sw = img.width * oc.w;
            sh = img.height * oc.h;
        }

        // Phase: micro-crop rotate + expand fill
        {
            const exp = window.App.state.expand;
            let hasExpand = exp && exp.enabled && exp.pad && Object.values(exp.pad).some(v=> (v||0) > 0.006);
            let outerW = drawW, outerH = drawH;
            let innerW = drawW, innerH = drawH;
            let dx = -drawW/2, dy = -drawH/2;
            let renderW = drawW, renderH = drawH;
            // Handle expand: compute inner rect and fill border
            if(hasExpand){
                const pad = exp.pad;
                const totalW = (pad.left||0)+(pad.right||0);
                const totalH = (pad.top||0)+(pad.bottom||0);
                innerW = drawW / (1+totalW);
                innerH = drawH / (1+totalH);
                const leftOff = (pad.left||0)/(1+totalW) * drawW;
                const topOff = (pad.top||0)/(1+totalH) * drawH;
                dx = -drawW/2 + leftOff;
                dy = -drawH/2 + topOff;
                renderW = innerW; renderH = innerH;
                // fill expand border before drawing inner (in rotated space, axis-aligned with image)
                const mode = exp.mode || 'smart';
                this.ctx.save();
                // fill outer
                if(mode==='white'){
                    this.ctx.fillStyle='#ffffff';
                    this.ctx.fillRect(-outerW/2, -outerH/2, outerW, outerH);
                } else if(mode==='black'){
                    this.ctx.fillStyle='#0a0a0f';
                    this.ctx.fillRect(-outerW/2, -outerH/2, outerW, outerH);
                } else if(mode==='reflect'){
                    // reflect: draw mirrored copies to border areas
                    // top
                    if((pad.top||0)>0){
                        this.ctx.save(); this.ctx.scale(1,-1);
                        this.ctx.drawImage(img, sx, sy, sw, sh, dx, -dy - innerH*2 - (outerH-innerH - (pad.bottom||0)/(1+totalH)*outerH), innerW, innerH);
                        this.ctx.restore();
                    }
                    // bottom
                    if((pad.bottom||0)>0){
                        this.ctx.save(); this.ctx.scale(1,-1);
                        this.ctx.drawImage(img, sx, sy, sw, sh, dx, -dy, innerW, innerH);
                        this.ctx.restore();
                    }
                    // left/right handled via scale -1,1 similarly if needed (simplified: just fill with edge color for now)
                    this.ctx.fillStyle='rgba(0,0,0,0.04)';
                    this.ctx.fillRect(-outerW/2, -outerH/2, outerW, outerH);
                } else { // smart — blurred average fill
                    // quick smart: fill with blurred inner via filter
                    this.ctx.save();
                    this.ctx.filter='blur(18px)';
                    // draw inner enlarged to cover border
                    this.ctx.drawImage(img, sx, sy, sw, sh, -outerW/2, -outerH/2, outerW, outerH);
                    this.ctx.restore();
                    // darken slightly to distinguish border
                    this.ctx.fillStyle='rgba(255,255,255,0.06)';
                    this.ctx.fillRect(-outerW/2, -outerH/2, outerW, outerH);
                }
                this.ctx.restore();
            }
            // Handle straighten micro-crop (scale inner to hide corners)
            if (geom.straighten && geom.straighten !== 0) {
                const theta = geom.straighten * Math.PI / 180;
                const absCos = Math.abs(Math.cos(theta));
                const absSin = Math.abs(Math.sin(theta));
                // need size accounts for expand outer vs inner? Use inner size for crop calculation
                const baseW = hasExpand ? innerW : drawW;
                const baseH = hasExpand ? innerH : drawH;
                const needW = baseW * absCos + baseH * absSin;
                const needH = baseW * absSin + baseH * absCos;
                let extraScale = Math.max(needW / baseW, needH / baseH);
                extraScale *= 1.015;
                renderW = baseW * extraScale;
                renderH = baseH * extraScale;
                // recenter inner after scale: keep same center as inner rect
                const centerX = hasExpand ? (dx + innerW/2) : 0;
                const centerY = hasExpand ? (dy + innerH/2) : 0;
                dx = centerX - renderW/2;
                dy = centerY - renderH/2;
            }
            this.ctx.drawImage(img, sx, sy, sw, sh, dx, dy, renderW, renderH);
        }
        
        this.ctx.restore();
        
        // Retrieve pixels for processing
        const imageData = this.ctx.getImageData(0, 0, this.el.width, this.el.height);
        
        // Save unfiltered geometry-resolved base image for destructive/overlay tools (Healing) and Compare
        window.App.canvas.baseImageData = new ImageData(
            new Uint8ClampedArray(imageData.data), this.el.width, this.el.height
        );

        const isCompare = window.App.state.uiFlags && window.App.state.uiFlags.compareOriginal;
        if (isCompare) {
            // Before: show original (geometry only, no filters) with subtle fade
            this.el.classList.add('is-compare');
            this.ctx.putImageData(window.App.canvas.baseImageData, 0, 0);
            // Still show healing overlay in compare? No — pure original feels more honest
            if (window.App.ui && window.App.toolManager) {
                if (window.App.toolManager.activeToolId === 'btn-lens-blur') {
                    if (window.App.ui.drawLensBlurOverlay) window.App.ui.drawLensBlurOverlay();
                } else if (window.App.toolManager.activeToolId === 'btn-vignette') {
                    if (window.App.ui.drawVignetteOverlay) window.App.ui.drawVignetteOverlay();
                }
            }
            return;
        } else {
            this.el.classList.remove('is-compare');
        }
        
        // 0.4 Perspective warp (Snapseed tilt) — must run before other pixel filters but after geometry base capture
        if (window.App.filtersLogic.applyPerspective) {
            window.App.filtersLogic.applyPerspective(imageData.data, this.el.width, this.el.height);
        }
        // 0.45 Expand border fill (preview already via geometry, but filter path ensures data consistency)
        if (window.App.filtersLogic.applyExpand) {
            window.App.filtersLogic.applyExpand(imageData.data, this.el.width, this.el.height);
        }
        // 0.5 Healing Overlay
        if (window.App.filtersLogic.applyHealing) {
            window.App.filtersLogic.applyHealing(imageData.data, this.el.width, this.el.height);
        }
        
        // Pass through filter pipelines non-destructively
        // 1. RAW Develop
        if (window.App.filtersLogic.applyRaw) {
            window.App.filtersLogic.applyRaw(imageData.data);
        }
        
        // 2. Tune Image
        if (window.App.filtersLogic.applyTune) {
            window.App.filtersLogic.applyTune(imageData.data);
        }

        // 2.5 Selective Nodes (U-Point)
        if (window.App.filtersLogic.applySelective) {
            window.App.filtersLogic.applySelective(imageData.data, this.el.width, this.el.height);
        }

        // 3. Details (Requires width/height for convolution)
        if (window.App.filtersLogic.applyDetails) {
            window.App.filtersLogic.applyDetails(imageData.data, this.el.width, this.el.height);
        }
        
        // 3.5 Glamour Glow
        if (window.App.filtersLogic.applyGlamourGlow) {
            window.App.filtersLogic.applyGlamourGlow(imageData.data, this.el.width, this.el.height);
        }

        // 3.6 Grainy Film
        if (window.App.filtersLogic.applyGrainyFilm) {
            window.App.filtersLogic.applyGrainyFilm(imageData.data, this.el.width, this.el.height);
        }

        // 3.7 Black & White
        if (window.App.filtersLogic.applyBlackAndWhite) {
            window.App.filtersLogic.applyBlackAndWhite(imageData.data, this.el.width, this.el.height);
        }

        // 3.8 Lens Blur (with Split Screen Support embedded in filter)
        if (window.App.filtersLogic.applyLensBlur) {
            window.App.filtersLogic.applyLensBlur(imageData.data, this.el.width, this.el.height);
        }

        // 3.9 Vignette
        if (window.App.filtersLogic.applyVignette) {
            window.App.filtersLogic.applyVignette(imageData.data, this.el.width, this.el.height);
        }

        // 4. Curves
        if (window.App.filtersLogic.applyCurves) {
            window.App.filtersLogic.applyCurves(imageData.data);
        }

        // 5. White Balance
        if (window.App.filtersLogic.applyWhiteBalance) {
            window.App.filtersLogic.applyWhiteBalance(imageData.data);
        }

        // 6. Brush Mask (painted per-pixel effects)
        if (window.App.filtersLogic.applyBrushMask) {
            window.App.filtersLogic.applyBrushMask(imageData.data, this.el.width, this.el.height);
        }

        // 7. Text Tool Overlays
        if (window.App.filtersLogic.applyText) {
            window.App.filtersLogic.applyText(imageData.data, this.el.width, this.el.height);
        }

        // Put modified pixels back
        this.ctx.putImageData(imageData, 0, 0);

        // Overlay visuals
        if (window.App.ui && window.App.toolManager) {
            if (window.App.toolManager.activeToolId === 'btn-lens-blur') {
                if (window.App.ui.drawLensBlurOverlay) window.App.ui.drawLensBlurOverlay();
            } else if (window.App.toolManager.activeToolId === 'btn-vignette') {
                if (window.App.ui.drawVignetteOverlay) window.App.ui.drawVignetteOverlay();
            }
        }
    }
};
