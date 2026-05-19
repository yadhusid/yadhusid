class VisualCMS {
    constructor() {
        this.isActive = window.location.href.includes('edit=true');
        this.selectedElement = null;
        this.historyStack = [];
        if (this.isActive) {
            console.log("[CMS] Initialization Active");
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this.init());
            } else {
                this.init();
            }
        }
    }

    init() {
        console.log("[CMS] Starting Engine...");
        document.body.classList.add('cms-enabled');
        this.injectCSS();
        this.makeElementsEditable();
        this.generateUniqueIds();
        this.bindEvents();
        this.bindGlobalEvents();
        this.bindMessageListener();
        
        window.parent.postMessage({ source: 'cms-engine', action: 'canvas-ready' }, '*');
    }
    
    saveState() {
        // Strip out volatile UI classes before saving state so undo doesn't get stuck in a hover/selected state
        document.querySelectorAll('.cms-selected, .cms-hover').forEach(el => el.classList.remove('cms-selected', 'cms-hover'));
        this.historyStack.push(document.body.innerHTML);
        if (this.historyStack.length > 30) this.historyStack.shift();
    }

    injectCSS() {
        const style = document.createElement('style');
        style.innerHTML = `
            .cms-hover { outline: 2px solid rgba(59, 130, 246, 0.4) !important; outline-offset: -2px !important; }
            .cms-selected { outline: 2px solid #3b82f6 !important; outline-offset: -2px !important; box-shadow: 0 0 0 1000px rgba(59, 130, 246, 0.05) !important; }
            .editable:hover, .editable-banner:hover { cursor: pointer; }
            hr.editable { height: 40px !important; border: none !important; background-color: transparent !important; position: relative; cursor: pointer; margin: 24px 0 !important; }
            hr.editable::after { content: ''; position: absolute; top: 50%; left: 0; right: 0; height: 1px; background-color: #E5E5E5; }
            .cms-drag-over-top { border-top: 4px solid #3b82f6 !important; }
            .cms-drag-over-bottom { border-bottom: 4px solid #3b82f6 !important; }
        `;
        document.head.appendChild(style);
    }

    makeElementsEditable() {
        const textElements = document.querySelectorAll('h1, h2, h3, h4, p, span:not(.cms-format-btn), a.btn-invert, button:not([class*="cms-"]), hr, div.cms-inserted');
        textElements.forEach(el => {
            if (el.closest('#project-categories') || el.closest('#projectsGrid')) {
                return;
            }
            el.classList.add('editable');
            el.setAttribute('draggable', 'true');
        });

        const banners = document.querySelectorAll('#hero-banner-container, #contact-banner-container');
        banners.forEach(b => {
            b.classList.add('editable-banner');
            b.setAttribute('draggable', 'true');
        });

        const allLinks = document.querySelectorAll('a');
        allLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                const href = link.getAttribute('href');
                if (href && !href.startsWith('#') && !href.includes('edit=true')) {
                    e.preventDefault();
                }
            });
        });
    }

    bindMessageListener() {
        window.addEventListener('message', (e) => {
            if (e.data.source === 'cms-dashboard') {
                const { action, data, id } = e.data;
                const el = id ? document.getElementById(id) : null;
                
                if (action === 'undo' && this.historyStack.length > 0) {
                    document.body.innerHTML = this.historyStack.pop();
                    this.makeElementsEditable();
                    this.generateUniqueIds();
                    this.bindEvents();
                    this.selectedElement = null;
                    this.notifyDashboard('global', null);
                    return;
                }
                
                if (action === 'scroll-to-section') {
                    const sec = document.getElementById(id);
                    if (sec) sec.scrollIntoView({ behavior: 'smooth' });
                }
                
                if (action === 'update-content' && el) {
                    if (el.innerHTML !== data.val || (data.href && el.getAttribute('href') !== data.href)) {
                        this.saveState();
                        el.innerHTML = data.val;
                        if (data.href && el.tagName === 'A') {
                            el.setAttribute('href', data.href);
                        }
                        
                        if (el.tagName === 'H2') {
                            if (el.closest('#expertise')) {
                                const navLink = document.querySelector('a.nav-scroll[href="#expertise"]');
                                if (navLink) navLink.innerHTML = data.val;
                            } else if (el.closest('#projects')) {
                                const navLink = document.querySelector('a.nav-scroll[href="#projects"]');
                                if (navLink) navLink.innerHTML = data.val;
                            }
                        }
                    }
                }
                
                if (action === 'update-style' && el && data.property) {
                    this.saveState();
                    el.style[data.property] = data.value;
                }
                
                if (action === 'update-banner' && el) {
                    this.saveState();
                    const mediaLayer = el.querySelector('.media-layer');
                    if (mediaLayer) {
                        mediaLayer.innerHTML = `<img src="${data.val}" class="w-full h-full object-cover">`;
                    }
                }
                
                if (action === 'insert-element') {
                    const targetEl = el || this.selectedElement;
                    if (!targetEl) {
                        alert('Please select an element first to insert below it.');
                        return;
                    }
                    this.saveState();
                    
                    let newHtml = '';
                    if (data.elementType === 'space') {
                        newHtml = `<div style="height: 25px;" class="editable cms-inserted" draggable="true"></div>`;
                    } else if (data.elementType === 'line') {
                        newHtml = `<hr class="border-[#E5E5E5] editable cms-inserted" style="margin: 24px 0;" draggable="true">`;
                    } else if (data.elementType === 'text') {
                        newHtml = `<p class="text-[clamp(13px,1vw,15px)] text-[#444] leading-[1.6] max-w-5xl font-light editable cms-inserted" style="margin-bottom:clamp(16px,1.8vw,36px)" draggable="true">New Text Block</p>`;
                    }
                    
                    if (newHtml) {
                        targetEl.insertAdjacentHTML('afterend', newHtml);
                        const newlyInserted = targetEl.nextElementSibling;
                        if (newlyInserted) {
                            newlyInserted.id = `cms-auto-new-${Date.now()}`;
                            this.bindDragEvents(newlyInserted);
                        }
                    }
                }
                
                if (action === 'delete-element' && el) {
                    this.saveState();
                    if (this.selectedElement === el) {
                        this.selectedElement = null;
                        this.notifyDashboard('global', null);
                    }
                    el.remove();
                }
                
                if (action === 'get-html') {
                    const clone = document.documentElement.cloneNode(true);
                    clone.querySelectorAll('.cms-sidebar, .cms-floating-toolbar, .cms-bottom-toolbar, script[src*="cms.js"], .editable, .cms-hover, .cms-selected, .editable-banner, .cms-inserted').forEach(el => {
                        el.classList.remove('editable', 'cms-hover', 'cms-selected', 'editable-banner', 'cms-inserted');
                        el.removeAttribute('contenteditable');
                        el.removeAttribute('draggable');
                        if (el.tagName === 'SCRIPT' && el.src.includes('cms.js')) el.remove();
                    });
                    window.parent.postMessage({ action: 'html-response', html: '<!DOCTYPE html>\n' + clone.outerHTML }, '*');
                }
            }
        });
    }

    generateUniqueIds() {
        const editables = document.querySelectorAll('.editable, .editable-banner');
        editables.forEach((el, index) => {
            if (!el.id) {
                el.id = `cms-auto-${index}`;
            }
        });
    }

    bindDragEvents(el) {
        el.addEventListener('dragstart', (e) => {
            this.draggedElement = el;
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', el.id);
            setTimeout(() => el.style.opacity = '0.5', 0);
        });

        el.addEventListener('dragend', (e) => {
            el.style.opacity = '1';
            document.querySelectorAll('.cms-drag-over-top, .cms-drag-over-bottom').forEach(node => {
                node.classList.remove('cms-drag-over-top', 'cms-drag-over-bottom');
            });
            this.draggedElement = null;
        });

        el.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            const rect = el.getBoundingClientRect();
            const midpoint = rect.top + rect.height / 2;
            
            document.querySelectorAll('.cms-drag-over-top, .cms-drag-over-bottom').forEach(node => {
                if (node !== el) node.classList.remove('cms-drag-over-top', 'cms-drag-over-bottom');
            });

            if (e.clientY < midpoint) {
                el.classList.add('cms-drag-over-top');
                el.classList.remove('cms-drag-over-bottom');
            } else {
                el.classList.add('cms-drag-over-bottom');
                el.classList.remove('cms-drag-over-top');
            }
        });

        el.addEventListener('dragleave', (e) => {
            el.classList.remove('cms-drag-over-top', 'cms-drag-over-bottom');
        });

        el.addEventListener('drop', (e) => {
            e.preventDefault();
            el.classList.remove('cms-drag-over-top', 'cms-drag-over-bottom');
            
            if (this.draggedElement && this.draggedElement !== el) {
                this.saveState();
                const rect = el.getBoundingClientRect();
                const midpoint = rect.top + rect.height / 2;
                if (e.clientY < midpoint) {
                    el.parentNode.insertBefore(this.draggedElement, el);
                } else {
                    el.parentNode.insertBefore(this.draggedElement, el.nextSibling);
                }
            }
        });
    }

    bindEvents() {
        document.querySelectorAll('.editable, .editable-banner').forEach(el => {
            this.bindDragEvents(el);
        });
    }

    bindGlobalEvents() {
        document.addEventListener('mouseover', (e) => {
            const el = e.target.closest('.editable') || e.target.closest('.editable-banner');
            if (el) el.classList.add('cms-hover');
        });
        document.addEventListener('mouseout', (e) => {
            const el = e.target.closest('.editable') || e.target.closest('.editable-banner');
            if (el) el.classList.remove('cms-hover');
        });
        document.addEventListener('click', (e) => {
            const editable = e.target.closest('.editable');
            const banner = e.target.closest('.editable-banner');
            
            document.querySelectorAll('.cms-selected').forEach(el => el.classList.remove('cms-selected'));
            
            if (editable) {
                e.preventDefault();
                e.stopPropagation();
                this.selectedElement = editable;
                this.selectedElement.classList.add('cms-selected');
                
                let type = 'text';
                if (editable.tagName === 'HR') type = 'hr';
                if (editable.tagName === 'DIV' && !editable.textContent.trim() && !editable.children.length) type = 'space';
                
                this.notifyDashboard(type, this.selectedElement);
            } else if (banner) {
                e.preventDefault();
                e.stopPropagation();
                this.selectedElement = banner;
                this.selectedElement.classList.add('cms-selected');
                this.notifyDashboard('banner', this.selectedElement);
            } else {
                this.notifyDashboard('global', null);
            }
        });
    }

    notifyDashboard(type, el) {
        let data = { type: type };
        if (el) {
            data.id = el.id;
            data.tagName = el.tagName;
            data.content = el.innerHTML;
            if (type === 'banner') {
                const img = el.querySelector('.media-layer img');
                data.bannerImage = img ? img.src : '';
            }
            const style = window.getComputedStyle(el);
            data.style = { fontSize: style.fontSize, borderRadius: style.borderRadius };
            if (el.tagName === 'A') data.href = el.getAttribute('href');
        }
        window.parent.postMessage({ source: 'cms-engine', action: 'element-selected', data: data }, '*');

    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.cms = new VisualCMS();
});
