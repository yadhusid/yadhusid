/**
 * Anti-Gravity CMS Engine
 * Handles UI interactions, iframe scaling, and property synchronization
 */

class CMSEngine {
    constructor() {
        this.iframe = document.getElementById('canvas-iframe');
        this.iframeContainer = document.getElementById('iframe-container');
        this.selectedData = null;
        
        this.initUI();
        this.setupIframeBridge();
    }

    initUI() {
        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                const target = btn.getAttribute('data-target');
                ['panel-structure', 'panel-projects', 'panel-settings'].forEach(id => {
                    document.getElementById(id).classList.add('hidden');
                    document.getElementById(id).classList.remove('flex');
                });
                document.getElementById(target).classList.remove('hidden');
                document.getElementById(target).classList.add('flex');
            });
        });

        // Viewport Toggles
        const viewports = {
            'desktop': '1440px',
            'laptop': '1024px',
            'tablet': '768px',
            'mobile': '390px'
        };

        document.querySelectorAll('.device-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.device-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const view = btn.getAttribute('data-view');
                const width = viewports[view];
                
                this.iframeContainer.style.maxWidth = width;
                document.getElementById('canvas-size-label').innerText = `${parseInt(width)} x 900`;
            });
        });

        // Property Inputs Setup
        this.bindPropertyInputs();
        this.bindCornerToggles();
        this.bindLinkSettings();
    }

    bindPropertyInputs() {
        const inputs = {
            'prop-content': 'UPDATE_TEXT',
            'prop-size': 'UPDATE_STYLE|fontSize',
            'prop-weight': 'UPDATE_STYLE|fontWeight',
            'prop-mt': 'UPDATE_STYLE|marginTop',
            'prop-mb': 'UPDATE_STYLE|marginBottom',
            'prop-ml': 'UPDATE_STYLE|marginLeft',
            'prop-mr': 'UPDATE_STYLE|marginRight',
            'prop-pt': 'UPDATE_STYLE|paddingTop',
            'prop-pb': 'UPDATE_STYLE|paddingBottom',
            'prop-pl': 'UPDATE_STYLE|paddingLeft',
            'prop-pr': 'UPDATE_STYLE|paddingRight',
            'prop-width': 'UPDATE_STYLE|width',
            'prop-height': 'UPDATE_STYLE|height',
            'prop-radius': 'UPDATE_STYLE|borderRadius'
        };

        for (const [id, action] = Object.entries(inputs)) {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('input', (e) => {
                    if (!this.selectedData) return;
                    
                    let val = e.target.value;
                    if (['prop-size', 'prop-mt', 'prop-mb', 'prop-ml', 'prop-mr', 'prop-pt', 'prop-pb', 'prop-pl', 'prop-pr', 'prop-radius'].includes(id)) {
                        if (val !== '' && !val.endsWith('px') && !val.endsWith('%') && !val.endsWith('vw') && !val.endsWith('vh') && !val.endsWith('rem') && !val.endsWith('em') && !val.endsWith('auto')) {
                            val += 'px';
                        }
                    }

                    if (action === 'UPDATE_TEXT') {
                        this.sendMessage({ type: 'UPDATE_TEXT', value: val });
                    } else {
                        const prop = action.split('|')[1];
                        this.sendMessage({ type: 'UPDATE_STYLE', property: prop, value: val });
                    }
                });
            }
        }
    }

    bindCornerToggles() {
        const toggles = ['toggle-tl', 'toggle-tr', 'toggle-bl', 'toggle-br'];
        const properties = ['borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomLeftRadius', 'borderBottomRightRadius'];

        toggles.forEach((id, index) => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.addEventListener('click', () => {
                    btn.classList.toggle('active');
                    const isActive = btn.classList.contains('active');
                    const radiusInput = document.getElementById('prop-radius').value || '0';
                    const val = isActive ? (radiusInput.includes('px') ? radiusInput : radiusInput + 'px') : '0px';
                    
                    this.sendMessage({ 
                        type: 'UPDATE_STYLE', 
                        property: properties[index], 
                        value: val 
                    });
                });
            }
        });
    }

    bindLinkSettings() {
        const linkType = document.getElementById('prop-link-type');
        const linkUrl = document.getElementById('prop-link-url');
        const linkNewTab = document.getElementById('prop-link-newtab');

        if (linkType) {
            linkType.addEventListener('change', (e) => {
                const type = e.target.value;
                if (type === 'none') {
                    linkUrl.style.display = 'none';
                    linkNewTab.classList.add('hidden');
                    this.sendMessage({ type: 'UPDATE_ATTRIBUTE', attribute: 'href', value: null });
                } else {
                    linkUrl.style.display = 'block';
                    linkNewTab.classList.remove('hidden');
                    
                    if (type === 'email') linkUrl.placeholder = "mailto:yadhusid@gmail.com";
                    else if (type === 'section') linkUrl.placeholder = "#contact";
                    else linkUrl.placeholder = "https://...";
                }
            });
        }
        
        if (linkUrl) {
            linkUrl.addEventListener('input', (e) => {
                this.sendMessage({ type: 'UPDATE_ATTRIBUTE', attribute: 'href', value: e.target.value });
            });
        }
        
        const targetCheck = document.getElementById('link-target');
        if (targetCheck) {
            targetCheck.addEventListener('change', (e) => {
                const targetVal = e.target.checked ? '_blank' : null;
                this.sendMessage({ type: 'UPDATE_ATTRIBUTE', attribute: 'target', value: targetVal });
            });
        }
    }

    setupIframeBridge() {
        console.log("CMS Engine setupIframeBridge initialized.");
        window.addEventListener('message', (event) => {
            console.log("Parent received message:", event.data);
            if (!event.data || !event.data.type) return;
            const { type, data } = event.data;
            if (type === 'CANVAS_READY') {
                const loader = document.getElementById('iframe-loader');
                if (loader) {
                    loader.style.opacity = '0';
                    setTimeout(() => loader.remove(), 500);
                }
            }
            if (type === 'ELEMENT_SELECTED') {
                this.handleSelection(data);
            }
        });

        // Fallback for loader
        if (this.iframe) {
            this.iframe.addEventListener('load', () => {
                console.log("Iframe load event fired.");
                const loader = document.getElementById('iframe-loader');
                if (loader) {
                    loader.style.opacity = '0';
                    setTimeout(() => loader.remove(), 500);
                }
            });
        }
    }

    sendMessage(payload) {
        if (this.iframe && this.iframe.contentWindow) {
            this.iframe.contentWindow.postMessage(payload, '*');
        }
    }

    handleSelection(data) {
        this.selectedData = data;
        
        document.getElementById('no-selection').classList.add('hidden');
        document.getElementById('property-panel').classList.remove('hidden');
        document.getElementById('property-panel').classList.add('flex');

        // Header info
        document.getElementById('selected-tag').innerText = data.tag;
        document.getElementById('selected-class').innerText = data.className ? '.' + data.className.split(' ').join('.') : 'No Class';

        // Content
        const contentInput = document.getElementById('prop-content');
        if (contentInput) contentInput.value = data.content || '';

        // Style mapping
        const styleMap = {
            'prop-size': data.style.fontSize,
            'prop-weight': data.style.fontWeight,
            'prop-mt': data.style.marginTop,
            'prop-mb': data.style.marginBottom,
            'prop-ml': data.style.marginLeft,
            'prop-mr': data.style.marginRight,
            'prop-pt': data.style.paddingTop,
            'prop-pb': data.style.paddingBottom,
            'prop-pl': data.style.paddingLeft,
            'prop-pr': data.style.paddingRight,
            'prop-width': data.style.width,
            'prop-height': data.style.height,
            'prop-radius': data.style.borderRadius
        };

        for (const [id, val] of Object.entries(styleMap)) {
            const el = document.getElementById(id);
            if (el) {
                el.value = (val && val !== '0px') ? parseInt(val) || val : '';
            }
        }

        // Link Mapping
        const linkType = document.getElementById('prop-link-type');
        const linkUrl = document.getElementById('prop-link-url');
        
        if (data.attributes && data.attributes.href) {
            linkType.value = data.attributes.href.startsWith('#') ? 'section' : 
                             data.attributes.href.startsWith('mailto:') ? 'email' : 'external';
            
            linkType.dispatchEvent(new Event('change'));
            linkUrl.value = data.attributes.href;
            
            const targetCheck = document.getElementById('link-target');
            if (targetCheck) {
                targetCheck.checked = data.attributes.target === '_blank';
            }
        } else {
            linkType.value = 'none';
            linkType.dispatchEvent(new Event('change'));
            linkUrl.value = '';
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.cmsEngine = new CMSEngine();
});
