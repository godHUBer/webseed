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

    fitToContainer() {
        const img = window.App.state.originalImage;
        const geom = window.App.state.geometry;
        if (!img) return;

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

        // Account for rotations bridging orthogonal bounds
        const isRotatedOrthogonal = Math.abs(geom.rotate) % 180 === 90;
        const logicalW = isRotatedOrthogonal ? baseH : baseW;
        const logicalH = isRotatedOrthogonal ? baseW : baseH;

        const padding = 48; // 24px padding on each side
        const maxWidth = this.container.clientWidth - padding;
        const maxHeight = this.container.clientHeight - padding;
        
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

        window.App.state.canvasConfig.previewScale = finalWidth / logicalW;
        this.el.width = finalWidth;
        this.el.height = finalHeight;
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

        if (geom.straightenCache && geom.straightenCacheAngle === geom.straighten) {
            // Un-transform context back to default because the cache ALREADY has rotation and geometry baked in!
            this.ctx.restore(); 
            this.ctx.save();
            this.ctx.drawImage(geom.straightenCache, 0, 0, this.el.width, this.el.height);
        } else {
            let dx = -drawW / 2;
            let dy = -drawH / 2;
            
            if (geom.straighten && geom.straighten !== 0) {
                // Live Drag Proxy: Produce a heavily blurred ambient bleed to cover corners without lagging the UI thread
                this.ctx.filter = 'blur(40px)';
                // Right
                this.ctx.save(); this.ctx.scale(-1, 1); this.ctx.drawImage(img, sx, sy, sw, sh, -dx - drawW * 2, dy, drawW, drawH); this.ctx.restore();
                // Left
                this.ctx.save(); this.ctx.scale(-1, 1); this.ctx.drawImage(img, sx, sy, sw, sh, -dx, dy, drawW, drawH); this.ctx.restore();
                // Bottom
                this.ctx.save(); this.ctx.scale(1, -1); this.ctx.drawImage(img, sx, sy, sw, sh, dx, -dy - drawH * 2, drawW, drawH); this.ctx.restore();
                // Top
                this.ctx.save(); this.ctx.scale(1, -1); this.ctx.drawImage(img, sx, sy, sw, sh, dx, -dy, drawW, drawH); this.ctx.restore();
                // Corners
                this.ctx.save(); this.ctx.scale(-1, -1); this.ctx.drawImage(img, sx, sy, sw, sh, -dx, -dy, drawW, drawH); this.ctx.restore();
                this.ctx.save(); this.ctx.scale(-1, -1); this.ctx.drawImage(img, sx, sy, sw, sh, -dx - drawW * 2, -dy, drawW, drawH); this.ctx.restore();
                this.ctx.save(); this.ctx.scale(-1, -1); this.ctx.drawImage(img, sx, sy, sw, sh, -dx, -dy - drawH * 2, drawW, drawH); this.ctx.restore();
                this.ctx.save(); this.ctx.scale(-1, -1); this.ctx.drawImage(img, sx, sy, sw, sh, -dx - drawW * 2, -dy - drawH * 2, drawW, drawH); this.ctx.restore();
                this.ctx.filter = 'none';
            }

            // Draw crisp base image over ambient proxy
            this.ctx.drawImage(img, sx, sy, sw, sh, dx, dy, drawW, drawH);
        }
        
        this.ctx.restore();
        
        // Retrieve pixels for processing
        const imageData = this.ctx.getImageData(0, 0, this.el.width, this.el.height);
        
        // Save unfiltered geometry-resolved base image for destructive/overlay tools (Healing)
        window.App.canvas.baseImageData = new ImageData(
            new Uint8ClampedArray(imageData.data), this.el.width, this.el.height
        );
        
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
