// Custom Cursor
const cursor = document.querySelector('.cursor');
const cursorFollower = document.querySelector('.cursor-follower');
const interactiveElements = document.querySelectorAll('a, button, input, textarea');

// Update cursor position
document.addEventListener('mousemove', (e) => {
    cursor.style.left = e.clientX + 'px';
    cursor.style.top = e.clientY + 'px';
    
    // Slight delay for the follower
    setTimeout(() => {
        cursorFollower.style.left = e.clientX + 'px';
        cursorFollower.style.top = e.clientY + 'px';
    }, 50);
});

// Add hover effect to interactive elements
interactiveElements.forEach(el => {
    el.addEventListener('mouseenter', () => {
        cursorFollower.classList.add('hover');
    });
    
    el.addEventListener('mouseleave', () => {
        cursorFollower.classList.remove('hover');
    });
});

// Scroll Reveal Animations
const observerOptions = {
    root: null,
    rootMargin: '0px',
    threshold: 0.15
};

const observer = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            // Optional: Stop observing once revealed
            // observer.unobserve(entry.target);
        }
    });
}, observerOptions);

const animateElements = document.querySelectorAll('.fade-up, .fade-in');
animateElements.forEach(el => observer.observe(el));

// Form Submission
const contactForm = document.getElementById('contactForm');
if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const btn = contactForm.querySelector('.submit-btn');
        const originalText = btn.textContent;
        
        btn.textContent = 'Sending...';
        btn.style.opacity = '0.7';
        
        // Simulate API call
        setTimeout(() => {
            btn.textContent = 'Message Sent!';
            btn.style.background = '#10b981'; // Green
            btn.style.opacity = '1';
            contactForm.reset();
            
            setTimeout(() => {
                btn.textContent = originalText;
                btn.style.background = '';
            }, 3000);
        }, 1500);
    });
}

// Mobile Menu Toggle
const hamburger = document.getElementById('hamburger');
const navLinks = document.getElementById('navLinks');
const navItems = document.querySelectorAll('.nav-links a');

if (hamburger && navLinks) {
    hamburger.addEventListener('click', () => {
        hamburger.classList.toggle('active');
        navLinks.classList.toggle('active');
    });

    // Close menu when clicking a link
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            hamburger.classList.remove('active');
            navLinks.classList.remove('active');
        });
    });
}

// Header scroll effect - Removed dark transition to maintain white glass theme
/*
const header = document.querySelector('header');
window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
        header.style.background = 'rgba(10, 10, 15, 0.95)';
        header.style.boxShadow = '0 5px 20px rgba(0,0,0,0.5)';
    } else {
        header.style.background = 'rgba(10, 10, 15, 0.8)';
        header.style.boxShadow = 'none';
    }
});
*/
