document.addEventListener('DOMContentLoaded', () => {

    // 1. Scroll Progress Bar Indicator
    const scrollProgress = document.getElementById('scrollProgress');
    
    // 2. Back-to-Top Button Toggle
    const backToTopBtn = document.getElementById('backToTopBtn');

    window.addEventListener('scroll', () => {
        const scrollTop = window.scrollY;
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        const scrollPercent = (scrollTop / docHeight) * 100;
        
        if (scrollProgress) {
            scrollProgress.style.width = `${scrollPercent}%`;
        }

        if (backToTopBtn) {
            if (window.scrollY > 400) {
                backToTopBtn.classList.add('visible');
            } else {
                backToTopBtn.classList.remove('visible');
            }
        }
    });

    if (backToTopBtn) {
        backToTopBtn.addEventListener('click', () => {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    }

    // 3. Animated Metric Counter Engine
    const counters = document.querySelectorAll('.counter');
    let hasAnimatedCounters = false;

    const startCounters = () => {
        counters.forEach(counter => {
            const target = +counter.getAttribute('data-target');
            const duration = 1800;
            const stepTime = 20;
            const steps = duration / stepTime;
            const increment = target / steps;
            let current = 0;

            const timer = setInterval(() => {
                current += increment;
                if (current >= target) {
                    counter.textContent = target;
                    clearInterval(timer);
                } else {
                    counter.textContent = Math.ceil(current);
                }
            }, stepTime);
        });
    };

    const metricsSection = document.getElementById('metrics');
    if (metricsSection) {
        const metricsObserver = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting && !hasAnimatedCounters) {
                hasAnimatedCounters = true;
                startCounters();
            }
        }, { threshold: 0.3 });

        metricsObserver.observe(metricsSection);
    }

    // 4. Theme Toggle (Light / Dark Mode)
    const themeToggleBtn = document.getElementById('themeToggleBtn');

    // Shared with the dashboard pages, so both use the same theme
    function setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        themeToggleBtn.textContent = theme === 'dark' ? '🌙 Theme' : '☀️ Theme';
        try { localStorage.setItem('neutrixTheme', theme); } catch (e) {}
    }
    let savedTheme = 'light';
    try { savedTheme = localStorage.getItem('neutrixTheme') || 'light'; } catch (e) {}
    setTheme(savedTheme === 'dark' ? 'dark' : 'light');

    themeToggleBtn.addEventListener('click', () => {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        setTheme(isDark ? 'light' : 'dark');
    });

    // 5. 3D Interactive Card Tilt
    const tiltCards = document.querySelectorAll('.tilt-card');
    tiltCards.forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            
            const rotateX = ((y - centerY) / centerY) * -8;
            const rotateY = ((x - centerX) / centerX) * 8;
            
            card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-4px)`;
        });

        card.addEventListener('mouseleave', () => {
            card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0px)';
        });
    });

    // 6. Rotating Eyebrow Tagline
    const rotatingTagline = document.getElementById('rotatingTagline');
    const taglines = [
        "AI RECOVERY COMPANION",
        "DISCHARGE SUMMARY EXPLAINER",
        "DOSEGUARD PRESCRIPTION MANAGER",
        "RED-FLAG SAFETY ENGINE"
    ];
    let tagIndex = 0;

    setInterval(() => {
        if (rotatingTagline) {
            rotatingTagline.classList.add('fade-out');
            setTimeout(() => {
                tagIndex = (tagIndex + 1) % taglines.length;
                rotatingTagline.textContent = taglines[tagIndex];
                rotatingTagline.classList.remove('fade-out');
            }, 400);
        }
    }, 3500);

    // 7. Active Navigation Auto Highlight Pill on Scroll
    const sections = document.querySelectorAll('section[id]');
    const navItems = document.querySelectorAll('.nav-links a.nav-item');

    window.addEventListener('scroll', () => {
        let currentSec = '';
        sections.forEach(sec => {
            const secTop = sec.offsetTop - 120;
            const secHeight = sec.offsetHeight;
            if (window.scrollY >= secTop && window.scrollY < secTop + secHeight) {
                currentSec = sec.getAttribute('id');
            }
        });

        navItems.forEach(item => {
            item.classList.remove('active');
            if (item.getAttribute('href') === `#${currentSec}`) {
                item.classList.add('active');
            }
        });
    });

    // 8. Sample Output Drawer Toggle with Skeleton Loading State
    const drawerToggleBtn = document.getElementById('drawerToggleBtn');
    const sampleDrawer = document.getElementById('sampleDrawer');
    const skeletonLoader = document.getElementById('skeletonLoader');
    const drawerRealContent = document.getElementById('drawerRealContent');

    if (drawerToggleBtn && sampleDrawer && skeletonLoader && drawerRealContent) {
        drawerToggleBtn.addEventListener('click', () => {
            const isOpen = sampleDrawer.classList.contains('open');

            if (!isOpen) {
                sampleDrawer.classList.add('open');
                drawerToggleBtn.textContent = '✕ Close Sample Output';
                
                skeletonLoader.classList.remove('hidden-loader');
                drawerRealContent.classList.add('hidden-content');

                setTimeout(() => {
                    skeletonLoader.classList.add('hidden-loader');
                    drawerRealContent.classList.remove('hidden-content');
                }, 500);
            } else {
                sampleDrawer.classList.remove('open');
                drawerToggleBtn.textContent = '⚡ View Sample Output';
            }
        });
    }

    // 9. Mouse Spotlight Radial Glow on Team Cards
    const spotlightCards = document.querySelectorAll('.spotlight-card');
    spotlightCards.forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            card.style.setProperty('--mouse-x', `${x}px`);
            card.style.setProperty('--mouse-y', `${y}px`);
        });
    });

    // 10. Animated Accordion Controls
    const accordionItems = document.querySelectorAll('.accordion-item');

    accordionItems.forEach(item => {
        const header = item.querySelector('.accordion-header');
        header.addEventListener('click', () => {
            const isActive = item.classList.contains('active');
            
            accordionItems.forEach(otherItem => {
                otherItem.classList.remove('active');
                const icon = otherItem.querySelector('.acc-icon');
                if (icon) icon.textContent = '+';
            });

            if (!isActive) {
                item.classList.add('active');
                const icon = item.querySelector('.acc-icon');
                if (icon) icon.textContent = '−';
            }
        });
    });

    // 11. Scroll-Reveal Animation Observer
    const revealElements = document.querySelectorAll('.scroll-reveal');

    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('revealed');
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '0px 0px -40px 0px'
    });

    revealElements.forEach(el => revealObserver.observe(el));

    // 12. Smooth Navigation Scrolling
    const navLinks = document.querySelectorAll('.nav-links a, .hero-cta-group a, .card-link');

    navLinks.forEach(link => {
        if (link.getAttribute('href')) {
            link.addEventListener('click', (e) => {
                const targetHref = link.getAttribute('href');
                if (targetHref && targetHref.startsWith('#')) {
                    e.preventDefault();
                    const targetSec = document.querySelector(targetHref);
                    if (targetSec) {
                        targetSec.scrollIntoView({ behavior: 'smooth' });
                    }
                }
            });
        }
    });
});
