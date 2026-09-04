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
        this.initToastSystem();
        this.initKeyboard();
        this.initUnifiedPopups();
        this.initCompare();
        this.initZoomPan();
        this.initFullscreen();
        this.initToolSearch();
        this.initCommandPalette();
        this.initHistoryThumbnails();
        this.initOpencvStatus();
        this.initPhaseAPolish();
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
                    const thumb = entry.thumb ? `<div class="history-entry-thumb"><img src="${entry.thumb}" alt="" loading="lazy"></div>` : `<div class="history-entry-thumb"><span>${String(entry.label||'').charAt(0).toUpperCase()}</span></div>`;
                    return `
                        <div class="history-entry${isApplied ? ' current' : ' pending'}${isSelected ? ' selected' : ''}" data-history-entry="${entry.id}">
                            ${thumb}
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
        if (message && isError) this.showToast(message, 'error');
        else if (message && targetId === 'looks-status' && /applied|saved/i.test(message)) this.showToast(message, 'success');
    },

    showToast(message, type) {
        const container = document.getElementById('toast-container');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = `toast ${type || ''}`;
        toast.innerHTML = `<span class=\"toast-dot\"></span><span>${message}</span>`;
        container.appendChild(toast);
        setTimeout(() => { if (toast.parentNode) toast.remove(); }, 3000);
    },

    initToastSystem() {
        // Exposed via showToast
    },

    initKeyboard() {
        this._keyHintTimer = null;
        const keyHint = document.getElementById('key-hint');
        const showHint = () => {
            if (!keyHint) return;
            if (window.App.toolManager && !window.App.toolManager.activeToolId) return;
            keyHint.style.display = 'flex';
            clearTimeout(this._keyHintTimer);
            this._keyHintTimer = setTimeout(() => { keyHint.style.display = 'none'; }, 4200);
        };
        const hideHint = () => { if (keyHint) keyHint.style.display = 'none'; };

        // Patch toolManager open/hide to show hint (monkey-patch gently)
        const origOpen = window.App.toolManager && window.App.toolManager.openTool;
        // Instead hook via polling activeToolId changes - simple: observe display changes
        document.addEventListener('keydown', (e) => {
            // Global app shortcuts (when not typing)
            const tag = document.activeElement && document.activeElement.tagName;
            const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement && document.activeElement.isContentEditable;
            if ((e.ctrlKey || e.metaKey) && !e.altKey) {
                if ((e.key === 'z' || e.key === 'Z') && !e.shiftKey) { e.preventDefault(); if (window.App.historyManager) window.App.historyManager.undo(); return; }
                if ((e.key === 'z' || e.key === 'Z') && e.shiftKey) { e.preventDefault(); if (window.App.historyManager) window.App.historyManager.redo(); return; }
                if (e.key === 'y' || e.key === 'Y') { e.preventDefault(); if (window.App.historyManager) window.App.historyManager.redo(); return; }
                // allow palette to handle Cmd+K elsewhere — don't intercept here beyond undo
            }
            if (!isTyping && (e.key === '+' || e.key === '=' ) && !e.ctrlKey && !e.metaKey && window.App.toolManager && !window.App.toolManager.activeToolId) {
                e.preventDefault(); if (window.App.canvas) window.App.canvas.zoomIn(); return;
            }
            if (!isTyping && (e.key === '-' || e.key === '_' ) && !e.ctrlKey && !e.metaKey && window.App.toolManager && !window.App.toolManager.activeToolId) {
                e.preventDefault(); if (window.App.canvas) window.App.canvas.zoomOut(); return;
            }
            if (!isTyping && e.key === '0' && !e.ctrlKey && !e.metaKey) { if (window.App.canvas) window.App.canvas.zoomFit(); return; }
            if (!isTyping && (e.key === 'h' || e.key === 'H') && !e.ctrlKey && !e.metaKey) {
                e.preventDefault(); if (window.App.ui && window.App.ui.toggleHistoryPanel) window.App.ui.toggleHistoryPanel(); return;
            }
            if (e.key === 'Escape') {
                // Palette gets first dibs — if open, let it handle
                const pal = document.getElementById('command-palette');
                if (pal && pal.style.display !== 'none' && pal.style.display !== '') return;
                if (window.App.toolManager && window.App.toolManager.activeToolId) {
                    e.preventDefault();
                    window.App.toolManager.cancelTool();
                    hideHint();
                    this.showToast('Cancelled', 'success');
                } else if (document.getElementById('history-panel') && document.getElementById('history-panel').style.display !== 'none') {
                    document.getElementById('history-panel').style.display = 'none';
                }
                return;
            }
            if (e.key === 'Enter') {
                if (window.App.toolManager && window.App.toolManager.activeToolId) {
                    e.preventDefault();
                    window.App.toolManager.commitTool();
                    hideHint();
                    this.showToast('Applied', 'success');
                }
                return;
            }
            // Arrow to navigate active popup item
            if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && window.App.toolManager && window.App.toolManager.activeToolId) {
                const popup = document.querySelector('.tool-popup[style*=\"block\"], .snapseed-popup[style*=\"block\"]');
                if (!popup) return;
                e.preventDefault();
                const items = [...popup.querySelectorAll('.popup-item')];
                if (!items.length) return;
                let idx = items.findIndex(i => i.classList.contains('active'));
                if (idx === -1) idx = 0; else idx = e.key === 'ArrowDown' ? (idx + 1) % items.length : (idx - 1 + items.length) % items.length;
                items.forEach(i => i.classList.remove('active'));
                items[idx].classList.add('active');
                showHint();
            }
            // +/- to adjust value of active popup item
            if ((e.key === '+' || e.key === '=' || e.key === '-' || e.key === '_') && window.App.toolManager && window.App.toolManager.activeToolId) {
                const popup = document.querySelector('.tool-popup[style*=\"block\"], .snapseed-popup[style*=\"block\"]');
                if (!popup) return;
                const active = popup.querySelector('.popup-item.active');
                if (!active) return;
                e.preventDefault();
                const delta = (e.key === '+' || e.key === '=') ? 2 : -2;
                // dispatch synthetic wheel
                active.dispatchEvent(new WheelEvent('wheel', { deltaY: delta < 0 ? -10 : 10, cancelable: true }));
            }
        });
        // Show hint when a tool is opened — hook via MutationObserver on bottom bars
        const observer = new MutationObserver(() => {
            if (window.App.toolManager && window.App.toolManager.activeToolId) showHint(); else hideHint();
        });
        observer.observe(document.body, { attributes: true, subtree: true, attributeFilter: ['style'] });
    },

    initUnifiedPopups() {
        // Convert legacy bokeh/text/frames popups to use the same bottom-bar hint positioning
        // Ensure Esc closes inner popups first
        document.addEventListener('click', (e) => {
            // Click outside popup closes it if not dragging
            if (e.target.closest('.tool-popup') || e.target.closest('[id$=\"-popup\"]') || e.target.closest('.tool-item') || e.target.closest('[id^=\"btn-\"]') || e.target.closest('[id^=\"txt-toggle\"]')) return;
            // Don't auto-close primary tool popups — those are managed by toolManager
        });
        // Make popup items respond to click adjusting focus
        document.querySelectorAll('.popup-item').forEach(item => {
            item.addEventListener('click', () => {
                const popup = item.closest('.tool-popup, .snapseed-popup');
                if (!popup) return;
                [...popup.querySelectorAll('.popup-item')].forEach(i => i.classList.remove('active'));
                item.classList.add('active');
            });
        });
    },

    initCompare() {
        const badge = document.getElementById('compare-badge');
        const btn = document.getElementById('compare-hold');
        let isActive = false;
        const setCompare = (on) => {
            if (!window.App.state.originalImage) return;
            if (isActive === on) return;
            isActive = on;
            window.App.state.uiFlags.compareOriginal = on;
            if (badge) badge.style.display = on ? 'block' : 'none';
            if (btn) btn.classList.toggle('active', on);
            if (window.App.canvas) window.App.canvas.scheduleRender();
        };
        if (btn) {
            const start = (e) => { e.preventDefault(); setCompare(true); };
            const stop = () => setCompare(false);
            btn.addEventListener('mousedown', start);
            btn.addEventListener('touchstart', start, {passive:false});
            ['mouseup','mouseleave','touchend','touchcancel'].forEach(ev => btn.addEventListener(ev, stop));
            btn.addEventListener('click', (e) => { e.preventDefault(); setCompare(!isActive); setTimeout(() => setCompare(false), 1200); });
        }
        document.addEventListener('keydown', (e) => {
            if ((e.key === 'c' || e.key === 'C') && !e.metaKey && !e.ctrlKey && !e.altKey) {
                if (e.repeat) return;
                const tag = document.activeElement && document.activeElement.tagName;
                if (tag === 'INPUT' || tag === 'TEXTAREA') return;
                setCompare(true);
            }
        });
        document.addEventListener('keyup', (e) => {
            if (e.key === 'c' || e.key === 'C') setCompare(false);
        });
        // Long-press on canvas also triggers compare (useful on mobile)
        const stage = document.querySelector('.canvas-area');
        let longPressTimer = null;
        if (stage) {
            const onTouchStart = () => { longPressTimer = setTimeout(() => setCompare(true), 380); };
            const onTouchEnd = () => { clearTimeout(longPressTimer); setCompare(false); };
            stage.addEventListener('touchstart', onTouchStart, {passive:true});
            stage.addEventListener('touchend', onTouchEnd);
            stage.addEventListener('touchcancel', onTouchEnd);
        }
    },

    initZoomPan() {
        const btnIn = document.getElementById('zoom-in');
        const btnOut = document.getElementById('zoom-out');
        const btnFit = document.getElementById('zoom-fit');
        if (btnIn) btnIn.addEventListener('click', () => window.App.canvas && window.App.canvas.zoomIn());
        if (btnOut) btnOut.addEventListener('click', () => window.App.canvas && window.App.canvas.zoomOut());
        if (btnFit) btnFit.addEventListener('click', () => window.App.canvas && window.App.canvas.zoomFit());

        // Ctrl/Cmd + wheel zoom, Shift+wheel already used by tools — we respect that
        const container = document.querySelector('.canvas-container');
        const stage = document.querySelector('.canvas-area');
        if (stage) {
            stage.addEventListener('wheel', (e) => {
                if (!e.ctrlKey && !e.metaKey) return;
                if (!window.App.state.originalImage) return;
                e.preventDefault();
                const delta = e.deltaY < 0 ? 1.1 : 0.9;
                const cur = window.App.state.canvasConfig.userZoom || 1;
                window.App.canvas.setZoom(cur * delta, {x:e.clientX, y:e.clientY});
            }, {passive:false});
        }
        // Drag to pan when zoomed
        let isPanning = false, startX=0, startY=0, startScrollLeft=0, startScrollTop=0;
        if (container) {
            container.addEventListener('mousedown', (e) => {
                if ((window.App.state.canvasConfig.userZoom || 1) <= 1.05) return;
                if (e.button !== 0) return;
                // Only pan if clicking on canvas area not on overlay handle
                if (e.target.closest('.ui-overlay') || e.target.closest('[id$=\"-popup\"]') || e.target.closest('.floating-toolbar')) return;
                isPanning = true;
                startX = e.clientX; startY = e.clientY;
                startScrollLeft = container.scrollLeft; startScrollTop = container.scrollTop;
                container.style.cursor = 'grabbing';
                e.preventDefault();
            });
            document.addEventListener('mousemove', (e) => {
                if (!isPanning) return;
                const dx = e.clientX - startX;
                const dy = e.clientY - startY;
                container.scrollLeft = startScrollLeft - dx;
                container.scrollTop = startScrollTop - dy;
            });
            document.addEventListener('mouseup', () => {
                if (!isPanning) return;
                isPanning = false;
                container.style.cursor = '';
            });
            // Pinch zoom on mobile
            let lastDist = 0;
            container.addEventListener('touchstart', (e) => {
                if (e.touches.length === 2) {
                    const dx = e.touches[0].clientX - e.touches[1].clientX;
                    const dy = e.touches[0].clientY - e.touches[1].clientY;
                    lastDist = Math.hypot(dx, dy);
                }
            }, {passive:true});
            container.addEventListener('touchmove', (e) => {
                if (e.touches.length === 2) {
                    e.preventDefault();
                    const dx = e.touches[0].clientX - e.touches[1].clientX;
                    const dy = e.touches[0].clientY - e.touches[1].clientY;
                    const dist = Math.hypot(dx, dy);
                    if (lastDist) {
                        const scale = dist / lastDist;
                        const cur = window.App.state.canvasConfig.userZoom || 1;
                        window.App.canvas.setZoom(cur * scale);
                    }
                    lastDist = dist;
                }
            }, {passive:false});
            container.addEventListener('touchend', () => { lastDist = 0; });
        }
        // Update label on load & resize
        window.addEventListener('resize', () => { if (window.App.canvas && window.App.canvas.updateZoomLabel) window.App.canvas.updateZoomLabel(); });
    },

    initFullscreen() {
        const btn = document.getElementById('fullscreen-toggle');
        const stage = document.querySelector('.canvas-area');
        const updateIcon = () => {
            if (!btn) return;
            const isFs = !!document.fullscreenElement;
            btn.classList.toggle('active', isFs);
            btn.title = isFs ? 'Exit fullscreen (F)' : 'Fullscreen (F)';
        };
        if (btn && stage) {
            btn.addEventListener('click', async () => {
                try {
                    if (!document.fullscreenElement) await stage.requestFullscreen();
                    else await document.exitFullscreen();
                } catch(err) { /* ignore */ }
            });
        }
        document.addEventListener('fullscreenchange', updateIcon);
        document.addEventListener('keydown', (e) => {
            if ((e.key === 'f' || e.key === 'F') && !e.metaKey && !e.ctrlKey) {
                const tag = document.activeElement && document.activeElement.tagName;
                if (tag === 'INPUT' || tag === 'TEXTAREA') return;
                e.preventDefault();
                if (btn) btn.click();
            }
        });
    },

    initToolSearch() {
        const input = document.getElementById('tool-search');
        const clear = document.getElementById('tool-search-clear');
        if (!input) return;
        const grid = document.querySelector('.tools-grid');
        const items = grid ? [...grid.querySelectorAll('.tool-item')] : [];
        const filter = () => {
            const q = (input.value || '').trim().toLowerCase();
            if (clear) clear.style.display = q ? 'block' : 'none';
            let visible = 0;
            items.forEach(el => {
                const name = (el.textContent || '').toLowerCase();
                const hit = !q || name.includes(q) || (el.id||'').toLowerCase().includes(q);
                el.classList.toggle('is-hidden', !hit);
                if (hit) visible++;
            });
            if (grid) grid.style.opacity = visible === 0 ? '0.5' : '';
        };
        input.addEventListener('input', filter);
        if (clear) clear.addEventListener('click', () => { input.value=''; filter(); input.focus(); });
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') { input.value=''; filter(); input.blur(); }
            if (e.key === 'Enter') {
                const first = items.find(el => !el.classList.contains('is-hidden'));
                if (first) first.click();
            }
        });
        // Cmd/Ctrl + K focuses search when palette not desired
        // (Palette handles Cmd+K itself — this is fallback for just typing)
    },

    initCommandPalette() {
        const palette = document.getElementById('command-palette');
        const input = document.getElementById('command-input');
        const list = document.getElementById('command-list');
        if (!palette || !input || !list) return;
        const tools = [
            {id:'btn-tune-image', label:'Tune Image', desc:'Brightness • Contrast • Saturation', icon:'◐', keys:'T'},
            {id:'btn-details', label:'Details', desc:'Structure • Sharpening', icon:'⬢', keys:''},
            {id:'btn-curves', label:'Curves', desc:'Tone curve • LUT', icon:'〰', keys:''},
            {id:'btn-wb', label:'White Balance', desc:'Temperature • Tint', icon:'WB', keys:''},
            {id:'btn-crop', label:'Crop', desc:'Free • 1:1 • 3:2 • 4:3', icon:'◫', keys:'C'},
            {id:'btn-rotate', label:'Rotate', desc:'90° • Flip • Straighten', icon:'↻', keys:'R'},
            {id:'btn-selective', label:'Selective', desc:'U-Point control points', icon:'◎', keys:''},
            {id:'btn-brush', label:'Brush', desc:'Dodge • Exposure • Temp', icon:'🖌', keys:'B'},
            {id:'btn-healing', label:'Healing', desc:'Patch • Heal blemishes', icon:'✦', keys:'H'},
            {id:'btn-glamour-glow', label:'Glamour Glow', desc:'Soft bloom • Warmth', icon:'✨', keys:''},
            {id:'btn-grainy-film', label:'Grainy Film', desc:'19 analog presets', icon:'🎞', keys:''},
            {id:'btn-bw', label:'Black & White', desc:'Styles + color filters', icon:'◑', keys:''},
            {id:'btn-lens-blur', label:'Lens Blur', desc:'Elliptical • Bokeh', icon:'◎', keys:''},
            {id:'btn-vignette', label:'Vignette', desc:'Inner • Outer brightness', icon:'◯', keys:''},
            {id:'btn-text', label:'Text', desc:'Add caption • 6 styles', icon:'T', keys:''},
        ];
        const actions = [
            {label:'Undo', desc:'Step back', icon:'↩', run:()=>window.App.historyManager&&window.App.historyManager.undo(), keys:'⌘Z'},
            {label:'Redo', desc:'Step forward', icon:'↪', run:()=>window.App.historyManager&&window.App.historyManager.redo(), keys:'⇧⌘Z'},
            {label:'Compare original', desc:'Hold C', icon:'👁', run:()=>{ const b=document.getElementById('compare-hold'); if(b) b.click(); }, keys:'C'},
            {label:'Toggle theme', desc:'Dark / Light', icon:'◐', run:()=>document.getElementById('theme-toggle')&&document.getElementById('theme-toggle').click(), keys:''},
            {label:'Fullscreen', desc:'Focus on photo', icon:'⛶', run:()=>document.getElementById('fullscreen-toggle')&&document.getElementById('fullscreen-toggle').click(), keys:'F'},
            {label:'Export JPEG', desc:'Flatten & download', icon:'⬇', run:()=>document.getElementById('export-flatten')&&document.getElementById('export-flatten').click(), keys:''},
        ];
        let filtered = [];
        let activeIdx = 0;
        const render = () => {
            list.innerHTML = filtered.map((entry, i) => {
                const isTool = !!entry.id;
                return `<button class=\"command-item ${i===activeIdx?'active':''}\" data-idx=\"${i}\" role=\"option\" aria-selected=\"${i===activeIdx}\">
                    <span class=\"cmd-icon\">${entry.icon||'•'}</span>
                    <span style=\"display:flex; flex-direction:column; text-align:left;\"><span style=\"font-weight:700; letter-spacing:-0.01em;\">${entry.label}</span><span style=\"font-size:11px; color:var(--text-muted);\">${entry.desc||''}</span></span>
                    ${entry.keys?`<kbd>${entry.keys}</kbd>`:''}
                </button>`;
            }).join('') || `<div style=\"padding:16px; text-align:center; color:var(--text-muted); font-size:13px;\">No matches — try “crop”, “blur”, or “export”.</div>`;
            [...list.querySelectorAll('.command-item')].forEach(btn=>{
                btn.addEventListener('click', ()=>{ activeIdx = parseInt(btn.dataset.idx,10); commit(); });
                btn.addEventListener('mouseenter', ()=>{ activeIdx = parseInt(btn.dataset.idx,10); render(); });
            });
        };
        const updateFilter = () => {
            const q = (input.value||'').trim().toLowerCase();
            if (!q) filtered = [...tools, ...actions];
            else filtered = [...tools, ...actions].filter(e => (e.label+e.desc+(e.id||'')).toLowerCase().includes(q));
            activeIdx = 0; render();
        };
        const open = () => { palette.style.display='flex'; input.value=''; updateFilter(); setTimeout(()=>input.focus(), 0); };
        const close = () => { palette.style.display='none'; input.blur(); };
        const commit = () => {
            const entry = filtered[activeIdx];
            if (!entry) return;
            close();
            if (entry.id) {
                const el = document.getElementById(entry.id);
                if (el) el.click();
                // also switch to tools tab
                if (window.App.ui && window.App.ui.setActiveSidebarTab) window.App.ui.setActiveSidebarTab('tools');
            } else if (entry.run) entry.run();
        };
        document.addEventListener('keydown', (e) => {
            const isK = (e.key === 'k' || e.key === 'K');
            if ((e.metaKey || e.ctrlKey) && isK) { e.preventDefault(); if (palette.style.display === 'none' || palette.style.display === '') open(); else close(); return; }
            if (e.key === '/' && !e.metaKey && !e.ctrlKey && palette.style.display==='none') {
                const tag = document.activeElement && document.activeElement.tagName;
                if (tag==='INPUT'||tag==='TEXTAREA') return;
                // quick slash to open palette
                // e.preventDefault(); open();
            }
            if (palette.style.display !== 'none' && palette.style.display !== '') {
                if (e.key === 'Escape') { e.preventDefault(); close(); }
                else if (e.key === 'ArrowDown') { e.preventDefault(); activeIdx = (activeIdx+1)%filtered.length; render(); }
                else if (e.key === 'ArrowUp') { e.preventDefault(); activeIdx = (activeIdx-1+filtered.length)%filtered.length; render(); }
                else if (e.key === 'Enter') { e.preventDefault(); commit(); }
            }
        });
        palette.addEventListener('click', (e) => { if (e.target === palette) close(); });
        input.addEventListener('input', updateFilter);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') { e.preventDefault(); close(); }
            else if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter') { e.preventDefault(); document.dispatchEvent(new KeyboardEvent('keydown', {key:e.key})); }
        });
        updateFilter();
    },

    initHistoryThumbnails() {
        // wrap historyManager.recordEdit to snapshot thumbnail after each commit
        const mgr = window.App.historyManager;
        if (!mgr || mgr._thumbWrapped) return;
        mgr._thumbWrapped = true;
        const origRecord = mgr.recordEdit.bind(mgr);
        const origRebuild = mgr.rebuildToCursor.bind(mgr);
        const makeThumb = () => {
            try {
                const c = window.App.canvas && window.App.canvas.el;
                if (!c || !c.width || !c.height) return null;
                const off = document.createElement('canvas');
                const s = 72;
                off.width = s; off.height = s;
                const ctx = off.getContext('2d');
                // cover crop
                const iw = c.width, ih = c.height;
                const scale = Math.max(s/iw, s/ih);
                const w = iw*scale, h = ih*scale;
                const x = (s - w)/2, y = (s - h)/2;
                ctx.fillStyle = '#0A0A0F'; ctx.fillRect(0,0,s,s);
                ctx.drawImage(c, x, y, w, h);
                return off.toDataURL('image/jpeg', 0.62);
            } catch(e) { return null; }
        };
        mgr.recordEdit = (opts) => {
            const ok = origRecord(opts);
            if (ok && mgr.entries.length) {
                const last = mgr.entries[mgr.entries.length-1];
                // defer to next frame so canvas has rendered
                requestAnimationFrame(()=> {
                    const url = makeThumb();
                    if (url) { last.thumb = url; if (window.App.ui && window.App.ui.renderHistoryPanel) window.App.ui.renderHistoryPanel(); }
                });
            }
            return ok;
        };
        mgr.rebuildToCursor = () => {
            origRebuild();
            // after rebuild, ensure zoom label correct
            if (window.App.canvas && window.App.canvas.updateZoomLabel) window.App.canvas.updateZoomLabel();
        };
        // also patch reset to clear thumbs
        const origReset = mgr.reset.bind(mgr);
        mgr.reset = (snap) => { origReset(snap); };
    },

    initOpencvStatus() {
        const pill = document.getElementById('opencv-status');
        const txt = document.getElementById('opencv-status-text');
        const closeBtn = document.getElementById('opencv-status-close');
        if (!pill || !txt) return;
        const dot = pill.querySelector('span');
        let dismissed = false;
        let autoHideTimer = null;
        const footerStatus = document.querySelector('.statusbar span:last-child');
        const hide = () => {
            if (dismissed) return;
            dismissed = true;
            if (autoHideTimer) clearTimeout(autoHideTimer);
            pill.style.transition = 'opacity 280ms ease, transform 280ms ease';
            pill.style.opacity = '0';
            pill.style.transform = 'translateY(8px)';
            pill.style.pointerEvents = 'none';
            setTimeout(() => { pill.style.display = 'none'; }, 320);
        };
        if (closeBtn) closeBtn.addEventListener('click', hide);
        // close on Escape when pill visible
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && pill.style.display !== 'none' && pill.style.opacity !== '0') hide();
        });
        const setReady = () => {
            window.App.state.uiFlags.opencvReady = true;
            pill.classList.add('is-ready');
            txt.textContent = 'OpenCV ready — Healing & Expand enabled';
            if (dot) { dot.style.background = 'var(--success)'; dot.style.animation = 'none'; }
            if (footerStatus) footerStatus.textContent = 'OpenCV ready';
            if (autoHideTimer) clearTimeout(autoHideTimer);
            autoHideTimer = setTimeout(hide, 2200);
        };
        const setFail = () => {
            txt.textContent = 'OpenCV unavailable — limited tools';
            if (dot) { dot.style.background = 'var(--danger)'; dot.style.animation = 'none'; }
            pill.style.background = 'rgba(239,68,68,0.14)';
            pill.style.borderColor = 'rgba(239,68,68,0.20)';
            if (footerStatus) footerStatus.textContent = 'OpenCV unavailable';
            if (autoHideTimer) clearTimeout(autoHideTimer);
            autoHideTimer = setTimeout(hide, 3400);
        };
        txt.textContent = 'Loading OpenCV…';
        if (dot) { dot.style.background = 'var(--warning)'; dot.style.animation = ''; }
        // Always auto-dismiss after 3.5s so canvas is never blocked — status persists in footer
        autoHideTimer = setTimeout(() => {
            if (!window.App.state.uiFlags.opencvReady && !dismissed) {
                if (footerStatus) footerStatus.textContent = 'Loading OpenCV…';
                hide();
            }
        }, 3500);
        let tries = 0;
        const check = () => {
            tries++;
            if (window.cv && window.cv.Mat) { setReady(); return; }
            if (tries > 18) { setFail(); return; } // ~4.5s instead of 30s
            setTimeout(check, 250);
        };
        window.Module = window.Module || {};
        const prevOnRuntime = window.Module.onRuntimeInitialized;
        window.Module.onRuntimeInitialized = () => { if (prevOnRuntime) try{prevOnRuntime();}catch(e){} setReady(); };
        check();
        window.addEventListener('load', check);
    },

    initPhaseAPolish(){
        // ---- Tune histogram ----
        this.renderTuneHistogram = () => {
            const popup = document.getElementById('tune-image-popup');
            if(!popup || popup.style.display==='none') return;
            let canvas = document.getElementById('tune-histogram');
            if(!canvas){
                canvas = document.createElement('canvas');
                canvas.id='tune-histogram';
                canvas.width=260; canvas.height=42;
                canvas.style.cssText='width:100%;height:42px;border-radius:8px;margin:6px 0 0;display:block;background:rgba(0,0,0,0.18);border:1px solid rgba(255,255,255,0.06)';
                const list = popup.querySelector('.popup-list');
                if(list) list.parentElement.insertBefore(canvas, list.nextSibling);
            }
            const c = window.App.canvas && window.App.canvas.el;
            if(!c) return;
            try{
                const w=c.width,h=c.height;
                const sm=Math.min(w, 360);
                const sh=Math.round(h*(sm/w));
                const off=document.createElement('canvas'); off.width=sm; off.height=sh;
                off.getContext('2d').drawImage(c,0,0,sm,sh);
                const d=off.getContext('2d').getImageData(0,0,sm,sh).data;
                const hist=new Uint32Array(256);
                for(let i=0;i<d.length;i+=4){
                    const lum=(0.2126*d[i]+0.7152*d[i+1]+0.0722*d[i+2])|0;
                    hist[lum]++;
                }
                let max=1; for(let i=0;i<256;i++) if(hist[i]>max) max=hist[i];
                const ctx=canvas.getContext('2d');
                ctx.clearRect(0,0,canvas.width,canvas.height);
                ctx.fillStyle='rgba(255,255,255,0.03)';
                ctx.fillRect(0,0,canvas.width,canvas.height);
                // draw hist as area
                ctx.strokeStyle='rgba(91,127,255,0.95)';
                ctx.fillStyle='rgba(91,127,255,0.18)';
                ctx.lineWidth=1.2;
                ctx.beginPath();
                for(let i=0;i<256;i++){
                    const x=i/255*canvas.width;
                    const y=canvas.height - (hist[i]/max)* (canvas.height-6) -3;
                    if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
                }
                ctx.lineTo(canvas.width, canvas.height); ctx.lineTo(0, canvas.height); ctx.closePath();
                ctx.fill();
                // stroke top
                ctx.beginPath();
                for(let i=0;i<256;i++){
                    const x=i/255*canvas.width;
                    const y=canvas.height - (hist[i]/max)* (canvas.height-6) -3;
                    if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
                }
                ctx.stroke();
            }catch(e){}
        };
        // hook tune open to draw histogram
        const btnTune=document.getElementById('btn-tune-image');
        if(btnTune){
            btnTune.addEventListener('click', ()=> setTimeout(()=>this.renderTuneHistogram(), 80));
        }
        // also re-render on slider changes
        const tunePopup=document.getElementById('tune-image-popup');
        if(tunePopup){
            tunePopup.addEventListener('wheel', ()=> setTimeout(()=>this.renderTuneHistogram(), 120), {passive:true});
        }

        // ---- White Balance auto + picker ----
        const wbAuto=document.getElementById('wb-auto');
        const wbPicker=document.getElementById('wb-picker');
        const wbClose=document.getElementById('wb-close');
        const wbApply=document.getElementById('wb-apply');
        let picking=false;
        const setPickMode=(on)=>{
            picking=on;
            if(wbPicker) wbPicker.classList.toggle('active', on);
            const c=document.querySelector('.canvas-container');
            if(c) c.style.cursor = on ? 'crosshair' : '';
            if(on && window.App.ui) window.App.ui.showToast('Tap image to pick neutral gray', 'success');
        };
        if(wbAuto){
            wbAuto.addEventListener('click', ()=>{
                if(window.App.filtersLogic && window.App.filtersLogic.applyAutoWhiteBalance){
                    const r=window.App.filtersLogic.applyAutoWhiteBalance();
                    if(r){
                        const popup=document.getElementById('wb-popup');
                        if(popup){
                            ['temperature','tint'].forEach(k=>{
                                const el=popup.querySelector(`[data-filter="${k}"] .popup-value`);
                                if(el) el.textContent=Math.round(window.App.state.filters[k]);
                            });
                        }
                        if(window.App.canvas) window.App.canvas.scheduleRender();
                        if(window.App.ui) window.App.ui.showToast(`AWB: ${r.temperature>0?'+':''}${r.temperature} temp, ${r.tint>0?'+':''}${r.tint} tint`, 'success');
                    } else if(window.App.ui) window.App.ui.showToast('Auto WB — open an image first', 'error');
                }
            });
        }
        if(wbPicker){
            wbPicker.addEventListener('click', ()=> setPickMode(!picking));
        }
        if(wbClose) wbClose.addEventListener('click', ()=>{ setPickMode(false); if(window.App.toolManager) window.App.toolManager.cancelTool(); });
        if(wbApply) wbApply.addEventListener('click', ()=>{ setPickMode(false); if(window.App.toolManager) window.App.toolManager.commitTool(); });
        // canvas click for picker
        const canvasEl=document.getElementById('editor-canvas');
        const container=document.querySelector('.canvas-container');
        const pickHandler=(e)=>{
            if(!picking) return;
            if(window.App.toolManager && window.App.toolManager.activeToolId!=='btn-wb') return;
            // map client to normalized
            const rect=canvasEl.getBoundingClientRect();
            const x=(e.clientX - rect.left)/rect.width;
            const y=(e.clientY - rect.top)/rect.height;
            if(x<0||x>1||y<0||y>1) return;
            if(window.App.filtersLogic && window.App.filtersLogic.pickWhiteBalanceAt){
                const r=window.App.filtersLogic.pickWhiteBalanceAt(x,y);
                if(r){
                    const popup=document.getElementById('wb-popup');
                    if(popup){
                        ['temperature','tint'].forEach(k=>{
                            const el=popup.querySelector(`[data-filter="${k}"] .popup-value`);
                            if(el) el.textContent=Math.round(window.App.state.filters[k]);
                        });
                    }
                    if(window.App.canvas) window.App.canvas.scheduleRender();
                    if(window.App.ui) window.App.ui.showToast(`Picked ${Math.round(r.avgR)},${Math.round(r.avgG)},${Math.round(r.avgB)}`, 'success');
                }
            }
            // keep picking until manual off or apply
        };
        if(container){
            container.addEventListener('click', pickHandler);
        }
        // show picker hint when popup visible
        const wbPopup=document.getElementById('wb-popup');

        // ---- Rotate auto straighten ----
        const rotAuto=document.getElementById('rotate-auto');
        if(rotAuto){
            rotAuto.addEventListener('click', async ()=>{
                const badge=document.getElementById('rotate-angle-badge');
                const grid=document.getElementById('rotate-grid');
                if(window.App.filtersLogic && window.App.filtersLogic.autoStraighten){
                    if(badge) badge.textContent='Analyzing…';
                    const angle = await window.App.filtersLogic.autoStraighten();
                    if(typeof angle==='number'){
                        window.App.state.geometry.straighten = angle;
                        if(badge) badge.textContent=`Straighten Angle ${angle.toFixed(2)}° (auto)`;
                        if(grid) grid.style.display='block';
                        setTimeout(()=>{ if(grid) grid.style.display='none'; }, 900);
                        if(window.App.canvas) window.App.canvas.scheduleRender();
                        if(window.App.ui) window.App.ui.showToast(`Auto: ${angle>0?'+':''}${angle.toFixed(1)}°`, 'success');
                    } else {
                        if(badge) badge.textContent=`Straighten Angle ${(window.App.state.geometry.straighten||0).toFixed(2)}°`;
                        if(window.App.ui) window.App.ui.showToast('Auto straighten needs an image', 'error');
                    }
                } else {
                    // fallback tiny nudge
                    if(window.App.ui) window.App.ui.showToast('Auto straighten unavailable (OpenCV not ready — pick manually)', 'error');
                }
            });
        }
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
            const outer = getOuterRadii();
            const lbState = ensureLensBlurState();
            const rot = (lbState.anchor.rotation||0)*Math.PI/180;
            const c=Math.cos(rot), s=Math.sin(rot);
            const rotPt=(dx,dy)=>({x: center.x + dx*c - dy*s, y: center.y + dx*s + dy*c});
            return {
                center,
                resizeXPositive: rotPt(focus.x,0),
                resizeXNegative: rotPt(-focus.x,0),
                resizeYPositive: rotPt(0,-focus.y),
                resizeYNegative: rotPt(0,focus.y),
                rotateKnob: rotPt(outer.x+14,0)
            };
        };
        const getHoverMode = (point) => {
            const handles = getHandlePositions();
            const distanceTo = (handle) => Math.hypot(point.x - handle.x, point.y - handle.y);
            if (distanceTo(handles.rotateKnob) < 13) return 'rotate';
            if (distanceTo(handles.resizeXPositive) < 14 || distanceTo(handles.resizeXNegative) < 14) return 'resizeX';
            if (distanceTo(handles.resizeYPositive) < 14 || distanceTo(handles.resizeYNegative) < 14) return 'resizeY';
            if (distanceTo(handles.center) < 14) return 'move';
            const focus = getFocusRadii();
            // for inside test, unrotate point
            const lbState = ensureLensBlurState();
            const rot = (lbState.anchor.rotation||0)*Math.PI/180;
            const c=Math.cos(-rot), s=Math.sin(-rot);
            const dx = point.x - handles.center.x, dy = point.y - handles.center.y;
            const rx = dx*c - dy*s, ry = dx*s + dy*c;
            const normX = rx / Math.max(1, focus.x);
            const normY = ry / Math.max(1, focus.y);
            if ((normX * normX) + (normY * normY) <= 1.1) return 'move';
            return null;
        };
        const updateCursor = (point) => {
            if (!lbCanvas) return;
            const mode = dragMode || (point && getHoverMode(point));
            lbCanvas.style.cursor =
                mode === 'resizeX' ? 'ew-resize' :
                mode === 'resizeY' ? 'ns-resize' :
                mode === 'rotate' ? 'crosshair' :
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

        // expose show for toolManager
        this.showLensBlurUI = () => {
            ensureLensBlurState();
            overlay.style.display = 'block';
            if (paramPopup) paramPopup.style.display = 'none';
            setTimeout(() => {
                syncOverlayCanvas();
                this.drawLensBlurOverlay();
            }, 50);
        };
        if (btnLB) {
            btnLB.addEventListener('click', () => {
                // If this click was a toggle-close handled by setupToolPopup, skip reopening
                if (window.__toolToggleClosing === 'btn-lens-blur') { window.__toolToggleClosing = null; return; }
                // Otherwise, ensure state and show (fallback if opened outside toolManager)
                // But if already open via toolManager, this duplicate would double-show; guard
                if (window.App.toolManager.activeToolId === 'btn-lens-blur') return;
                this.showLensBlurUI();
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
            const lbState = ensureLensBlurState();
            const center = getCenterPoint();
            const focus = getFocusRadii();
            const outer = getOuterRadii();
            const rot = (lbState.anchor.rotation||0) * Math.PI/180;

            // outer glow for visibility over any image (fixes disappearance)
            ctx.save();
            ctx.shadowColor='rgba(0,0,0,0.55)'; ctx.shadowBlur=12;
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.96)';
            ctx.lineWidth = 2.2;
            ctx.beginPath();
            ctx.ellipse(center.x, center.y, focus.x, focus.y, rot, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
            ctx.setLineDash([8, 6]);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.62)';
            ctx.lineWidth=1.6;
            ctx.beginPath();
            ctx.ellipse(center.x, center.y, outer.x, outer.y, rot, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);

            const drawHandle = (x, y, active) => {
                ctx.beginPath();
                ctx.arc(x, y, active?9:7, 0, Math.PI * 2);
                ctx.fillStyle = active ? '#4285F4' : '#fff';
                ctx.fill();
                ctx.lineWidth = 2;
                ctx.strokeStyle = active ? '#fff' : '#4285F4';
                ctx.stroke();
                // outer ring for contrast
                ctx.beginPath(); ctx.arc(x,y, active?11:9,0,Math.PI*2); ctx.strokeStyle='rgba(0,0,0,0.35)'; ctx.lineWidth=1; ctx.stroke();
            };
            const c = Math.cos(rot), s=Math.sin(rot);
            const rotPt = (dx,dy)=>({x: center.x + dx*c - dy*s, y: center.y + dx*s + dy*c});
            const handles = [
                {p: center, mode:'move'},
                {p: rotPt(focus.x,0), mode:'resizeX'},
                {p: rotPt(-focus.x,0), mode:'resizeX'},
                {p: rotPt(0,-focus.y), mode:'resizeY'},
                {p: rotPt(0,focus.y), mode:'resizeY'},
                // rotation knob just outside outer X handle
                {p: rotPt(outer.x+14,0), mode:'rotate'}
            ];
            // draw
            handles.forEach(h=>{
                const isActive = dragMode===h.mode;
                // for rotate, check special
                drawHandle(h.p.x, h.p.y, isActive);
            });
            // rotation arc indicator
            if(lbState.anchor.rotation){
                ctx.beginPath(); ctx.arc(center.x, center.y, Math.max(focus.x, focus.y)+16, -0.2, rot, false);
                ctx.strokeStyle='rgba(66,133,244,0.75)'; ctx.lineWidth=1.5; ctx.setLineDash([4,4]); ctx.stroke(); ctx.setLineDash([]);
            }

            if (hint) {
                hint.textContent = 'Drag oval • Wheel=bokeh • Shift=softness • Alt=rotate • Ctrl=vignette';
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
            } else if (dragMode === 'rotate') {
                const ang = Math.atan2(point.y - center.y, point.x - center.x) * 180 / Math.PI;
                lbState.anchor.rotation = ((ang % 360) + 360) % 360;
                // also sync bokeh rotation for visual coherence
                lbState.bokehRotation = lbState.anchor.rotation;
            } else if (dragMode === 'resizeX' || dragMode === 'resizeY') {
                const dx = point.x - center.x, dy = point.y - center.y;
                const rot = (lbState.anchor.rotation||0) * Math.PI/180;
                const c=Math.cos(-rot), s=Math.sin(-rot);
                const rx = dx*c - dy*s, ry = dx*s + dy*c;
                if(dragMode==='resizeX') lbState.anchor.focusScaleX = Math.max(0.08, Math.min(0.45, Math.abs(rx) / minDimension));
                else lbState.anchor.focusScaleY = Math.max(0.08, Math.min(0.45, Math.abs(ry) / minDimension));
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
                if (e.altKey) {
                    lbState.bokehRotation = (lbState.bokehRotation + delta*3 + 360) % 360;
                    if(window.App.ui) window.App.ui.showToast('Rotation '+Math.round(lbState.bokehRotation)+'°','success');
                } else if (e.shiftKey) {
                    lbState.transition = Math.max(0, Math.min(100, lbState.transition + delta));
                } else if (e.ctrlKey || e.metaKey) {
                    lbState.vignetteStrength = Math.max(-100, Math.min(100, lbState.vignetteStrength + delta));
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

        // Phase: copy lens blur ellipse handles — vignette now has dual radii like lens blur
        const getRadii = () => {
            const s = ensureVignetteState();
            const maxDim = Math.max(vigCanvas.width, vigCanvas.height);
            const rxRaw = (s.anchor.radiusX!=null ? s.anchor.radiusX : s.anchor.radius);
            const ryRaw = (s.anchor.radiusY!=null ? s.anchor.radiusY : s.anchor.radius);
            return {x: rxRaw*maxDim, y: ryRaw*maxDim};
        };
        const getCenter = () => {
            const state = ensureVignetteState();
            return {
                x: state.anchor.x * vigCanvas.width,
                y: state.anchor.y * vigCanvas.height
            };
        };
        const getRadiusPx = () => {
            const r = getRadii();
            return Math.max(r.x, r.y);
        };
        const getHandlePositions = () => {
            const center = getCenter();
            const rad = getRadii();
            return {
                center,
                resizeXPositive: {x: center.x + rad.x, y: center.y},
                resizeXNegative: {x: center.x - rad.x, y: center.y},
                resizeYPositive: {x: center.x, y: center.y - rad.y},
                resizeYNegative: {x: center.x, y: center.y + rad.y}
            };
        };
        const getHoverMode = (point) => {
            const handles = getHandlePositions();
            const distTo = (h)=> Math.hypot(point.x - h.x, point.y - h.y);
            if(distTo(handles.resizeXPositive)<14 || distTo(handles.resizeXNegative)<14) return 'resizeX';
            if(distTo(handles.resizeYPositive)<14 || distTo(handles.resizeYNegative)<14) return 'resizeY';
            if(distTo(handles.center)<14) return 'move';
            const rad = getRadii();
            const nx = (point.x - handles.center.x)/Math.max(1, rad.x);
            const ny = (point.y - handles.center.y)/Math.max(1, rad.y);
            if(nx*nx + ny*ny <= 1.1) return 'move';
            return null;
        };
        const updateCursor = (point) => {
            const mode = dragMode || (point && getHoverMode(point));
            vigCanvas.style.cursor =
                mode === 'resizeX' ? 'ew-resize' :
                mode === 'resizeY' ? 'ns-resize' :
                mode === 'move' ? 'grab' :
                'crosshair';
        };

        if (manualBtn && paramPopup) {
            manualBtn.addEventListener('click', () => {
                paramPopup.style.display = paramPopup.style.display === 'none' ? 'block' : 'none';
            });
        }

        this.showVignetteUI = () => {
            overlay.style.display = 'block';
            ensureVignetteState();
            setTimeout(() => {
                syncOverlayCanvas();
                this.drawVignetteOverlay();
            }, 50);
        };
        if (btnVig) {
            btnVig.addEventListener('click', () => {
                if (window.__toolToggleClosing === 'btn-vignette') { window.__toolToggleClosing = null; return; }
                if (window.App.toolManager.activeToolId === 'btn-vignette') return;
                this.showVignetteUI();
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
            const rad = getRadii();
            const featherPct = (state.feather!=null? state.feather:45)/100;
            const feather = Math.max(14, Math.min(rad.x, rad.y) * (0.18 + featherPct*0.55));
            // inner ellipse (lens-blur style)
            ctx.save(); ctx.shadowColor='rgba(0,0,0,0.45)'; ctx.shadowBlur=10;
            ctx.beginPath();
            ctx.ellipse(cx, cy, rad.x, rad.y, 0, 0, Math.PI*2);
            ctx.setLineDash([8,6]);
            ctx.strokeStyle='rgba(255,255,255,0.96)'; ctx.lineWidth=2.2; ctx.stroke(); ctx.setLineDash([]);
            ctx.restore();
            ctx.beginPath();
            ctx.ellipse(cx, cy, rad.x+feather, rad.y+feather, 0, 0, Math.PI*2);
            ctx.setLineDash([6,6]);
            ctx.strokeStyle='rgba(255,255,255,0.52)'; ctx.lineWidth=1.6; ctx.stroke(); ctx.setLineDash([]);
            // center + handles like lens blur
            const drawHandle=(x,y,active)=>{
                ctx.beginPath(); ctx.arc(x,y, active?9:7,0,Math.PI*2);
                ctx.fillStyle= active?'#4285F4':'#fff'; ctx.fill();
                ctx.lineWidth=2; ctx.strokeStyle= active?'#fff':'#4285F4'; ctx.stroke();
                ctx.beginPath(); ctx.arc(x,y, active?11:9,0,Math.PI*2); ctx.strokeStyle='rgba(0,0,0,0.32)'; ctx.lineWidth=1; ctx.stroke();
            };
            const handles=getHandlePositions();
            drawHandle(cx, cy, dragMode==='move');
            drawHandle(handles.resizeXPositive.x, handles.resizeXPositive.y, dragMode==='resizeX');
            drawHandle(handles.resizeXNegative.x, handles.resizeXNegative.y, dragMode==='resizeX');
            drawHandle(handles.resizeYPositive.x, handles.resizeYPositive.y, dragMode==='resizeY');
            drawHandle(handles.resizeYNegative.x, handles.resizeYNegative.y, dragMode==='resizeY');

            if (hint) {
                hint.textContent = 'Wheel=outer • Shift=size • Alt=inner • Ctrl=feather';
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
                const st=ensureVignetteState();
                pinchStartRadius = {x: (st.anchor.radiusX!=null? st.anchor.radiusX:st.anchor.radius), y: (st.anchor.radiusY!=null? st.anchor.radiusY:st.anchor.radius)};
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
                const maxDim = Math.max(vigCanvas.width, vigCanvas.height);
                const baseX = pinchStartRadius.x, baseY = pinchStartRadius.y;
                const rx = Math.max(0.08, Math.min(1.2, baseX*scale));
                const ry = Math.max(0.08, Math.min(1.2, baseY*scale));
                state.anchor.radius = Math.max(rx,ry);
                state.anchor.radiusX = rx; state.anchor.radiusY = ry;
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
            const maxDim = Math.max(vigCanvas.width, vigCanvas.height);
            if (dragMode === 'move') {
                if (e.cancelable) e.preventDefault();
                state.anchor.x = Math.max(0, Math.min(1, point.x / vigCanvas.width));
                state.anchor.y = Math.max(0, Math.min(1, point.y / vigCanvas.height));
            } else if (dragMode === 'resizeX') {
                if (e.cancelable) e.preventDefault();
                const center = getCenter();
                const rx = Math.abs(point.x - center.x)/maxDim;
                state.anchor.radiusX = Math.max(0.08, Math.min(1.2, rx));
                state.anchor.radius = state.anchor.radiusX;
            } else if (dragMode === 'resizeY') {
                if (e.cancelable) e.preventDefault();
                const center = getCenter();
                const ry = Math.abs(point.y - center.y)/maxDim;
                state.anchor.radiusY = Math.max(0.08, Math.min(1.2, ry));
                state.anchor.radius = state.anchor.radiusY;
            } else if (dragMode === 'resize') {
                if (e.cancelable) e.preventDefault();
                const center = getCenter();
                const radiusPx = Math.hypot(point.x - center.x, point.y - center.y);
                const r = Math.max(0.08, Math.min(1.2, radiusPx / maxDim));
                state.anchor.radius = r; state.anchor.radiusX=r; state.anchor.radiusY=r;
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
                if ((e.ctrlKey||e.metaKey) && !e.shiftKey && !e.altKey) {
                    state.feather = Math.max(0, Math.min(100, (state.feather||45) + direction*3));
                    if(window.App.ui) window.App.ui.showToast('Feather '+state.feather,'success');
                } else if (e.shiftKey) {
                    // Phase C: elliptical resize — Shift drags both, plain drag is radius unified
                    state.anchor.radius = Math.max(0.08, Math.min(1.2, state.anchor.radius + (direction * 0.02)));
                    // keep elliptical in sync if used
                    if(state.anchor.radiusX!=null) state.anchor.radiusX=state.anchor.radius;
                    if(state.anchor.radiusY!=null) state.anchor.radiusY=state.anchor.radius;
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
        
        this.showTextUI = () => {
            syncTextOverlay();
            overlay.style.display = 'block';
            bottomBar.style.display = 'flex';
            window.App.state.text.enabled = true;
            if (customFontInput) {
                customFontInput.value = window.App.state.text.customFontFamily || '';
            }
            window.App.canvas.scheduleRender();
        };
        if (btnText) {
            btnText.addEventListener('click', () => {
                if (window.__toolToggleClosing === 'btn-text') { window.__toolToggleClosing = null; return; }
                if (window.App.toolManager.activeToolId === 'btn-text') return;
                this.showTextUI();
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
        // Phase C: Text align / shadow / outline
        document.querySelectorAll('.txt-align-btn').forEach(btn=>{
            btn.addEventListener('click', ()=>{
                const a=btn.getAttribute('data-align');
                window.App.state.text.align=a;
                document.querySelectorAll('.txt-align-btn').forEach(b=>b.classList.remove('active'));
                btn.classList.add('active');
                window.App.canvas.scheduleRender();
            });
            if(btn.getAttribute('data-align')===(window.App.state.text.align||'center')) btn.classList.add('active');
        });
        const shadowBtn=document.getElementById('txt-shadow-toggle');
        if(shadowBtn){
            const syncShadow=()=>{ shadowBtn.classList.toggle('active', !!window.App.state.text.shadow); shadowBtn.style.background= window.App.state.text.shadow ? 'var(--accent)' : ''; shadowBtn.style.color= window.App.state.text.shadow ? '#fff' : ''; };
            syncShadow();
            shadowBtn.addEventListener('click', ()=>{ window.App.state.text.shadow=!window.App.state.text.shadow; syncShadow(); window.App.canvas.scheduleRender(); });
        }
        const outlineBtn=document.getElementById('txt-outline-toggle');
        if(outlineBtn){
            const syncOutline=()=>{ outlineBtn.classList.toggle('active', !!window.App.state.text.outline); outlineBtn.style.background= window.App.state.text.outline ? 'var(--accent)' : ''; outlineBtn.style.color= window.App.state.text.outline ? '#fff' : ''; };
            syncOutline();
            outlineBtn.addEventListener('click', ()=>{ window.App.state.text.outline=!window.App.state.text.outline; syncOutline(); window.App.canvas.scheduleRender(); });
        }
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
            window.App.canvas.fitToContainer(false);
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

        // helper: visual drag state
        const setDragOver = (on) => {
            const target = uploadPrompt || container;
            if (!target) return;
            if (on) {
                target.classList.add('is-dragover');
                if (container) container.style.opacity = '0.82';
                if (uploadPrompt) { uploadPrompt.style.transform = 'scale(1.01)'; uploadPrompt.style.borderColor = 'var(--accent, #4285F4)'; }
            } else {
                target.classList.remove('is-dragover');
                if (container) container.style.opacity = '1';
                if (uploadPrompt) { uploadPrompt.style.transform = ''; uploadPrompt.style.borderColor = ''; }
            }
        };

        const handleDropFiles = (files) => {
            if (!files || !files.length) return;
            // pick first image or json
            const file = [...files].find(f => f.type.startsWith('image/') || /\.json$/i.test(f.name) || f.type==='application/json') || files[0];
            procFile(file);
        };

        const bindDrag = (el) => {
            if (!el) return;
            el.addEventListener('dragover', (e) => {
                // only react to files
                const hasFiles = e.dataTransfer && [...(e.dataTransfer.types||[])].includes('Files');
                if (!hasFiles) return;
                e.preventDefault();
                e.stopPropagation();
                if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
                setDragOver(true);
            });
            el.addEventListener('dragenter', (e) => {
                const hasFiles = e.dataTransfer && [...(e.dataTransfer.types||[])].includes('Files');
                if (!hasFiles) return;
                e.preventDefault();
                e.stopPropagation();
                setDragOver(true);
            });
            el.addEventListener('dragleave', (e) => {
                // only remove if leaving the element itself (not child)
                if (e.target === el || !el.contains(e.relatedTarget)) {
                    e.preventDefault();
                    e.stopPropagation();
                    setDragOver(false);
                }
            });
            el.addEventListener('drop', (e) => {
                e.preventDefault();
                e.stopPropagation();
                setDragOver(false);
                if (e.dataTransfer && e.dataTransfer.files) handleDropFiles(e.dataTransfer.files);
            });
        };

        // Bind to container, prompt, and window as fallback (preview iframe needs everywhere)
        if (container) bindDrag(container);
        if (uploadPrompt) {
            uploadPrompt.style.cursor = 'pointer';
            // clicking prompt (not button) also opens file picker
            uploadPrompt.addEventListener('click', (e) => {
                if (e.target.closest('button')) return; // button already handles
                if (imageUpload) imageUpload.click();
            });
            bindDrag(uploadPrompt);
        }
        // window-level fallback so drag anywhere works even when overlays steal pointer
        ['dragover','dragenter'].forEach(ev => {
            window.addEventListener(ev, (e) => {
                const hasFiles = e.dataTransfer && [...(e.dataTransfer.types||[])].includes('Files');
                if (!hasFiles) return;
                e.preventDefault();
                if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
                setDragOver(true);
            }, {passive:false});
        });
        window.addEventListener('dragleave', (e) => {
            if (e.clientX===0 && e.clientY===0) setDragOver(false);
        });
        window.addEventListener('drop', (e) => {
            e.preventDefault();
            setDragOver(false);
            if (e.dataTransfer && e.dataTransfer.files) handleDropFiles(e.dataTransfer.files);
        }, {passive:false});

        // paste from clipboard (Ctrl+V)
        window.addEventListener('paste', (e) => {
            const items = e.clipboardData && e.clipboardData.files;
            if (items && items.length) {
                const file = [...items][0];
                if (file && file.type && file.type.startsWith('image/')) {
                    e.preventDefault();
                    procFile(file);
                }
            }
        });

        // ensure file input can re-select same file
        if (imageUpload) {
            imageUpload.addEventListener('click', (e) => { e.target.value = ''; });
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
                if (window.App.toolManager.activeToolId === btnId) { window.__toolToggleClosing = btnId; window.App.toolManager.cancelTool(); return; }

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
                        // Phase C: ensure overlays show when opening via toolManager (covers duplicate btn handlers)
                        if (btnId === 'btn-lens-blur' && window.App.ui && window.App.ui.showLensBlurUI) window.App.ui.showLensBlurUI();
                        else if (btnId === 'btn-vignette' && window.App.ui && window.App.ui.showVignetteUI) window.App.ui.showVignetteUI();
                        else if (btnId === 'btn-text' && window.App.ui && window.App.ui.showTextUI) window.App.ui.showTextUI();
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

            // Handle Auto-Tune button if applicable — polished (histogram-based)
            if (hasAutoTune && contextBar) {
                const autoTuneBtn = contextBar.querySelector('[title="Auto Tune"]');
                if (autoTuneBtn) {
                    autoTuneBtn.addEventListener('click', () => {
                        // Try polished auto; fallback to subtle neutral if no image
                        let deltas = null;
                        if (window.App.filtersLogic && window.App.filtersLogic.applyAutoTune) {
                            deltas = window.App.filtersLogic.applyAutoTune();
                        }
                        if(!deltas){
                            // fallback subtle
                            const f = window.App.state.filters;
                            f.brightness = Math.max(-100, Math.min(100, f.brightness + 8));
                            f.contrast = Math.max(-100, Math.min(100, f.contrast + 8));
                            f.ambiance = Math.max(-100, Math.min(100, f.ambiance + 10));
                            deltas = {brightness:f.brightness, contrast:f.contrast, ambiance:f.ambiance};
                        }
                        // sync popup values
                        const keys = ['brightness','contrast','saturation','ambiance','highlights','shadows','warmth'];
                        keys.forEach(key => {
                            const domItem = popup.querySelector(`[data-filter="${key}"]`);
                            if (domItem) {
                                const valSpan = domItem.querySelector('.popup-value');
                                if (valSpan) valSpan.textContent = Math.round(window.App.state.filters[key]||0);
                            }
                        });
                        if(window.App.canvas) window.App.canvas.scheduleRender();
                        if(window.App.ui && window.App.ui.renderTuneHistogram) window.App.ui.renderTuneHistogram();
                        autoTuneBtn.classList.add('active');
                        setTimeout(() => autoTuneBtn.classList.remove('active'), 220);
                        if(window.App.ui) window.App.ui.showToast('Auto tuned from histogram', 'success');
                    });
                }
            }

        }
    }
};
