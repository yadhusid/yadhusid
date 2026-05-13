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
        this.injectUI();
        this.makeElementsEditable();
        this.bindEvents();
        this.initCoreSkills();
        this.initProjectCategories();
        
        if (!window.Sortable) {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/sortablejs@latest/Sortable.min.js';
            script.onload = () => {
                this.initCoreSkills();
                this.initProjectCategories();
            };
            document.head.appendChild(script);
        }

        window.parent.postMessage({ source: 'cms-engine', action: 'canvas-ready' }, '*');
    }

    injectUI() {
        const isEmbedded = window.location.href.includes('embedded=true');
        if (!isEmbedded) {
            // Full CMS UI (Floating controls if not inside iframe)
            this.bottomToolbar = document.createElement('div');
            this.bottomToolbar.className = 'cms-bottom-toolbar';
            this.bottomToolbar.innerHTML = `
                <div class="cms-toolbar-brand">YADHU CMS</div>
                <button class="cms-save-btn">Publish Changes</button>
            `;
            document.body.appendChild(this.bottomToolbar);
        }

        this.floatingToolbar = document.createElement('div');
        this.floatingToolbar.className = 'cms-floating-toolbar';
        this.floatingToolbar.innerHTML = `
            <button class="cms-format-btn" data-command="bold">B</button>
            <button class="cms-format-btn" data-command="italic">I</button>
            <button class="cms-format-btn" data-command="createLink">🔗</button>
        `;
        document.body.appendChild(this.floatingToolbar);

        const style = document.createElement('style');
        style.innerHTML = `
            .cms-hover { outline: 2px solid rgba(59, 130, 246, 0.4) !important; outline-offset: -2px !important; }
            .cms-selected { outline: 2px solid #3b82f6 !important; outline-offset: -2px !important; box-shadow: 0 0 0 1000px rgba(59, 130, 246, 0.05) !important; }
            .editable:hover { cursor: pointer; }
            .cms-floating-toolbar { position: absolute; background: #000; border: 1px solid rgba(255,255,255,0.1); padding: 5px; border-radius: 8px; display: none; z-index: 10000; }
            .cms-floating-toolbar.active { display: flex; gap: 5px; }
            .cms-format-btn { background: none; border: none; color: #fff; padding: 5px 10px; cursor: pointer; border-radius: 4px; }
            .cms-format-btn:hover { background: rgba(255,255,255,0.1); }
        `;
        document.head.appendChild(style);
    }

    makeElementsEditable() {
        const textElements = document.querySelectorAll('h1, h2, h3, h4, p, span:not(.cms-format-btn), a.btn-invert, button:not([class*="cms-"])');
        textElements.forEach(el => {
            el.classList.add('editable');
            el.setAttribute('contenteditable', 'true');
        });

        const allLinks = document.querySelectorAll('a');
        allLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                const href = link.getAttribute('href');
                if (href && !href.startsWith('#') && !href.includes('edit=true')) {
                    e.preventDefault();
                    alert("Navigation disabled in editor.");
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
                if (action === 'update-content' && el) el.innerHTML = data.val;
                if (action === 'update-link' && el) el.setAttribute('href', data.val);
                if (action === 'update-style' && el) el.style[data.property] = data.value;
                if (action === 'get-html') {
                    const clone = document.documentElement.cloneNode(true);
                    clone.querySelectorAll('.cms-sidebar, .cms-floating-toolbar, .cms-bottom-toolbar, script[src*="cms.js"], .editable').forEach(el => {
                        el.classList.remove('editable');
                        el.removeAttribute('contenteditable');
                        if (el.tagName === 'SCRIPT' || el.classList.contains('cms-floating-toolbar')) el.remove();
                    });
                    window.parent.postMessage({ action: 'html-response', html: '<!DOCTYPE html>\n' + clone.outerHTML }, '*');
                }
            }
        });
    }

    bindEvents() {
        document.addEventListener('mouseover', (e) => {
            const el = e.target.closest('.editable');
            if (el) el.classList.add('cms-hover');
        });
        document.addEventListener('mouseout', (e) => {
            const el = e.target.closest('.editable');
            if (el) el.classList.remove('cms-hover');
        });
        document.addEventListener('click', (e) => {
            if (e.target.closest('.cms-floating-toolbar')) return;
            document.querySelectorAll('.cms-selected').forEach(el => el.classList.remove('cms-selected'));
            const editable = e.target.closest('.editable');
            if (editable) {
                this.selectedElement = editable;
                this.selectedElement.classList.add('cms-selected');
                this.positionFloatingToolbar(this.selectedElement);
                this.notifyDashboard('text', this.selectedElement);
            } else {
                this.floatingToolbar.classList.remove('active');
                this.notifyDashboard('global', null);
            }
        });
    }

    positionFloatingToolbar(el) {
        const rect = el.getBoundingClientRect();
        this.floatingToolbar.classList.add('active');
        this.floatingToolbar.style.top = `${rect.top + window.scrollY - 40}px`;
        this.floatingToolbar.style.left = `${rect.left + window.scrollX}px`;
    }

    notifyDashboard(type, el) {
        let data = { type: type };
        if (el) {
            data.id = el.id;
            data.tagName = el.tagName;
            data.content = el.innerHTML;
            const style = window.getComputedStyle(el);
            data.style = { fontSize: style.fontSize, borderRadius: style.borderRadius };
            if (el.tagName === 'A') data.href = el.getAttribute('href');
        }
        window.parent.postMessage({ source: 'cms-engine', action: 'element-selected', data: data }, '*');
    }

    initCoreSkills() { /* logic if needed */ }
    initProjectCategories() { /* logic if needed */ }
}

document.addEventListener('DOMContentLoaded', () => {
    window.cms = new VisualCMS();
});
