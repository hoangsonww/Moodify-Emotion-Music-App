/**
 * Moodify Wiki - Interactive JavaScript
 * Handles theme switching, tab navigation, smooth scrolling, and animations
 */

// ==========================================
// Theme Management
// ==========================================

class ThemeManager {
    constructor() {
        this.theme = localStorage.getItem('theme') || 'light';
        this.themeToggle = document.getElementById('themeToggle');
        this.init();
    }

    init() {
        this.applyTheme();
        this.setupEventListeners();
        this.detectSystemTheme();
    }

    applyTheme() {
        document.documentElement.setAttribute('data-theme', this.theme);
        localStorage.setItem('theme', this.theme);
    }

    toggleTheme() {
        this.theme = this.theme === 'light' ? 'dark' : 'light';
        this.applyTheme();
        
        // Add animation effect
        document.body.style.transition = 'background-color 0.3s ease, color 0.3s ease';
    }

    setupEventListeners() {
        if (this.themeToggle) {
            this.themeToggle.addEventListener('click', () => this.toggleTheme());
        }
    }

    detectSystemTheme() {
        const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        
        darkModeMediaQuery.addEventListener('change', (e) => {
            if (!localStorage.getItem('theme')) {
                this.theme = e.matches ? 'dark' : 'light';
                this.applyTheme();
            }
        });
    }
}

// ==========================================
// Tab Navigation
// ==========================================

class TabManager {
    constructor() {
        this.tabButtons = document.querySelectorAll('.tab-btn');
        this.tabContents = document.querySelectorAll('.tab-content');
        this.init();
    }

    init() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        this.tabButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const tabName = e.target.dataset.tab;
                this.switchTab(tabName);
            });
        });
    }

    switchTab(tabName) {
        // Remove active class from all buttons
        this.tabButtons.forEach(btn => btn.classList.remove('active'));
        
        // Remove active class from all contents
        this.tabContents.forEach(content => content.classList.remove('active'));
        
        // Add active class to selected button
        const activeButton = document.querySelector(`[data-tab="${tabName}"]`);
        if (activeButton) {
            activeButton.classList.add('active');
        }
        
        // Add active class to selected content
        const activeContent = document.getElementById(`${tabName}-tab`);
        if (activeContent) {
            activeContent.classList.add('active');
        }
    }
}

// ==========================================
// Smooth Scrolling
// ==========================================

class ScrollManager {
    constructor() {
        this.navLinks = document.querySelectorAll('.nav-links a[href^="#"]');
        this.init();
    }

    init() {
        this.setupSmoothScrolling();
        this.setupScrollSpy();
        this.setupBackToTop();
    }

    setupSmoothScrolling() {
        this.navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = link.getAttribute('href').substring(1);
                const targetElement = document.getElementById(targetId);
                
                if (targetElement) {
                    const navHeight = document.querySelector('.navbar').offsetHeight;
                    const targetPosition = targetElement.offsetTop - navHeight;
                    
                    window.scrollTo({
                        top: targetPosition,
                        behavior: 'smooth'
                    });
                }
            });
        });
    }

    setupScrollSpy() {
        const sections = document.querySelectorAll('section[id], header[id]');
        const navLinks = document.querySelectorAll('.nav-links a[href^="#"]');
        
        const observerOptions = {
            threshold: 0.3,
            rootMargin: '-80px 0px -80px 0px'
        };
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const id = entry.target.getAttribute('id');
                    
                    // Remove active class from all links
                    navLinks.forEach(link => {
                        link.classList.remove('active');
                    });
                    
                    // Add active class to current link
                    const activeLink = document.querySelector(`.nav-links a[href="#${id}"]`);
                    if (activeLink) {
                        activeLink.classList.add('active');
                    }
                }
            });
        }, observerOptions);
        
        // Observe all sections
        sections.forEach(section => {
            observer.observe(section);
        });
    }

    setupBackToTop() {
        // Create back to top button if it doesn't exist
        if (!document.getElementById('backToTop')) {
            const button = document.createElement('button');
            button.id = 'backToTop';
            button.innerHTML = '↑';
            button.setAttribute('aria-label', 'Back to top');
            button.style.cssText = `
                position: fixed;
                bottom: 30px;
                right: 30px;
                width: 50px;
                height: 50px;
                border-radius: 50%;
                background: var(--primary-color);
                color: white;
                border: none;
                cursor: pointer;
                font-size: 24px;
                display: none;
                z-index: 1000;
                transition: all 0.3s ease;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            `;
            
            button.addEventListener('click', () => {
                window.scrollTo({
                    top: 0,
                    behavior: 'smooth'
                });
            });
            
            button.addEventListener('mouseenter', () => {
                button.style.transform = 'translateY(-5px)';
                button.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.2)';
            });
            
            button.addEventListener('mouseleave', () => {
                button.style.transform = 'translateY(0)';
                button.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
            });
            
            document.body.appendChild(button);
        }
        
        // Show/hide button based on scroll position
        window.addEventListener('scroll', () => {
            const button = document.getElementById('backToTop');
            if (window.scrollY > 300) {
                button.style.display = 'block';
            } else {
                button.style.display = 'none';
            }
        });
    }
}

// ==========================================
// Intersection Observer for Animations
// ==========================================

class AnimationManager {
    constructor() {
        this.observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        };
        this.init();
    }

    init() {
        this.setupIntersectionObserver();
    }

    setupIntersectionObserver() {
        const elements = document.querySelectorAll('.overview-card, .feature-card, .deployment-card, .demo-card, .stat-card');
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.style.opacity = '0';
                    entry.target.style.transform = 'translateY(20px)';
                    
                    setTimeout(() => {
                        entry.target.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
                        entry.target.style.opacity = '1';
                        entry.target.style.transform = 'translateY(0)';
                    }, 100);
                    
                    observer.unobserve(entry.target);
                }
            });
        }, this.observerOptions);
        
        elements.forEach(element => observer.observe(element));
    }
}

// ==========================================
// Navbar Scroll Effect & Progress Bar
// ==========================================

class NavbarManager {
    constructor() {
        this.navbar = document.querySelector('.navbar');
        this.progressBar = document.getElementById('progressBar');
        this.hamburger = document.getElementById('hamburger');
        this.navLinks = document.getElementById('navLinks');
        this.lastScroll = 0;
        this.init();
    }

    init() {
        this.setupScrollEffect();
        this.setupProgressBar();
        this.setupHamburger();
    }

    setupScrollEffect() {
        window.addEventListener('scroll', () => {
            const currentScroll = window.scrollY;
            
            // Add shadow when scrolled
            if (currentScroll > 0) {
                this.navbar.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
            } else {
                this.navbar.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
            }
            
            this.lastScroll = currentScroll;
        });
    }

    setupProgressBar() {
        window.addEventListener('scroll', () => {
            const windowHeight = window.innerHeight;
            const documentHeight = document.documentElement.scrollHeight;
            const scrollTop = window.scrollY || document.documentElement.scrollTop;
            
            // Calculate scroll percentage
            const scrollPercentage = (scrollTop / (documentHeight - windowHeight)) * 100;
            
            // Update progress bar width
            if (this.progressBar) {
                this.progressBar.style.width = scrollPercentage + '%';
            }
        });
    }

    setupHamburger() {
        if (this.hamburger && this.navLinks) {
            // Toggle menu on hamburger click
            this.hamburger.addEventListener('click', () => {
                this.hamburger.classList.toggle('active');
                this.navLinks.classList.toggle('active');
            });

            // Close menu when clicking a link
            const links = this.navLinks.querySelectorAll('a');
            links.forEach(link => {
                link.addEventListener('click', () => {
                    this.hamburger.classList.remove('active');
                    this.navLinks.classList.remove('active');
                });
            });

            // Close menu when clicking outside
            document.addEventListener('click', (e) => {
                if (!this.navbar.contains(e.target)) {
                    this.hamburger.classList.remove('active');
                    this.navLinks.classList.remove('active');
                }
            });
        }
    }
}

// ==========================================
// Mermaid Diagram Initialization
// ==========================================

class DiagramManager {
    constructor() {
        this.init();
    }

    init() {
        if (typeof mermaid !== 'undefined') {
            mermaid.initialize({
                startOnLoad: true,
                theme: document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'default',
                securityLevel: 'loose',
                flowchart: {
                    useMaxWidth: true,
                    htmlLabels: true,
                    curve: 'basis',
                    padding: 20
                },
                sequence: {
                    useMaxWidth: true,
                    wrap: true,
                    diagramMarginX: 50,
                    diagramMarginY: 10
                },
                themeVariables: {
                    fontSize: '14px'
                }
            });
            
            // Re-render diagrams when theme changes
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.attributeName === 'data-theme') {
                        const newTheme = document.documentElement.getAttribute('data-theme');
                        
                        try {
                            mermaid.initialize({
                                theme: newTheme === 'dark' ? 'dark' : 'default',
                                securityLevel: 'loose',
                                flowchart: {
                                    useMaxWidth: true,
                                    htmlLabels: true,
                                    curve: 'basis',
                                    padding: 20
                                }
                            });
                            
                            // Re-render all diagrams
                            const diagrams = document.querySelectorAll('.mermaid');
                            diagrams.forEach((diagram) => {
                                if (diagram.getAttribute('data-processed')) {
                                    const content = diagram.getAttribute('data-mermaid-src') || diagram.textContent;
                                    diagram.removeAttribute('data-processed');
                                    diagram.innerHTML = content;
                                }
                            });
                            
                            mermaid.init(undefined, '.mermaid:not([data-processed])');
                        } catch (error) {
                            console.warn('Error re-rendering Mermaid diagrams:', error);
                        }
                    }
                });
            });
            
            observer.observe(document.documentElement, {
                attributes: true
            });
        }
    }
}

// ==========================================
// Loading Animation
// ==========================================

class LoadingManager {
    constructor() {
        this.init();
    }

    init() {
        window.addEventListener('load', () => {
            // Remove loading class from body if exists
            document.body.classList.remove('loading');
            
            // Fade in content
            document.body.style.opacity = '0';
            setTimeout(() => {
                document.body.style.transition = 'opacity 0.5s ease';
                document.body.style.opacity = '1';
            }, 100);
        });
    }
}

// ==========================================
// Performance Monitoring
// ==========================================

class PerformanceMonitor {
    constructor() {
        this.init();
    }

    init() {
        if ('PerformanceObserver' in window) {
            try {
                // Monitor Largest Contentful Paint (LCP)
                const lcpObserver = new PerformanceObserver((list) => {
                    const entries = list.getEntries();
                    const lastEntry = entries[entries.length - 1];
                    console.log('LCP:', lastEntry.renderTime || lastEntry.loadTime);
                });
                
                lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
                
                // Monitor First Input Delay (FID)
                const fidObserver = new PerformanceObserver((list) => {
                    const entries = list.getEntries();
                    entries.forEach((entry) => {
                        console.log('FID:', entry.processingStart - entry.startTime);
                    });
                });
                
                fidObserver.observe({ entryTypes: ['first-input'] });
            } catch (error) {
                console.warn('Performance monitoring not supported:', error);
            }
        }
    }
}

// ==========================================
// Utility Functions
// ==========================================

const Utils = {
    // Debounce function
    debounce: (func, wait) => {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },
    
    // Throttle function
    throttle: (func, limit) => {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },
    
    // Check if element is in viewport
    isInViewport: (element) => {
        const rect = element.getBoundingClientRect();
        return (
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
            rect.right <= (window.innerWidth || document.documentElement.clientWidth)
        );
    }
};

// ==========================================
// Initialize All Managers
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    // Initialize all managers
    new ThemeManager();
    new TabManager();
    new ScrollManager();
    new AnimationManager();
    new NavbarManager();
    new DiagramManager();
    new LoadingManager();
    new PerformanceMonitor();
    
    console.log('✨ Moodify Wiki initialized successfully!');
    console.log('🎵 Developed by Son Nguyen (@hoangsonww)');
    console.log('📦 GitHub: https://github.com/hoangsonww/Moodify-Emotion-Music-App');
});

// ==========================================
// Error Handling
// ==========================================

window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
});

// ==========================================
// Service Worker Registration (Optional)
// ==========================================

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        // Uncomment to enable service worker
        // navigator.serviceWorker.register('/sw.js')
        //     .then(registration => console.log('SW registered:', registration))
        //     .catch(error => console.log('SW registration failed:', error));
    });
}

// ==========================================
// Export for module usage (if needed)
// ==========================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        ThemeManager,
        TabManager,
        ScrollManager,
        AnimationManager,
        NavbarManager,
        DiagramManager,
        Utils
    };
}
