// js/ui.js
window.App = window.App || {};

window.App.ui = {
    init() {
        this.hideCustomToolUI = (toolId) => {
            if (toolId === 'btn-lens-blur' && this.hideLensBlurUI) this.hideLensBlurUI();
            if (toolId === 'btn-vignette' && this.hideVignetteUI) this.hideVignetteUI();
            if (toolId === 'btn-text' && this.hideTextUI) this.hideTextUI();
        };
        this.ensurePopupDragHandle = (popup) => {
            if (!popup) return null;
            let handle = popup.querySelector('.popup-drag-handle');
            if (handle) return handle;

            handle = document.createElement('div');
            handle.className = 'popup-drag-handle';
            handle.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="8" r="1.5"/><circle cx="15" cy="8" r="1.5"/><circle cx="9" cy="16" r="1.5"/><circle cx="15" cy="16" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/></svg>';
            popup.prepend(handle);
            return handle;
        };
        this.enablePopupDragging = (popup) => {
            if (!popup || popup.dataset.dragInit === 'true') return;

            const handle = this.ensurePopupDragHandle(popup);
            if (!handle) return;

            let isDragging = false;
            let startX = 0;
            let startY = 0;
            let initialLeft = 0;
            let initialTop = 0;

            const getBoundsEl = () => popup.closest('.canvas-area') || popup.parentElement || document.body;
            const beginDrag = (clientX, clientY) => {
                const rect = popup.getBoundingClientRect();
                const boundsRect = getBoundsEl().getBoundingClientRect();

                isDragging = true;
                startX = clientX;
                startY = clientY;
                initialLeft = rect.left - boundsRect.left;
                initialTop = rect.top - boundsRect.top;

                popup.style.position = 'absolute';
                popup.style.transform = 'none';
                popup.style.right = 'auto';
                popup.style.bottom = 'auto';
                popup.style.width = `${rect.width}px`;
                popup.style.left = `${initialLeft}px`;
                popup.style.top = `${initialTop}px`;
            };

            const moveDrag = (clientX, clientY) => {
                if (!isDragging) return;
                const boundsRect = getBoundsEl().getBoundingClientRect();
                const width = popup.offsetWidth;
                const height = popup.offsetHeight;

                let nextLeft = initialLeft + (clientX - startX);
                let nextTop = initialTop + (clientY - startY);

                nextLeft = Math.max(0, Math.min(boundsRect.width - width, nextLeft));
                nextTop = Math.max(0, Math.min(boundsRect.height - height, nextTop));

                popup.style.left = `${nextLeft}px`;
                popup.style.top = `${nextTop}px`;
            };

            handle.addEventListener('mousedown', (e) => {
                beginDrag(e.clientX, e.clientY);
                e.preventDefault();
            });
            handle.addEventListener('touchstart', (e) => {
                if (!e.touches || e.touches.length !== 1) return;
                beginDrag(e.touches[0].clientX, e.touches[0].clientY);
                if (e.cancelable) e.preventDefault();
            }, { passive: false });

            document.addEventListener('mousemove', (e) => moveDrag(e.clientX, e.clientY));
            document.addEventListener('touchmove', (e) => {
                if (!isDragging || !e.touches || e.touches.length !== 1) return;
                moveDrag(e.touches[0].clientX, e.touches[0].clientY);
                if (e.cancelable) e.preventDefault();
            }, { passive: false });

            const stopDrag = () => { isDragging = false; };
            document.addEventListener('mouseup', stopDrag);
            document.addEventListener('touchend', stopDrag);
            document.addEventListener('touchcancel', stopDrag);

            popup.dataset.dragInit = 'true';
        };
        this.initGlobalToolbar();
        this.initSidebarTabs();
        this.initLooksUI();
        this.initThemeToggle();
        this.initUpload();
        this.initSliders();
        this.initToolToggles();
        this.initPopups();
        if (window.App.filtersLogic && window.App.filtersLogic.initCurvesUI) {
            window.App.filtersLogic.initCurvesUI();
        }
        this.initGlamourGlowUI();
        this.initGrainyFilmUI();
        this.initBWUI();
        this.initLensBlurUI();
        this.initVignetteUI();
        this.initTextUI();
    },

    initGlobalToolbar() {
        const undoBtn = document.getElementById('history-undo');
        const redoBtn = document.getElementById('history-redo');
        const layersBtn = document.getElementById('history-layers');
        const historyPanel = document.getElementById('history-panel');
        const historyClose = document.getElementById('history-close');
        const deleteSelectedBtn = document.getElementById('history-delete-selected');

        this.toggleHistoryPanel = (show) => {
            if (!historyPanel) return;
            const shouldShow = typeof show === 'boolean' ? show : historyPanel.style.display === 'none';
            historyPanel.style.display = shouldShow ? 'flex' : 'none';
            if (layersBtn) layersBtn.classList.toggle('active', shouldShow);
        };

        if (undoBtn) {
            undoBtn.addEventListener('click', () => {
                if (window.App.toolManager && window.App.toolManager.activeToolId) {
                    window.App.toolManager.cancelTool();
                }
                if (window.App.historyManager) {
                    window.App.historyManager.undo();
                }
            });
        }

        if (redoBtn) {
            redoBtn.addEventListener('click', () => {
                if (window.App.toolManager && window.App.toolManager.activeToolId) {
                    window.App.toolManager.cancelTool();
                }
                if (window.App.historyManager) {
                    window.App.historyManager.redo();
                }
            });
        }

        if (layersBtn) {
            layersBtn.addEventListener('click', () => {
                this.toggleHistoryPanel();
                this.renderHistoryPanel();
            });
        }

        if (historyClose) {
            historyClose.addEventListener('click', () => this.toggleHistoryPanel(false));
        }

        if (deleteSelectedBtn) {
            deleteSelectedBtn.addEventListener('click', () => {
                if (window.App.toolManager && window.App.toolManager.activeToolId) {
                    window.App.toolManager.cancelTool();
                }
                if (window.App.historyManager && window.App.historyManager.selectedEntryId) {
                    window.App.historyManager.deleteEntry(window.App.historyManager.selectedEntryId);
                }
            });
        }

        this.renderHistoryPanel = () => {
            const list = document.getElementById('history-list');
            const subtitle = document.getElementById('history-panel-subtitle');
            const manager = window.App.historyManager;
            if (!list || !manager) return;

            if (subtitle) {
                subtitle.textContent = manager.entries.length
                    ? `${manager.cursor} of ${manager.entries.length} edits currently applied.`
                    : 'Every successful edit is saved here.';
            }

            if (!manager.entries.length) {
                list.innerHTML = `
                    <div class="history-entry base current">
                        <div class="history-entry-main">
                            <span class="history-entry-title">Original</span>
                            <span class="history-entry-meta">Load an image and commit tools to build the stack.</span>
                        </div>
                    </div>
                `;
            } else {
                list.innerHTML = manager.entries.slice().reverse().map((entry, reverseIndex) => {
                    const actualIndex = manager.entries.length - 1 - reverseIndex;
                    const isApplied = actualIndex < manager.cursor;
                    const isSelected = manager.selectedEntryId === entry.id;
                    return `
                        <div class="history-entry${isApplied ? ' current' : ' pending'}${isSelected ? ' selected' : ''}" data-history-entry="${entry.id}">
                            <button class="history-entry-select" data-history-select="${entry.id}">
                                <span class="history-entry-title">${entry.label}</span>
                                <span class="history-entry-meta">${isApplied ? 'Applied' : 'Waiting in redo stack'}</span>
                            </button>
                            <button class="history-entry-delete" data-history-delete="${entry.id}" title="Delete Edit">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M8 6V4h8v2"></path><path d="M19 6l-1 14H6L5 6"></path></svg>
                            </button>
                        </div>
                    `;
                }).join('');
            }

            list.querySelectorAll('[data-history-select]').forEach((button) => {
                button.addEventListener('click', () => {
                    if (window.App.historyManager) {
                        window.App.historyManager.selectEntry(button.getAttribute('data-history-select'));
                    }
                });
            });

            list.querySelectorAll('[data-history-delete]').forEach((button) => {
                button.addEventListener('click', () => {
                    if (window.App.toolManager && window.App.toolManager.activeToolId) {
                        window.App.toolManager.cancelTool();
                    }
                    if (window.App.historyManager) {
                        window.App.historyManager.deleteEntry(button.getAttribute('data-history-delete'));
                    }
                });
            });

            const setDisabled = (btn, disabled) => {
                if (!btn) return;
                btn.disabled = disabled;
                btn.classList.toggle('disabled', disabled);
            };

            setDisabled(undoBtn, manager.cursor === 0);
            setDisabled(redoBtn, manager.cursor >= manager.entries.length);
            setDisabled(deleteSelectedBtn, !manager.selectedEntryId);
        };

        this.renderHistoryPanel();
    },

    initSidebarTabs() {
        const tabs = document.querySelectorAll('.tab-btn[data-tab]');
        if (!tabs.length) return;

        this.setActiveSidebarTab = (tabId) => {
            tabs.forEach((tabBtn) => {
                tabBtn.classList.toggle('active', tabBtn.getAttribute('data-tab') === tabId);
            });

            document.querySelectorAll('.sidebar-content[data-tab-panel]').forEach((panel) => {
                panel.style.display = panel.getAttribute('data-tab-panel') === tabId ? 'block' : 'none';
            });
        };

        tabs.forEach((tabBtn) => {
            tabBtn.addEventListener('click', () => {
                this.setActiveSidebarTab(tabBtn.getAttribute('data-tab'));
            });
        });

        this.setActiveSidebarTab('tools');
    },

    setWorkflowMessage(targetId, message, isError) {
        const el = document.getElementById(targetId);
        if (!el) return;

        el.textContent = message;
        el.classList.toggle('error', !!isError);
    },

    initLooksUI() {
        const defaultGrid = document.getElementById('looks-default-grid');
        const customList = document.getElementById('looks-custom-list');
        const saveBtn = document.getElementById('looks-save-current');
        const copyBtn = document.getElementById('looks-copy-code');
        const loadBtn = document.getElementById('looks-load-code');
        if (!defaultGrid || !customList) return;

        const customLooksKey = 'webseed.customLooks';
        const legacyCustomLooksKey = 'snapseed.customLooks';
        const defaultLooks = [
            {
                id: 'portrait',
                name: 'Portrait',
                description: 'Softens skin and lifts warmth for flattering portraits.',
                preview: 'linear-gradient(135deg, #5c3b2a 0%, #d9a07b 48%, #f4e2cf 100%)',
                snapshot: {
                    filters: {
                        brightness: 6,
                        contrast: 8,
                        saturation: -4,
                        warmth: 10,
                        ambiance: 12,
                        structure: -18,
                        sharpen: -12,
                        glamourGlow: 26,
                        glamourSaturation: 6,
                        glamourWarmth: 18
                    },
                    vignette: {
                        enabled: true,
                        innerBrightness: 8,
                        outerBrightness: -18
                    }
                }
            },
            {
                id: 'smooth',
                name: 'Smooth',
                description: 'Calms contrast and texture for a gentle clean finish.',
                preview: 'linear-gradient(135deg, #26384d 0%, #8ab1c8 45%, #e3edf2 100%)',
                snapshot: {
                    filters: {
                        brightness: 4,
                        contrast: -6,
                        saturation: -10,
                        ambiance: 8,
                        structure: -28,
                        sharpen: -20,
                        glamourGlow: 34,
                        glamourSaturation: -4,
                        glamourWarmth: 6
                    }
                }
            },
            {
                id: 'pop',
                name: 'Pop',
                description: 'Adds crisp contrast, punchy color, and a lively finish.',
                preview: 'linear-gradient(135deg, #09203f 0%, #1b6ca8 40%, #fdbb2d 100%)',
                snapshot: {
                    filters: {
                        brightness: 4,
                        contrast: 24,
                        saturation: 24,
                        ambiance: 28,
                        highlights: -12,
                        shadows: 10,
                        structure: 16,
                        sharpen: 14,
                        grainyFilmEnabled: true,
                        grainyFilmGrain: 12,
                        grainyFilmStyleId: 'F2',
                        grainyFilmStyleStrength: 24
                    }
                }
            },
            {
                id: 'accentuate',
                name: 'Accentuate',
                description: 'Boosts detail and dynamic range without going too far.',
                preview: 'linear-gradient(135deg, #1f4037 0%, #4d7c5d 48%, #c9d6a3 100%)',
                snapshot: {
                    filters: {
                        brightness: 2,
                        contrast: 16,
                        saturation: 10,
                        ambiance: 36,
                        highlights: -18,
                        shadows: 20,
                        structure: 12,
                        sharpen: 10,
                        warmth: 4
                    },
                    vignette: {
                        enabled: true,
                        innerBrightness: 4,
                        outerBrightness: -10
                    }
                }
            }
        ];

        this.getStoredLooks = () => {
            try {
                const raw = window.localStorage.getItem(customLooksKey) || window.localStorage.getItem(legacyCustomLooksKey);
                const parsed = raw ? JSON.parse(raw) : [];
                return Array.isArray(parsed) ? parsed : [];
            } catch (err) {
                return [];
            }
        };

        this.saveStoredLooks = (looks) => {
            window.localStorage.setItem(customLooksKey, JSON.stringify(looks));
            window.localStorage.removeItem(legacyCustomLooksKey);
        };

        const applyLook = (look) => {
            if (!window.App.state.originalImage) {
                this.setWorkflowMessage('looks-status', 'Open an image before applying a look.', true);
                return;
            }

            if (window.App.toolManager && window.App.toolManager.activeToolId) {
                window.App.toolManager.cancelTool();
            }

            const beforeSnapshot = window.App.getRuntimeSnapshot();
            window.App.applyLookSnapshot(look.snapshot);
            if (window.App.canvas) {
                window.App.canvas.fitToContainer();
                window.App.canvas.scheduleRender();
            }

            if (window.App.historyManager) {
                window.App.historyManager.recordEdit({
                    toolId: 'looks',
                    label: `Look: ${look.name}`,
                    beforeSnapshot,
                    afterSnapshot: window.App.getRuntimeSnapshot()
                });
            }

            this.activeLookId = look.id;
            this.renderLooksUI();
            this.setWorkflowMessage('looks-status', `${look.name} applied. You can fine-tune it in Tools.`, false);
        };

        this.renderLooksUI = () => {
            const storedLooks = this.getStoredLooks();
            defaultGrid.innerHTML = defaultLooks.map((look) => `
                <button class="look-card${this.activeLookId === look.id ? ' active' : ''}" data-look-id="${look.id}">
                    <span class="look-card-preview" style="background:${look.preview};"></span>
                    <span class="look-card-title">${look.name}</span>
                    <span class="look-card-description">${look.description}</span>
                </button>
            `).join('');

            customList.innerHTML = storedLooks.length ? storedLooks.map((look) => `
                <div class="look-card${this.activeLookId === look.id ? ' active' : ''}" data-custom-look-id="${look.id}">
                    <span class="look-card-title">${look.name}</span>
                    <span class="look-card-description">${look.description || 'Saved from your current adjustments.'}</span>
                    <div class="look-card-actions">
                        <button class="look-card-apply" data-apply-custom="${look.id}">Apply</button>
                        <button class="look-card-delete" data-delete-custom="${look.id}">Delete</button>
                    </div>
                </div>
            `).join('') : `<div class="empty-state">No custom looks yet. Save your current grade to reuse it later.</div>`;

            defaultGrid.querySelectorAll('[data-look-id]').forEach((button) => {
                button.addEventListener('click', () => {
                    const look = defaultLooks.find((entry) => entry.id === button.getAttribute('data-look-id'));
                    if (look) applyLook(look);
                });
            });

            customList.querySelectorAll('[data-apply-custom]').forEach((button) => {
                button.addEventListener('click', () => {
                    const storedLook = storedLooks.find((entry) => entry.id === button.getAttribute('data-apply-custom'));
                    if (storedLook) applyLook(storedLook);
                });
            });

            customList.querySelectorAll('[data-delete-custom]').forEach((button) => {
                button.addEventListener('click', () => {
                    const nextLooks = storedLooks.filter((entry) => entry.id !== button.getAttribute('data-delete-custom'));
                    this.saveStoredLooks(nextLooks);
                    this.renderLooksUI();
                    this.setWorkflowMessage('looks-status', 'Custom look removed.', false);
                });
            });
        };

        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                if (!window.App.state.originalImage) {
                    this.setWorkflowMessage('looks-status', 'Open an image before saving a custom look.', true);
                    return;
                }

                const name = window.prompt('Name this custom look:', `Look ${this.getStoredLooks().length + 1}`);
                if (!name) return;

                const storedLooks = this.getStoredLooks();
                const look = {
                    id: `custom-${Date.now()}`,
                    name: name.trim(),
                    description: 'Saved from your current adjustments.',
                    preview: 'linear-gradient(135deg, #232526 0%, #414345 100%)',
                    snapshot: window.App.getLookSnapshot()
                };

                storedLooks.unshift(look);
                this.saveStoredLooks(storedLooks);
                this.activeLookId = look.id;
                this.renderLooksUI();
                this.setWorkflowMessage('looks-status', `"${look.name}" saved to Custom Looks.`, false);
            });
        }

        if (copyBtn) {
            copyBtn.addEventListener('click', async () => {
                if (!window.App.state.originalImage) {
                    this.setWorkflowMessage('looks-status', 'Open an image before creating a look code.', true);
                    return;
                }

                const code = btoa(unescape(encodeURIComponent(JSON.stringify(window.App.getLookSnapshot()))));
                try {
                    if (navigator.clipboard && navigator.clipboard.writeText) {
                        await navigator.clipboard.writeText(code);
                        this.setWorkflowMessage('looks-status', 'Look code copied to the clipboard.', false);
                    } else {
                        window.prompt('Copy this look code:', code);
                    }
                } catch (err) {
                    window.prompt('Copy this look code:', code);
                    this.setWorkflowMessage('looks-status', 'Look code generated. Copy it from the prompt.', false);
                }
            });
        }

        if (loadBtn) {
            loadBtn.addEventListener('click', () => {
                const code = window.prompt('Paste a look code:');
                if (!code) return;

                try {
                    const snapshot = JSON.parse(decodeURIComponent(escape(atob(code.trim()))));
                    applyLook({
                        id: `imported-${Date.now()}`,
                        name: 'Imported Look',
                        snapshot
                    });
                } catch (err) {
                    this.setWorkflowMessage('looks-status', 'That look code could not be read.', true);
                }
            });
        }

        this.renderLooksUI();
    },

    initLensBlurUI() {
        const overlay = document.getElementById('lens-blur-ui-overlay');
        const lbCanvas = document.getElementById('lens-blur-interactive-canvas');
        const maskToggleBtn = document.getElementById('lb-toggle-mask');
        const manualBtn = document.getElementById('lb-manual');
        const paramPopup = document.getElementById('lens-blur-popup');
        const bokehBtn = document.getElementById('lb-toggle-bokeh');
        const bokehPopup = document.getElementById('bokeh-shape-popup');
        const btnLB = document.getElementById('btn-lens-blur');
        const lbCancel = document.getElementById('lb-cancel');
        const lbApply = document.getElementById('lb-apply');
        const hint = document.getElementById('lens-blur-hint');
        let dragMode = null;

        const ensureLensBlurState = () => {
            if (window.App.normalizeLensBlurState) {
                return window.App.normalizeLensBlurState();
            }
            return window.App.state.lensBlur;
        };

        const syncOverlayCanvas = () => {
            const editorCanvas = window.App.canvas && window.App.canvas.el;
            if (!overlay || !lbCanvas || !editorCanvas) return false;

            const canvasRect = editorCanvas.getBoundingClientRect();
            const overlayRect = overlay.getBoundingClientRect();
            if (canvasRect.width < 1 || canvasRect.height < 1) return false;

            lbCanvas.width = Math.max(1, Math.round(canvasRect.width));
            lbCanvas.height = Math.max(1, Math.round(canvasRect.height));
            lbCanvas.style.position = 'absolute';
            lbCanvas.style.left = `${canvasRect.left - overlayRect.left}px`;
            lbCanvas.style.top = `${canvasRect.top - overlayRect.top}px`;
            lbCanvas.style.width = `${canvasRect.width}px`;
            lbCanvas.style.height = `${canvasRect.height}px`;
            return true;
        };

        const getMinDimension = () => Math.min(lbCanvas.width || 1, lbCanvas.height || 1);
        const getFeatherPadding = () => {
            const lbState = ensureLensBlurState();
            return (0.05 + ((lbState.transition / 100) * 0.28)) * getMinDimension();
        };
        const getFocusRadii = () => {
            const lbState = ensureLensBlurState();
            const minDimension = getMinDimension();
            return {
                x: lbState.anchor.focusScaleX * minDimension,
                y: lbState.anchor.focusScaleY * minDimension
            };
        };
        const getOuterRadii = () => {
            const focus = getFocusRadii();
            const feather = getFeatherPadding();
            return {
                x: focus.x + feather,
                y: focus.y + feather
            };
        };
        const getCenterPoint = () => {
            const lbState = ensureLensBlurState();
            return {
                x: lbState.anchor.x * lbCanvas.width,
                y: lbState.anchor.y * lbCanvas.height
            };
        };
        const getPointer = (e) => {
            if (!syncOverlayCanvas()) return null;
            const rect = lbCanvas.getBoundingClientRect();
            return {
                x: (e.clientX || (e.touches && e.touches[0] && e.touches[0].clientX) || 0) - rect.left,
                y: (e.clientY || (e.touches && e.touches[0] && e.touches[0].clientY) || 0) - rect.top
            };
        };
        const getHandlePositions = () => {
            const center = getCenterPoint();
            const focus = getFocusRadii();
            return {
                center,
                resizeXPositive: { x: center.x + focus.x, y: center.y },
                resizeXNegative: { x: center.x - focus.x, y: center.y },
                resizeYPositive: { x: center.x, y: center.y - focus.y },
                resizeYNegative: { x: center.x, y: center.y + focus.y }
            };
        };
        const getHoverMode = (point) => {
            const handles = getHandlePositions();
            const distanceTo = (handle) => Math.hypot(point.x - handle.x, point.y - handle.y);

            if (distanceTo(handles.resizeXPositive) < 14 || distanceTo(handles.resizeXNegative) < 14) return 'resizeX';
            if (distanceTo(handles.resizeYPositive) < 14 || distanceTo(handles.resizeYNegative) < 14) return 'resizeY';
            if (distanceTo(handles.center) < 14) return 'move';

            const focus = getFocusRadii();
            const normX = (point.x - handles.center.x) / Math.max(1, focus.x);
            const normY = (point.y - handles.center.y) / Math.max(1, focus.y);
            if ((normX * normX) + (normY * normY) <= 1.1) return 'move';
            return null;
        };
        const updateCursor = (point) => {
            if (!lbCanvas) return;
            const mode = dragMode || (point && getHoverMode(point));
            lbCanvas.style.cursor =
                mode === 'resizeX' ? 'ew-resize' :
                mode === 'resizeY' ? 'ns-resize' :
                mode === 'move' ? 'grab' :
                'crosshair';
        };

        const shapeBtns = document.querySelectorAll('.lb-shape-btn');
        shapeBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                shapeBtns.forEach(b => {
                    b.style.borderColor = 'transparent';
                    b.style.color = '#777';
                });
                btn.style.borderColor = '#4285F4';
                btn.style.color = '#4285F4';
                window.App.state.lensBlur.bokehShape = parseInt(btn.getAttribute('data-shape'));
                window.App.canvas.scheduleRender();
            });
        });

        if (manualBtn) {
            manualBtn.title = 'Reset Oval';
            manualBtn.addEventListener('click', () => {
                const lbState = ensureLensBlurState();
                lbState.anchor.x = 0.5;
                lbState.anchor.y = 0.5;
                lbState.anchor.focusScaleX = 0.24;
                lbState.anchor.focusScaleY = 0.24;
                lbState.transition = 50;
                lbState.maskMode = 'elliptical';
                if (paramPopup) paramPopup.style.display = 'none';
                if (bokehPopup) bokehPopup.style.display = 'none';
                this.drawLensBlurOverlay();
                window.App.canvas.scheduleRender();
            });
        }
        if (bokehBtn && bokehPopup) {
            bokehBtn.addEventListener('click', () => {
                bokehPopup.style.display = bokehPopup.style.display === 'none' ? 'block' : 'none';
                if (paramPopup) paramPopup.style.display = 'none';
            });
        }

        if (maskToggleBtn) {
            maskToggleBtn.title = 'Make Circle';
            maskToggleBtn.addEventListener('click', () => {
                const lbState = ensureLensBlurState();
                const averageRadius = (lbState.anchor.focusScaleX + lbState.anchor.focusScaleY) / 2;
                lbState.anchor.focusScaleX = averageRadius;
                lbState.anchor.focusScaleY = averageRadius;
                this.drawLensBlurOverlay();
                window.App.canvas.scheduleRender();
            });
        }

        if (btnLB) {
            btnLB.addEventListener('click', () => {
                ensureLensBlurState();
                overlay.style.display = 'block';
                if (paramPopup) paramPopup.style.display = 'none';
                setTimeout(() => {
                    syncOverlayCanvas();
                    this.drawLensBlurOverlay();
                }, 50);
            });
        }
        
        const hideOverlay = () => {
            overlay.style.display = 'none';
            dragMode = null;
            if (paramPopup) paramPopup.style.display = 'none';
            if (bokehPopup) bokehPopup.style.display = 'none';
        };
        this.hideLensBlurUI = hideOverlay;
        if (lbCancel) lbCancel.addEventListener('click', hideOverlay);
        if (lbApply) lbApply.addEventListener('click', hideOverlay);

        this.drawLensBlurOverlay = () => {
            if (!lbCanvas || !overlay || overlay.style.display === 'none') return;
            if (!syncOverlayCanvas()) return;
            const ctx = lbCanvas.getContext('2d');
            ctx.clearRect(0, 0, lbCanvas.width, lbCanvas.height);
            
            const center = getCenterPoint();
            const focus = getFocusRadii();
            const outer = getOuterRadii();

            ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.ellipse(center.x, center.y, focus.x, focus.y, 0, 0, Math.PI * 2);
            ctx.stroke();

            ctx.setLineDash([8, 6]);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
            ctx.beginPath();
            ctx.ellipse(center.x, center.y, outer.x, outer.y, 0, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);

            const drawHandle = (x, y) => {
                ctx.beginPath();
                ctx.arc(x, y, 7, 0, Math.PI * 2);
                ctx.fillStyle = '#4285F4';
                ctx.fill();
                ctx.lineWidth = 2;
                ctx.strokeStyle = '#ffffff';
                ctx.stroke();
            };

            drawHandle(center.x, center.y);
            drawHandle(center.x + focus.x, center.y);
            drawHandle(center.x - focus.x, center.y);
            drawHandle(center.x, center.y - focus.y);
            drawHandle(center.x, center.y + focus.y);

            if (hint) {
                hint.textContent = 'Drag the oval to move it. Drag side or top handles to shape it. Wheel changes bokeh, Shift+wheel changes softness.';
            }
        };

        const onDown = (e) => {
            if (window.App.toolManager.activeToolId !== 'btn-lens-blur') return;
            const point = getPointer(e);
            if (!point) return;
            dragMode = getHoverMode(point);
            updateCursor(point);
            if (dragMode && e.cancelable) e.preventDefault();
        };

        const onMove = (e) => {
            if (window.App.toolManager.activeToolId !== 'btn-lens-blur') return;
            const point = getPointer(e);
            if (!point) return;

            if (!dragMode) {
                updateCursor(point);
                return;
            }

            if (e.cancelable) e.preventDefault();
            const lbState = ensureLensBlurState();
            const center = getCenterPoint();
            const minDimension = getMinDimension();

            if (dragMode === 'move') {
                lbState.anchor.x = Math.max(0, Math.min(1, point.x / lbCanvas.width));
                lbState.anchor.y = Math.max(0, Math.min(1, point.y / lbCanvas.height));
            } else if (dragMode === 'resizeX') {
                lbState.anchor.focusScaleX = Math.max(0.08, Math.min(0.45, Math.abs(point.x - center.x) / minDimension));
            } else if (dragMode === 'resizeY') {
                lbState.anchor.focusScaleY = Math.max(0.08, Math.min(0.45, Math.abs(point.y - center.y) / minDimension));
            }

            this.drawLensBlurOverlay();
            window.App.canvas.scheduleRender();
        };

        const onUp = () => {
            dragMode = null;
            if (lbCanvas) lbCanvas.style.cursor = 'crosshair';
        };

        if (lbCanvas) {
            lbCanvas.addEventListener('mousedown', onDown);
            lbCanvas.addEventListener('touchstart', onDown, {passive: false});
            lbCanvas.addEventListener('wheel', (e) => {
                if (window.App.toolManager.activeToolId !== 'btn-lens-blur') return;
                if (e.cancelable) e.preventDefault();

                const lbState = ensureLensBlurState();
                const delta = e.deltaY < 0 ? 2 : -2;
                if (e.shiftKey) {
                    lbState.transition = Math.max(0, Math.min(100, lbState.transition + delta));
                } else {
                    lbState.blurStrength = Math.max(0, Math.min(100, lbState.blurStrength + delta));
                }

                this.drawLensBlurOverlay();
                window.App.canvas.scheduleRender();
            }, {passive: false});
        }
        document.addEventListener('mousemove', onMove);
        document.addEventListener('touchmove', onMove, {passive: false});
        document.addEventListener('mouseup', onUp);
        document.addEventListener('touchend', onUp);
        window.addEventListener('resize', () => {
            if (window.App.toolManager.activeToolId === 'btn-lens-blur') {
                this.drawLensBlurOverlay();
            }
        });
    },

    initVignetteUI() {
        const overlay = document.getElementById('vignette-ui-overlay');
        const vigCanvas = document.getElementById('vignette-interactive-canvas');
        const hint = document.getElementById('vignette-hint');
        const paramPopup = document.getElementById('vignette-popup');
        const manualBtn = document.getElementById('vig-manual');
        const btnVig = document.getElementById('btn-vignette');
        const vigCancel = document.getElementById('vig-cancel');
        const vigApply = document.getElementById('vig-apply');
        let dragMode = null;
        let pinchStartDistance = 0;
        let pinchStartRadius = 0;

        const ensureVignetteState = () => {
            if (window.App.normalizeVignetteState) {
                return window.App.normalizeVignetteState();
            }
            return window.App.state.vignette;
        };

        const syncOverlayCanvas = () => {
            const editorCanvas = window.App.canvas && window.App.canvas.el;
            if (!overlay || !vigCanvas || !editorCanvas) return false;

            const canvasRect = editorCanvas.getBoundingClientRect();
            const overlayRect = overlay.getBoundingClientRect();
            if (canvasRect.width < 1 || canvasRect.height < 1) return false;

            vigCanvas.width = Math.max(1, Math.round(canvasRect.width));
            vigCanvas.height = Math.max(1, Math.round(canvasRect.height));
            vigCanvas.style.position = 'absolute';
            vigCanvas.style.left = `${canvasRect.left - overlayRect.left}px`;
            vigCanvas.style.top = `${canvasRect.top - overlayRect.top}px`;
            vigCanvas.style.width = `${canvasRect.width}px`;
            vigCanvas.style.height = `${canvasRect.height}px`;
            return true;
        };

        const getPointer = (e) => {
            if (!syncOverlayCanvas()) return null;
            const rect = vigCanvas.getBoundingClientRect();
            return {
                x: (e.clientX || (e.touches && e.touches[0] && e.touches[0].clientX) || 0) - rect.left,
                y: (e.clientY || (e.touches && e.touches[0] && e.touches[0].clientY) || 0) - rect.top
            };
        };

        const getCenter = () => {
            const state = ensureVignetteState();
            return {
                x: state.anchor.x * vigCanvas.width,
                y: state.anchor.y * vigCanvas.height
            };
        };

        const getRadiusPx = () => {
            const state = ensureVignetteState();
            return state.anchor.radius * Math.max(vigCanvas.width, vigCanvas.height);
        };

        const getHoverMode = (point) => {
            const center = getCenter();
            const radius = getRadiusPx();
            const dist = Math.hypot(point.x - center.x, point.y - center.y);

            if (dist < 14) return 'move';
            if (Math.abs(dist - radius) < 14) return 'resize';
            if (dist < radius) return 'move';
            return null;
        };

        const updateCursor = (point) => {
            const mode = dragMode || (point && getHoverMode(point));
            vigCanvas.style.cursor =
                mode === 'resize' ? 'ew-resize' :
                mode === 'move' ? 'grab' :
                'crosshair';
        };

        if (manualBtn && paramPopup) {
            manualBtn.addEventListener('click', () => {
                paramPopup.style.display = paramPopup.style.display === 'none' ? 'block' : 'none';
            });
        }

        if (btnVig) {
            btnVig.addEventListener('click', () => {
                overlay.style.display = 'block';
                ensureVignetteState();
                setTimeout(() => {
                    syncOverlayCanvas();
                    this.drawVignetteOverlay();
                }, 50);
            });
        }

        const hideOverlay = () => {
            overlay.style.display = 'none';
            if (paramPopup) paramPopup.style.display = 'none';
        };
        this.hideVignetteUI = hideOverlay;

        if (vigCancel) vigCancel.addEventListener('click', hideOverlay);
        if (vigApply) vigApply.addEventListener('click', hideOverlay);

        this.drawVignetteOverlay = () => {
            if (!vigCanvas || !overlay || overlay.style.display === 'none') return;
            if (!syncOverlayCanvas()) return;

            const ctx = vigCanvas.getContext('2d');
            ctx.clearRect(0, 0, vigCanvas.width, vigCanvas.height);

            const state = ensureVignetteState();
            const cx = state.anchor.x * vigCanvas.width;
            const cy = state.anchor.y * vigCanvas.height;
            const r = state.anchor.radius * Math.max(vigCanvas.width, vigCanvas.height);
            const feather = Math.max(18, r * 0.45);

            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.setLineDash([8, 6]);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.setLineDash([]);

            ctx.beginPath();
            ctx.arc(cx, cy, r + feather, 0, Math.PI * 2);
            ctx.setLineDash([6, 6]);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.setLineDash([]);

            ctx.beginPath();
            ctx.arc(cx, cy, 4, 0, Math.PI * 2);
            ctx.fillStyle = '#4285F4';
            ctx.fill();

            ctx.beginPath();
            ctx.arc(cx + r, cy, 7, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff';
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = '#4285F4';
            ctx.stroke();

            if (hint) {
                hint.textContent = 'Wheel changes vignette intensity. Shift+wheel changes size. Alt+wheel changes inner brightness.';
            }
        };

        const getPinchDistance = (touches) => {
            const dx = touches[0].clientX - touches[1].clientX;
            const dy = touches[0].clientY - touches[1].clientY;
            return Math.sqrt(dx * dx + dy * dy);
        };

        const onDown = (e) => {
            if (window.App.toolManager.activeToolId !== 'btn-vignette') return;
            if (e.touches && e.touches.length === 2) {
                pinchStartDistance = getPinchDistance(e.touches);
                pinchStartRadius = ensureVignetteState().anchor.radius;
                dragMode = 'pinch';
                return;
            }

            const point = getPointer(e);
            if (!point) return;
            dragMode = getHoverMode(point);
            updateCursor(point);
            if (dragMode && e.cancelable) e.preventDefault();
        };

        const onMove = (e) => {
            if (window.App.toolManager.activeToolId !== 'btn-vignette') return;

            if (dragMode === 'pinch' && e.touches && e.touches.length === 2) {
                if (e.cancelable) e.preventDefault();
                const dist = getPinchDistance(e.touches);
                const scale = dist / Math.max(1, pinchStartDistance);
                const state = ensureVignetteState();
                state.anchor.radius = Math.max(0.08, Math.min(1.2, pinchStartRadius * scale));
                this.drawVignetteOverlay();
                window.App.canvas.scheduleRender();
                return;
            }

            const point = getPointer(e);
            if (!point) return;

            if (!dragMode) {
                updateCursor(point);
                return;
            }

            const state = ensureVignetteState();
            if (dragMode === 'move') {
                if (e.cancelable) e.preventDefault();
                state.anchor.x = Math.max(0, Math.min(1, point.x / vigCanvas.width));
                state.anchor.y = Math.max(0, Math.min(1, point.y / vigCanvas.height));
            } else if (dragMode === 'resize') {
                if (e.cancelable) e.preventDefault();
                const center = getCenter();
                const radiusPx = Math.hypot(point.x - center.x, point.y - center.y);
                state.anchor.radius = Math.max(0.08, Math.min(1.2, radiusPx / Math.max(vigCanvas.width, vigCanvas.height)));
            }

            this.drawVignetteOverlay();
            window.App.canvas.scheduleRender();
        };

        const onUp = (e) => {
            if (e.touches && e.touches.length > 0) return;
            dragMode = null;
            if (vigCanvas) vigCanvas.style.cursor = 'crosshair';
        };

        if (vigCanvas) {
            vigCanvas.addEventListener('mousedown', onDown);
            vigCanvas.addEventListener('touchstart', onDown, {passive: false});
            vigCanvas.addEventListener('wheel', (e) => {
                if (window.App.toolManager.activeToolId !== 'btn-vignette') return;
                if (e.cancelable) e.preventDefault();

                const state = ensureVignetteState();
                const direction = e.deltaY < 0 ? 1 : -1;
                if (e.shiftKey) {
                    state.anchor.radius = Math.max(0.08, Math.min(1.2, state.anchor.radius + (direction * 0.02)));
                } else if (e.altKey) {
                    state.innerBrightness = Math.max(-100, Math.min(100, state.innerBrightness + (direction * 2)));
                } else {
                    const sign = state.outerBrightness < 0 ? -1 : state.outerBrightness > 0 ? 1 : -1;
                    const magnitude = Math.max(0, Math.min(100, Math.abs(state.outerBrightness) + (direction * 2)));
                    state.outerBrightness = sign * magnitude;
                }
                this.drawVignetteOverlay();
                window.App.canvas.scheduleRender();
            }, {passive: false});
        }
        document.addEventListener('mousemove', onMove);
        document.addEventListener('touchmove', onMove, {passive: false});
        document.addEventListener('mouseup', onUp);
        document.addEventListener('touchend', onUp);

        window.addEventListener('resize', () => {
            if (window.App.toolManager.activeToolId === 'btn-vignette') {
                this.drawVignetteOverlay();
            }
        });
    },

    initTextUI() {
        const overlay = document.getElementById('text-interactive-canvas');
        const btnText = document.getElementById('btn-text');
        const txtCancel = document.getElementById('txt-cancel');
        const txtApply = document.getElementById('txt-apply');
        const bottomBar = document.getElementById('text-bottom-bar');
        const editInput = document.getElementById('text-edit-input');
        const customFontInput = document.getElementById('txt-custom-font');
        
        let isDragging = false;
        let isRotating = false;

        const syncTextOverlay = () => {
            const editorCanvas = window.App.canvas && window.App.canvas.el;
            if (!overlay || !editorCanvas) return false;

            const rect = editorCanvas.getBoundingClientRect();
            if (rect.width < 1 || rect.height < 1) return false;

            overlay.width = Math.max(1, Math.round(rect.width));
            overlay.height = Math.max(1, Math.round(rect.height));
            overlay.style.width = `${rect.width}px`;
            overlay.style.height = `${rect.height}px`;
            overlay.style.left = `${editorCanvas.offsetLeft}px`;
            overlay.style.top = `${editorCanvas.offsetTop}px`;
            return true;
        };

        const getPointer = (e) => {
            if (!syncTextOverlay()) return null;
            const rect = overlay.getBoundingClientRect();
            return {
                x: (e.clientX || (e.touches && e.touches[0] && e.touches[0].clientX) || 0) - rect.left,
                y: (e.clientY || (e.touches && e.touches[0] && e.touches[0].clientY) || 0) - rect.top
            };
        };
        
        if (btnText) {
            btnText.addEventListener('click', () => {
                syncTextOverlay();
                overlay.style.display = 'block';
                bottomBar.style.display = 'flex';
                window.App.state.text.enabled = true;
                if (customFontInput) {
                    customFontInput.value = window.App.state.text.customFontFamily || '';
                }
                window.App.canvas.scheduleRender();
            });
        }
        
        const closeText = () => {
            overlay.style.display = 'none';
            bottomBar.style.display = 'none';
            editInput.style.display = 'none';
            document.querySelectorAll('.tool-popup').forEach(p => p.style.display = 'none');
            const textColorPopup = document.getElementById('text-color-popup');
            const textStylePopup = document.getElementById('text-style-popup');
            if (textColorPopup) textColorPopup.style.display = 'none';
            if (textStylePopup) textStylePopup.style.display = 'none';
            isDragging = false;
            isRotating = false;
        };
        this.hideTextUI = closeText;

        if (txtCancel) txtCancel.addEventListener('click', closeText);
        if (txtApply) txtApply.addEventListener('click', closeText);

        const updateTextCursor = (e) => {
            if (!overlay || !window.App.state.text.enabled) return;
            const point = getPointer(e);
            if (!point) return;
            
            const state = window.App.state.text;
            if (isDragging) {
                state.x = Math.max(0, Math.min(1, point.x / overlay.width));
                state.y = Math.max(0, Math.min(1, point.y / overlay.height));
                window.App.canvas.scheduleRender();
            } else if (isRotating) {
                const centerX = state.x * overlay.width;
                const centerY = state.y * overlay.height;
                state.rotation = Math.atan2(point.y - centerY, point.x - centerX);
                window.App.canvas.scheduleRender();
            }
        };

        const container = document.querySelector('.canvas-container');

        const onDown = (e) => {
            if (window.App.toolManager.activeToolId !== 'btn-text') return;
            if (e.target.closest('#text-interactive-canvas')) {
                const point = getPointer(e);
                if (!point) return;
                isRotating = !!(e.shiftKey || e.button === 2);
                isDragging = !isRotating;
                editInput.style.display = 'none'; // hide editor when dragging
                updateTextCursor(e);
                if (e.cancelable) e.preventDefault();
            }
        };

        const onMove = (e) => {
            if (window.App.toolManager.activeToolId !== 'btn-text') return;
            if (isDragging || isRotating) {
                if (e.cancelable) e.preventDefault();
                updateTextCursor(e);
            }
        };

        const onUp = () => {
            isDragging = false;
            isRotating = false;
        };

        if (container) {
            container.addEventListener('mousedown', onDown);
            container.addEventListener('touchstart', onDown, {passive: false});
            
            // Double click to edit text
            container.addEventListener('dblclick', (e) => {
                if (window.App.toolManager.activeToolId !== 'btn-text') return;
                
                editInput.value = window.App.state.text.content;
                editInput.style.display = 'block';
                editInput.focus();
                
                // Keep cursor at end of text
                editInput.selectionStart = editInput.selectionEnd = editInput.value.length;
            });
            
            container.addEventListener('wheel', (e) => {
                if (window.App.toolManager.activeToolId !== 'btn-text') return;
                e.preventDefault();
                syncTextOverlay();
                const state = window.App.state.text;
                
                if (e.shiftKey) {
                    state.rotation -= e.deltaY * 0.01;
                } else {
                    state.scale -= e.deltaY * 0.001;
                    state.scale = Math.max(0.2, Math.min(5.0, state.scale));
                }
                
                window.App.canvas.scheduleRender();
            }, {passive: false});
        }
        
        document.addEventListener('mousemove', onMove);
        document.addEventListener('touchmove', onMove, {passive: false});
        document.addEventListener('mouseup', onUp);
        document.addEventListener('touchend', onUp);
        if (overlay) {
            overlay.addEventListener('contextmenu', (e) => e.preventDefault());
        }
        window.addEventListener('resize', () => {
            if (window.App.toolManager.activeToolId === 'btn-text') {
                syncTextOverlay();
            }
        });
        
        if (editInput) {
            editInput.addEventListener('input', (e) => {
                window.App.state.text.content = e.target.value;
                window.App.canvas.scheduleRender();
            });
        }

        if (customFontInput) {
            customFontInput.addEventListener('input', (e) => {
                window.App.state.text.customFontFamily = e.target.value.trim();
                window.App.canvas.scheduleRender();
            });
        }

        // Color and Tools Logic
        const invertBtn = document.getElementById('txt-invert-btn');
        if (invertBtn) {
            invertBtn.addEventListener('click', () => {
                window.App.state.text.inverted = !window.App.state.text.inverted;
                invertBtn.style.background = window.App.state.text.inverted ? '#333' : '#f0f0f0';
                invertBtn.style.color = window.App.state.text.inverted ? '#fff' : '#000';
                window.App.canvas.scheduleRender();
            });
        }

        const colorBtns = document.querySelectorAll('.txt-color-btn');
        colorBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                colorBtns.forEach(b => b.style.border = 'none');
                btn.style.border = '2px solid #aaa';
                window.App.state.text.color = btn.getAttribute('data-color');
                window.App.canvas.scheduleRender();
            });
        });

        const styleBtns = document.querySelectorAll('.txt-style-btn');
        styleBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                styleBtns.forEach(b => b.style.borderColor = 'transparent');
                btn.style.borderColor = '#aaa';
                window.App.state.text.styleId = btn.getAttribute('data-style');
                window.App.canvas.scheduleRender();
            });
        });
    },

    initBWUI() {
        const toggleStyleBtn = document.getElementById('bw-toggle-styles');
        const toggleFilterBtn = document.getElementById('bw-toggle-filters');
        const stylesList = document.getElementById('bw-styles-list');
        const filtersList = document.getElementById('bw-filters-list');

        if (toggleStyleBtn && toggleFilterBtn && stylesList && filtersList) {
            toggleStyleBtn.addEventListener('click', () => {
                stylesList.style.display = 'flex';
                filtersList.style.display = 'none';
                toggleStyleBtn.style.color = '#4285F4';
                toggleFilterBtn.style.color = '#777';
            });
            toggleFilterBtn.addEventListener('click', () => {
                stylesList.style.display = 'none';
                filtersList.style.display = 'flex';
                toggleFilterBtn.style.color = '#4285F4';
                toggleStyleBtn.style.color = '#777';
            });
        }

        const styleBtns = document.querySelectorAll('.bw-style-btn');
        styleBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                styleBtns.forEach(b => b.style.color = '#777');
                btn.style.color = '#4285F4';
                window.App.state.filters.bwStyleId = btn.getAttribute('data-style');
                window.App.canvas.scheduleRender();
            });
        });

        const filterBtns = document.querySelectorAll('.bw-filter-btn');
        filterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                filterBtns.forEach(b => {
                    b.style.color = '#777';
                    const circle = b.querySelector('div');
                    if (circle) circle.style.border = 'none';
                });
                btn.style.color = '#4285F4';
                const circle = btn.querySelector('div');
                if (circle) circle.style.border = '2px solid currentColor';

                window.App.state.filters.bwFilterId = btn.getAttribute('data-filter');
                window.App.canvas.scheduleRender();
            });
        });

        const manualBtn = document.getElementById('bw-manual');
        const popup = document.getElementById('bw-popup');
        if (manualBtn && popup) {
            manualBtn.addEventListener('click', () => {
                popup.style.display = popup.style.display === 'none' ? 'block' : 'none';
            });
        }
    },

    initGrainyFilmUI() {
        const container = document.getElementById('grainy-presets-container');
        if (!container) return;
        
        const presetKeys = [
            'A1', 'A2', 'A3', 'A4',
            'B1', 'B2', 'B3', 'B4',
            'F1', 'F2', 'F3', 'F4', 'F5',
            'X1', 'X2', 'X3', 'X4', 'X5'
        ];

        let html = `<button class="icon-btn grainy-preset" data-preset="" style="flex-direction: column; font-size: 10px; color: #4285F4; gap: 4px; min-width: 40px; border:none; background:none; cursor:pointer;">
                <div style="width: 28px; height: 28px; border-radius: 4px; border: 2px solid currentColor; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 11px;">0</div>
            </button>`;

        presetKeys.forEach(key => {
            html += `<button class="icon-btn grainy-preset" data-preset="${key}" style="flex-direction: column; font-size: 10px; color: #777; gap: 4px; min-width: 40px; border:none; background:none; cursor:pointer;">
                <div style="width: 28px; height: 28px; border-radius: 4px; border: 2px solid currentColor; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 11px;">${key}</div>
            </button>`;
        });

        container.innerHTML = html;

        const presets = container.querySelectorAll('.grainy-preset');
        const popup = document.getElementById('grainy-film-popup');
        const syncGrainyFilmUI = () => {
            const selectedPresetId = window.App.state.filters.grainyFilmStyleId || '';

            presets.forEach((presetBtn) => {
                presetBtn.style.color = presetBtn.getAttribute('data-preset') === selectedPresetId ? '#4285F4' : '#777';
            });

            if (!popup) return;

            ['grainyFilmGrain', 'grainyFilmStyleStrength'].forEach((key) => {
                const item = popup.querySelector(`[data-filter="${key}"]`);
                if (!item) return;

                const valueSpan = item.querySelector('.popup-value');
                if (valueSpan) {
                    valueSpan.textContent = Math.round(window.App.state.filters[key] || 0);
                }
            });
        };

        presets.forEach(btn => {
            btn.addEventListener('click', () => {
                const presetId = btn.getAttribute('data-preset');
                if (presetId === "") {
                    window.App.state.filters.grainyFilmStyleId = null;
                } else {
                    window.App.state.filters.grainyFilmStyleId = presetId;
                    if (!window.App.state.filters.grainyFilmStyleStrength) {
                       window.App.state.filters.grainyFilmStyleStrength = 50; 
                    }
                }

                syncGrainyFilmUI();
                window.App.canvas.scheduleRender();
            });
        });

        const manualBtn = document.getElementById('grainy-film-manual');
        if (manualBtn && popup) {
            manualBtn.addEventListener('click', () => {
                popup.style.display = popup.style.display === 'none' ? 'block' : 'none';
            });
        }

        const toolBtn = document.getElementById('btn-grainy-film');
        if (toolBtn) {
            toolBtn.addEventListener('click', () => {
                syncGrainyFilmUI();
                setTimeout(() => {
                    if (window.App.toolManager.activeToolId === 'btn-grainy-film') {
                        window.App.canvas.scheduleRender();
                    }
                }, 0);
            });
        }

        this.syncGrainyFilmUI = syncGrainyFilmUI;
        syncGrainyFilmUI();
    },

    initGlamourGlowUI() {
        const presets = document.querySelectorAll('.glamour-preset');
        if (!presets.length) return;

        const presetsData = {
            '1': { glamourGlow: 20, glamourSaturation: 5, glamourWarmth: 0 },
            '2': { glamourGlow: 40, glamourSaturation: 10, glamourWarmth: 30 },
            '3': { glamourGlow: 40, glamourSaturation: 40, glamourWarmth: 0 },
            '4': { glamourGlow: 70, glamourSaturation: -10, glamourWarmth: 0 },
            '5': { glamourGlow: 70, glamourSaturation: -10, glamourWarmth: -40 }
        };

        const updatePopupValues = () => {
            const popup = document.getElementById('glamour-glow-popup');
            if (popup) {
                ['glamourGlow', 'glamourSaturation', 'glamourWarmth'].forEach(key => {
                    const item = popup.querySelector(`[data-filter="${key}"]`);
                    if (item) {
                        const valSpan = item.querySelector('.popup-value');
                        if (valSpan) valSpan.textContent = Math.round(window.App.state.filters[key]);
                    }
                });
            }
        };

        presets.forEach(btn => {
            btn.addEventListener('click', () => {
                // Remove active styling from all presets
                presets.forEach(p => p.style.color = '#777');
                // Apply active styling to clicked preset
                btn.style.color = '#4285F4';

                const presetId = btn.getAttribute('data-preset');
                const data = presetsData[presetId];
                if (data) {
                    window.App.state.filters.glamourGlow = data.glamourGlow;
                    window.App.state.filters.glamourSaturation = data.glamourSaturation;
                    window.App.state.filters.glamourWarmth = data.glamourWarmth;
                    
                    updatePopupValues();
                    window.App.canvas.scheduleRender();
                }
            });
        });

        const manualBtn = document.getElementById('glamour-glow-manual');
        const popup = document.getElementById('glamour-glow-popup');
        if (manualBtn && popup) {
            manualBtn.addEventListener('click', () => {
                popup.style.display = popup.style.display === 'none' ? 'block' : 'none';
            });
        }
    },

    initThemeToggle() {
        const themeToggle = document.getElementById('theme-toggle');
        const html = document.documentElement;
        const storageKey = 'webseed.theme';
        if (!themeToggle || !html) return;

        const applyTheme = (theme) => {
            const nextTheme = theme === 'light' ? 'light' : 'dark';
            html.setAttribute('data-theme', nextTheme);
            themeToggle.setAttribute('aria-pressed', nextTheme === 'light' ? 'true' : 'false');
            themeToggle.setAttribute('aria-label', nextTheme === 'light' ? 'Switch to dark mode' : 'Switch to light mode');
            themeToggle.title = nextTheme === 'light' ? 'Switch to dark mode' : 'Switch to light mode';
        };

        let initialTheme = html.getAttribute('data-theme') || 'dark';
        try {
            initialTheme = window.localStorage.getItem(storageKey) || initialTheme;
        } catch (err) {
            initialTheme = html.getAttribute('data-theme') || 'dark';
        }

        applyTheme(initialTheme);

        themeToggle.addEventListener('click', () => {
            const nextTheme = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
            applyTheme(nextTheme);
            try {
                window.localStorage.setItem(storageKey, nextTheme);
            } catch (err) {
                // Ignore storage failures and keep the current session theme.
            }
        });
    },

    initUpload() {
        const uploadPrompt = document.getElementById('upload-prompt');
        const imageUpload = document.getElementById('image-upload');
        const container = document.querySelector('.canvas-container');
        const canvasEl = document.getElementById('editor-canvas');

        const finalizeLoadedImage = (img, options) => {
            window.App.state.originalImage = img;
            window.App.state.originalImageDataUrl = options && options.dataUrl ? options.dataUrl : img.src;
            window.App.state.originalFileName = options && options.fileName ? options.fileName : 'edited-image';
            window.App.ui.activeLookId = null;
            if (window.App.historyManager) {
                window.App.historyManager.reset(window.App.defaultRuntimeSnapshot);
            }
            uploadPrompt.style.display = 'none';
            canvasEl.style.display = 'block';
            window.App.canvas.fitToContainer();
            window.App.canvas.render();

            if (window.App.ui && window.App.ui.renderLooksUI) {
                window.App.ui.renderLooksUI();
                window.App.ui.setWorkflowMessage('looks-status', 'Image loaded. Tap a look or save your own preset.', false);
                window.App.ui.setWorkflowMessage('export-status', 'Choose Save for an editable project or Export for a flattened JPG.', false);
            }
        };

        const procFile = (file) => {
            if (!file) return;
            const reader = new FileReader();
            const isProjectFile = file.type === 'application/json' || /\.json$/i.test(file.name || '');

            if (isProjectFile) {
                reader.onload = (event) => {
                    try {
                        const project = JSON.parse(event.target.result);
                        if (!project || !project.originalImageDataUrl) {
                            throw new Error('Invalid project payload');
                        }

                        const img = new Image();
                        img.onload = () => {
                            if (window.App.toolManager && window.App.toolManager.activeToolId) {
                                window.App.toolManager.cancelTool();
                            }

                            finalizeLoadedImage(img, {
                                dataUrl: project.originalImageDataUrl,
                                fileName: project.originalFileName || file.name.replace(/\.json$/i, '')
                            });

                            if (project.snapshot && window.App.applyProjectSnapshot) {
                                window.App.applyProjectSnapshot(project.snapshot);
                                if (window.App.historyManager) {
                                    window.App.historyManager.reset(window.App.getRuntimeSnapshot());
                                }
                                window.App.canvas.fitToContainer();
                                window.App.canvas.scheduleRender();
                            }

                            if (window.App.ui) {
                                window.App.ui.setWorkflowMessage('looks-status', `Project "${project.originalFileName || 'Untitled'}" loaded.`, false);
                            }
                        };
                        img.src = project.originalImageDataUrl;
                    } catch (err) {
                        if (window.App.ui) {
                            window.App.ui.setWorkflowMessage('looks-status', 'This project file could not be opened.', true);
                        }
                    }
                };
                reader.readAsText(file);
                return;
            }

            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    if (window.App.applyProjectSnapshot && window.App.defaultProjectSnapshot) {
                        window.App.applyProjectSnapshot(window.App.defaultProjectSnapshot);
                    }
                    finalizeLoadedImage(img, {
                        dataUrl: event.target.result,
                        fileName: file.name
                    });
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        };

        if (imageUpload) {
            imageUpload.addEventListener('change', (e) => {
                if (e.target.files && e.target.files[0]) {
                    procFile(e.target.files[0]);
                }
            });
        }

        if (container) {
            container.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.stopPropagation();
                container.style.opacity = '0.7';
            });
            container.addEventListener('dragleave', (e) => {
                e.preventDefault();
                e.stopPropagation();
                container.style.opacity = '1';
            });
            container.addEventListener('drop', (e) => {
                e.preventDefault();
                e.stopPropagation();
                container.style.opacity = '1';
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    procFile(e.dataTransfer.files[0]);
                }
            });
        }
    },

    initSliders() {
        const sliders = [
            'raw-exposure', 'raw-highlights', 'raw-shadows', 'raw-contrast', 'raw-structure',
            'brightness', 'contrast', 'saturation', 'ambiance', 'highlights', 'shadows', 'warmth',
            'structure', 'sharpen', 'temperature', 'tint'
        ];

        const toCamelCase = (str) => str.replace(/-([a-z])/g, (g) => g[1].toUpperCase());

        sliders.forEach(id => {
            const slider = document.getElementById(id);
            const valDisplay = document.getElementById(`${id}-val`);
            if (!slider || !valDisplay) return;
            
            const stateKey = toCamelCase(id);

            // Allow precision scroll-wheel interaction
            slider.addEventListener('wheel', (e) => {
                e.preventDefault();
                const step = (slider.max - slider.min) / 200; // fine precision
                const delta = e.deltaY < 0 ? step : -step;
                let newVal = parseFloat(slider.value) + delta;
                newVal = Math.max(slider.min, Math.min(slider.max, newVal));
                slider.value = newVal;
                valDisplay.textContent = Math.round(newVal);
                window.App.state.filters[stateKey] = newVal;
                window.App.canvas.scheduleRender();
            });

            slider.addEventListener('input', (e) => {
                valDisplay.textContent = Math.round(e.target.value);
                window.App.state.filters[stateKey] = parseFloat(e.target.value);
                window.App.canvas.scheduleRender();
            });
        });
    },

    initToolToggles() {
        // Expose toggle globally for inline onclick handlers in HTML
        window.app = window.app || {};
        window.app.toggleTool = (toolId) => {
            const tool = document.getElementById(toolId);
            if (tool) tool.classList.toggle('collapsed');
        };
    },

    initPopups() {
        this.setupToolPopup('btn-tune-image', 'tune-image-popup', 'tune-bottom-bar', true);
        this.setupToolPopup('btn-details', 'details-popup', 'details-bottom-bar', false);
        this.setupToolPopup('btn-wb', 'wb-popup', 'wb-bottom-bar', false);
        this.setupToolPopup('btn-glamour-glow', 'glamour-glow-popup', 'glamour-glow-bottom-bar', false);
        this.setupToolPopup('btn-grainy-film', 'grainy-film-popup', 'grainy-film-bottom-bar', false);
        this.setupToolPopup('btn-bw', 'bw-popup', 'bw-bottom-bar', false);
        this.setupToolPopup('btn-lens-blur', '', 'lens-blur-bottom-bar', false);
        this.setupToolPopup('btn-vignette', '', 'vignette-bottom-bar', false);
        this.setupToolPopup('btn-text', '', 'text-bottom-bar', false);
        this.setupToolPopup('txt-toggle-color', 'text-color-popup', '', false);
        this.setupToolPopup('txt-toggle-opacity', 'text-opacity-popup', '', false);
        this.setupToolPopup('txt-toggle-style', 'text-style-popup', '', false);
        // Special case for secondary popup
        this.setupToolPopup('', 'bokeh-lab-popup', '', false); 

        document.querySelectorAll(
            '.tool-popup, #bokeh-shape-popup, #text-color-popup, #text-style-popup, #frames-style-popup'
        ).forEach((popup) => this.enablePopupDragging(popup));
    },

    setupToolPopup(btnId, popupId, contextBarId, hasAutoTune) {
        const toolBtn = document.getElementById(btnId);
        const popup = document.getElementById(popupId);
        const contextBar = document.getElementById(contextBarId);
        
        if (!toolBtn) return;

        if (popup) this.enablePopupDragging(popup);

        const isPrimaryToolButton = btnId.startsWith('btn-');

        if (!isPrimaryToolButton) {
            toolBtn.addEventListener('click', () => {
                if (!popup) return;
                popup.style.display = popup.style.display === 'none' ? 'block' : 'none';
            });
        } else {
            toolBtn.addEventListener('click', () => {
                if (window.App.toolManager.activeToolId === btnId) return; // Ignore if already open

                window.App.toolManager.openTool(btnId, {
                    show: () => {
                        if (popup) {
                            popup.style.display = 'block';
                            if (!popup.style.top || popup.style.top === '50%') {
                                popup.style.transform = 'translate(-50%, -50%)';
                                popup.style.left = '50%';
                                popup.style.top = '50%';
                            }
                        }
                        if (contextBar) contextBar.style.display = 'flex';
                    },
                    hide: () => {
                        if (popup) popup.style.display = 'none';
                        if (contextBar) contextBar.style.display = 'none';
                        if (window.App.ui && window.App.ui.hideCustomToolUI) {
                            window.App.ui.hideCustomToolUI(btnId);
                        }
                    }
                });
            });
        }

        // Setup X and Tick buttons
        if (contextBar) {
            const cancelBtn = contextBar.querySelector('[title="Cancel"]') || document.getElementById(btnId.replace('btn-', '') + '-close');
            const applyBtn  = contextBar.querySelector('[title="Apply"]') || document.getElementById(btnId.replace('btn-', '') + '-apply');
            
            if (cancelBtn) cancelBtn.addEventListener('click', () => window.App.toolManager.cancelTool());
            if (applyBtn)  applyBtn.addEventListener('click', () => window.App.toolManager.commitTool());
        } else if (popup) {
            // Handle if buttons are inside popup (like curves)
            const cancelBtn = popup.querySelector('[title="Cancel"]');
            const applyBtn  = popup.querySelector('[title="Apply"]');
            if (cancelBtn) cancelBtn.addEventListener('click', () => window.App.toolManager.cancelTool());
            if (applyBtn)  applyBtn.addEventListener('click', () => window.App.toolManager.commitTool());
        }

        if (popup) {
            // Handle interactions for popup items
            const items = popup.querySelectorAll('.popup-item');
            
            items.forEach(item => {
                const filterName = item.getAttribute('data-filter');
                const valueSpan = item.querySelector('.popup-value');
                
                // Set active on enter
                item.addEventListener('mouseenter', () => {
                    items.forEach(i => i.classList.remove('active'));
                    item.classList.add('active');
                });

                // Scroll to change value
                item.addEventListener('wheel', (e) => {
                    e.preventDefault();
                    
                    items.forEach(i => i.classList.remove('active'));
                    item.classList.add('active');

                    const step = 200 / 100;
                    const delta = e.deltaY < 0 ? step : -step;
                    
                    let currentVal = window.App.state.filters[filterName] || 0;
                    if (filterName.startsWith('lb')) {
                        const key = filterName === 'lbStrength' ? 'blurStrength' : filterName === 'lbTransition' ? 'transition' : 'vignetteStrength';
                        currentVal = window.App.state.lensBlur[key];
                    } else if (filterName.startsWith('vig')) {
                        const key = filterName === 'vigInner' ? 'innerBrightness' : 'outerBrightness';
                        currentVal = window.App.state.vignette[key];
                    } else if (filterName === 'txtOpac') {
                        currentVal = window.App.state.text.opacity;
                    }

                    let newVal = currentVal + delta;
                    newVal = Math.max(filterName === 'txtOpac' ? 0 : -100, Math.min(100, newVal));
                    
                    if (Math.round(newVal) !== Math.round(currentVal)) {
                        if (filterName.startsWith('lb')) {
                            const key = filterName === 'lbStrength' ? 'blurStrength' : filterName === 'lbTransition' ? 'transition' : 'vignetteStrength';
                            window.App.state.lensBlur[key] = newVal;
                        } else if (filterName.startsWith('vig')) {
                            const key = filterName === 'vigInner' ? 'innerBrightness' : 'outerBrightness';
                            window.App.state.vignette[key] = newVal;
                        } else if (filterName === 'txtOpac') {
                            window.App.state.text.opacity = newVal;
                        } else {
                            window.App.state.filters[filterName] = newVal;
                        }
                        valueSpan.textContent = Math.round(newVal);
                        window.App.canvas.scheduleRender();
                    }
                });
            });

            // Handle Auto-Tune button if applicable
            if (hasAutoTune && contextBar) {
                const autoTuneBtn = contextBar.querySelector('[title="Auto Tune"]');
                if (autoTuneBtn) {
                    autoTuneBtn.addEventListener('click', () => {
                        const randomize = (base, variance) => Math.round(base + (Math.random() * variance * 2 - variance));
                        const overrides = {
                            brightness: randomize(12, 5),
                            contrast: randomize(10, 5),
                            saturation: randomize(15, 6),
                            ambiance: randomize(25, 10),
                            shadows: randomize(15, 5),
                            highlights: randomize(-10, 5),
                            warmth: randomize(5, 5)
                        };
                        
                        Object.keys(overrides).forEach(key => {
                            window.App.state.filters[key] = overrides[key];
                            const domItem = popup.querySelector(`[data-filter="${key}"]`);
                            if (domItem) {
                                const valSpan = domItem.querySelector('.popup-value');
                                if (valSpan) valSpan.textContent = overrides[key];
                            }
                        });
                        
                        window.App.canvas.scheduleRender();
                        
                        autoTuneBtn.classList.add('active');
                        setTimeout(() => autoTuneBtn.classList.remove('active'), 200);
                    });
                }
            }

        }
    }
};
