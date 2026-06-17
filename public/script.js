// script.js — Core frontend animations and nav logic for yadsid.com

// ── Custom Cursor ─────────────────────────────────────────────────────────────
const cursor = document.querySelector('.cursor');
const cursorFollower = document.querySelector('.cursor-follower');

if (cursor && cursorFollower) {
    const interactiveElements = document.querySelectorAll('a, button, input, textarea');

    document.addEventListener('mousemove', (e) => {
        cursor.style.left = e.clientX + 'px';
        cursor.style.top = e.clientY + 'px';
        setTimeout(() => {
            cursorFollower.style.left = e.clientX + 'px';
            cursorFollower.style.top = e.clientY + 'px';
        }, 50);
    });

    interactiveElements.forEach(el => {
        el.addEventListener('mouseenter', () => cursorFollower.classList.add('hover'));
        el.addEventListener('mouseleave', () => cursorFollower.classList.remove('hover'));
    });
}

// ── Scroll Reveal Animations ──────────────────────────────────────────────────
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) entry.target.classList.add('visible');
    });
}, { root: null, rootMargin: '0px', threshold: 0.15 });

document.querySelectorAll('.fade-up, .fade-in').forEach(el => observer.observe(el));

// ── Contact Form ──────────────────────────────────────────────────────────────
const contactForm = document.getElementById('contactForm');
if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const btn = contactForm.querySelector('button[type="submit"]');
        const originalText = btn.textContent;
        btn.textContent = 'Sending...';
        btn.style.opacity = '0.7';
        setTimeout(() => {
            btn.textContent = 'Message Sent!';
            btn.style.opacity = '1';
            contactForm.reset();
            setTimeout(() => { btn.textContent = originalText; }, 3000);
        }, 1500);
    });
}

// ── Mobile Menu Toggle ────────────────────────────────────────────────────────
const hamburger = document.getElementById('hamburger');
const mobileMenuContent = document.getElementById('mobile-menu-content');
const mainNav = document.getElementById('main-nav');

function toggleMenu() {
    if (!hamburger || !mainNav || !mobileMenuContent) return;
    
    hamburger.classList.toggle('active');
    mainNav.classList.toggle('active');

    if (mainNav.classList.contains('active')) {
        mobileMenuContent.style.opacity = '1';
        mobileMenuContent.style.pointerEvents = 'auto';
        
        const spans = hamburger.querySelectorAll('span');
        spans[0].style.transform = 'translateY(7.5px) rotate(45deg)';
        spans[1].style.opacity = '0';
        spans[2].style.transform = 'translateY(-7.5px) rotate(-45deg)';
    } else {
        mobileMenuContent.style.opacity = '0';
        mobileMenuContent.style.pointerEvents = 'none';
        
        const spans = hamburger.querySelectorAll('span');
        spans[0].style.transform = '';
        spans[1].style.opacity = '1';
        spans[2].style.transform = '';
    }
}

if (hamburger) {
    hamburger.addEventListener('click', toggleMenu);
}

// ── Smooth Scroll for nav links ───────────────────────────────────────────────
document.querySelectorAll('.nav-scroll').forEach(link => {
    link.addEventListener('click', function(e) {
        const targetId = this.getAttribute('href');
        if (!targetId || !targetId.startsWith('#')) return;
        e.preventDefault();
        const target = document.querySelector(targetId);
        if (!target) return;

        // Close mobile menu if open
        if (mainNav && mainNav.classList.contains('active')) {
            toggleMenu();
        }

        const offset = targetId === '#home' ? 0 : 80;
        const top = target.getBoundingClientRect().top + window.pageYOffset - offset;
        window.scrollTo({ top, behavior: 'smooth' });
    });
});

// ── Header scroll effect: float → dock ───────────────────────────────────────
if (typeof window !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        const header = document.querySelector('header');
        if (!header) return;

        const SCROLL_THRESHOLD = 20; // ~1st scroll action

        function updateNavbarState() {
            if (window.scrollY > SCROLL_THRESHOLD) {
                header.classList.add('navbar-fixed-top', 'scrolled');
                header.classList.remove('navbar-hero-overlay');
            } else {
                header.classList.remove('navbar-fixed-top', 'scrolled');
                header.classList.add('navbar-hero-overlay');
            }
        }

        window.addEventListener('scroll', updateNavbarState, { passive: true });
        updateNavbarState(); // set correct state on load
    });
}

// Helper to convert hex string (#RRGGBB) to normalized RGB float array
function hexToRgb(hex, defaultColor) {
    if (!hex) return defaultColor;
    hex = hex.replace(/^#/, '');
    if (hex.length === 3) {
        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    if (hex.length !== 6) return defaultColor;
    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;
    return [r, g, b];
}

// ── Shader Gradient Animation (WebGL) ──────────────────────────────────────────
class ShaderGradient {
    constructor(canvas, colors = {}, speed = 0.25) {
        this.canvas = canvas;
        this.gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (!this.gl) {
            throw new Error('WebGL not supported');
        }
        
        // Colors mapping: hex/rgb normalization
        this.colors = {
            color1: colors.color1 || [0.34, 1.0, 0.55], // #57ff8c (mint green)
            color2: colors.color2 || [0.06, 0.84, 1.0],  // #0fd7ff (cyan/blue)
            color3: colors.color3 || [0.58, 0.65, 1.0],  // #94a6ff (lavender blue)
            bg: colors.bg || [1.0, 1.0, 1.0]
        };
        this.speed = speed;
        
        this.init();
    }

    init() {
        const gl = this.gl;
        
        const vsSource = `
            attribute vec2 position;
            void main() {
                gl_Position = vec4(position, 0.0, 1.0);
            }
        `;

        const fsSource = `
            precision mediump float;
            uniform vec2 u_resolution;
            uniform float u_time;
            uniform float u_speed;
            
            uniform vec3 u_color1;
            uniform vec3 u_color2;
            uniform vec3 u_color3;
            uniform vec3 u_bg;

            void main() {
                // Map coordinates to centered aspect-corrected space [-2.0, 2.0]
                vec2 p = (gl_FragCoord.xy * 2.0 - u_resolution.xy) / min(u_resolution.x, u_resolution.y) * 2.0;
                
                float t = u_time * u_speed; // Speed factor
                
                // 1. Simulate 3D rotation (45 degrees pitch around X-axis)
                // pitch angle: 45deg. cos(45) = 0.707, sin(45) = 0.707
                float yRot = p.y * 0.707;
                float zRot = p.y * 0.707; // Depth position prior to displacement
                
                // 2. Warp space organically using layered sine wave components (noise approximation)
                float dx = sin(p.y * 0.8 + t) * 0.6 + sin(p.y * 1.5 + t * 1.3) * 0.3;
                float dy = cos(p.x * 0.8 + t * 0.9) * 0.6 + cos(p.x * 1.4 + t * 1.1) * 0.3;
                vec2 warped = p + vec2(dx, dy) * 1.2;
                
                // 3. Calculate dynamic wave displacement (waterPlane height deformation)
                // We use multiple out-of-phase waves to create organic water-like movement
                float wave1 = sin(warped.x * 1.0 + t * 1.2) * cos(warped.y * 1.0 + t * 0.8);
                float wave2 = cos(warped.x * 1.8 - t * 0.9) * sin(warped.y * 1.5 + t * 1.4);
                float sDisplacement = wave1 * 0.6 + wave2 * 0.4;
                
                // High-contrast sharp wave displacement (using smoothstep on a threshold)
                // This creates sharp lines/contours of waves deforming and moving
                float threshold = sin(warped.y * 2.0 - t * 0.5) * 0.15;
                float shDisplacement = smoothstep(threshold - 0.05, threshold + 0.05, sDisplacement) * 2.0 - 1.0;
                
                // Spatially varying blend factor to transition between sharp and blur waves
                float waveBlend = clamp(0.5 + 0.5 * sin(p.x * 1.5 - t * 0.6), 0.0, 1.0);
                float displacement = mix(sDisplacement, shDisplacement, waveBlend);
                
                // Total Z height position (incorporating both the pitch angle tilt and wave displacement)
                float vPosZ = zRot + displacement * 1.6;
                
                // 4. Color Blending in Squared (Gamma-Correct) Space:
                // Mix color1 and color2 horizontally (X-axis) using smoothstep
                vec3 c1_sq = u_color1 * u_color1;
                vec3 c2_sq = u_color2 * u_color2;
                vec3 c3_sq = u_color3 * u_color3;
                
                vec3 xBlend_sq = mix(c1_sq, c2_sq, smoothstep(-2.0, 2.0, warped.x));
                
                // Mix the resulting horizontal gradient with color3 based on the height displacement (Z-axis)
                float zBlendFactor = clamp((vPosZ + 1.8) / 3.6, 0.0, 1.0);
                vec3 colorBlend_sq = mix(xBlend_sq, c3_sq, zBlendFactor);
                
                // Convert back from squared space to get final vibrant color
                vec3 col = sqrt(colorBlend_sq);
                
                gl_FragColor = vec4(col, 1.0);
            }
        `;

        const vs = this.compileShader(vsSource, gl.VERTEX_SHADER);
        const fs = this.compileShader(fsSource, gl.FRAGMENT_SHADER);
        if (!vs || !fs) return;

        this.program = gl.createProgram();
        gl.attachShader(this.program, vs);
        gl.attachShader(this.program, fs);
        gl.linkProgram(this.program);
        
        if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
            console.error('Shader linking failed:', gl.getProgramInfoLog(this.program));
            return;
        }

        const vertices = new Float32Array([
            -1, -1,
             1, -1,
            -1,  1,
            -1,  1,
             1, -1,
             1,  1
        ]);
        
        this.buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

        this.positionLoc = gl.getAttribLocation(this.program, 'position');
        this.resolutionLoc = gl.getUniformLocation(this.program, 'u_resolution');
        this.timeLoc = gl.getUniformLocation(this.program, 'u_time');
        this.speedLoc = gl.getUniformLocation(this.program, 'u_speed');
        
        this.color1Loc = gl.getUniformLocation(this.program, 'u_color1');
        this.color2Loc = gl.getUniformLocation(this.program, 'u_color2');
        this.color3Loc = gl.getUniformLocation(this.program, 'u_color3');
        this.bgLoc = gl.getUniformLocation(this.program, 'u_bg');

        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    compileShader(source, type) {
        const gl = this.gl;
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error('Shader compilation error:', gl.getShaderInfoLog(shader));
            return null;
        }
        return shader;
    }

    resize() {
        const gl = this.gl;
        const displayWidth  = this.canvas.clientWidth;
        const displayHeight = this.canvas.clientHeight;

        if (this.canvas.width  !== displayWidth ||
            this.canvas.height !== displayHeight) {
            this.canvas.width  = displayWidth;
            this.canvas.height = displayHeight;
        }
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }

    render(time) {
        const gl = this.gl;
        if (!gl) return;

        gl.clearColor(1.0, 1.0, 1.0, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.useProgram(this.program);

        gl.enableVertexAttribArray(this.positionLoc);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
        gl.vertexAttribPointer(this.positionLoc, 2, gl.FLOAT, false, 0, 0);

        gl.uniform2f(this.resolutionLoc, this.canvas.width, this.canvas.height);
        gl.uniform1f(this.timeLoc, time * 0.001);
        gl.uniform1f(this.speedLoc, this.speed);

        gl.uniform3fv(this.color1Loc, this.colors.color1);
        gl.uniform3fv(this.colors.color2 ? this.color2Loc : this.color1Loc, this.colors.color2 || this.colors.color1);
        gl.uniform3fv(this.colors.color3 ? this.color3Loc : this.color1Loc, this.colors.color3 || this.colors.color1);
        gl.uniform3fv(this.bgLoc, this.colors.bg);

        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
}

function initShaderGradients() {
    const data = window.CMS_DATA || {};
    const heroConfig = data.hero || {};
    const contactConfig = data.contact || {};
    
    // Fallback/base colors (Mint, Magenta, Lavender)
    const defaultColor1 = [0.62, 0.99, 0.74]; // #9effbe
    const defaultColor2 = [0.97, 0.51, 1.0];  // #f782ff
    const defaultColor3 = [0.61, 0.55, 1.0];  // #9c8cff
    
    const containers = [
        {
            id: 'hero-banner-container',
            enabled: heroConfig.gradientEnabled !== false,
            speed: heroConfig.gradientSpeed !== undefined ? parseFloat(heroConfig.gradientSpeed) : 0.25,
            colors: {
                color1: hexToRgb(heroConfig.gradientColor1, defaultColor1),
                color2: hexToRgb(heroConfig.gradientColor2, defaultColor2),
                color3: hexToRgb(heroConfig.gradientColor3, defaultColor3),
                bg: [1.0, 1.0, 1.0]
            }
        },
        {
            id: 'contact-banner-container',
            enabled: contactConfig.gradientEnabled !== false,
            speed: contactConfig.gradientSpeed !== undefined ? parseFloat(contactConfig.gradientSpeed) : 0.25,
            colors: {
                color1: hexToRgb(contactConfig.gradientColor1, defaultColor1),
                color2: hexToRgb(contactConfig.gradientColor2, defaultColor2),
                color3: hexToRgb(contactConfig.gradientColor3, defaultColor3),
                bg: [1.0, 1.0, 1.0]
            }
        }
    ];

    const instances = [];

    // Cancel existing animation loop if any
    if (window._shaderAnimFrameId) {
        cancelAnimationFrame(window._shaderAnimFrameId);
        window._shaderAnimFrameId = null;
    }

    containers.forEach(cfg => {
        const container = document.getElementById(cfg.id);
        if (!container) return;

        let canvas = container.querySelector('.shader-gradient-canvas');
        if (!cfg.enabled) {
            if (canvas) canvas.remove();
            if (cfg.id === 'hero-banner-container') {
                container.style.background = '#ffffff';
            } else {
                container.style.background = '';
            }
            container.classList.add('gradient-disabled');
            return;
        }

        container.style.position = 'relative';
        container.style.isolation = 'isolate';
        container.style.background = ''; // reset fallback
        container.classList.remove('gradient-disabled');

        if (!canvas) {
            canvas = document.createElement('canvas');
            canvas.className = 'shader-gradient-canvas absolute inset-0 w-full h-full object-cover pointer-events-none';
            canvas.style.position = 'absolute';
            canvas.style.top = '0';
            canvas.style.left = '0';
            canvas.style.width = '100%';
            canvas.style.height = '100%';
            canvas.style.objectFit = 'cover';
            canvas.style.pointerEvents = 'none';
            canvas.style.zIndex = '0';
            canvas.style.borderRadius = 'inherit';
            container.insertBefore(canvas, container.firstChild);
        }
        try {
            const inst = new ShaderGradient(canvas, cfg.colors, cfg.speed);
            instances.push(inst);
        } catch (e) {
            console.warn('WebGL failed to initialize for container', cfg.id, e);
            if (cfg.id === 'hero-banner-container') {
                container.style.background = '#ffffff';
            } else {
                container.style.background = '';
            }
            container.classList.add('gradient-disabled');
        }
    });

    if (instances.length > 0) {
        function animate(time) {
            instances.forEach(inst => inst.render(time));
            window._shaderAnimFrameId = requestAnimationFrame(animate);
        }
        window._shaderAnimFrameId = requestAnimationFrame(animate);
    }
}

// Initialize on DOMContentLoaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initShaderGradients);
} else {
    initShaderGradients();
}

// ── Hero Heading Loop Animation ───────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // 1. Hero Text Loop Animation (like Core Skills roll)
    const heroTitleContainer = document.getElementById('hero-title-container');
    const heroRoles = document.querySelectorAll('.hero-role');
    
    if (heroTitleContainer && heroRoles.length === 3 && typeof gsap !== 'undefined') {
        // Reset tailwind classes to allow GSAP full control
        heroRoles.forEach(r => r.classList.remove('translate-y-[20px]'));
        
        if (!prefersReducedMotion) {
            // Split text into spans for staggered letter animation, preserving <br> tags
            heroRoles.forEach(role => {
                const newHtml = [];
                role.childNodes.forEach(node => {
                    if (node.nodeType === 3) { // Text node
                        [...node.textContent].forEach(char => {
                            if (char === ' ') newHtml.push('<span>&nbsp;</span>');
                            else newHtml.push(`<span style="display:inline-block">${char}</span>`);
                        });
                    } else if (node.nodeType === 1) { // Element node
                        newHtml.push(node.outerHTML);
                    }
                });
                role.innerHTML = newHtml.join('');
            });

            // Setup initial states
            gsap.set(heroRoles[0].querySelectorAll('span'), { yPercent: 0, opacity: 1 });
            gsap.set(heroRoles[1].querySelectorAll('span'), { yPercent: 100, opacity: 0 });
            gsap.set(heroRoles[2].querySelectorAll('span'), { yPercent: 100, opacity: 0 });
            
            // Ensure container visibility is handled by children spans
            gsap.set([heroRoles[1], heroRoles[2]], { opacity: 1 });

            // Create infinite loop timeline
            const loopTl = gsap.timeline({ repeat: -1 });
            const stag = 0.02;

            // 0 -> 1
            loopTl.to(heroRoles[0].querySelectorAll('span'), { yPercent: -100, opacity: 0, duration: 0.6, stagger: stag, ease: "power2.inOut", delay: 3 })
                  .to(heroRoles[1].querySelectorAll('span'), { yPercent: 0, opacity: 1, duration: 0.6, stagger: stag, ease: "power2.inOut" }, "<")
            // 1 -> 2
                  .to(heroRoles[1].querySelectorAll('span'), { yPercent: -100, opacity: 0, duration: 0.6, stagger: stag, ease: "power2.inOut", delay: 3 })
                  .to(heroRoles[2].querySelectorAll('span'), { yPercent: 0, opacity: 1, duration: 0.6, stagger: stag, ease: "power2.inOut" }, "<")
            // 2 -> 0
                  .to(heroRoles[2].querySelectorAll('span'), { yPercent: -100, opacity: 0, duration: 0.6, stagger: stag, ease: "power2.inOut", delay: 3 })
                  .set(heroRoles[0].querySelectorAll('span'), { yPercent: 100 })
                  .to(heroRoles[0].querySelectorAll('span'), { yPercent: 0, opacity: 1, duration: 0.6, stagger: stag, ease: "power2.inOut" }, "<");
        } else {
            // Reduced motion: just show first heading cleanly
            gsap.set(heroRoles[0], { opacity: 1, y: 0 });
            gsap.set(heroRoles[1], { opacity: 0, display: 'none' });
            gsap.set(heroRoles[2], { opacity: 0, display: 'none' });
        }
    }
});
