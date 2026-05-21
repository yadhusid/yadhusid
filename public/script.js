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
        if (header) {
            window.addEventListener('scroll', () => {
                if (window.scrollY > 20) {
                    header.classList.add('scrolled');
                } else {
                    header.classList.remove('scrolled');
                }
            });
            
            // Set initial state based on current scroll position
            if (window.scrollY > 20) {
                header.classList.add('scrolled');
            }
        }
    });
}
