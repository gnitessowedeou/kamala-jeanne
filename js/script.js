/**
 * ==============================================================================
 * VENDIA AI — LANDING PAGE INTERACTIVE ENGINE
 * Mobile Navigation, Phone Simulator, Pricing Toggle, FAQ Accordion & Modals
 * Pure Vanilla JavaScript
 * ==============================================================================
 */

document.addEventListener("DOMContentLoaded", () => {
  initNavbarScroll();
  initMobileMenu();
  initPricingToggle();
  initFaqAccordion();
  initPhoneSimulator();
  
  initSmoothScroll();
  initAuthModal();
});

// ==============================================================================
// 1. NAVBAR SCROLL EFFECT (Full-width bar -> Floating Capsule Pill)
// ==============================================================================
function initNavbarScroll() {
  const navbar = document.getElementById("navbar");
  const navbarWrap = document.getElementById("navbar-wrap") || document.querySelector(".navbar-wrap");
  if (!navbar) return;

  const updateNavbarState = () => {
    const isScrolled = window.scrollY > 30;
    if (isScrolled) {
      navbar.classList.add("scrolled");
      if (navbarWrap) navbarWrap.classList.add("scrolled");
    } else {
      navbar.classList.remove("scrolled");
      if (navbarWrap) navbarWrap.classList.remove("scrolled");
    }
  };

  window.addEventListener("scroll", updateNavbarState, { passive: true });
  updateNavbarState();
}

// ==============================================================================
// 2. MOBILE MENU DRAWER
// ==============================================================================
function initMobileMenu() {
  const toggleBtn = document.getElementById("mobile-nav-toggle");
  const closeBtn = document.getElementById("mobile-drawer-close");
  const drawer = document.getElementById("mobile-drawer");
  const mobileLinks = document.querySelectorAll(".mobile-link");

  if (toggleBtn && drawer) {
    toggleBtn.addEventListener("click", () => {
      drawer.classList.add("open");
      document.body.style.overflow = "hidden";
    });
  }

  const closeMenu = () => {
    if (drawer) {
      drawer.classList.remove("open");
      document.body.style.overflow = "";
    }
  };

  if (closeBtn) closeBtn.addEventListener("click", closeMenu);
  mobileLinks.forEach(link => link.addEventListener("click", closeMenu));
}

// ==============================================================================
// 3. PRICING TOGGLE (MENSUEL / ANNUEL AVEC ÉQUIVALENTS XOF)
// ==============================================================================
function initPricingToggle() {
  const checkbox = document.getElementById("pricing-toggle-checkbox");
  const lblMonthly = document.getElementById("lbl-monthly");
  const lblAnnual = document.getElementById("lbl-annual");

  const priceBasic = document.getElementById("price-basic");
  const xofBasic = document.getElementById("xof-basic");

  const pricePro = document.getElementById("price-pro");
  const xofPro = document.getElementById("xof-pro");
  const priceBusiness = document.getElementById("price-business");
  const xofBusiness = document.getElementById("xof-business");

  if (!checkbox) return;

  const updatePricing = (isAnnual) => {
    if (lblMonthly) lblMonthly.classList.toggle("active", !isAnnual);
    if (lblAnnual) lblAnnual.classList.toggle("active", isAnnual);

    // Update Basic
    if (priceBasic && xofBasic) {
      priceBasic.style.opacity = "0";
      xofBasic.style.opacity = "0";
      setTimeout(() => {
        priceBasic.textContent = isAnnual ? priceBasic.getAttribute("data-annual") : priceBasic.getAttribute("data-monthly");
        const xofVal = isAnnual ? xofBasic.getAttribute("data-xof-annual") : xofBasic.getAttribute("data-xof-monthly");
        xofBasic.textContent = `≈ ${xofVal} XOF`;
        priceBasic.style.opacity = "1";
        xofBasic.style.opacity = "1";
      }, 150);
    }

    // Update Pro
    if (pricePro && xofPro) {
      pricePro.style.opacity = "0";
      xofPro.style.opacity = "0";
      setTimeout(() => {
        pricePro.textContent = isAnnual ? pricePro.getAttribute("data-annual") : pricePro.getAttribute("data-monthly");
        const xofVal = isAnnual ? xofPro.getAttribute("data-xof-annual") : xofPro.getAttribute("data-xof-monthly");
        xofPro.textContent = `≈ ${xofVal} XOF`;
        pricePro.style.opacity = "1";
        xofPro.style.opacity = "1";
      }, 150);
    }

    // Update Business
    if (priceBusiness && xofBusiness) {
      priceBusiness.style.opacity = "0";
      xofBusiness.style.opacity = "0";
      setTimeout(() => {
        priceBusiness.textContent = isAnnual ? priceBusiness.getAttribute("data-annual") : priceBusiness.getAttribute("data-monthly");
        const xofVal = isAnnual ? xofBusiness.getAttribute("data-xof-annual") : xofBusiness.getAttribute("data-xof-monthly");
        xofBusiness.textContent = `≈ ${xofVal} XOF`;
        priceBusiness.style.opacity = "1";
        xofBusiness.style.opacity = "1";
      }, 150);
    }
  };

  checkbox.addEventListener("change", (e) => {
    updatePricing(e.target.checked);
  });

  if (lblMonthly) {
    lblMonthly.addEventListener("click", () => {
      checkbox.checked = false;
      updatePricing(false);
    });
  }

  if (lblAnnual) {
    lblAnnual.addEventListener("click", () => {
      checkbox.checked = true;
      updatePricing(true);
    });
  }
}

// ==============================================================================
// 4. FAQ ACCORDION
// ==============================================================================
function initFaqAccordion() {
  const faqItems = document.querySelectorAll(".faq-item");

  faqItems.forEach(item => {
    const questionBtn = item.querySelector(".faq-question-btn");
    const answerBody = item.querySelector(".faq-answer-body");

    // Set initial active state height
    if (item.classList.contains("active") && answerBody) {
      answerBody.style.maxHeight = answerBody.scrollHeight + 40 + "px";
    }

    if (questionBtn && answerBody) {
      questionBtn.addEventListener("click", () => {
        const isOpen = item.classList.contains("active");

        // Close all items
        faqItems.forEach(otherItem => {
          otherItem.classList.remove("active");
          const otherAnswer = otherItem.querySelector(".faq-answer-body");
          if (otherAnswer) otherAnswer.style.maxHeight = "0";
        });

        // Open selected item if it was closed
        if (!isOpen) {
          item.classList.add("active");
          answerBody.style.maxHeight = answerBody.scrollHeight + 40 + "px";
        }
      });
    }
  });
}

// ==============================================================================
// 5. INTERACTIVE SMARTPHONE WHATSAPP SIMULATOR
// ==============================================================================
function initPhoneSimulator() {
  const form = document.getElementById("phone-interactive-form");
  const input = document.getElementById("phone-interactive-input");
  const chatBody = document.getElementById("phone-chat-body");

  if (!form || !input || !chatBody) return;

  const responses = [
    "Avec grand plaisir ! Notre Agent IA se connecte à votre catalogue et encaisse pour vous 24h/24 sans interruption ✨",
    "Absolument, vos clients reçoivent un lien Wave ou Orange Money et vous êtes notifié dès la validation de commande !",
    "C'est exactement ça ! Grâce à la coexistence active, vous gardez l'accès à WhatsApp sur votre smartphone sans coupure.",
    "Tout est prêt en 2 minutes. Voulez-vous tester votre premier tunnel de vente dès maintenant ?"
  ];
  let responseIndex = 0;

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const userText = input.value.trim();
    if (!userText) return;

    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    // 1. Append user message
    const clientBubble = document.createElement("div");
    clientBubble.className = "phone-msg-bubble client";
    clientBubble.innerHTML = `
      <p>${escapeHtml(userText)}</p>
      <div class="phone-msg-time">${timeStr}</div>
    `;
    chatBody.appendChild(clientBubble);
    input.value = "";
    chatBody.scrollTop = chatBody.scrollHeight;

    // 2. Simulate AI response after 700ms
    setTimeout(() => {
      const botResponse = responses[responseIndex % responses.length];
      responseIndex++;

      const agentBubble = document.createElement("div");
      agentBubble.className = "phone-msg-bubble agent";
      agentBubble.innerHTML = `
        <p>${botResponse}</p>
        <div class="phone-msg-time">${timeStr} • Réponse IA 0.7s</div>
      `;
      chatBody.appendChild(agentBubble);
      chatBody.scrollTop = chatBody.scrollHeight;
    }, 700);
  });
}

function escapeHtml(string) {
  const div = document.createElement("div");
  div.appendChild(document.createTextNode(string));
  return div.innerHTML;
}

// ==============================================================================
// 6. DEMO VIDEO MODAL
// ==============================================================================
function initDemoModal() {
  const modal = document.getElementById("demo-modal");
  const openHeroDemoBtn = document.getElementById("btn-hero-demo");
  const openMockupPlayBtn = document.getElementById("mockup-play-btn");
  const closeBtn = document.getElementById("modal-demo-close");

  const openModal = () => {
    if (modal) modal.classList.add("active");
  };

  const closeModal = () => {
    if (modal) modal.classList.remove("active");
  };

  const demoNavTriggers = document.querySelectorAll(".demo-nav-trigger");

  if (openHeroDemoBtn) openHeroDemoBtn.addEventListener("click", openModal);
  if (openMockupPlayBtn) openMockupPlayBtn.addEventListener("click", openModal);
  if (closeBtn) closeBtn.addEventListener("click", closeModal);
  demoNavTriggers.forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      openModal();
    });
  });

  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeModal();
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });
}

// ==============================================================================
// 7. SMOOTH SCROLL WITH HEADER OFFSET
// ==============================================================================
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener("click", function(e) {
      const targetId = this.getAttribute("href");
      if (targetId === "#") return;

      const targetEl = document.querySelector(targetId);
      if (targetEl) {
        e.preventDefault();
        const headerOffset = 90;
        const elementPosition = targetEl.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

        window.scrollTo({
          top: offsetPosition,
          behavior: "smooth"
        });
      }
    });
  });
}

// ==============================================================================
// 8. REAL AUTHENTICATION MODAL (Inscription, Connexion, OAuth Google/Facebook)
// ==============================================================================
function initAuthModal() {
  const modal = document.getElementById("auth-modal");
  const closeBtn = document.getElementById("auth-modal-close");
  const tabSignup = document.getElementById("tab-btn-signup");
  const tabLogin = document.getElementById("tab-btn-login");
  const formSignup = document.getElementById("form-signup");
  const formLogin = document.getElementById("form-login");
  const formForgot = document.getElementById("form-forgot");
  const alertBox = document.getElementById("auth-alert-box");
  const socialSection = document.getElementById("auth-social-section");
  const footerPrompt = document.getElementById("auth-footer-prompt");
  const footerText = document.getElementById("auth-footer-text");
  const footerAction = document.getElementById("auth-footer-action");
  const linkForgot = document.getElementById("link-forgot-password");
  const linkBackLogin = document.getElementById("link-back-to-login");

  if (!modal) return;

  const showAlert = (message, type = "error") => {
    if (!alertBox) return;
    alertBox.className = `auth-alert ${type} show`;
    const icon = type === "error" 
      ? '<i class="fa-solid fa-circle-exclamation auth-alert-icon"></i>' 
      : '<i class="fa-solid fa-circle-check auth-alert-icon"></i>';
    alertBox.innerHTML = `${icon}<span class="auth-alert-text">${message}</span>`;
  };

  const hideAlert = () => {
    if (alertBox) alertBox.className = "auth-alert";
  };

  const setMode = (mode) => {
    hideAlert();
    if (mode === "signup") {
      if (tabSignup) tabSignup.classList.add("active");
      if (tabLogin) tabLogin.classList.remove("active");
      if (formSignup) formSignup.style.display = "block";
      if (formLogin) formLogin.style.display = "none";
      if (formForgot) formForgot.style.display = "none";
      if (socialSection) socialSection.style.display = "block";
      if (footerPrompt) footerPrompt.style.display = "block";
      if (footerText) footerText.textContent = "Déjà un compte VANDIA ?";
      if (footerAction) footerAction.textContent = "Se connecter";
    } else if (mode === "login") {
      if (tabSignup) tabSignup.classList.remove("active");
      if (tabLogin) tabLogin.classList.add("active");
      if (formSignup) formSignup.style.display = "none";
      if (formLogin) formLogin.style.display = "block";
      if (formForgot) formForgot.style.display = "none";
      if (socialSection) socialSection.style.display = "block";
      if (footerPrompt) footerPrompt.style.display = "block";
      if (footerText) footerText.textContent = "Pas encore de compte ?";
      if (footerAction) footerAction.textContent = "S'inscrire gratuitement";
    } else if (mode === "forgot") {
      if (tabSignup) tabSignup.classList.remove("active");
      if (tabLogin) tabLogin.classList.remove("active");
      if (formSignup) formSignup.style.display = "none";
      if (formLogin) formLogin.style.display = "none";
      if (formForgot) formForgot.style.display = "block";
      if (socialSection) socialSection.style.display = "none";
      if (footerPrompt) footerPrompt.style.display = "none";
    }
  };

  const openAuthModal = (mode = "signup") => {
    modal.classList.add("active");
    setMode(mode);
    document.body.style.overflow = "hidden";
  };

  const closeAuthModal = () => {
    modal.classList.remove("active");
    document.body.style.overflow = "";
    hideAlert();
  };

  if (closeBtn) closeBtn.addEventListener("click", closeAuthModal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeAuthModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.classList.contains("active")) closeAuthModal();
  });

  if (tabSignup) tabSignup.addEventListener("click", () => setMode("signup"));
  if (tabLogin) tabLogin.addEventListener("click", () => setMode("login"));
  if (footerAction) footerAction.addEventListener("click", () => {
    if (tabSignup && tabSignup.classList.contains("active")) {
      setMode("login");
    } else {
      setMode("signup");
    }
  });
  if (linkForgot) linkForgot.addEventListener("click", (e) => {
    e.preventDefault();
    setMode("forgot");
  });
  if (linkBackLogin) linkBackLogin.addEventListener("click", (e) => {
    e.preventDefault();
    setMode("login");
  });

  // Password Visibility Toggles
  document.querySelectorAll(".password-toggle-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("data-target");
      const input = document.getElementById(targetId);
      if (input) {
        const isPassword = input.getAttribute("type") === "password";
        input.setAttribute("type", isPassword ? "text" : "password");
        btn.innerHTML = isPassword ? '<i class="fa-regular fa-eye-slash"></i>' : '<i class="fa-regular fa-eye"></i>';
      }
    });
  });

  // Attach Open Triggers across Landing Page
  // 1. Login buttons (boutons de connexion explicites)
  document.querySelectorAll(".btn-nav-login, #btn-nav-login, .login-trigger").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      openAuthModal("login");
    });
  });

  // 2. Signup / CTA buttons (tous les boutons d'inscription & accès à l'essai gratuit 7 jours / 300 crédits)
  document.querySelectorAll(".btn-nav-cta, .btn-primary-pill, .btn-card-action, .btn-free-trial, a[href='dashboard.html']").forEach(btn => {
    if (btn.classList.contains("btn-nav-login") || btn.id === "btn-nav-login") return;
    btn.addEventListener("click", (e) => {
      
      e.preventDefault();
      openAuthModal("signup");
    });
  });

  // Form Submit: Inscription
  if (formSignup) {
    formSignup.addEventListener("submit", async (e) => {
      e.preventDefault();
      hideAlert();
      const submitBtn = document.getElementById("btn-submit-signup");
      const originalText = submitBtn ? submitBtn.innerHTML : "";

      const data = {
        firstName: document.getElementById("signup-firstname").value,
        lastName: document.getElementById("signup-lastname").value,
        email: document.getElementById("signup-email").value,
        phoneCountry: document.getElementById("signup-phone-country").value,
        phoneNumber: document.getElementById("signup-phone").value,
        password: document.getElementById("signup-password").value,
        passwordConfirm: document.getElementById("signup-password-confirm").value
      };

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i><span>Création du compte en cours...</span>';
      }

      const res = await window.AuthEngine.signUp(data);
      if (res.success) {
        showAlert("Compte créé avec succès ! Redirection vers votre tableau de bord...", "success");
        setTimeout(() => {
          window.location.href = "dashboard.html";
        }, 1100);
      } else {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalText;
        }
        showAlert(res.error, "error");
      }
    });
  }

  // Form Submit: Connexion
  if (formLogin) {
    formLogin.addEventListener("submit", async (e) => {
      e.preventDefault();
      hideAlert();
      const submitBtn = document.getElementById("btn-submit-login");
      const originalText = submitBtn ? submitBtn.innerHTML : "";

      const email = document.getElementById("login-email").value;
      const password = document.getElementById("login-password").value;

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i><span>Connexion en cours...</span>';
      }

      const res = await window.AuthEngine.signIn(email, password);
      if (res.success) {
        showAlert("Connexion réussie ! Redirection vers votre Dashboard...", "success");
        setTimeout(() => {
          window.location.href = "dashboard.html";
        }, 900);
      } else {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalText;
        }
        showAlert(res.error, "error");
      }
    });
  }

  // Form Submit: Mot de passe oublié
  if (formForgot) {
    formForgot.addEventListener("submit", async (e) => {
      e.preventDefault();
      hideAlert();
      const submitBtn = document.getElementById("btn-submit-forgot");
      const originalText = submitBtn ? submitBtn.innerHTML : "";
      const email = document.getElementById("forgot-email").value;

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i><span>Envoi en cours...</span>';
      }

      const res = await window.AuthEngine.resetPassword(email);
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
      }

      if (res.success) {
        showAlert(res.message, "success");
      } else {
        showAlert(res.error, "error");
      }
    });
  }

  // OAuth Google
  const btnGoogle = document.getElementById("btn-oauth-google");
  if (btnGoogle) {
    btnGoogle.addEventListener("click", async () => {
      hideAlert();
      btnGoogle.disabled = true;
      btnGoogle.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i><span>Connexion Google...</span>';
      const res = await window.AuthEngine.signInWithOAuth("google");
      if (res.success) {
        showAlert("Connecté avec succès via Google ! Redirection...", "success");
        setTimeout(() => {
          window.location.href = "dashboard.html";
        }, 900);
      }
    });
  }

  // OAuth Facebook
  const btnFacebook = document.getElementById("btn-oauth-facebook");
  if (btnFacebook) {
    btnFacebook.addEventListener("click", async () => {
      hideAlert();
      btnFacebook.disabled = true;
      btnFacebook.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i><span>Connexion Facebook...</span>';
      const res = await window.AuthEngine.signInWithOAuth("facebook");
      if (res.success) {
        showAlert("Connecté avec succès via Facebook ! Redirection...", "success");
        setTimeout(() => {
          window.location.href = "dashboard.html";
        }, 900);
      }
    });
  }
}

