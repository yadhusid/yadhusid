class VisualCMS {
    constructor() {
        this.isActive = window.location.href.includes('edit=true');
        this.selectedElement = null;
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
        
        window.parent.postMessage({ source: 'cms-engine', action: 'canvas-ready' }, '*');
    }

    injectCSS() {
        const style = document.createElement('style');
        style.innerHTML = `
            .cms-hover { outline: 2px solid rgba(59, 130, 246, 0.4) !important; outline-offset: -2px !important; }
            .cms-selected { outline: 2px solid #3b82f6 !important; outline-offset: -2px !important; box-shadow: 0 0 0 1000px rgba(59, 130, 246, 0.05) !important; }
            .editable:hover, .editable-banner:hover { cursor: pointer; }
        `;
        document.head.appendChild(style);
    }

    makeElementsEditable() {
        const textElements = document.querySelectorAll('h1, h2, h3, h4, p, span:not(.cms-format-btn), a.btn-invert, button:not([class*="cms-"]), hr');
        textElements.forEach(el => {
            if (el.closest('#project-categories') || el.closest('#projectsGrid')) {
                return;
            }
            el.classList.add('editable');
        });

        const banners = document.querySelectorAll('#hero-banner-container, #contact-banner-container');
        banners.forEach(b => {
            b.classList.add('editable-banner');
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

        window.addEventListener('message', (e) => {
            if (e.data.source === 'cms-dashboard') {
                const { action, data, id } = e.data;
                const el = id ? document.getElementById(id) : null;
                
                if (action === 'scroll-to-section') {
                    const sec = document.getElementById(id);
                    if (sec) sec.scrollIntoView({ behavior: 'smooth' });
                }
                
                if (action === 'update-content' && el) {
                    el.innerHTML = data.val;
                    if (data.href && el.tagName === 'A') {
                        el.setAttribute('href', data.href);
                    }
                    
                    // Synchronization Logic for Navigation Menu
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
                
                if (action === 'update-style' && el && data.property) {
                    el.style[data.property] = data.value;
                }
                
                if (action === 'update-banner' && el) {
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
                    
                    let newHtml = '';
                    if (data.elementType === 'space') {
                        newHtml = `<div style="height: 50px;" class="editable cms-inserted"></div>`;
                    } else if (data.elementType === 'line') {
                        newHtml = `<hr class="border-[#E5E5E5] editable cms-inserted" style="margin: 24px 0;">`;
                    } else if (data.elementType === 'text') {
                        newHtml = `<p class="text-[clamp(14px,1vw,16px)] text-[#666] leading-[1.6] editable cms-inserted">New Text Block</p>`;
                    }
                    
                    if (newHtml) {
                        targetEl.insertAdjacentHTML('afterend', newHtml);
                        const newlyInserted = targetEl.nextElementSibling;
                        if (newlyInserted) {
                            newlyInserted.id = `cms-auto-new-${Date.now()}`;
                        }
                    }
                }
                
                if (action === 'delete-element' && el) {
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

    bindEvents() {
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
                const type = editable.tagName === 'HR' ? 'hr' : 'text';
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
