class VisualCMS {
    constructor() {
        this.isActive = window.location.href.includes('edit=true');
        this.selectedElement = null;
        if (this.isActive) {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this.init());
            } else {
                this.init();
            }
        }
    }

    init() {
        document.body.classList.add('cms-enabled');
        this.injectUI();
        this.makeElementsEditable();
        this.bindEvents();
        this.initCoreSkills();
        this.initProjectCategories();
        
        // Add SortableJS dynamically if not present
        if (!window.Sortable) {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/sortablejs@latest/Sortable.min.js';
            script.onload = () => {
                this.initCoreSkills();
                this.initProjectCategories();
            };
            document.head.appendChild(script);
        }
    }

    injectUI() {
        const isEmbedded = window.location.href.includes('embedded=true');

        if (!isEmbedded) {
            // Visual Properties Sidebar
            this.sidebar = document.createElement('div');
            this.sidebar.className = 'cms-sidebar';
            this.sidebar.innerHTML = `
                <div class="cms-sidebar-header">
                    <h3>Visual Properties</h3>
                    <button class="cms-close-btn" onclick="document.querySelector('.cms-sidebar').classList.remove('open')">&times;</button>
                </div>
                <div class="cms-sidebar-content">
                    <div class="cms-section">
                        <h4>Corner Radius (Banner)</h4>
                        <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                            <div>
                                <label style="font-size:10px;color:#888;">Top Left</label>
                                <input type="number" id="cms-rad-tl" value="32" class="cms-input" onchange="window.cms.updateRadius('tl', this.value)">
                            </div>
                            <div>
                                <label style="font-size:10px;color:#888;">Top Right</label>
                                <input type="number" id="cms-rad-tr" value="32" class="cms-input" onchange="window.cms.updateRadius('tr', this.value)">
                            </div>
                            <div>
                                <label style="font-size:10px;color:#888;">Bottom Left</label>
                                <input type="number" id="cms-rad-bl" value="32" class="cms-input" onchange="window.cms.updateRadius('bl', this.value)">
                            </div>
                            <div>
                                <label style="font-size:10px;color:#888;">Bottom Right</label>
                                <input type="number" id="cms-rad-br" value="32" class="cms-input" onchange="window.cms.updateRadius('br', this.value)">
                            </div>
                        </div>
                    </div>
                    <div class="cms-section">
                        <h4>Core Skills</h4>
                        <div id="cms-skills-list" style="margin-bottom:10px;"></div>
                        <input type="text" id="cms-new-skill" placeholder="Skill Name" class="cms-input">
                        <button class="cms-action-btn" onclick="window.cms.addSkill()">+ Add Skill</button>
                        <p style="font-size:10px; color:#888; margin-top:8px;">Drag pills on the canvas to reorder.</p>
                    </div>
                    <p style="font-size: 11px; color: #888; margin-top: 20px;">Click any text, button, or link on the canvas to edit instantly.</p>
                </div>
            `;
            document.body.appendChild(this.sidebar);
            
            // Main Bottom Toolbar
            this.bottomToolbar = document.createElement('div');
            this.bottomToolbar.className = 'cms-bottom-toolbar';
            this.bottomToolbar.innerHTML = `
                <div class="cms-toolbar-brand" style="color:#fff; font-weight:800; font-size:12px; margin-right:15px;">YADHU CMS</div>
                <button class="cms-viewport-btn" onclick="document.querySelector('.cms-sidebar').classList.toggle('open')">Properties</button>
                <div class="cms-viewport-toggles">
                    <button class="cms-viewport-btn active" data-mode="desktop">Desktop</button>
                    <button class="cms-viewport-btn" data-mode="tablet">Tablet</button>
                    <button class="cms-viewport-btn" data-mode="mobile">Mobile</button>
                </div>
                <button class="cms-save-btn">Publish Changes</button>
            `;
            document.body.appendChild(this.bottomToolbar);
        }

        // Floating Formatting Toolbar (Always show for editing)
        this.floatingToolbar = document.createElement('div');
        this.floatingToolbar.className = 'cms-floating-toolbar';
        this.floatingToolbar.innerHTML = `
            <button class="cms-format-btn" data-command="bold">B</button>
            <button class="cms-format-btn" data-command="italic" style="font-style: italic;">I</button>
            <button class="cms-format-btn" data-command="createLink" style="text-decoration: underline;">🔗</button>
            <div class="cms-toolbar-divider"></div>
            <button class="cms-format-btn" data-command="formatBlock" data-value="H1" style="font-size: 11px;">H1</button>
            <button class="cms-format-btn" data-command="formatBlock" data-value="H2" style="font-size: 11px;">H2</button>
            <button class="cms-format-btn" data-command="formatBlock" data-value="P" style="font-size: 11px;">P</button>
        `;
        document.body.appendChild(this.floatingToolbar);

        // Add Selection Styles
        const style = document.createElement('style');
        style.innerHTML = `
            .cms-hover { 
                outline: 2px solid rgba(59, 130, 246, 0.4) !important; 
                outline-offset: -2px !important; 
            }
            .cms-selected { 
                outline: 2px solid #3b82f6 !important; 
                outline-offset: -2px !important; 
                box-shadow: 0 0 0 1000px rgba(59, 130, 246, 0.05) !important;
            }
            .editable:hover, .editable-media:hover { cursor: pointer; }
        `;
        document.head.appendChild(style);
    }

    makeElementsEditable() {
        // Text Elements
        const textElements = document.querySelectorAll('h1, h2, h3, h4, p, span:not(.cms-format-btn), button:not([class*="cms-"]), a.btn-invert, a.bg-white');
        textElements.forEach(el => {
            el.classList.add('editable');
            el.setAttribute('contenteditable', 'true');
        });

        // Prevent links from navigating away from edit mode
        const allLinks = document.querySelectorAll('a');
        allLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                const href = link.getAttribute('href');
                if (href && href.startsWith('#')) {
                    e.preventDefault();
                    document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' });
                } else if (href && !href.includes('edit=true')) {
                    e.preventDefault();
                    // We prevent navigating away so we don't lose unsaved changes
                    alert("Link navigation disabled in Edit Mode to prevent losing changes. To edit the link URL, select the text and use the 🔗 button.");
                }
            });
        });

        // Media/Background Elements
        const mediaElements = document.querySelectorAll('img, .reeded-gradient');
        mediaElements.forEach(el => {
            el.classList.add('editable-media');
            el.title = "Click to replace media";
            if (!el.id) el.id = 'media-' + Math.random().toString(36).substr(2, 9);
        });

        // Dashboard Command Listener
        window.addEventListener('message', (e) => {
            if (e.data.source === 'cms-dashboard') {
                const { action, data, id } = e.data;
                
                if (action === 'scroll-to-section') {
                    const sec = document.getElementById(e.data.id);
                    if (sec) sec.scrollIntoView({ behavior: 'smooth' });
                }

                if (action === 'update-content') {
                    const el = document.getElementById(data.id);
                    if (el) el.innerHTML = data.val;
                }

                if (action === 'update-link') {
                    const el = document.getElementById(data.id);
                    if (el) el.setAttribute('href', data.val);
                }

                if (action === 'trigger-media') {
                    const el = document.getElementById(data.id);
                    if (el) this.triggerMediaUpload(el);
                }

                if (action === 'update-style') {
                    const el = document.getElementById(data.id);
                    if (el) el.style[data.property] = data.value;
                }

                if (action === 'update-media') {
                    const container = document.getElementById(data.id);
                    if (!container) return;
                    const mediaLayer = container.querySelector('.media-layer');
                    if (!mediaLayer) return;

                    if (data.mediaType === 'video') {
                        mediaLayer.innerHTML = `<video autoplay muted loop playsinline class="media-content" style="width:100%;height:100%;object-fit:cover;"><source src="${data.src}" type="video/mp4"></video>`;
                    } else {
                        mediaLayer.innerHTML = `<img src="${data.src}" class="media-content" style="width:100%;height:100%;object-fit:cover;">`;
                    }
                }

                if (action === 'update-radius') {
                    this.updateRadius(data.corner, data.value);
                }

                if (action === 'add-skill') {
                    // Temporarily inject id for addSkill to find
                    const dummy = document.createElement('input');
                    dummy.id = 'cms-new-skill';
                    dummy.value = data.name;
                    document.body.appendChild(dummy);
                    this.addSkill();
                    dummy.remove();
                }

                if (action === 'update-glass') {
                    const container = document.getElementById(e.data.id);
                    if (container) {
                        const glass = container.querySelector('.glass-overlay');
                        if (glass) glass.style.opacity = e.data.value;
                    }
                }

                if (action === 'get-html') {
                    const clone = document.documentElement.cloneNode(true);
                    
                    // Cleanup CMS artifacts
                    clone.querySelectorAll('.cms-sidebar, .cms-floating-toolbar, .cms-bottom-toolbar, script[src*="cms.js"], .editable, .editable-media').forEach(el => {
                        el.classList.remove('editable', 'editable-media');
                        el.removeAttribute('contenteditable');
                        el.removeAttribute('title');
                        if (el.tagName === 'SCRIPT' || el.classList.contains('cms-sidebar')) el.remove();
                    });

                    // Remove auto-generated IDs from media elements
                    clone.querySelectorAll('[id^="media-"]').forEach(el => el.removeAttribute('id'));

                    const finalHTML = '<!DOCTYPE html>\n' + clone.outerHTML;
                    window.parent.postMessage({ action: 'html-response', html: finalHTML }, '*');
                }
            }
        });
    }

    bindEvents() {
        if (this.bottomToolbar) {
            // Viewport Toggles
            const viewportBtns = this.bottomToolbar.querySelectorAll('.cms-viewport-btn[data-mode]');
            viewportBtns.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    viewportBtns.forEach(b => b.classList.remove('active'));
                    e.target.classList.add('active');
                    
                    document.body.classList.remove('cms-mode-tablet', 'cms-mode-mobile');
                    const mode = e.target.dataset.mode;
                    if (mode !== 'desktop') {
                        document.body.classList.add(`cms-mode-${mode}`);
                    }
                });
            });

            // Publish Button
            const publishBtn = this.bottomToolbar.querySelector('.cms-save-btn');
            publishBtn.addEventListener('click', async () => {
                publishBtn.textContent = 'Publishing...';
                
                try {
                    // Clone the document to clean it
                    const clone = document.documentElement.cloneNode(true);
                    
                    // Remove CMS UI
                    const cmsElements = clone.querySelectorAll('.cms-sidebar, .cms-floating-toolbar, .cms-bottom-toolbar, script[src*="cms.js"], link[href*="cms.css"]');
                    cmsElements.forEach(el => el.remove());
                    
                    // Clean body classes
                    clone.querySelector('body').classList.remove('cms-enabled', 'cms-mode-tablet', 'cms-mode-mobile');
                    
                    // Remove editable attributes
                    clone.querySelectorAll('.editable').forEach(el => {
                        el.classList.remove('editable');
                        el.removeAttribute('contenteditable');
                    });
                    clone.querySelectorAll('.editable-media').forEach(el => {
                        el.classList.remove('editable-media');
                        el.removeAttribute('title');
                    });
                    
                    // Clear dynamic content
                    const projectsGrid = clone.querySelector('#projectsGrid');
                    if (projectsGrid) projectsGrid.innerHTML = '<!-- Content will load from portfolio.js -->';
                    
                    const categoryFilter = clone.querySelector('#categoryFilter');
                    if (categoryFilter) categoryFilter.innerHTML = '<!-- Dynamic from portfolio.js -->';
                    
                    // Strip out delete buttons from pills
                    clone.querySelectorAll('.cms-del-skill').forEach(el => el.remove());

                    // We need to keep the HTML structure intact
                    const finalHTML = '<!DOCTYPE html>\\n<html lang="en" class="scroll-smooth">\\n' + clone.innerHTML + '\\n</html>';
                    
                    const res = await fetch('/admin/save-cms', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ html: finalHTML })
                    });
                    
                    if (res.ok) {
                        publishBtn.textContent = 'Published!';
                        publishBtn.style.background = '#10b981';
                    } else {
                        publishBtn.textContent = 'Error!';
                        publishBtn.style.background = '#dc2626';
                    }
                } catch (err) {
                    console.error(err);
                    publishBtn.textContent = 'Error!';
                    publishBtn.style.background = '#dc2626';
                }
                
                setTimeout(() => {
                    publishBtn.textContent = 'Publish Changes';
                    publishBtn.style.background = '';
                }, 2000);
            });
        }

        // Formatting Toolbar Actions
        const formatBtns = this.floatingToolbar.querySelectorAll('.cms-format-btn');
        formatBtns.forEach(btn => {
            btn.addEventListener('mousedown', (e) => {
                e.preventDefault(); 
                const command = btn.dataset.command;
                if (command === 'createLink') {
                    const url = prompt('Enter link URL (e.g., https://google.com or mailto:user@email.com):');
                    if (url) {
                        document.execCommand(command, false, url);
                        // Make sure the new link is editable but doesn't navigate
                        const newLink = window.getSelection().anchorNode.parentNode;
                        if (newLink.tagName === 'A') {
                            newLink.setAttribute('contenteditable', 'true');
                            newLink.classList.add('editable');
                        }
                    }
                } else if (command === 'formatBlock') {
                    document.execCommand(command, false, btn.dataset.value);
                } else {
                    document.execCommand(command, false, null);
                }
            });
        });

        // Highlight on Hover
        document.addEventListener('mouseover', (e) => {
            const el = e.target.closest('.editable, .editable-media');
            if (el) el.classList.add('cms-hover');
        });
        document.addEventListener('mouseout', (e) => {
            const el = e.target.closest('.editable, .editable-media');
            if (el) el.classList.remove('cms-hover');
        });

        document.addEventListener('click', (e) => {
            if (e.target.closest('.cms-floating-toolbar') || e.target.closest('.cms-bottom-toolbar') || e.target.closest('.cms-sidebar')) {
                return;
            }

            // Remove previous selection
            document.querySelectorAll('.cms-selected').forEach(el => el.classList.remove('cms-selected'));

            const editable = e.target.closest('.editable');
            const media = e.target.closest('.editable-media');

            if (editable) {
                e.preventDefault();
                e.stopPropagation();
                this.selectedElement = editable;
                this.selectedElement.classList.add('cms-selected');
                this.positionFloatingToolbar(this.selectedElement);
                this.notifyDashboard('text', this.selectedElement);
            } else if (media) {
                e.preventDefault();
                e.stopPropagation();
                this.selectedElement = media;
                this.selectedElement.classList.add('cms-selected');
                this.floatingToolbar.classList.remove('active');
                this.notifyDashboard('media', this.selectedElement);
            } else {
                this.floatingToolbar.classList.remove('active');
                this.selectedElement = null;
                this.notifyDashboard('global', null);
            }
        });

        window.addEventListener('scroll', () => {
            if (this.selectedElement && this.floatingToolbar.classList.contains('active')) {
                this.positionFloatingToolbar(this.selectedElement);
            }
        });
    }

    positionFloatingToolbar(el) {
        const rect = el.getBoundingClientRect();
        this.floatingToolbar.classList.add('active');
        const top = rect.top + window.scrollY - this.floatingToolbar.offsetHeight - 10;
        const left = rect.left + window.scrollX + (rect.width / 2) - (this.floatingToolbar.offsetWidth / 2);
        this.floatingToolbar.style.top = \`\${Math.max(10, top)}px\`;
        this.floatingToolbar.style.left = \`\${Math.max(10, left)}px\`;
    }

    triggerMediaUpload(el) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*,video/*';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    if (el.tagName === 'IMG') {
                        el.src = event.target.result;
                    } else {
                        el.style.backgroundImage = `url('${event.target.result}')`;
                        el.style.backgroundSize = 'cover';
                        el.style.backgroundPosition = 'center';
                    }
                };
                reader.readAsDataURL(file);
            }
        };
        input.click();
    }

    notifyDashboard(type, el) {
        if (!window.location.href.includes('embedded=true')) return;

        let data = { type: type };
        
        if (el) {
            data.id = el.id;
            data.tagName = el.tagName;
            data.className = el.className;
            data.content = el.innerHTML;
            data.sectionId = el.closest('section')?.id;
            
            if (el.tagName === 'A') {
                data.href = el.getAttribute('href');
            }
            if (el.tagName === 'IMG') {
                data.src = el.src;
            }
            if (el.classList.contains('reeded-gradient')) {
                data.isBanner = true;
                const mediaLayer = el.querySelector('.media-layer');
                if (mediaLayer) {
                    const video = mediaLayer.querySelector('video');
                    const img = mediaLayer.querySelector('img');
                    if (video) {
                        data.mediaType = 'video';
                        data.src = video.querySelector('source')?.src;
                    } else if (img) {
                        data.mediaType = 'image';
                        data.src = img.src;
                    }
                }
            }

            // Extract Styles
            const style = window.getComputedStyle(el);
            data.style = {
                fontSize: style.fontSize || '16px',
                fontFamily: style.fontFamily || 'sans-serif',
                paddingBottom: style.paddingBottom || '0px',
                marginBottom: style.marginBottom || '0px',
                borderRadius: style.borderRadius || '0px'
            };

            // Banner Specific Styles
            if (data.isBanner) {
                const glass = el.querySelector('.glass-overlay');
                if (glass) {
                    data.glassOpacity = window.getComputedStyle(glass).opacity || 1;
                }
            }
        }

        window.parent.postMessage({
            source: 'cms-engine',
            action: 'element-selected',
            data: data
        }, '*');
    }

    initSortable() {
        // Skill pills sorting
        const skillsContainer = document.querySelector('#expertise-pills');
        if (skillsContainer) {
            new Sortable(skillsContainer, {
                animation: 150,
                ghostClass: 'cms-sortable-ghost',
                onEnd: () => this.notifyDashboard('global', null)
            });
        }

        // Category tabs sorting
        const tabsContainer = document.querySelector('#categoryFilter');
        if (tabsContainer) {
            new Sortable(tabsContainer, {
                animation: 150,
                ghostClass: 'cms-sortable-ghost',
                onEnd: () => this.notifyDashboard('global', null)
            });
        }
    }

    // -- Corner Radius System --
    updateRadius(corner, value) {
        document.documentElement.style.setProperty(`--radius-${corner}`, `${value}px`);
    }

    // -- Core Skills System --
    initCoreSkills() {
        const skillsContainer = document.querySelector('#expertise .flex.flex-wrap');
        if (!skillsContainer) return;
        
        // Add delete buttons to existing pills
        skillsContainer.querySelectorAll('span').forEach(pill => {
            if (!pill.querySelector('.cms-del-skill')) {
                const delBtn = document.createElement('button');
                delBtn.className = 'cms-del-skill';
                delBtn.innerHTML = '×';
                delBtn.style.cssText = 'background:rgba(0,0,0,0.1); border-radius:50%; width:16px; height:16px; display:flex; align-items:center; justify-content:center; margin-left:8px; font-size:10px; cursor:pointer; border:none;';
                delBtn.onclick = (e) => { e.stopPropagation(); pill.remove(); };
                pill.appendChild(delBtn);
                pill.style.cursor = 'grab';
            }
        });

        if (window.Sortable && !this.skillsSortable) {
            this.skillsSortable = new Sortable(skillsContainer, {
                animation: 150,
                ghostClass: 'cms-sortable-ghost'
            });
        }
    }

    addSkill() {
        const name = document.getElementById('cms-new-skill').value.trim();
        if (!name) return;
        
        const skillsContainer = document.querySelector('#expertise .flex.flex-wrap');
        if (!skillsContainer) return;

        const pill = document.createElement('span');
        pill.className = "bg-[#F2F2F2] rounded-full font-bold uppercase flex items-center gap-2 text-[#111] editable";
        pill.style.cssText = "padding:clamp(8px,0.7vw,10px) clamp(14px,1.5vw,20px);font-size:clamp(10px,0.7vw,11px);letter-spacing:0.08em; cursor:grab;";
        pill.setAttribute('contenteditable', 'true');
        
        pill.innerHTML = \`<div class="w-1.5 h-1.5 bg-[#111] rounded-full flex-shrink-0"></div> \${name}\`;
        
        const delBtn = document.createElement('button');
        delBtn.className = 'cms-del-skill';
        delBtn.innerHTML = '×';
        delBtn.style.cssText = 'background:rgba(0,0,0,0.1); border-radius:50%; width:16px; height:16px; display:flex; align-items:center; justify-content:center; margin-left:8px; font-size:10px; cursor:pointer; border:none;';
        delBtn.onclick = (e) => { e.stopPropagation(); pill.remove(); };
        pill.appendChild(delBtn);
        
        skillsContainer.appendChild(pill);
        document.getElementById('cms-new-skill').value = '';
    }

    // -- Project Categories System --
    initProjectCategories() {
        const catContainer = document.querySelector('#project-categories');
        if (!catContainer) return;
        
        // Add delete buttons to existing pills
        catContainer.querySelectorAll('button').forEach(pill => {
            if (!pill.querySelector('.cms-del-skill')) {
                const delBtn = document.createElement('span'); // Use span inside button
                delBtn.className = 'cms-del-skill';
                delBtn.innerHTML = '×';
                delBtn.style.cssText = 'background:rgba(0,0,0,0.1); border-radius:50%; width:14px; height:14px; display:flex; align-items:center; justify-content:center; margin-left:8px; font-size:10px; cursor:pointer; border:none;';
                delBtn.onclick = (e) => { e.stopPropagation(); pill.remove(); };
                pill.appendChild(delBtn);
                pill.style.display = 'inline-flex';
                pill.style.alignItems = 'center';
                pill.style.cursor = 'grab';
            }
        });

        if (window.Sortable && !this.catSortable) {
            this.catSortable = new Sortable(catContainer, {
                animation: 150,
                ghostClass: 'cms-sortable-ghost'
            });
        }
    }

    addCategoryPill() {
        const input = document.getElementById('cms-new-category');
        const name = input ? input.value.trim() : '';
        if (!name) return;
        
        const catContainer = document.querySelector('#project-categories');
        if (!catContainer) return;

        const pill = document.createElement('button');
        pill.className = "bg-[#F2F2F2] px-5 py-2.5 rounded-full text-[11px] font-bold uppercase tracking-widest text-[#111] hover:bg-black hover:text-white transition-all editable";
        pill.style.cssText = "display:inline-flex; align-items:center; cursor:grab;";
        pill.setAttribute('contenteditable', 'true');
        pill.innerText = name;
        
        const delBtn = document.createElement('span');
        delBtn.className = 'cms-del-skill';
        delBtn.innerHTML = '×';
        delBtn.style.cssText = 'background:rgba(0,0,0,0.1); border-radius:50%; width:14px; height:14px; display:flex; align-items:center; justify-content:center; margin-left:8px; font-size:10px; cursor:pointer; border:none;';
        delBtn.onclick = (e) => { e.stopPropagation(); pill.remove(); };
        pill.appendChild(delBtn);
        
        catContainer.appendChild(pill);
        if (input) input.value = '';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.cms = new VisualCMS();
});
