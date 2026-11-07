/**
 * CASA MOMO • BOUTIQUE APARTMENTS IN GRAZ
 * Interactive Logic, GSAP Timelines, Lenis Smooth Scroll & Tunnel Parallax
 */

document.addEventListener('DOMContentLoaded', () => {

  // =========================================================================
  // 1. LENIS SMOOTH SCROLL & GSAP SYNC
  // =========================================================================
  let lenis;
  try {
    lenis = new Lenis({
      duration: 1.15,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      wheelMultiplier: 0.9,
      touchMultiplier: 1.5,
    });

    lenis.on('scroll', ScrollTrigger.update);

    gsap.ticker.add((time) => {
      lenis.raf(time * 1000);
    });

    gsap.ticker.lagSmoothing(0);
  } catch (err) {
    console.warn('Lenis smooth scroll fallback:', err);
  }

  // Handle in-page anchor links smoothly with Lenis
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', function (e) {
      const targetId = this.getAttribute('href');
      if (targetId === '#' || targetId === '') return;
      const targetEl = document.querySelector(targetId);
      if (targetEl) {
        e.preventDefault();
        if (lenis) {
          lenis.scrollTo(targetEl, { offset: -60, duration: 1.2 });
        } else {
          targetEl.scrollIntoView({ behavior: 'smooth' });
        }
        // Close mobile menu if open
        closeMobileMenu();
      }
    });
  });

  // =========================================================================
  // 2. LIVE GRAZ (CET) TIME WIDGET
  // =========================================================================
  const liveTimeEl = document.getElementById('liveTimeGraz');
  function updateGrazTime() {
    if (!liveTimeEl) return;
    try {
      const now = new Date();
      // Graz is in CET/CEST (Europe/Vienna)
      const options = {
        timeZone: 'Europe/Vienna',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      };
      const grazTimeString = new Intl.DateTimeFormat([], options).format(now);
      liveTimeEl.textContent = `${grazTimeString} CET`;
    } catch (e) {
      liveTimeEl.textContent = `19:48 CET`;
    }
  }
  updateGrazTime();
  setInterval(updateGrazTime, 1000);

  // Set current year in footer
  const currentYearEl = document.getElementById('currentYear');
  if (currentYearEl) currentYearEl.textContent = new Date().getFullYear();

  // Start video playback immediately so frames are buffered
  const heroVideoInit = document.getElementById('heroVideo');
  if (heroVideoInit) {
    heroVideoInit.play().catch(() => {});
  }

  // =========================================================================
  // 3. EDITORIAL PRELOADER TIMELINE
  // =========================================================================
  const preloader = document.getElementById('preloader');
  const preloaderProgress = document.getElementById('preloaderProgress');
  const preloaderCount = document.getElementById('preloaderCount');

  let loadProgress = 0;
  const loadInterval = setInterval(() => {
    loadProgress += Math.floor(Math.random() * 12) + 8;
    if (loadProgress >= 100) {
      loadProgress = 100;
      clearInterval(loadInterval);
      if (preloaderProgress) preloaderProgress.style.width = '100%';
      if (preloaderCount) preloaderCount.textContent = '100%';
      
      setTimeout(() => {
        if (preloader) {
          preloader.classList.add('finished');
          setTimeout(() => {
            preloader.style.display = 'none';
          }, 900);
        }
        triggerHeroReveal();
      }, 200);
    } else {
      if (preloaderProgress) preloaderProgress.style.width = `${loadProgress}%`;
      if (preloaderCount) preloaderCount.textContent = `${loadProgress < 10 ? '0' + loadProgress : loadProgress}%`;
    }
  }, 25);

  function triggerHeroReveal() {
    // 1. Staggered letter reveal for CASA and MOMO (EL PACRE Regular)
    const chars = document.querySelectorAll('.char-span');
    if (chars.length > 0) {
      gsap.fromTo(chars, 
        { y: 60, opacity: 0, filter: 'blur(4px)' },
        { y: 0, opacity: 1, filter: 'blur(0px)', duration: 1.1, stagger: 0.06, ease: 'power3.out', delay: 0.1 }
      );
    }

    // 2. Reveal bottom-left content & top floating navigation
    gsap.fromTo(['.site-header', '.hero-bottom-left', '.hero-scroll-cue'], 
      { opacity: 0, y: 15 },
      { opacity: 1, y: 0, duration: 0.9, stagger: 0.12, ease: 'power3.out', delay: 0.35 }
    );

    // 3. Play hero background video
    const heroVideo = document.getElementById('heroVideo');
    if (heroVideo) {
      heroVideo.play().catch(() => {});
    }
  }

  // Ambient Video Sound Toggle (Matches Image 1 with clean SVGs)
  const heroVideoEl = document.getElementById('heroVideo');
  const soundToggleBtn = document.getElementById('soundToggleBtn');
  const soundSvgOn = soundToggleBtn?.querySelector('.sound-svg-on');
  const soundSvgOff = soundToggleBtn?.querySelector('.sound-svg-off');

  if (soundToggleBtn && heroVideoEl) {
    soundToggleBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (heroVideoEl.muted) {
        heroVideoEl.muted = false;
        if (soundSvgOn) soundSvgOn.style.display = 'block';
        if (soundSvgOff) soundSvgOff.style.display = 'none';
        soundToggleBtn.setAttribute('aria-label', 'Mute Ambient Audio');
      } else {
        heroVideoEl.muted = true;
        if (soundSvgOn) soundSvgOn.style.display = 'none';
        if (soundSvgOff) soundSvgOff.style.display = 'block';
        soundToggleBtn.setAttribute('aria-label', 'Unmute Ambient Audio');
      }
    });
  }

  // Unified Navbar & Hero Booking CTAs
  document.getElementById('navBookNowBtn')?.addEventListener('click', (e) => {
    e.preventDefault();
    openBookingModal();
  });

  document.getElementById('heroBottomBookBtn')?.addEventListener('click', (e) => {
    e.preventDefault();
    openBookingModal();
  });

  document.getElementById('hostBookBtn')?.addEventListener('click', (e) => {
    e.preventDefault();
    openBookingModal();
  });

  document.getElementById('locationsBookBtn')?.addEventListener('click', (e) => {
    e.preventDefault();
    openBookingModal();
  });

  // =========================================================================
  // 4. CUSTOM MAGNETIC & FOLLOWER CURSOR
  // =========================================================================
  const cursorDot = document.getElementById('cursorDot');
  const cursorRing = document.getElementById('cursorRing');
  const cursorText = document.getElementById('cursorText');

  let mouseX = window.innerWidth / 2;
  let mouseY = window.innerHeight / 2;
  let ringX = mouseX;
  let ringY = mouseY;

  window.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;

    if (cursorDot) {
      cursorDot.style.left = `${mouseX}px`;
      cursorDot.style.top = `${mouseY}px`;
    }
  });

  function renderCursor() {
    // Smooth lerp for outer ring
    ringX += (mouseX - ringX) * 0.18;
    ringY += (mouseY - ringY) * 0.18;

    if (cursorRing) {
      cursorRing.style.left = `${ringX}px`;
      cursorRing.style.top = `${ringY}px`;
    }

    requestAnimationFrame(renderCursor);
  }
  requestAnimationFrame(renderCursor);

  // Cursor Hover Interactions
  const interactiveLinks = document.querySelectorAll('a, button, .filter-btn, input, select');
  interactiveLinks.forEach((el) => {
    el.addEventListener('mouseenter', () => {
      if (cursorRing) cursorRing.classList.add('hovering');
    });
    el.addEventListener('mouseleave', () => {
      if (cursorRing) cursorRing.classList.remove('hovering');
    });
  });

  const viewCards = document.querySelectorAll('.apt-card, .parallax-showcase-frame, .hero-video-wrapper, .locations-media-frame');
  viewCards.forEach((card) => {
    card.addEventListener('mouseenter', () => {
      if (cursorRing) {
        cursorRing.classList.add('active-view');
        if (cursorText) cursorText.textContent = 'VIEW';
      }
    });
    card.addEventListener('mouseleave', () => {
      if (cursorRing) {
        cursorRing.classList.remove('active-view');
        if (cursorText) cursorText.textContent = '';
      }
    });
  });

  // =========================================================================
  // 5. STICKY HEADER & SCROLL BEHAVIOR
  // =========================================================================
  const siteHeader = document.getElementById('siteHeader');
  const backToTop = document.getElementById('backToTop');

  function handleHeaderScroll(y) {
    if (y > 70) {
      siteHeader?.classList.add('scrolled');
    } else {
      siteHeader?.classList.remove('scrolled');
    }
  }

  window.addEventListener('scroll', () => {
    handleHeaderScroll(window.scrollY);
  });

  if (lenis) {
    lenis.on('scroll', (e) => {
      handleHeaderScroll(e.scroll);
    });
  }

  if (backToTop) {
    backToTop.addEventListener('click', () => {
      if (lenis) {
        lenis.scrollTo(0, { duration: 1.4 });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  }

  // =========================================================================
  // 6. MOBILE MENU OVERLAY
  // =========================================================================
  const mobileToggle = document.getElementById('mobileToggle') || document.getElementById('mobileToggleBtn');
  const mobileMenu = document.getElementById('mobileMenu');
  const mobileMenuClose = document.getElementById('mobileMenuClose');
  const mobileBookBtn = document.getElementById('mobileBookBtn');

  function openMobileMenu() {
    mobileMenu?.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeMobileMenu() {
    mobileMenu?.classList.remove('active');
    document.body.style.overflow = '';
  }

  mobileToggle?.addEventListener('click', openMobileMenu);
  mobileMenuClose?.addEventListener('click', closeMobileMenu);

  mobileBookBtn?.addEventListener('click', () => {
    closeMobileMenu();
    openBookingModal();
  });

  // =========================================================================
  // 7. SCROLL-SCRUBBED TEXT REVEAL (STATEMENT - MATCHES IMAGE 2)
  // =========================================================================
  const scrubWords = document.querySelectorAll('.scrub-word');
  const statementSec = document.getElementById('statement');
  if (scrubWords.length > 0 && statementSec && typeof ScrollTrigger !== 'undefined') {
    ScrollTrigger.create({
      trigger: '#statement',
      start: 'top 55%',
      end: 'center 40%',
      scrub: 0.6,
      onUpdate: (self) => {
        const total = scrubWords.length;
        // First word "Between" starts active at progress = 0 (matches Image 2)
        const activeCount = Math.max(1, Math.ceil(self.progress * total));
        scrubWords.forEach((word, idx) => {
          if (idx < activeCount) {
            word.classList.add('active');
          } else {
            word.classList.remove('active');
          }
        });
      }
    });
  }

  // =========================================================================
  // 7b. SCROLL-EXPANDING SHOWCASE (STARTS SMALL & COVERS 100% WIDTH ON SCROLL)
  // Matches authentic Casa Momo Graz (Images 1 - 5)
  // =========================================================================
  const showcaseFrame = document.getElementById('showcaseFrame');
  const showcaseImg = document.getElementById('showcaseImg');
  const showcaseExpandSec = document.getElementById('showcaseExpand');
  const showcaseBadge = document.getElementById('showcaseBadge');

  if (showcaseFrame && showcaseExpandSec && typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
    const isMobile = window.innerWidth <= 768;
    const initialScale = isMobile ? 0.72 : 0.50;
    const initialRadius = isMobile ? '28px' : '56px';

    // Frame expands from scale 0.5 with rounded corners to 100vw full width edge-to-edge
    gsap.fromTo(showcaseFrame,
      {
        scale: initialScale,
        borderRadius: initialRadius,
        boxShadow: '0 40px 100px rgba(0, 0, 0, 0.7)'
      },
      {
        scale: 1,
        borderRadius: '0px',
        boxShadow: '0 0 0 rgba(0, 0, 0, 0)',
        ease: 'power1.out',
        scrollTrigger: {
          trigger: '#showcaseExpand',
          start: 'top 92%',
          end: 'top 10%',
          scrub: 1,
          onUpdate: (self) => {
            // Fade in the Boutique N°3 | Living Room badge pills when nearing full width
            if (self.progress > 0.7) {
              showcaseBadge?.classList.add('visible');
            } else {
              showcaseBadge?.classList.remove('visible');
            }
          }
        }
      }
    );

    // Parallax zoom depth on the inner architectural photo
    if (showcaseImg) {
      gsap.fromTo(showcaseImg,
        { scale: 1.15, yPercent: -10 },
        {
          scale: 1.02,
          yPercent: 8,
          ease: 'none',
          scrollTrigger: {
            trigger: '#showcaseExpand',
            start: 'top bottom',
            end: 'bottom top',
            scrub: true
          }
        }
      );
    }
  }

  // =========================================================================
  // 7c. HOST MORITZ PHOTO SCROLL-FLATTENING TRANSITION (MATCHES CASAMOMO.AT)
  // Starts with rounded corners (border-radius 140px), flattens to 0px on scroll
  // =========================================================================
  const moritzPhotoFrame = document.getElementById('moritzPhotoFrame');
  const moritzPhotoImg = document.getElementById('moritzPhotoImg');
  const hostSection = document.getElementById('host');

  if (moritzPhotoFrame && hostSection && typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
    const isMobile = window.innerWidth <= 900;
    const initialRadius = isMobile ? '60px' : '140px';

    gsap.fromTo(moritzPhotoFrame,
      {
        borderRadius: initialRadius,
        scale: 0.94
      },
      {
        borderRadius: '0px',
        scale: 1,
        ease: 'power1.out',
        scrollTrigger: {
          trigger: '#host',
          start: 'top 85%',
          end: 'top 18%',
          scrub: 1
        }
      }
    );

    if (moritzPhotoImg) {
      gsap.fromTo(moritzPhotoImg,
        { yPercent: -8, scale: 1.10 },
        {
          yPercent: 8,
          scale: 1.02,
          ease: 'none',
          scrollTrigger: {
            trigger: '#host',
            start: 'top bottom',
            end: 'bottom top',
            scrub: true
          }
        }
      );
    }
  }

  // =========================================================================
  // 7d. 3D TUNNEL PARALLAX: "FEEL AT HOME. BEAUTIFULLY."
  // Floating furniture items fly in from 3D depth as words cascade up
  // =========================================================================
  const feelSection = document.getElementById('feelAtHome');
  const feelSticky = document.getElementById('feelSticky');

  if (feelSection && feelSticky && typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
    const feelItems = [
      { id: '#feelItemArmchair', startScale: 0.15, endScale: 1.08, startX: '-4vw', endX: '-22vw', startY: '-2.8vh', endY: '-14vh', startRot: -3, endRot: -7 },
      { id: '#feelItemLamp',     startScale: 0.13, endScale: 1.02, startX: '3.8vw', endX: '18vw',   startY: '2.5vh',  endY: '9vh',   startRot: 2.5, endRot: 4.5 },
      { id: '#feelItemCushion',  startScale: 0.11, endScale: 0.90, startX: '-2.7vw', endX: '-9vw',  startY: '2.8vh',  endY: '11vh',  startRot: 2,   endRot: 5.5 },
      { id: '#feelItemJug',      startScale: 0.10, endScale: 0.85, startX: '2.7vw',  endX: '5vw',   startY: '-2.5vh', endY: '-6vh',  startRot: -2,  endRot: -4 },
      { id: '#feelItemVase',     startScale: 0.09, endScale: 0.82, startX: '-2.8vw', endX: '9vw',   startY: '-0.3vh', endY: '-8vh',  startRot: -2.5, endRot: -3 },
      { id: '#feelItemRadio',    startScale: 0.08, endScale: 0.74, startX: '1.6vw',  endX: '-4vw',  startY: '-2.5vh', endY: '1vh',   startRot: 3,   endRot: 6 },
      { id: '#feelItemCandle',   startScale: 0.07, endScale: 0.68, startX: '-1.3vw', endX: '-14vw', startY: '-2.3vh', endY: '-3vh',  startRot: 1.5, endRot: 3 },
      { id: '#feelItemDish',     startScale: 0.07, endScale: 0.64, startX: '2.1vw',  endX: '22vw',  startY: '0.4vh',  endY: '-5vh',  startRot: -3,  endRot: -5 }
    ];

    // Master scrub timeline with PINNING: screen stays stuck on Feel at Home while scrolling down
    const feelTl = gsap.timeline({
      scrollTrigger: {
        trigger: '#feelAtHome',
        start: 'top top',
        end: '+=400%',
        pin: true,
        pinSpacing: true,
        anticipatePin: 1,
        scrub: 1.2,
        invalidateOnRefresh: true
      }
    });

    // 1. Initial state setup: all objects start deep in perspective
    feelItems.forEach((item) => {
      gsap.set(item.id, {
        autoAlpha: 0,
        scale: item.startScale,
        x: item.startX,
        y: item.startY,
        rotation: item.startRot,
        transformOrigin: 'center center'
      });
    });

    // 2. Animate items flying forward in 3D perspective as user scrolls down
    feelItems.forEach((item, idx) => {
      // Fade in early so objects are visible emerging from distance
      feelTl.to(item.id, {
        autoAlpha: 1,
        duration: 0.20,
        ease: 'power1.in'
      }, 0.02 + idx * 0.012);

      // Zoom outward to final prominent position
      feelTl.to(item.id, {
        scale: item.endScale,
        x: item.endX,
        y: item.endY,
        rotation: item.endRot,
        duration: 0.75,
        ease: 'power2.out'
      }, 0.05);
    });

    // 3. Staggered Masked Typography: "Feel at Home. Beautifully."
    // Initial states: masked below
    gsap.set('.feel-word', { yPercent: 115, rotation: 8 });

    // Word 1: "Feel"
    feelTl.to('#feelWord1', {
      yPercent: 0,
      rotation: 0,
      duration: 0.22,
      ease: 'power2.out'
    }, 0.16);

    // Word 2: "at"
    feelTl.to('#feelWord2', {
      yPercent: 0,
      rotation: 0,
      duration: 0.20,
      ease: 'power2.out'
    }, 0.28);

    // Word 3: "Home."
    feelTl.to('#feelWord3', {
      yPercent: 0,
      rotation: 0,
      duration: 0.22,
      ease: 'power2.out'
    }, 0.42);

    // Word 4: "Beautifully."
    feelTl.to('#feelWord4', {
      yPercent: 0,
      rotation: 0,
      duration: 0.24,
      ease: 'power2.out'
    }, 0.56);

    // The full composition (all 8 objects + full headline) remains fully assembled
    // and holds prominently on screen from progress 0.70 to 1.0!
    // As the user scrolls past 1.0, the pinned section naturally unpins and scrolls away into Philosophy.
  }

  // Fade Up Elements
  gsap.utils.toArray('[data-fade-up]').forEach((el) => {
    gsap.fromTo(el,
      { opacity: 0, y: 40 },
      {
        opacity: 1,
        y: 0,
        duration: 0.9,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: el,
          start: 'top 85%',
          toggleActions: 'play none none none'
        }
      }
    );
  });

  // =========================================================================
  // 9. APARTMENTS DATABASE & DETAIL MODAL
  // =========================================================================
  const apartmentsData = {
    'boutique-1': {
      id: 'boutique-1',
      title: 'Boutique N°1',
      category: 'Boutique Collection',
      price: 145,
      area: '60 m²',
      guests: '3 Guests',
      bed: 'King Bed + Sofa',
      view: 'Schlossberg View',
      summary: 'Featuring a private sunny balcony overlooking Graz, curated vintage pieces, and historic Altbau walls with a natural mossy patina.',
      desc: 'Boutique N°1 is one of our flagship intimate residences, located on the 2nd floor of our Schönaugasse property. The apartment combines original Austrian Altbau architectural bones—soaring 3.6m ceilings, double-wing timber doors, and vintage parquet—with contemporary natural linen tones and a bespoke kitchen bar. Step out onto your private balcony at dusk with a glass of Styrian Sauvignon Blanc while looking towards the historic Clock Tower.',
      images: [
        'assets/FFMB70aKEXAkAkxXAKKQTB8epk.webp',
        'assets/qwHsbwPqfdWdQUSwIKbIkRdc.webp',
        'assets/AUKTjMtGsoMYUJPsPCzFeywV2Os.webp'
      ],
      amenities: [
        'Private Balcony with Castle View',
        'Nespresso Coffee & Local Graz Roasts',
        'Stone-washed 100% European Linen',
        '300 Mbps Fiber Wi-Fi',
        'Rain Shower & Organic Bath Products',
        'Dishwasher & Induction Cooktop',
        'Marshall Bluetooth Audio Speaker',
        'Digital Smart Lock Self Check-In',
        'Courtyard Parking on Request'
      ]
    },
    'boutique-2': {
      id: 'boutique-2',
      title: 'Boutique N°2',
      category: 'Boutique Collection',
      price: 135,
      area: '45 m²',
      guests: '3 Guests',
      bed: 'King Bed',
      view: 'Schlossberg & Courtyard',
      summary: 'Crown jewel of our historic building, highlighted by an original 19th-century painted fresco ceiling and a crystal chandelier.',
      desc: 'Walking into Boutique N°2 feels like entering an art collector’s private salon. The centerpiece is the meticulously preserved 19th-century painted ceiling and classic crystal chandelier that casts warm golden reflections across the Altbau plaster walls. Complemented by an ultra-comfortable king-size bed with down pillows, quiet courtyard insulation, and a sunny dining corner.',
      images: [
        'assets/qwHsbwPqfdWdQUSwIKbIkRdc.webp',
        'assets/yBIxh7LgO2No9HDQ30impB370Y.webp'
      ],
      amenities: [
        'Original 19th-C. Fresco Ceiling',
        'Crystal Chandelier & Atmospheric Dimmers',
        'Hypoallergenic King Mattress',
        'Fully Equipped Designer Kitchenette',
        'High-Speed Wi-Fi & Work Desk',
        'Rain Shower & Hair Dryer',
        'Local Coffee Beans & Tea Selection',
        '24/7 Keyless Smart Entry'
      ]
    },
    'boutique-3': {
      id: 'boutique-3',
      title: 'Boutique N°3 Flagship',
      category: 'Flagship Residence',
      price: 220,
      area: '120 m²',
      guests: '6 Guests',
      bed: '2 King Bedrooms + Sofa',
      view: 'Panoramic Clock Tower',
      summary: 'Our grandest 120 m² apartment. Two separate bedrooms, handcrafted Portuguese tiles, private balcony, and reading lounge.',
      desc: 'The flagship residence of Casa Momo Graz. With 120 m² of generous space, this grand apartment accommodates up to 6 guests with complete privacy and architectural poise. Features two grand king bedrooms, an expansive living salon, hand-pressed Portuguese wall tiles, a spacious sunlit balcony facing the Schlossberg, and an eight-person solid oak dining table perfect for shared meals.',
      images: [
        'assets/UayMv2I16UbQQBQkbI90HsJMv5o.webp',
        'assets/oX2oq6XyfLyGAEy331vdyigCk.webp'
      ],
      amenities: [
        '120 m² Two-Bedroom Layout',
        'Private Schlossberg Balcony',
        'Handcrafted Portuguese Ceramic Tiles',
        'Expansive Chef Kitchen with Dishwasher',
        'Washing Machine & Drying Rack',
        'Two Luxury Bathrooms with Rain Showers',
        'Marshall Bluetooth Speaker & 4K Smart TV',
        'Dedicated Courtyard Parking Included'
      ]
    },
    'boutique-4': {
      id: 'boutique-4',
      title: 'Boutique N°4',
      category: 'Boutique Collection',
      price: 130,
      area: '45 m²',
      guests: '4 Guests',
      bed: 'King Bed + Daybed',
      view: 'Sunny South View',
      summary: 'Bathed in morning sunlight and styled with warm ochre tones, vintage ceramic lamps, and elevated views towards Schlossberg.',
      desc: 'Boutique N°4 embraces warm earth pigments—ochre, terracotta, and soft chalk. Positioned on the sunny 2nd floor, natural southern light pours through the tall double-casement windows from sunrise until late afternoon. Features a cozy reading daybed, handcrafted ceramic lighting, and a serene sleeping sanctuary.',
      images: [
        'assets/yBIxh7LgO2No9HDQ30impB370Y.webp'
      ],
      amenities: [
        'Warm Ochre Color Concept',
        'Elevated City & Sky Views',
        'Nespresso Coffee Station',
        'Organic European Bed Linen',
        'Fast Mesh Wi-Fi & Work Space',
        'Modern Walk-in Shower',
        'Keyless Digital Entry 24/7'
      ]
    },
    'loft-1': {
      id: 'loft-1',
      title: 'Loft N°1',
      category: 'Loft Collection',
      price: 125,
      area: '45 m²',
      guests: '4 Guests',
      bed: 'King Bed + Sofa Bed',
      view: 'Quiet Leafy Courtyard',
      summary: 'A serene, bright sanctuary nestled in Graz’s leafy university quarter. Ideal for thinkers, writers, and longer stays.',
      desc: 'Set in a peaceful pocket near the University of Graz and Stadtpark, Loft N°1 is designed for contemplation and quiet focus. Clean minimalist lines, built-in bookshelves, an ergonomic work corner, and peaceful green outlooks make this loft a favorite for creative travelers and extended workations.',
      images: [
        'assets/2xHCTBMpXtVodlF5OQINb1IbM.webp'
      ],
      amenities: [
        'Quiet Academic District Location',
        'Ergonomic Work Desk with Fiber Wi-Fi',
        'Fully Outfitted Kitchenette',
        'Walk-in Shower & Soft Towels',
        'Weekly Linen Service on Request',
        'Keyless Check-In'
      ]
    },
    'loft-2': {
      id: 'loft-2',
      title: 'Loft N°2',
      category: 'Loft Collection',
      price: 150,
      area: '60 m²',
      guests: '4 Guests',
      bed: 'King Bed + Lounge',
      view: 'Central Graz Rooftops',
      summary: 'Airy open-concept atelier in central Graz. Features soaring ceilings, minimalist steel accents, and generous skylights.',
      desc: 'An inspiring atelier space that celebrates open-plan volume. Loft N°2 combines black industrial steel framing with natural blonde oak and sunlit skylights. The kitchen island invites relaxed cooking, while the living zone offers deep linen armchairs for reading Moritz’s curated Graz guides.',
      images: [
        'assets/K9tRZVOwNnZgndmDo4Fbq4.webp'
      ],
      amenities: [
        'Soaring Open-Plan Ceilings',
        'Natural Roof Skylights',
        'Kitchen Island with Induction Hob',
        'Nespresso & Selection of Austrian Teas',
        'Marshall Speaker & Fast Fiber Wi-Fi',
        'Courtyard Parking Available'
      ]
    },
    'loft-3': {
      id: 'loft-3',
      title: 'Loft N°3 Panorama',
      category: 'Panorama Luxury Loft',
      price: 195,
      area: '80 m²',
      guests: '5 Guests',
      bed: 'King Bed + Queen Mezzanine',
      view: 'Direct Clock Tower Panorama',
      summary: 'Exceptional penthouse volume with 5-meter cathedral ceilings, panoramic clock tower vista, and rain shower suite.',
      desc: 'Loft N°3 is our crown penthouse accommodation. Soaring 5-meter cathedral timber beams create an exhilarating feeling of space, while floor-to-ceiling windows frame an uninterrupted panorama of Graz’s famous Uhrturm clock tower. Features a split mezzanine sleeping gallery, custom banquette dining, and a spa-like bathroom.',
      images: [
        'assets/sXyrAPMPoUMCYGjfPIyJx3amvwg.webp'
      ],
      amenities: [
        '5-Meter Cathedral Vaulted Ceilings',
        'Direct Unobstructed Clock Tower View',
        'Mezzanine Bedroom & Lounge',
        'Luxury Bathroom with Dual Rain Showers',
        'Full Kitchen with Oven & Dishwasher',
        'Marshall Bluetooth Sound System',
        'Courtyard Parking Spot'
      ]
    },
    'garden-1': {
      id: 'garden-1',
      title: 'Garden N°1',
      category: 'Garden Oasis',
      price: 140,
      area: '40 m²',
      guests: '3 Guests',
      bed: 'King Bed + Daybed',
      view: 'Private Walled Garden',
      summary: 'A rare private city garden oasis in inner Graz. Earthy clay finishes, Moroccan hand-pressed zellige tiles, and garden patio.',
      desc: 'An unexpected green oasis right in the center of Graz. Garden N°1 opens directly onto a private walled garden patio surrounded by ivy, lavender, and potted olive trees. Interiors feature earthy lime wash, Moroccan zellige tiles in the bathroom, and a tranquil outdoor breakfast table.',
      images: [
        'assets/ok0JjrCxxM8lHi3hQ8qC8QmPys.webp'
      ],
      amenities: [
        'Private Walled Garden & Breakfast Terrace',
        'Handmade Moroccan Zellige Tiles',
        'Stone-washed European Linen',
        'Nespresso Bar & Herbal Teas',
        'Ultra-quiet Courtyard Position',
        'Keyless Smart Entry'
      ]
    },
    'urban-1': {
      id: 'urban-1',
      title: 'Urban N°1',
      category: 'Urban Studio',
      price: 120,
      area: '40 m²',
      guests: '2 Guests',
      bed: 'Queen Bed',
      view: 'Private Courtyard Terrace',
      summary: 'Quiet ground-floor studio with private courtyard entrance, sunny terrace, full climate control, and guaranteed garage parking.',
      desc: 'Designed for effortless urban living. Urban N°1 provides private ground-floor access directly from the quiet inner courtyard. Features a sunny personal terrace, air conditioning, modern kitchen setup, and guaranteed direct garage parking on-site.',
      images: [
        'assets/nCpZHO0o6riJK75pc9xxHA2OQC4.webp'
      ],
      amenities: [
        'Private Courtyard Entrance & Terrace',
        'Guaranteed On-Site Garage Parking',
        'Full Climate Control / Air Conditioning',
        'High-Speed Wi-Fi & Smart TV',
        'Rain Shower & Organic Toiletries',
        'Keyless Check-In 24/7'
      ]
    }
  };

  // -------------------------------------------------------------------------
  // Filtering & Card Click for Apartments (Matches Live Casa Momo)
  // -------------------------------------------------------------------------
  const filterPills = document.querySelectorAll('.filter-pill');
  const aptCards = document.querySelectorAll('.apt-card');

  filterPills.forEach((pill) => {
    pill.addEventListener('click', () => {
      filterPills.forEach((p) => p.classList.remove('active'));
      pill.classList.add('active');

      const filterVal = pill.getAttribute('data-filter');

      aptCards.forEach((card) => {
        const cardCat = card.getAttribute('data-category');
        if (filterVal === 'all' || cardCat === filterVal) {
          card.style.display = 'flex';
          gsap.fromTo(card, { opacity: 0, y: 15 }, { opacity: 1, y: 0, duration: 0.35 });
        } else {
          card.style.display = 'none';
        }
      });
    });
  });

  // Clicking an apartment card opens its suite modal
  aptCards.forEach((card) => {
    card.addEventListener('click', (e) => {
      e.preventDefault();
      const aptId = card.getAttribute('data-id');
      if (aptId) {
        openApartmentModal(aptId);
      }
    });
  });

  // -------------------------------------------------------------------------
  // Apartment Detail Modal
  // -------------------------------------------------------------------------
  const aptModal = document.getElementById('aptModal');
  const modalCloseBtn = document.getElementById('modalCloseBtn');
  const modalMainImg = document.getElementById('modalMainImg');
  const modalThumbs = document.getElementById('modalThumbs');
  const modalCategory = document.getElementById('modalCategory');
  const modalTitle = document.getElementById('modalTitle');
  const modalArea = document.getElementById('modalArea');
  const modalGuests = document.getElementById('modalGuests');
  const modalBed = document.getElementById('modalBed');
  const modalView = document.getElementById('modalView');
  const modalDesc = document.getElementById('modalDesc');
  const modalAmenities = document.getElementById('modalAmenities');
  const modalPrice = document.getElementById('modalPrice');
  const modalReserveBtn = document.getElementById('modalReserveBtn');

  let currentModalAptId = 'boutique-1';

  function openApartmentModal(aptId) {
    const data = apartmentsData[aptId];
    if (!data) return;

    currentModalAptId = aptId;

    if (modalCategory) modalCategory.textContent = data.category;
    if (modalTitle) modalTitle.textContent = data.title;
    if (modalArea) modalArea.textContent = data.area;
    if (modalGuests) modalGuests.textContent = data.guests;
    if (modalBed) modalBed.textContent = data.bed;
    if (modalView) modalView.textContent = data.view;
    if (modalDesc) modalDesc.textContent = data.desc;
    if (modalPrice) modalPrice.textContent = `€${data.price}`;

    // Main Image
    if (modalMainImg && data.images.length > 0) {
      modalMainImg.src = data.images[0];
    }

    // Thumbnails
    if (modalThumbs) {
      modalThumbs.innerHTML = '';
      data.images.forEach((imgUrl, i) => {
        const thumb = document.createElement('div');
        thumb.className = `modal-thumb ${i === 0 ? 'active' : ''}`;
        thumb.innerHTML = `<img src="${imgUrl}" alt="${data.title} thumbnail ${i + 1}">`;
        thumb.addEventListener('click', () => {
          modalThumbs.querySelectorAll('.modal-thumb').forEach((t) => t.classList.remove('active'));
          thumb.classList.add('active');
          if (modalMainImg) modalMainImg.src = imgUrl;
        });
        modalThumbs.appendChild(thumb);
      });
    }

    // Amenities
    if (modalAmenities) {
      modalAmenities.innerHTML = '';
      data.amenities.forEach((amenity) => {
        const tag = document.createElement('span');
        tag.className = 'm-tag';
        tag.textContent = amenity;
        modalAmenities.appendChild(tag);
      });
    }

    aptModal?.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeApartmentModal() {
    aptModal?.classList.remove('active');
    document.body.style.overflow = '';
  }

  modalCloseBtn?.addEventListener('click', closeApartmentModal);
  aptModal?.addEventListener('click', (e) => {
    if (e.target === aptModal) closeApartmentModal();
  });

  // Attach Open Modal events
  document.querySelectorAll('.open-apt-modal').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const aptId = btn.getAttribute('data-id');
      openApartmentModal(aptId);
    });
  });

  // Modal Reserve CTA
  modalReserveBtn?.addEventListener('click', () => {
    closeApartmentModal();
    openBookingModal(currentModalAptId);
  });

  document.querySelectorAll('.direct-book-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const aptId = btn.getAttribute('data-id');
      openBookingModal(aptId);
    });
  });

  // Dates helper
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const departureDate = new Date(tomorrow);
  departureDate.setDate(departureDate.getDate() + 3);
  const formatDate = (d) => d.toISOString().split('T')[0];

  // Quick form on hero
  const quickBookingForm = document.getElementById('quickBookingForm');
  const heroCheckin = document.getElementById('checkinDate');
  const heroCheckout = document.getElementById('checkoutDate');

  if (heroCheckin) heroCheckin.value = formatDate(tomorrow);
  if (heroCheckout) heroCheckout.value = formatDate(departureDate);

  quickBookingForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const typeSelect = document.getElementById('typeSelect');
    const guests = document.getElementById('guestsSelect')?.value || '2';

    if (typeSelect && typeSelect.value !== 'all') {
      const matchBtn = document.querySelector(`.filter-btn[data-filter="${typeSelect.value}"]`);
      if (matchBtn) matchBtn.click();
    }

    // Scroll down to apartments
    const aptSection = document.getElementById('apartments');
    if (aptSection) {
      if (lenis) {
        lenis.scrollTo(aptSection, { offset: -60, duration: 1.2 });
      } else {
        aptSection.scrollIntoView({ behavior: 'smooth' });
      }
    }
  });

  // =========================================================================
  // 11. DIRECT RESERVATION MODAL
  // =========================================================================
  const bookingModal = document.getElementById('bookingModal');
  const bookingModalCloseBtn = document.getElementById('bookingModalCloseBtn');
  const directReservationForm = document.getElementById('directReservationForm');
  const bookingSuccessScreen = document.getElementById('bookingSuccessScreen');
  const btnCloseSuccessModal = document.getElementById('btnCloseSuccessModal');

  const rfSuiteSelect = document.getElementById('rfSuiteSelect');
  const rfGuestsSelect = document.getElementById('rfGuestsSelect');
  const rfCheckin = document.getElementById('rfCheckin');
  const rfCheckout = document.getElementById('rfCheckout');
  const rfSummaryPill = document.getElementById('rfSummaryPill');

  function openBookingModal(preselectedAptId = null, prefillData = null) {
    if (bookingSuccessScreen) bookingSuccessScreen.style.display = 'none';
    if (directReservationForm) directReservationForm.style.display = 'flex';

    if (rfCheckin) rfCheckin.value = prefillData?.checkin || calcCheckin?.value || formatDate(tomorrow);
    if (rfCheckout) rfCheckout.value = prefillData?.checkout || calcCheckout?.value || formatDate(departureDate);
    if (rfGuestsSelect && prefillData) rfGuestsSelect.value = prefillData.guests;

    // Match Suite Select
    if (rfSuiteSelect && preselectedAptId) {
      const apt = apartmentsData[preselectedAptId];
      if (apt) {
        for (let i = 0; i < rfSuiteSelect.options.length; i++) {
          if (rfSuiteSelect.options[i].text.includes(apt.title)) {
            rfSuiteSelect.selectedIndex = i;
            break;
          }
        }
      }
    }

    updateReservationSummaryPill();

    bookingModal?.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeBookingModal() {
    bookingModal?.classList.remove('active');
    document.body.style.overflow = '';
  }

  function updateReservationSummaryPill() {
    if (!rfCheckin || !rfCheckout || !rfSummaryPill) return;
    const inDate = new Date(rfCheckin.value);
    const outDate = new Date(rfCheckout.value);
    let nights = Math.round((outDate - inDate) / (1000 * 60 * 60 * 24));
    if (isNaN(nights) || nights < 1) nights = 1;

    rfSummaryPill.innerHTML = `Selected: <strong>${rfSuiteSelect?.value || 'Suite'}</strong> • <strong>${nights} Night${nights > 1 ? 's' : ''}</strong> (10% Direct Booking Discount included)`;
  }

  [rfSuiteSelect, rfGuestsSelect, rfCheckin, rfCheckout].forEach((elem) => {
    elem?.addEventListener('change', updateReservationSummaryPill);
  });

  bookingModalCloseBtn?.addEventListener('click', closeBookingModal);
  bookingModal?.addEventListener('click', (e) => {
    if (e.target === bookingModal) closeBookingModal();
  });

  document.getElementById('openBookingModalBtn')?.addEventListener('click', () => {
    openBookingModal();
  });

  directReservationForm?.addEventListener('submit', (e) => {
    e.preventDefault();

    // Show simulated success screen
    directReservationForm.style.display = 'none';
    if (bookingSuccessScreen) bookingSuccessScreen.style.display = 'block';
  });

  btnCloseSuccessModal?.addEventListener('click', closeBookingModal);

  // =========================================================================
  // 12. GUEST REVIEWS SLIDER
  // =========================================================================
  const reviewCards = document.querySelectorAll('.review-card');
  const revPrev = document.getElementById('revPrev');
  const revNext = document.getElementById('revNext');
  const revCounter = document.getElementById('revCounter');

  let activeReviewIdx = 0;
  const totalReviews = reviewCards.length;

  function showReview(idx) {
    reviewCards.forEach((card, i) => {
      if (i === idx) {
        card.classList.add('active');
      } else {
        card.classList.remove('active');
      }
    });

    if (revCounter) {
      revCounter.textContent = `0${idx + 1} / 0${totalReviews}`;
    }
  }

  revPrev?.addEventListener('click', () => {
    activeReviewIdx = (activeReviewIdx - 1 + totalReviews) % totalReviews;
    showReview(activeReviewIdx);
  });

  revNext?.addEventListener('click', () => {
    activeReviewIdx = (activeReviewIdx + 1) % totalReviews;
    showReview(activeReviewIdx);
  });

  // =========================================================================
  // 12. NEWSLETTER FORM
  // =========================================================================
  const newsletterForm = document.getElementById('newsletterForm');
  const newsletterSuccess = document.getElementById('newsletterSuccess');

  newsletterForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    newsletterForm.style.display = 'none';
    if (newsletterSuccess) newsletterSuccess.style.display = 'block';
  });

  // =========================================================================
  // 13. LEGAL INFORMATION MODAL (IMPRINT, PRIVACY, TERMS)
  // =========================================================================
  const legalModal = document.getElementById('legalModal');
  const legalModalCloseBtn = document.getElementById('legalModalCloseBtn');
  const legalModalTag = document.getElementById('legalModalTag');
  const legalModalTitle = document.getElementById('legalModalTitle');
  const legalModalBody = document.getElementById('legalModalBody');

  const linkImprint = document.getElementById('linkImprint');
  const linkPrivacy = document.getElementById('linkPrivacy');
  const linkTerms = document.getElementById('linkTerms');

  const legalContent = {
    imprint: {
      tag: 'LEGAL DISCLOSURE',
      title: 'Imprint / Impressum',
      html: `
        <p><strong>Casa Momo Graz</strong><br>
        Owner & Host: Moritz Steinlechner<br>
        Schönaugasse 76, 8010 Graz, Austria</p>
        <p><strong>Contact:</strong><br>
        Email: <a href="mailto:office@casamomo.at">office@casamomo.at</a><br>
        Phone: <a href="tel:+436641999605">+43 664 1999605</a><br>
        Website: <a href="https://casamomo.at" target="_blank" rel="noopener">casamomo.at</a></p>
        <p><strong>Business Purpose:</strong> Short- and long-term accommodation rental of boutique residences and designer lofts.<br>
        Supervisory Authority: Magistrat der Stadt Graz<br>
        Applicable Trade Legislation: Austrian Industrial Code (Gewerbeordnung 1994, GewO)</p>
        <p><strong>Design & Concept:</strong> Lucas Roßmann • Digital Design & Development</p>
      `
    },
    privacy: {
      tag: 'DATA PROTECTION',
      title: 'Privacy Policy',
      html: `
        <p>At Casa Momo, we prioritize your digital privacy with the same care we take in crafting calm, quiet apartments. We avoid invasive trackers, advertising cookies, and third-party data selling.</p>
        <p><strong>1. Responsible Entity:</strong><br>
        Moritz Steinlechner, Schönaugasse 76, 8010 Graz, Austria (office@casamomo.at).</p>
        <p><strong>2. Hosting & Infrastructure:</strong><br>
        This website is hosted on high-performance EU servers via Framer B.V. Server logs record standard technical connection data (IP address, browser user-agent, timestamp) strictly for security and uptime monitoring.</p>
        <p><strong>3. Cookie-Free Analytics:</strong><br>
        We use anonymous, cookie-less website analytics that do not store identifiable personal profiles or follow you across other websites.</p>
        <p><strong>4. Booking & Reservation Data:</strong><br>
        When you submit a reservation request or direct booking, your name, contact email, and stay preferences are processed securely to coordinate your check-in code and digital guest guide.</p>
      `
    },
    terms: {
      tag: 'RENTAL CONDITIONS',
      title: 'Terms & Conditions',
      html: `
        <p><strong>1. Check-In & Check-Out:</strong><br>
        Check-in is available 24/7 from 16:00 (4:00 PM) via keyless digital numeric keypad entry. Check-out is by 11:00 AM on your day of departure. Luggage storage is available on request.</p>
        <p><strong>2. Direct Booking Guarantee & Cancellation:</strong><br>
        Direct bookings through our website receive a 10% lower rate than external platforms. Direct reservations enjoy 100% free cancellation up to 5 days prior to the scheduled check-in date.</p>
        <p><strong>3. House Rules:</strong><br>
        Casa Momo residences are non-smoking spaces. In respect of our historic Altbau building and neighbors, quiet hours are observed from 22:00 to 07:00.</p>
        <p><strong>4. Parking:</strong><br>
        Courtyard and garage parking spots must be requested prior to arrival and are subject to availability.</p>
      `
    }
  };

  function openLegalModal(type) {
    const data = legalContent[type];
    if (!data) return;

    if (legalModalTag) legalModalTag.textContent = data.tag;
    if (legalModalTitle) legalModalTitle.textContent = data.title;
    if (legalModalBody) legalModalBody.innerHTML = data.html;

    legalModal?.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeLegalModal() {
    legalModal?.classList.remove('active');
    document.body.style.overflow = '';
  }

  legalModalCloseBtn?.addEventListener('click', closeLegalModal);
  legalModal?.addEventListener('click', (e) => {
    if (e.target === legalModal) closeLegalModal();
  });

  linkImprint?.addEventListener('click', (e) => {
    e.preventDefault();
    openLegalModal('imprint');
  });

  linkPrivacy?.addEventListener('click', (e) => {
    e.preventDefault();
    openLegalModal('privacy');
  });

  linkTerms?.addEventListener('click', (e) => {
    e.preventDefault();
    openLegalModal('terms');
  });

  // Keyboard accessibility: ESC closes active modal
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeApartmentModal();
      closeBookingModal();
      closeLegalModal();
      closeMobileMenu();
    }
  });

});

