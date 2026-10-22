/**
 * ==============================================================================
 * VANDIAS AI — LANDING PAGE INTERACTIVE ENGINE
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
  initLanguageSelector();
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
// 3. PRICING TOGGLE (MENSUEL / ANNUEL AVEC -20% RÉDUCTION)
// ==============================================================================
function initPricingToggle() {
  const checkbox = document.getElementById("pricing-toggle-checkbox");
  const lblMonthly = document.getElementById("lbl-monthly");
  const lblAnnual = document.getElementById("lbl-annual");

  const priceBasic = document.getElementById("price-basic");
  const pricePro = document.getElementById("price-pro");
  const priceBusiness = document.getElementById("price-business");

  if (!checkbox) return;

  const updatePricing = (isAnnual) => {
    if (lblMonthly) lblMonthly.classList.toggle("active", !isAnnual);
    if (lblAnnual) lblAnnual.classList.toggle("active", isAnnual);

    // Update Basic
    if (priceBasic) {
      priceBasic.style.transition = "opacity 0.2s ease, transform 0.2s ease";
      priceBasic.style.opacity = "0";
      priceBasic.style.transform = "scale(0.95)";
      setTimeout(() => {
        priceBasic.textContent = isAnnual 
          ? (priceBasic.getAttribute("data-annual") || "6 320") 
          : (priceBasic.getAttribute("data-monthly") || "7 900");
        priceBasic.style.opacity = "1";
        priceBasic.style.transform = "scale(1)";
      }, 150);
    }

    // Update Pro
    if (pricePro) {
      pricePro.style.transition = "opacity 0.2s ease, transform 0.2s ease";
      pricePro.style.opacity = "0";
      pricePro.style.transform = "scale(0.95)";
      setTimeout(() => {
        pricePro.textContent = isAnnual 
          ? (pricePro.getAttribute("data-annual") || "11 920") 
          : (pricePro.getAttribute("data-monthly") || "14 900");
        pricePro.style.opacity = "1";
        pricePro.style.transform = "scale(1)";
      }, 150);
    }

    // Update Business
    if (priceBusiness) {
      priceBusiness.style.transition = "opacity 0.2s ease, transform 0.2s ease";
      priceBusiness.style.opacity = "0";
      priceBusiness.style.transform = "scale(0.95)";
      setTimeout(() => {
        priceBusiness.textContent = isAnnual 
          ? (priceBusiness.getAttribute("data-annual") || "24 000") 
          : (priceBusiness.getAttribute("data-monthly") || "30 000");
        priceBusiness.style.opacity = "1";
        priceBusiness.style.transform = "scale(1)";
      }, 150);
    }

    // Update frequency & annual billing tags
    document.querySelectorAll(".price-frequency").forEach(el => {
      el.textContent = isAnnual ? "/mois (facturé à l'année)" : "/mois";
    });

    const basicTag = document.querySelector(".card-basic .price-xof-tag");
    if (basicTag) {
      basicTag.style.display = isAnnual ? "block" : "none";
      basicTag.innerHTML = isAnnual ? '<i class="fa-solid fa-circle-check"></i> 75 840 FCFA/an (-20% économisés)' : '';
      basicTag.style.color = "var(--whatsapp-green)";
      basicTag.style.fontSize = "12px";
      basicTag.style.marginTop = "4px";
      basicTag.style.fontWeight = "600";
    }

    const proTag = document.querySelector(".card-pro .price-xof-tag");
    if (proTag) {
      proTag.style.display = isAnnual ? "block" : "none";
      proTag.innerHTML = isAnnual ? '<i class="fa-solid fa-circle-check"></i> 143 040 FCFA/an (-20% économisés)' : '';
      proTag.style.color = "var(--whatsapp-green)";
      proTag.style.fontSize = "12px";
      proTag.style.marginTop = "4px";
      proTag.style.fontWeight = "600";
    }

    const bizTag = document.querySelector(".card-enterprise .price-xof-tag");
    if (bizTag) {
      bizTag.style.display = isAnnual ? "block" : "none";
      bizTag.innerHTML = isAnnual ? '<i class="fa-solid fa-circle-check"></i> 288 000 FCFA/an (-20% économisés)' : '';
      bizTag.style.color = "var(--whatsapp-green)";
      bizTag.style.fontSize = "12px";
      bizTag.style.marginTop = "4px";
      bizTag.style.fontWeight = "600";
    }
  };

  checkbox.addEventListener("change", (e) => {
    updatePricing(e.target.checked);
  });

  if (lblMonthly) {
    lblMonthly.style.cursor = "pointer";
    lblMonthly.addEventListener("click", () => {
      checkbox.checked = false;
      updatePricing(false);
    });
  }

  if (lblAnnual) {
    lblAnnual.style.cursor = "pointer";
    lblAnnual.addEventListener("click", () => {
      checkbox.checked = true;
      updatePricing(true);
    });
  }

  // Initial trigger to match current checkbox state
  updatePricing(checkbox.checked);
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
  const formReset = document.getElementById("form-reset-password");
  const alertBox = document.getElementById("auth-alert-box");
  const socialSection = document.getElementById("auth-social-section");
  const footerPrompt = document.getElementById("auth-footer-prompt");
  const footerText = document.getElementById("auth-footer-text");
  const footerAction = document.getElementById("auth-footer-action");
  const linkForgot = document.getElementById("link-forgot-password");
  const linkBackLogin = document.getElementById("link-back-to-login");
  const linkResetBackLogin = document.getElementById("link-reset-back-to-login");

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

  let currentAuthMode = "signup";

  const setMode = (mode) => {
    currentAuthMode = mode;
    try {
      localStorage.setItem("vendia_auth_mode", mode);
      localStorage.setItem("vendia_oauth_mode", mode);
      sessionStorage.setItem("vendia_auth_mode", mode);
      sessionStorage.setItem("vendia_oauth_mode", mode);
      document.cookie = `vendia_oauth_mode=${mode}; path=/; max-age=1800; SameSite=Lax`;
    } catch(e) {}
    hideAlert();
    if (mode === "signup") {
      if (tabSignup) tabSignup.classList.add("active");
      if (tabLogin) tabLogin.classList.remove("active");
      if (formSignup) formSignup.style.display = "block";
      if (formLogin) formLogin.style.display = "none";
      if (formForgot) formForgot.style.display = "none";
      if (formReset) formReset.style.display = "none";
      if (socialSection) socialSection.style.display = "none";
      if (footerPrompt) footerPrompt.style.display = "block";
      if (footerText) footerText.textContent = "Déjà un compte VANDIAS ?";
      if (footerAction) footerAction.textContent = "Se connecter";

      const refInput = document.getElementById("signup-referral-code");
      const refHint = document.getElementById("referral-code-hint");
      const activeRef = (typeof getStoredReferralCode === 'function' ? getStoredReferralCode() : null) || localStorage.getItem("vandia_referral_code") || localStorage.getItem("vendia_ref");
      if (activeRef && refInput) {
        if (!refInput.value) refInput.value = activeRef;
        if (refHint) {
          refHint.style.display = "block";
          refHint.innerHTML = `<i class="fa-solid fa-circle-check"></i> Code parrainage appliqué : <strong>${activeRef}</strong>`;
        }
      }
    } else if (mode === "login") {
      if (tabSignup) tabSignup.classList.remove("active");
      if (tabLogin) tabLogin.classList.add("active");
      if (formSignup) formSignup.style.display = "none";
      if (formLogin) formLogin.style.display = "block";
      if (formForgot) formForgot.style.display = "none";
      if (formReset) formReset.style.display = "none";
      if (socialSection) socialSection.style.display = "none";
      if (footerPrompt) footerPrompt.style.display = "block";
      if (footerText) footerText.textContent = "Pas encore de compte ?";
      if (footerAction) footerAction.textContent = "S'inscrire gratuitement";
    } else if (mode === "forgot") {
      if (tabSignup) tabSignup.classList.remove("active");
      if (tabLogin) tabLogin.classList.remove("active");
      if (formSignup) formSignup.style.display = "none";
      if (formLogin) formLogin.style.display = "none";
      if (formForgot) formForgot.style.display = "block";
      if (formReset) formReset.style.display = "none";
      if (socialSection) socialSection.style.display = "none";
      if (footerPrompt) footerPrompt.style.display = "none";
    } else if (mode === "reset") {
      if (tabSignup) tabSignup.classList.remove("active");
      if (tabLogin) tabLogin.classList.remove("active");
      if (formSignup) formSignup.style.display = "none";
      if (formLogin) formLogin.style.display = "none";
      if (formForgot) formForgot.style.display = "none";
      if (formReset) formReset.style.display = "block";
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

  // Exposer les méthodes globalement pour AuthEngine
  window.openAuthModal = openAuthModal;
  window.showAuthAlert = showAlert;
  window.hideAuthAlert = hideAlert;
  window.setAuthMode = setMode;

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
  if (linkResetBackLogin) linkResetBackLogin.addEventListener("click", (e) => {
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

      // Attribution de parrainage : première attribution valide (code saisi ou lien mémorisé)
      const refInputEl = document.getElementById("signup-referral-code");
      const enteredRef = refInputEl ? refInputEl.value.trim().toUpperCase() : "";
      const storedRef = (typeof getStoredReferralCode === 'function' ? getStoredReferralCode() : null) || localStorage.getItem("vandia_referral_code") || localStorage.getItem("vendia_ref");
      const referralCode = enteredRef || storedRef || null;

      const data = {
        firstName: document.getElementById("signup-firstname").value,
        lastName: document.getElementById("signup-lastname").value,
        email: document.getElementById("signup-email").value,
        phoneCountry: document.getElementById("signup-phone-country").value,
        phoneNumber: document.getElementById("signup-phone").value,
        password: document.getElementById("signup-password").value,
        passwordConfirm: document.getElementById("signup-password-confirm").value,
        referralCode: referralCode
      };

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i><span>Création du compte en cours...</span>';
      }

      const res = await window.AuthEngine.signUp(data);
      if (res.success) {
        if (res.requiresConfirmation) {
          showAlert(res.message || "Compte créé ! Veuillez vérifier votre boîte e-mail et cliquer sur le lien pour activer votre compte.", "success");
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
          }
          setTimeout(() => {
            if (typeof window.setAuthMode === 'function') {
              window.setAuthMode('login');
              showAlert("Veuillez cliquer sur le lien reçu par e-mail, puis connectez-vous avec vos identifiants.", "info");
            }
          }, 4500);
          return;
        }
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

  // Form Submit: Nouveau mot de passe (Réinitialisation)
  if (formReset) {
    formReset.addEventListener("submit", async (e) => {
      e.preventDefault();
      hideAlert();
      const submitBtn = document.getElementById("btn-submit-reset");
      const originalText = submitBtn ? submitBtn.innerHTML : "";
      const p1 = (document.getElementById("reset-new-password")?.value || "").trim();
      const p2 = (document.getElementById("reset-confirm-password")?.value || "").trim();

      if (p1.length < 8) {
        showAlert("Le mot de passe doit comporter au moins 8 caractères.", "error");
        return;
      }
      if (p1 !== p2) {
        showAlert("Les deux mots de passe ne correspondent pas.", "error");
        return;
      }

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i><span>Enregistrement...</span>';
      }

      const res = await window.AuthEngine.updateUserPassword(p1);
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
      }

      if (res && res.success) {
        showAlert("Mot de passe mis à jour avec succès ! Connexion à votre compte...", "success");
        setTimeout(() => {
          window.location.href = "dashboard.html";
        }, 1200);
      } else {
        showAlert((res && res.error) || "Erreur lors de la réinitialisation du mot de passe.", "error");
      }
    });
  }

  // OAuth Google
  const btnGoogle = document.getElementById("btn-oauth-google");
  if (btnGoogle) {
    btnGoogle.addEventListener("click", async (e) => {
      if (e) e.preventDefault();
      hideAlert();
      btnGoogle.disabled = true;
      btnGoogle.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i><span>Redirection vers Google...</span>';
      
      const tabLogin = document.getElementById("tab-btn-login");
      const formLogin = document.getElementById("form-login");
      const isLogin = (currentAuthMode === "login") || (tabLogin && tabLogin.classList.contains("active")) || (formLogin && formLogin.style.display !== "none");
      const mode = isLogin ? "login" : "signup";

      try {
        localStorage.setItem("vendia_auth_mode", mode);
        localStorage.setItem("vendia_oauth_mode", mode);
        sessionStorage.setItem("vendia_auth_mode", mode);
        sessionStorage.setItem("vendia_oauth_mode", mode);
        document.cookie = `vendia_oauth_mode=${mode}; path=/; max-age=1800; SameSite=Lax`;
        localStorage.removeItem("vendia_current_user");
        localStorage.removeItem("vendia_supabase_token");
      } catch(e) {}

      const res = await window.AuthEngine.signInWithOAuth("google", mode);
      if (!res.success && res.error) {
        btnGoogle.disabled = false;
        btnGoogle.innerHTML = '<i class="fa-brands fa-google auth-social-icon"></i><span>Continuer avec Google</span>';
        showAlert(res.error, "error");
      }
    });
  }

  // OAuth Facebook
  const btnFacebook = document.getElementById("btn-oauth-facebook");
  if (btnFacebook) {
    btnFacebook.addEventListener("click", async (e) => {
      if (e) e.preventDefault();
      hideAlert();
      btnFacebook.disabled = true;
      btnFacebook.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i><span>Redirection vers Facebook...</span>';
      
      const tabLogin = document.getElementById("tab-btn-login");
      const formLogin = document.getElementById("form-login");
      const isLogin = (currentAuthMode === "login") || (tabLogin && tabLogin.classList.contains("active")) || (formLogin && formLogin.style.display !== "none");
      const mode = isLogin ? "login" : "signup";

      try {
        localStorage.setItem("vendia_auth_mode", mode);
        localStorage.setItem("vendia_oauth_mode", mode);
        sessionStorage.setItem("vendia_auth_mode", mode);
        sessionStorage.setItem("vendia_oauth_mode", mode);
        document.cookie = `vendia_oauth_mode=${mode}; path=/; max-age=1800; SameSite=Lax`;
        localStorage.removeItem("vendia_current_user");
        localStorage.removeItem("vendia_supabase_token");
      } catch(e) {}

      const res = await window.AuthEngine.signInWithOAuth("facebook", mode);
      if (!res.success && res.error) {
        btnFacebook.disabled = false;
        btnFacebook.innerHTML = '<i class="fa-brands fa-facebook auth-social-icon"></i><span>Continuer avec Facebook</span>';
        showAlert(res.error, "error");
      }
    });
  }

  // Gestion automatique de l'alerte et de l'inscription si tentative de connexion Google sans compte
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const hasOAuthErr = sessionStorage.getItem("vendia_oauth_error");
    if (urlParams.get("auth") === "signup" || hasOAuthErr) {
      openAuthModal("signup");
      const err = sessionStorage.getItem("vendia_oauth_error");
      if (err) {
        showAlert(err, "error");
        sessionStorage.removeItem("vendia_oauth_error");
      }
      const prefillStr = sessionStorage.getItem("vendia_prefill_signup");
      if (prefillStr) {
        try {
          const prefill = JSON.parse(prefillStr);
          const inputFirst = document.getElementById("signup-firstname");
          const inputLast = document.getElementById("signup-lastname");
          const inputEmail = document.getElementById("signup-email");
          if (inputFirst && prefill.firstName) inputFirst.value = prefill.firstName;
          if (inputLast && prefill.lastName) inputLast.value = prefill.lastName;
          if (inputEmail && prefill.email) inputEmail.value = prefill.email;
        } catch(pe) {}
        sessionStorage.removeItem("vendia_prefill_signup");
      }
      if (window.history && window.history.replaceState) {
        window.history.replaceState(null, null, window.location.pathname);
      }
    }
  } catch(e) {}
}

// ==============================================================================
// 9. MULTI-LANGUAGE SELECTOR & TRANSLATION ENGINE (FR, EN, ES, PT, AR)
// ==============================================================================
const VANDIAS_LANGUAGES = {
  fr: { code: 'FR', name: 'Français', flag: 'https://flagcdn.com/w40/fr.png' },
  en: { code: 'EN', name: 'English', flag: 'https://flagcdn.com/w40/gb.png' },
  es: { code: 'ES', name: 'Español', flag: 'https://flagcdn.com/w40/es.png' },
  pt: { code: 'PT', name: 'Português', flag: 'https://flagcdn.com/w40/br.png' },
  ar: { code: 'AR', name: 'العربية', flag: 'https://flagcdn.com/w40/ae.png' }
};

function initLanguageSelector() {
  const wraps = document.querySelectorAll('.lang-selector-dropdown-wrap');
  if (!wraps.length) return;

  const savedLang = localStorage.getItem('vendia_lang') || 'fr';

  // Met à jour l'affichage de tous les sélecteurs de langue (desktop et mobile)
  const updateSelectorsUI = (langCode) => {
    const lang = VANDIAS_LANGUAGES[langCode] || VANDIAS_LANGUAGES.fr;
    wraps.forEach(wrap => {
      const btn = wrap.querySelector('.lang-selector-btn');
      if (btn) {
        const flagImg = btn.querySelector('.lang-flag-img');
        const codeSpan = btn.querySelector('.lang-current-code');
        if (flagImg) flagImg.src = lang.flag;
        if (codeSpan) codeSpan.textContent = lang.code;
      }

      // Mise à jour de la classe active dans la liste
      const items = wrap.querySelectorAll('.lang-option-item');
      items.forEach(item => {
        if (item.dataset.lang === langCode) {
          item.classList.add('active');
        } else {
          item.classList.remove('active');
        }
      });
    });
  };

  // Gestion des clics sur les boutons et les options
  wraps.forEach(wrap => {
    const btn = wrap.querySelector('.lang-selector-btn');
    if (btn) {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = wrap.classList.contains('open');
        // Ferme les autres dropdowns
        wraps.forEach(w => w.classList.remove('open'));
        if (!isOpen) {
          wrap.classList.add('open');
          btn.setAttribute('aria-expanded', 'true');
        } else {
          btn.setAttribute('aria-expanded', 'false');
        }
      });
    }

    const items = wrap.querySelectorAll('.lang-option-item');
    items.forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const selectedLang = item.dataset.lang;
        if (!selectedLang || !VANDIAS_LANGUAGES[selectedLang]) return;

        localStorage.setItem('vendia_lang', selectedLang);
        updateSelectorsUI(selectedLang);
        wraps.forEach(w => w.classList.remove('open'));

        // Déclenche la traduction instantanée native de toute la plateforme
        if (window.VendiaI18n) {
          window.VendiaI18n.setLanguage(selectedLang);
        }
        // Purge de sécurité de tout cookie tiers Google Translate résiduel
        try {
          document.cookie = "googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
          document.cookie = "googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=" + window.location.hostname;
        } catch(e) {}
      });
    });
  });

  // Fermeture au clic en dehors
  document.addEventListener('click', () => {
    wraps.forEach(w => {
      w.classList.remove('open');
      const b = w.querySelector('.lang-selector-btn');
      if (b) b.setAttribute('aria-expanded', 'false');
    });
  });

  // Applique la langue sauvegardée au démarrage via le moteur natif VendiaI18n
  updateSelectorsUI(savedLang);
  if (window.VendiaI18n) {
    window.VendiaI18n.setLanguage(savedLang, false);
  }
}


