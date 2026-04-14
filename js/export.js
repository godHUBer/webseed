// js/export.js
window.App = window.App || {};

window.App.exportService = {
    init() {
        const bind = (id, handler) => {
            const btn = document.getElementById(id);
            if (btn) btn.addEventListener('click', handler);
        };

        bind('export-save', () => this.saveProject());
        bind('export-save-copy', () => this.saveCopy());
        bind('export-flatten', () => this.exportFlattened());
        bind('export-flatten-as', () => this.exportFlattenedAs());
        bind('export-share', () => this.shareFlattened());
    },

    ensureImageLoaded() {
        if (window.App.state.originalImage) return true;
        if (window.App.ui && window.App.ui.setWorkflowMessage) {
            window.App.ui.setWorkflowMessage('export-status', 'Open an image before using Export.', true);
        }
        return false;
    },

    getBaseFileName() {
        const rawName = window.App.state.originalFileName || 'edited-image';
        return rawName.replace(/\.[^/.]+$/u, '').replace(/[^\w\-]+/g, '_') || 'edited-image';
    },

    updateStatus(message, isError) {
        if (window.App.ui && window.App.ui.setWorkflowMessage) {
            window.App.ui.setWorkflowMessage('export-status', message, isError);
        }
    },

    downloadBlob(blob, fileName) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    },

    canvasToBlob(canvas, type, quality) {
        return new Promise((resolve, reject) => {
            canvas.toBlob((blob) => {
                if (blob) resolve(blob);
                else reject(new Error('Failed to encode image'));
            }, type, quality);
        });
    },

    getCropSourceBounds() {
        const img = window.App.state.originalImage;
        const geom = window.App.state.geometry;
        let sx = 0;
        let sy = 0;
        let sw = img.width;
        let sh = img.height;

        if (geom.crop) {
            let rotatedCrop = { ...geom.crop };
            const rotation = ((geom.rotate % 360) + 360) % 360;
            if (rotation === 90) rotatedCrop = { x: geom.crop.y, y: 1 - (geom.crop.x + geom.crop.w), w: geom.crop.h, h: geom.crop.w };
            if (rotation === 180) rotatedCrop = { x: 1 - (geom.crop.x + geom.crop.w), y: 1 - (geom.crop.y + geom.crop.h), w: geom.crop.w, h: geom.crop.h };
            if (rotation === 270) rotatedCrop = { x: 1 - (geom.crop.y + geom.crop.h), y: geom.crop.x, w: geom.crop.h, h: geom.crop.w };

            sx = img.width * rotatedCrop.x;
            sy = img.height * rotatedCrop.y;
            sw = img.width * rotatedCrop.w;
            sh = img.height * rotatedCrop.h;
        }

        return { sx, sy, sw, sh };
    },

    renderFullResolutionCanvas() {
        const img = window.App.state.originalImage;
        const geom = window.App.state.geometry;
        if (!img) return null;

        const { sx, sy, sw, sh } = this.getCropSourceBounds();
        const isRotatedOrthogonal = Math.abs(geom.rotate) % 180 === 90;
        const baseW = sw;
        const baseH = sh;
        const outputW = Math.max(1, Math.round(isRotatedOrthogonal ? baseH : baseW));
        const outputH = Math.max(1, Math.round(isRotatedOrthogonal ? baseW : baseH));

        const expCanvas = document.createElement('canvas');
        expCanvas.width = outputW;
        expCanvas.height = outputH;
        const ctx = expCanvas.getContext('2d');

        ctx.clearRect(0, 0, outputW, outputH);
        ctx.save();
        ctx.translate(outputW / 2, outputH / 2);

        let totalRotation = geom.rotate || 0;
        if (geom.straighten) totalRotation += geom.straighten;
        ctx.rotate((totalRotation * Math.PI) / 180);
        ctx.scale(geom.flipX ? -1 : 1, geom.flipY ? -1 : 1);

        const drawW = isRotatedOrthogonal ? outputH : outputW;
        const drawH = isRotatedOrthogonal ? outputW : outputH;
        const dx = -drawW / 2;
        const dy = -drawH / 2;

        if (geom.straighten && geom.straighten !== 0) {
            ctx.filter = 'blur(40px)';
            ctx.save(); ctx.scale(-1, 1); ctx.drawImage(img, sx, sy, sw, sh, -dx - drawW * 2, dy, drawW, drawH); ctx.restore();
            ctx.save(); ctx.scale(-1, 1); ctx.drawImage(img, sx, sy, sw, sh, -dx, dy, drawW, drawH); ctx.restore();
            ctx.save(); ctx.scale(1, -1); ctx.drawImage(img, sx, sy, sw, sh, dx, -dy - drawH * 2, drawW, drawH); ctx.restore();
            ctx.save(); ctx.scale(1, -1); ctx.drawImage(img, sx, sy, sw, sh, dx, -dy, drawW, drawH); ctx.restore();
            ctx.save(); ctx.scale(-1, -1); ctx.drawImage(img, sx, sy, sw, sh, -dx, -dy, drawW, drawH); ctx.restore();
            ctx.save(); ctx.scale(-1, -1); ctx.drawImage(img, sx, sy, sw, sh, -dx - drawW * 2, -dy, drawW, drawH); ctx.restore();
            ctx.save(); ctx.scale(-1, -1); ctx.drawImage(img, sx, sy, sw, sh, -dx, -dy - drawH * 2, drawW, drawH); ctx.restore();
            ctx.save(); ctx.scale(-1, -1); ctx.drawImage(img, sx, sy, sw, sh, -dx - drawW * 2, -dy - drawH * 2, drawW, drawH); ctx.restore();
            ctx.filter = 'none';
        }

        ctx.drawImage(img, sx, sy, sw, sh, dx, dy, drawW, drawH);
        ctx.restore();

        const imageData = ctx.getImageData(0, 0, outputW, outputH);
        window.App.canvas.baseImageData = new ImageData(
            new Uint8ClampedArray(imageData.data), outputW, outputH
        );

        if (window.App.filtersLogic.applyHealing) window.App.filtersLogic.applyHealing(imageData.data, outputW, outputH);
        if (window.App.filtersLogic.applyRaw) window.App.filtersLogic.applyRaw(imageData.data);
        if (window.App.filtersLogic.applyTune) window.App.filtersLogic.applyTune(imageData.data);
        if (window.App.filtersLogic.applySelective) window.App.filtersLogic.applySelective(imageData.data, outputW, outputH);
        if (window.App.filtersLogic.applyDetails) window.App.filtersLogic.applyDetails(imageData.data, outputW, outputH);
        if (window.App.filtersLogic.applyGlamourGlow) window.App.filtersLogic.applyGlamourGlow(imageData.data, outputW, outputH);
        if (window.App.filtersLogic.applyGrainyFilm) window.App.filtersLogic.applyGrainyFilm(imageData.data, outputW, outputH);
        if (window.App.filtersLogic.applyBlackAndWhite) window.App.filtersLogic.applyBlackAndWhite(imageData.data, outputW, outputH);
        if (window.App.filtersLogic.applyLensBlur) window.App.filtersLogic.applyLensBlur(imageData.data, outputW, outputH);
        if (window.App.filtersLogic.applyVignette) window.App.filtersLogic.applyVignette(imageData.data, outputW, outputH);
        if (window.App.filtersLogic.applyCurves) window.App.filtersLogic.applyCurves(imageData.data);
        if (window.App.filtersLogic.applyWhiteBalance) window.App.filtersLogic.applyWhiteBalance(imageData.data);
        if (window.App.filtersLogic.applyBrushMask) window.App.filtersLogic.applyBrushMask(imageData.data, outputW, outputH);
        if (window.App.filtersLogic.applyText) window.App.filtersLogic.applyText(imageData.data, outputW, outputH);

        ctx.putImageData(imageData, 0, 0);
        return expCanvas;
    },

    async exportFlattened(options) {
        if (!this.ensureImageLoaded()) return null;

        try {
            const canvas = this.renderFullResolutionCanvas();
            const blob = await this.canvasToBlob(canvas, 'image/jpeg', 0.92);
            if (!options || options.download !== false) {
                this.downloadBlob(blob, `${this.getBaseFileName()}_export.jpg`);
                this.updateStatus('Flattened JPG exported.', false);
            }
            return { canvas, blob, fileName: `${this.getBaseFileName()}_export.jpg` };
        } catch (err) {
            this.updateStatus('Export failed while creating the flattened image.', true);
            return null;
        }
    },

    saveProject() {
        if (!this.ensureImageLoaded()) return;

        const project = {
            version: 1,
            createdAt: new Date().toISOString(),
            originalFileName: window.App.state.originalFileName,
            originalImageDataUrl: window.App.state.originalImageDataUrl || window.App.state.originalImage.src,
            snapshot: window.App.getProjectSnapshot()
        };

        const blob = new Blob([JSON.stringify(project)], { type: 'application/json' });
        this.downloadBlob(blob, `${this.getBaseFileName()}_editable.json`);
        this.updateStatus('Editable project saved. Reopen it with "Open Image or Project".', false);
    },

    async saveCopy() {
        if (!this.ensureImageLoaded()) return;

        this.saveProject();
        await this.exportFlattened();
        this.updateStatus('Editable project and flattened JPG copy saved.', false);
    },

    async exportFlattenedAs() {
        if (!this.ensureImageLoaded()) return;

        try {
            const rendered = await this.exportFlattened({ download: false });
            if (!rendered) return;

            if (window.showSaveFilePicker) {
                const handle = await window.showSaveFilePicker({
                    suggestedName: rendered.fileName,
                    types: [{
                        description: 'JPEG image',
                        accept: { 'image/jpeg': ['.jpg', '.jpeg'] }
                    }]
                });
                const writable = await handle.createWritable();
                await writable.write(rendered.blob);
                await writable.close();
                this.updateStatus('Flattened JPG saved to your chosen location.', false);
                return;
            }

            this.downloadBlob(rendered.blob, rendered.fileName);
            this.updateStatus('Browser file picker is unavailable, so the JPG was downloaded instead.', false);
        } catch (err) {
            this.updateStatus('Export As was canceled or unavailable in this browser.', true);
        }
    },

    async shareFlattened() {
        if (!this.ensureImageLoaded()) return;

        try {
            const rendered = await this.exportFlattened({ download: false });
            if (!rendered) return;

            const shareFile = new File([rendered.blob], rendered.fileName, { type: 'image/jpeg' });
            if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [shareFile] }))) {
                await navigator.share({
                    title: this.getBaseFileName(),
                    text: 'Edited with Webseed',
                    files: [shareFile]
                });
                this.updateStatus('Share sheet opened with the flattened JPG.', false);
                return;
            }

            this.downloadBlob(rendered.blob, rendered.fileName);
            this.updateStatus('Sharing is unavailable here, so the JPG was downloaded instead.', false);
        } catch (err) {
            this.updateStatus('Share was canceled or is not supported in this browser.', true);
        }
    }
};
