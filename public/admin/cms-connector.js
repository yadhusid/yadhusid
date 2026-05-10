/**
 * Anti-Gravity CMS: Visual Connector
 * Injected into the iframe (index.html) to enable live editing
 */

(function() {
    if (window.self === window.top) return; // Only run inside iframe

    console.log("[CMS Connector] Active");

    // Add Highlight Styles
    const style = document.createElement('style');
    style.innerHTML = `
        .cms-hover { 
            outline: 2px solid rgba(59, 130, 246, 0.5) !important; 
            cursor: default !important; 
            outline-offset: 1px !important; 
        }
        .cms-selected { 
            outline: 2px solid #3b82f6 !important; 
            outline-offset: 1px !important; 
            position: relative; 
            z-index: 999999; 
            box-shadow: 0 0 0 1000px rgba(59, 130, 246, 0.1), 0 0 20px rgba(59, 130, 246, 0.4) !important;
        }
    `;
    document.head.appendChild(style);

    let lastHovered = null;

    // Hover effect
    document.addEventListener('mouseover', (e) => {
        if (lastHovered) lastHovered.classList.remove('cms-hover');
        e.target.classList.add('cms-hover');
        lastHovered = e.target;
    });

    // Selection & Data Extraction
    document.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        document.querySelectorAll('.cms-selected').forEach(el => el.classList.remove('cms-selected'));
        const target = e.target;
        target.classList.add('cms-selected');
        target.setAttribute('data-cms-active', 'true');

        const computed = window.getComputedStyle(target);
        const rawClass = typeof target.className === 'string' ? target.className : (target.className && target.className.baseVal ? target.className.baseVal : '');
        
        const data = {
            tag: target.tagName.toLowerCase(),
            id: target.id || '',
            className: rawClass.replace('cms-hover', '').replace('cms-selected', '').trim(),
            content: target.innerText,
            attributes: {
                href: target.getAttribute('href') || '',
                target: target.getAttribute('target') || ''
            },
            style: {
                fontSize: computed.fontSize,
                fontWeight: computed.fontWeight,
                marginTop: computed.marginTop,
                marginBottom: computed.marginBottom,
                marginLeft: computed.marginLeft,
                marginRight: computed.marginRight,
                paddingTop: computed.paddingTop,
                paddingBottom: computed.paddingBottom,
                paddingLeft: computed.paddingLeft,
                paddingRight: computed.paddingRight,
                width: computed.width,
                height: computed.height,
                borderRadius: computed.borderRadius
            }
        };

        console.log("[CMS Connector] Sending ELEMENT_SELECTED:", data);
        window.parent.postMessage({ type: 'ELEMENT_SELECTED', data }, '*');
    }, true);

    // Listen for updates from CMS Engine
    window.addEventListener('message', (event) => {
        const { type, property, value, attribute, action, id } = event.data;
        
        // Handle global or section-level actions that don't need a selected element
        if (event.data.source === 'cms-dashboard') {
            if (action === 'update-spacing' && id) {
                const section = document.getElementById(id);
                if (section) section.style.paddingBottom = value;
                return;
            }
            if (action === 'scroll-to-section' && id) {
                const section = document.getElementById(id);
                if (section) section.scrollIntoView({ behavior: 'smooth', block: 'center' });
                return;
            }
        }

        const activeElement = document.querySelector('.cms-selected');
        if (!activeElement) return;

        if (type === 'UPDATE_TEXT') {
            activeElement.innerText = value;
        } 
        else if (type === 'UPDATE_STYLE') {
            activeElement.style[property] = value;
        }
        else if (type === 'UPDATE_ATTRIBUTE') {
            if (value === null) {
                activeElement.removeAttribute(attribute);
            } else {
                activeElement.setAttribute(attribute, value);
            }
        }
        else if (type === 'GET_HTML') {
            // Clean up CMS-specific classes before sending
            const clone = document.documentElement.cloneNode(true);
            clone.querySelectorAll('.cms-selected, .cms-hover').forEach(el => {
                el.classList.remove('cms-selected', 'cms-hover');
                if (el.classList.length === 0) el.removeAttribute('class');
            });
            // Remove the connector script itself from the clone
            clone.querySelectorAll('script[src*="cms-connector.js"]').forEach(s => s.remove());
            
            window.parent.postMessage({ type: 'HTML_RESPONSE', html: '<!DOCTYPE html>\n' + clone.outerHTML }, '*');
        }
    });

    // Notify ready
    window.parent.postMessage({ type: 'CANVAS_READY' }, '*');
})();
