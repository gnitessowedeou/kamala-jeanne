
// Capture et persistance globale d'affiliation (survit aux navigations et redirections)
(function() {
    try {
        const params = new URLSearchParams(window.location.search);
        let ref = params.get('ref') || params.get('referral');
        if (ref) {
            ref = String(ref).trim().toUpperCase();
            try { localStorage.setItem('vandia_referral_code', ref); } catch(e) {}
            try { localStorage.setItem('vendia_ref', ref); } catch(e) {}
            try { sessionStorage.setItem('vandia_referral_code', ref); } catch(e) {}
            try { document.cookie = `vandia_referral_code=${encodeURIComponent(ref)}; path=/; max-age=2592000; SameSite=Lax`; } catch(e) {}
        }
    } catch(e) {}
})();

function getStoredReferralCode() {
  try {
    const fromQuery = new URLSearchParams(window.location.search).get('ref') || new URLSearchParams(window.location.search).get('referral');
    if (fromQuery) return String(fromQuery).trim().toUpperCase();
    const fromLocal = localStorage.getItem('vandia_referral_code') || localStorage.getItem('vendia_ref');
    if (fromLocal) return String(fromLocal).trim().toUpperCase();
    const fromSession = sessionStorage.getItem('vandia_referral_code');
    if (fromSession) return String(fromSession).trim().toUpperCase();
    const match = document.cookie.match(/(?:^|;\s*)vandia_referral_code=([^;]*)/);
    if (match && match[1]) return decodeURIComponent(match[1]).trim().toUpperCase();
  } catch(e) {}
  return null;
}
window.getStoredReferralCode = getStoredReferralCode;

﻿/**
 * ==============================================================================
 * VANDIAS AI — CORE AUTHENTICATION & SUPABASE REST PROFILE ENGINE
 * Handles: Inscription, Connexion, Synchronisation Profil Réel (table 'profiles'),
 * Réinitialisation Mot de Passe, Formatage WhatsApp, Avatar & Persistance.
 * 100% Natif via Fetch API (Zéro dépendance CDN externe — Fiabilité 100%)
 * ==============================================================================
 */

(function (window) {
  "use strict";

  const STORAGE_KEY_USER = "vendia_current_user";
  const STORAGE_KEY_USERS = "vendia_users_db";
  const STORAGE_KEY_TOKEN = "vendia_supabase_token";

  // Configuration Supabase Officielle VANDIAS AI
  const SUPABASE_URL = "https://rcnaebfqtkwwmqdbgkpq.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_76HCqO2mjcqMQIOo0Yx9Bg_dUJmCixv";

  function setAuthCookie(name, value, seconds = 1800) {
    try {
      document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${seconds}; SameSite=Lax`;
    } catch(e) {}
  }

  function getAuthCookie(name) {
    try {
      const match = document.cookie.match(new RegExp('(^|;\\s*)' + name + '=([^;]*)'));
      return match ? decodeURIComponent(match[2].trim()) : null;
    } catch(e) {
      return null;
    }
  }

  function clearAuthCookie(name) {
    try {
      document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`;
    } catch(e) {}
  }

  function getBackendUrl() {
    try {
      const custom = localStorage.getItem('vandia_api_url') || localStorage.getItem('vandia_backend_url');
      if (custom) return custom;
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return window.location.origin;
      }
    } catch(e) {}
    return 'https://kamala-jeanne-production.up.railway.app';
  }

  /**
   * ==============================================================================
   * 1. NATIVE SUPABASE REST CLIENT (Résistant aux pannes de CDN & Adblockers)
   * ==============================================================================
   */
  const SupabaseRest = {
    getToken() {
      try {
        return localStorage.getItem(STORAGE_KEY_TOKEN) || null;
      } catch (e) {
        return null;
      }
    },

    setToken(token) {
      try {
        if (token) localStorage.setItem(STORAGE_KEY_TOKEN, token);
        else localStorage.removeItem(STORAGE_KEY_TOKEN);
      } catch (e) {}
    },

    async request(endpoint, method = "GET", body = null, customToken = null) {
      const token = customToken || this.getToken();
      const headers = {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${token || SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json"
      };

      if (method === "POST" && endpoint.startsWith("/rest/v1/")) {
        headers["Prefer"] = "resolution=merge-duplicates,return=representation";
      } else if (method === "PATCH" && endpoint.startsWith("/rest/v1/")) {
        headers["Prefer"] = "return=representation";
      }

      const res = await fetch(`${SUPABASE_URL}${endpoint}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
      });

      const text = await res.text();
      let data = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch (e) {
        data = text;
      }

      if (!res.ok) {
        const errorMsg = data?.message || data?.error_description || data?.msg || data?.error || `Erreur serveur (${res.status})`;
        throw new Error(errorMsg);
      }

      return data;
    },

    async signUp(email, password, metadata) {
      const res = await this.request("/auth/v1/signup", "POST", {
        email,
        password,
        data: metadata
      });
      if (res?.access_token) {
        this.setToken(res.access_token);
      }
      return res;
    },

    async signInWithPassword(email, password) {
      const res = await this.request("/auth/v1/token?grant_type=password", "POST", {
        email,
        password
      });
      if (res?.access_token) {
        this.setToken(res.access_token);
      }
      return res;
    },

    async upsertProfile(profileData, token = null) {
      return await this.request("/rest/v1/profiles", "POST", profileData, token);
    },

    async getProfile(userId, token = null) {
      const rows = await this.request(`/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=*`, "GET", null, token);
      return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
    },

    async updateProfile(userId, fields, token = null) {
      const rows = await this.request(`/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`, "PATCH", fields, token);
      return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
    },

    async recoverPassword(email) {
      return await this.request("/auth/v1/recover", "POST", { email });
    }
  };

  /**
   * ==============================================================================
   * 2. MODÈLE UTILISATEUR PAR DÉFAUT & VALIDATIONS
   * ==============================================================================
   */
  const DEFAULT_USER = null;

  const AuthEngine = {
    escapeHtml(str) {
      if (str === null || str === undefined) return "";
      const map = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      };
      return String(str).replace(/[&<>"']/g, m => map[m]);
    },

    sanitizeUrl(url) {
      if (!url || typeof url !== "string") return "";
      const trimmed = url.trim();
      if (/^(javascript|vbscript):/i.test(trimmed)) return "";
      if (trimmed.startsWith("data:") && !/^data:image\/(png|jpeg|jpg|webp|gif);base64,/i.test(trimmed)) {
        return "";
      }
      return trimmed;
    },

    getCurrentUser() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY_USER);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && (parsed.id || parsed.email)) {
            return parsed;
          }
        }
      } catch (e) {
        console.error("Erreur lecture utilisateur:", e);
      }
      return DEFAULT_USER;
    },

    saveCurrentUser(user) {
      try {
        localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
        this.saveUserToDb(user);
        this.syncProfileUI(user);
      } catch (e) {
        console.error("Erreur sauvegarde utilisateur:", e);
      }
    },

    saveUserToDb(user) {
      try {
        const users = this.getAllUsers();
        const index = users.findIndex(u => u.email && user.email && u.email.toLowerCase() === user.email.toLowerCase());
        if (index >= 0) {
          users[index] = { ...users[index], ...user };
        } else {
          users.push(user);
        }
        localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users));
      } catch (e) {
        console.error("Erreur sauvegarde users db:", e);
      }
    },

    getAllUsers() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY_USERS);
        if (raw) return JSON.parse(raw);
      } catch (e) {
        console.error("Erreur lecture users db:", e);
      }
      return [DEFAULT_USER];
    },

    splitPhone(rawPhone, fallbackCountry = '+225') {
      const KNOWN = [
        '+225', '+229', '+226', '+221', '+228', '+223', '+227', '+224', '+245',
        '+234', '+233', '+220', '+231', '+232', '+238', '+222', '+237', '+242',
        '+243', '+241', '+212', '+216', '+213', '+33',  '+32',  '+41',  '+1',
        '+44',  '+34',  '+55'
      ].sort((a, b) => b.length - a.length);

      const fallback = (fallbackCountry || '+225').trim();
      const safeFallback = fallback.startsWith('+') ? fallback : '+' + fallback;

      if (!rawPhone) {
        return { country: safeFallback, number: '', rawNumber: '', full: '', cleanFull: '' };
      }

      let s = String(rawPhone).trim().replace(/[\s\-\.]/g, '');
      if (!s || s === 'Non lié' || s === 'Inconnu' || s === 'Non configuré' || s === 'WhatsApp non configuré') {
        return { country: safeFallback, number: '', rawNumber: '', full: '', cleanFull: '' };
      }

      if (!s.startsWith('+')) {
        const matchNoPlus = KNOWN.find(c => s.startsWith(c.slice(1)));
        if (matchNoPlus) {
          s = '+' + s;
        } else {
          s = safeFallback + s;
        }
      }

      const match = KNOWN.find(c => s.startsWith(c));
      let country = safeFallback;
      let national = s;

      if (match) {
        country = match;
        national = s.slice(match.length);
      } else {
        const m = s.match(/^\+(\d{1,3})(.*)$/);
        if (m) {
          country = '+' + m[1];
          national = m[2];
        }
      }

      const cleanDigits = national.replace(/\D/g, '');
      const chunked = (cleanDigits.match(/.{1,2}/g) || []).join(' ');

      return {
        country: country,
        number: chunked || cleanDigits,
        rawNumber: cleanDigits,
        full: cleanDigits.length >= 6 ? (country + ' ' + (chunked || cleanDigits)).trim() : '',
        cleanFull: cleanDigits.length >= 6 ? (country + cleanDigits).trim() : ''
      };
    },

    formatPhone(country, number) {
      const cleanNum = (number || "").trim();
      const cleanCountry = (country || "+225").trim();
      if (!cleanNum) return "";
      const combined = cleanNum.startsWith('+') ? cleanNum : `${cleanCountry} ${cleanNum}`;
      const parsed = this.splitPhone(combined, cleanCountry);
      return parsed.full || `${cleanCountry} ${cleanNum}`.trim();
    },

    isValidEmail(email) {
      const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return re.test((email || "").trim());
    },

    isValidPhone(number) {
      const digits = (number || "").replace(/\D/g, "");
      return digits.length >= 6 && digits.length <= 15;
    },

    isStrongPassword(password) {
      return Boolean(password && password.length >= 8);
    },

    /**
     * ==============================================================================
     * 3. INSCRIPTION (Sign Up) — ENVOI GARANTI VERS SUPABASE
     * ==============================================================================
     */
    async signUp(data) {
      const { firstName, lastName, email, phoneCountry, phoneNumber, password, passwordConfirm, referralCode } = data;

      // 1. Validations de sécurité
      if (!firstName || !firstName.trim()) {
        return { success: false, error: "Veuillez renseigner votre prénom." };
      }
      if (!lastName || !lastName.trim()) {
        return { success: false, error: "Veuillez renseigner votre nom." };
      }
      if (!this.isValidEmail(email)) {
        return { success: false, error: "Veuillez entrer une adresse e-mail valide." };
      }
      if (!this.isValidPhone(phoneNumber)) {
        return { success: false, error: "Veuillez entrer un numéro WhatsApp valide (minimum 6 chiffres)." };
      }
      if (!password || password.length < 8) {
        return { success: false, error: "Le mot de passe doit contenir au moins 8 caractères." };
      }
      if (password !== passwordConfirm) {
        return { success: false, error: "Les mots de passe ne correspondent pas." };
      }

      const parsedPhone = this.splitPhone(`${phoneCountry || '+225'} ${phoneNumber}`, phoneCountry || '+225');
      const fullPhone = parsedPhone.full;
      const cleanEmail = email.trim().toLowerCase();
      const cleanRefCode = (typeof referralCode === 'string' && referralCode.trim()) ? referralCode.trim().toUpperCase() : null;
      const effectiveRefCode = cleanRefCode || (typeof getStoredReferralCode === 'function' ? getStoredReferralCode() : null);

      try {
        // Étape A : Création du compte dans auth.users de Supabase
        const signupRes = await SupabaseRest.signUp(cleanEmail, password, {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          whatsapp_number: fullPhone,
          referred_by: effectiveRefCode
        });

        const userId = signupRes?.id || signupRes?.user?.id;
        const accessToken = signupRes?.access_token || null;

        if (!userId) {
          throw new Error("L'identifiant utilisateur n'a pas pu être généré par Supabase.");
        }

        // Étape B : Génération du code d'affiliation permanent unique pour ce nouvel utilisateur
        const userAffCode = `VD-${(userId.replace(/\D/g, '').substring(0, 4) || Math.floor(1000 + Math.random()*9000))}99`;

        // Étape C : Enregistrement DIRECT dans la table 'profiles' de Supabase
        try {
          const profilePayload = {
            id: userId,
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            full_name: `${firstName.trim()} ${lastName.trim()}`,
            email: cleanEmail,
            whatsapp_number: fullPhone,
            avatar_url: "",
            credits: 100,
            affiliate_code: userAffCode,
            affiliate_balance: 0
          };
          if (effectiveRefCode) {
            profilePayload.referred_by = effectiveRefCode;
          }

          await SupabaseRest.upsertProfile(profilePayload, accessToken);
        } catch (profileErr) {
          console.warn("Avertissement upsert table profiles:", profileErr);
        }

        // Étape D : Confirmation et garantie d'enregistrement côté serveur (bypasse les restrictions RLS)
        try {
          const backendUrl = typeof getBackendUrl === 'function' ? getBackendUrl() : 'https://kamala-jeanne-production.up.railway.app';
          const attrRes = await fetch(`${backendUrl}/api/affiliate/attribute`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId,
              referralCode: effectiveRefCode,
              firstName: firstName.trim(),
              lastName: lastName.trim(),
              email: cleanEmail,
              whatsappNumber: fullPhone
            })
          });
          const attrData = await attrRes.json().catch(() => ({}));
          if (attrData?.success && effectiveRefCode) {
            try { localStorage.removeItem('vandia_referral_code'); } catch(e) {}
            try { localStorage.removeItem('vendia_ref'); } catch(e) {}
            try { sessionStorage.removeItem('vandia_referral_code'); } catch(e) {}
          }
        } catch(attrErr) {
          console.warn("[AFFILIATE] Notice enregistrement attribution serveur:", attrErr.message);
        }

        // Étape C : Création de la session locale avec 300 crédits d'essai gratuit
        const newUser = {
          id: userId,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: cleanEmail,
          phoneCountry: parsedPhone.country,
          phoneNumber: parsedPhone.number,
          fullPhone: fullPhone,
          whatsapp_number: fullPhone,
          company: "Mon Entreprise",
          role: "Administrateur",
          avatarUrl: "",
          provider: "supabase",
          plan: {
            name: "Essai Gratuit 7j 🦾",
            badge: "ESSAI",
            tokensUsed: 0,
            tokensMax: 100,
            daysLeft: 7
          },
          createdAt: signupRes?.user?.created_at || signupRes?.created_at || new Date().toISOString()
        };

        this.saveCurrentUser(newUser);
        try {
          localStorage.setItem('vendia_connected_phone', fullPhone);
          window.currentWhatsAppPhone = fullPhone;
        } catch(e) {}
        return { success: true, user: newUser };
      } catch (err) {
        console.error("Erreur inscription Supabase:", err);
        let errorMsg = err.message || "Erreur de connexion à Supabase.";
        if (errorMsg.includes("User already registered") || errorMsg.includes("already exists")) {
          errorMsg = "Cette adresse e-mail est déjà inscrite. Veuillez vous connecter.";
        }
        return { success: false, error: errorMsg };
      }
    },

    /**
     * ==============================================================================
     * 4. CONNEXION (Sign In) — VÉRIFICATION SUPABASE & LECTURE TABLE PROFILES
     * ==============================================================================
     */
    async signIn(email, password) {
      if (!this.isValidEmail(email)) {
        return { success: false, error: "Veuillez renseigner une adresse e-mail valide." };
      }
      if (!password || !password.trim()) {
        return { success: false, error: "Veuillez entrer votre mot de passe." };
      }

      const cleanEmail = email.trim().toLowerCase();

      try {
        const loginRes = await SupabaseRest.signInWithPassword(cleanEmail, password);
        const userObj = loginRes?.user;
        const userId = userObj?.id || loginRes?.id;

        // Lecture des informations complètes depuis la table 'profiles' de Supabase
        let profile = null;
        try {
          profile = await SupabaseRest.getProfile(userId, loginRes?.access_token);
        } catch (pErr) {
          console.warn("Lecture profil Supabase:", pErr);
        }

        const meta = userObj?.user_metadata || {};
        const appMeta = userObj?.app_metadata || {};
        const userFirst = profile?.first_name || meta.first_name || cleanEmail.split("@")[0].charAt(0).toUpperCase() + cleanEmail.split("@")[0].slice(1);
        const userLast = profile?.last_name || meta.last_name || "";
        let userPhone = (profile?.whatsapp_number || profile?.phone || meta.whatsapp_number || meta.phone || "").toString().trim();
        if (userPhone === 'Non lié' || userPhone === 'Inconnu' || userPhone === 'Non configuré' || userPhone === 'WhatsApp non configuré') userPhone = "";
        const parsedPhone = this.splitPhone(userPhone);

        const userCreatedAt = userObj?.created_at || profile?.created_at || new Date().toISOString();
        const activePlan = appMeta.plan || profile?.plan || 'trial';
        const planStatus = appMeta.plan_status || profile?.plan_status || 'active';
        const planCycle = appMeta.plan_cycle || profile?.plan_cycle || 'monthly';
        const planActivatedAt = appMeta.plan_activated_at || profile?.plan_activated_at || null;
        const planExpiresAt = appMeta.plan_expires_at || profile?.plan_expires_at || null;

        const isPaid = (activePlan && activePlan !== 'trial' && activePlan !== 'free' && activePlan !== 'expired' && planStatus === 'active');
        const maxTokens = isPaid ? (activePlan === 'basic' ? 1000 : activePlan === 'pro' ? 3000 : 10000) : 100;
        const remainingCredits = typeof profile?.credits === 'number' ? profile.credits : (isPaid ? maxTokens : 100);

        const loggedInUser = {
          id: userId,
          firstName: userFirst,
          lastName: userLast,
          email: profile?.email || userObj?.email || cleanEmail,
          phoneCountry: parsedPhone.country,
          phoneNumber: parsedPhone.number,
          fullPhone: parsedPhone.full,
          whatsapp_number: parsedPhone.full,
          company: "Mon Entreprise",
          role: "Administrateur",
          avatarUrl: profile?.avatar_url || meta.avatar_url || "",
          provider: "supabase",
          plan: {
            name: isPaid ? `Formule ${activePlan.toUpperCase()}` : "Essai Gratuit 7j 🦾",
            type: activePlan,
            status: planStatus,
            cycle: planCycle,
            activatedAt: planActivatedAt,
            expiresAt: planExpiresAt,
            badge: isPaid ? activePlan.toUpperCase() : "ESSAI",
            tokensUsed: Math.max(0, maxTokens - remainingCredits),
            tokensMax: maxTokens
          },
          createdAt: userCreatedAt
        };

        this.saveCurrentUser(loggedInUser);
        if (parsedPhone.full) {
          try {
            localStorage.setItem('vendia_connected_phone', parsedPhone.full);
            window.currentWhatsAppPhone = parsedPhone.full;
          } catch(e) {}
        }
        try {
          localStorage.setItem('vendia_user_registered_' + userId, userCreatedAt);
        } catch(e) {}
        return { success: true, user: loggedInUser };
      } catch (err) {
        console.error("Erreur connexion Supabase:", err);
        let message = err.message || "Erreur de connexion.";
        if (message.includes("Invalid login credentials") || message.includes("invalid_grant")) {
          message = "Identifiants incorrects. Vérifiez votre adresse e-mail et mot de passe.";
        } else if (message.includes("Email not confirmed")) {
          message = "Veuillez confirmer votre adresse e-mail avant de vous connecter (un e-mail vous a été envoyé).";
        }
        return { success: false, error: message };
      }
    },

    /**
     * ==============================================================================
     * 5. MOT DE PASSE OUBLIÉ & DÉCONNEXION
     * ==============================================================================
     */
    async resetPassword(email) {
      if (!this.isValidEmail(email)) {
        return { success: false, error: "Veuillez entrer une adresse e-mail valide." };
      }
      const cleanEmail = email.trim().toLowerCase();
      try {
        await SupabaseRest.recoverPassword(cleanEmail);
        return {
          success: true,
          message: `Un lien sécurisé de réinitialisation Supabase a été envoyé à ${cleanEmail}.`
        };
      } catch (err) {
        console.warn("Supabase recoverPassword:", err);
        return {
          success: true,
          message: `Si un compte existe pour ${cleanEmail}, un e-mail de réinitialisation a été envoyé.`
        };
      }
    },

    logout() {
      SupabaseRest.setToken(null);
      localStorage.removeItem(STORAGE_KEY_USER);
      localStorage.removeItem(STORAGE_KEY_TOKEN);
      window.location.href = "index.html";
    },

    /**
     * ==============================================================================
     * 5b. CONNEXION SOCIALE OAUTH (GOOGLE, FACEBOOK) VIA SUPABASE REST
     * ==============================================================================
     */
    async signInWithOAuth(provider = "google", mode = null) {
      try {
        const tabLogin = document.getElementById("tab-btn-login");
        const formLogin = document.getElementById("form-login");
        const isTabLogin = (tabLogin && tabLogin.classList.contains("active")) || (formLogin && formLogin.style.display !== "none");
        
        let authMode = mode || (isTabLogin ? "login" : (localStorage.getItem("vendia_auth_mode") || "signup"));
        if (isTabLogin) {
          authMode = "login";
        }

        console.log("[OAUTH START] Provider:", provider, "Mode:", authMode);

        // Sauvegarder dans 4 canaux distincts pour résister à toute perte de contexte
        setAuthCookie("vendia_oauth_mode", authMode, 1800);
        try {
          localStorage.setItem("vendia_oauth_mode", authMode);
          localStorage.setItem("vendia_auth_mode", authMode);
          sessionStorage.setItem("vendia_oauth_mode", authMode);
          sessionStorage.setItem("vendia_auth_mode", authMode);
          // Purger toute ancienne session locale résiduelle
          localStorage.removeItem(STORAGE_KEY_USER);
          localStorage.removeItem(STORAGE_KEY_TOKEN);
        } catch(e) {}

        const origin = window.location.origin;
        const basePath = window.location.pathname.substring(0, window.location.pathname.lastIndexOf("/") + 1);
        const redirectTo = `${origin}${basePath}index.html?oauth_mode=${encodeURIComponent(authMode)}`;
        const authUrl = `${SUPABASE_URL}/auth/v1/authorize?provider=${encodeURIComponent(provider)}&redirect_to=${encodeURIComponent(redirectTo)}`;
        window.location.href = authUrl;
        return { success: true, redirecting: true };
      } catch (err) {
        console.error("Erreur redirection OAuth:", err);
        return { success: false, error: err.message || "Erreur de redirection OAuth." };
      }
    },

    async handleOAuthCallback() {
      try {
        const hash = window.location.hash;
        if (!hash) return false;

        const params = new URLSearchParams(hash.substring(1));
        const errorDesc = params.get("error_description") || params.get("error");
        if (errorDesc) {
          console.error("Erreur retour OAuth:", errorDesc);
          const decodedErr = decodeURIComponent(errorDesc.replace(/\+/g, " "));
          if (typeof window.showAuthAlert === "function") {
            window.showAuthAlert("Erreur Google : " + decodedErr, "error");
            if (typeof window.openAuthModal === "function") window.openAuthModal("login");
          } else {
            this.showToast("Erreur de connexion : " + decodedErr, "error");
          }
          if (window.history && window.history.replaceState) {
            window.history.replaceState(null, null, window.location.pathname);
          }
          return false;
        }

        if (!hash.includes("access_token=")) return false;
        const accessToken = params.get("access_token");
        if (!accessToken) return false;

        SupabaseRest.setToken(accessToken);

        // Récupérer le compte utilisateur officiel depuis Supabase Auth
        const userObj = await SupabaseRest.request("/auth/v1/user", "GET", null, accessToken);
        if (!userObj || !userObj.id) return false;

        const meta = userObj.user_metadata || {};
        const cleanEmail = (userObj.email || "").trim().toLowerCase();
        const fullName = meta.full_name || meta.name || "";
        const parts = fullName.split(" ");
        const userFirst = parts[0] || meta.first_name || (cleanEmail ? cleanEmail.split("@")[0].charAt(0).toUpperCase() + cleanEmail.split("@")[0].slice(1) : "Utilisateur");
        const userLast = parts.slice(1).join(" ") || meta.last_name || "";
        const userAvatar = meta.avatar_url || meta.picture || "";

        // Détection ultra-robuste du mode d'authentification (URL > Cookie > Local > Session)
        const urlParams = new URLSearchParams(window.location.search);
        const urlMode = urlParams.get("oauth_mode");
        const cookieMode = getAuthCookie("vendia_oauth_mode");
        const localMode = localStorage.getItem("vendia_oauth_mode") || localStorage.getItem("vendia_auth_mode");
        const sessionMode = sessionStorage.getItem("vendia_oauth_mode") || sessionStorage.getItem("vendia_auth_mode");

        // Si l'un quelconque des 4 canaux a enregistré "login", c'est formellement un LOGIN
        const isLoginAttempt = (urlMode === "login" || cookieMode === "login" || localMode === "login" || sessionMode === "login");
        const authMode = isLoginAttempt ? "login" : (urlMode || cookieMode || localMode || sessionMode || "signup");

        console.log("[OAUTH CALLBACK] Modes -> URL:", urlMode, "Cookie:", cookieMode, "Local:", localMode, "Session:", sessionMode, "=> Final:", authMode);

        // Nettoyage des cookies et marqueurs temporaires
        clearAuthCookie("vendia_oauth_mode");
        try {
          localStorage.removeItem("vendia_oauth_mode");
          sessionStorage.removeItem("vendia_oauth_mode");
        } catch(e) {}

        if (window.history && window.history.replaceState) {
          window.history.replaceState(null, null, window.location.pathname);
        }

        // 1. Validation Backend & BDD Supabase (/api/auth/oauth-verify)
        // La décision d'accès est validée par le serveur pour garantir l'absence de bypass
        let serverVerified = false;
        let serverUser = null;
        let profile = null;

        try {
          const backendUrl = getBackendUrl();
          const verifyResp = await fetch(`${backendUrl}/api/auth/oauth-verify`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              accessToken: accessToken,
              mode: authMode
            })
          });

          const resData = await verifyResp.json();

          // Code 403 NO_ACCOUNT : L'accès au dashboard est catégoriquement refusé par le serveur
          if (verifyResp.status === 403 || resData?.code === "NO_ACCOUNT") {
            console.warn("[AUTH OAUTH] Blocage Backend : Compte inexistant lors de la connexion Google avec l'email :", cleanEmail);

            SupabaseRest.setToken(null);
            try {
              localStorage.removeItem(STORAGE_KEY_USER);
              localStorage.removeItem(STORAGE_KEY_TOKEN);
            } catch(e) {}

            const errorMsg = resData?.error || `Cette adresse e-mail (${cleanEmail}) n'a pas encore de compte sur la plateforme VANDIAS. Veuillez créer votre compte ci-dessous pour démarrer vos 7 jours d'essai gratuit.`;
            const prefill = resData?.user || { firstName: userFirst, lastName: userLast, email: cleanEmail };

            try {
              sessionStorage.setItem("vendia_oauth_error", errorMsg);
              sessionStorage.setItem("vendia_prefill_signup", JSON.stringify(prefill));
            } catch(e) {}

            if (window.location.pathname.includes("dashboard.html")) {
              const basePath = window.location.pathname.substring(0, window.location.pathname.lastIndexOf("/") + 1);
              window.location.replace(`${window.location.origin}${basePath}index.html?auth=signup`);
              return false;
            }

            if (typeof window.openAuthModal === "function") {
              window.openAuthModal("signup");
            }
            if (typeof window.showAuthAlert === "function") {
              window.showAuthAlert(errorMsg, "error");
            }

            const inputFirst = document.getElementById("signup-firstname");
            const inputLast = document.getElementById("signup-lastname");
            const inputEmail = document.getElementById("signup-email");
            if (inputFirst && prefill.firstName) inputFirst.value = prefill.firstName;
            if (inputLast && prefill.lastName) inputLast.value = prefill.lastName;
            if (inputEmail && prefill.email) inputEmail.value = prefill.email;

            return false;
          }

          if (verifyResp.ok && resData && resData.success) {
            serverVerified = true;
            serverUser = resData.user;
            profile = resData.profile;
          }
        } catch (serverErr) {
          console.warn("[AUTH OAUTH] Serveur Backend temporairement indisponible, validation directe Supabase:", serverErr);
        }

        // 2. Double vérification directe via Supabase REST si le serveur n'a pas répondu
        if (!serverVerified) {
          try {
            profile = await SupabaseRest.getProfile(userObj.id, accessToken);
          } catch (pErr) {
            console.warn("Lecture profil OAuth Supabase (ID):", pErr);
          }

          if (!profile && cleanEmail) {
            try {
              const rows = await SupabaseRest.request(`/rest/v1/profiles?email=eq.${encodeURIComponent(cleanEmail)}&select=*`, "GET", null, accessToken);
              if (Array.isArray(rows) && rows.length > 0) {
                profile = rows[0];
              }
            } catch(e) {
              console.warn("Lecture profil OAuth Supabase (Email):", e);
            }
          }

          // RÈGLE STRICTE : Si tentative de connexion (login) mais compte non enregistré dans la table profiles
          if (isLoginAttempt && !profile) {
            console.warn("[AUTH OAUTH] Compte inexistant lors de la connexion Google avec l'email :", cleanEmail);

            SupabaseRest.setToken(null);
            try {
              localStorage.removeItem(STORAGE_KEY_USER);
              localStorage.removeItem(STORAGE_KEY_TOKEN);
            } catch(e) {}

            const errorMsg = `Cette adresse e-mail (${cleanEmail}) n'a pas encore de compte sur la plateforme VANDIAS. Veuillez créer votre compte ci-dessous pour démarrer vos 7 jours d'essai gratuit.`;

            try {
              sessionStorage.setItem("vendia_oauth_error", errorMsg);
              sessionStorage.setItem("vendia_prefill_signup", JSON.stringify({
                firstName: userFirst,
                lastName: userLast,
                email: cleanEmail
              }));
            } catch(e) {}

            if (window.location.pathname.includes("dashboard.html")) {
              const basePath = window.location.pathname.substring(0, window.location.pathname.lastIndexOf("/") + 1);
              window.location.replace(`${window.location.origin}${basePath}index.html?auth=signup`);
              return false;
            }

            if (typeof window.openAuthModal === "function") {
              window.openAuthModal("signup");
            }
            if (typeof window.showAuthAlert === "function") {
              window.showAuthAlert(errorMsg, "error");
            }

            const inputFirst = document.getElementById("signup-firstname");
            const inputLast = document.getElementById("signup-lastname");
            const inputEmail = document.getElementById("signup-email");
            if (inputFirst && userFirst) inputFirst.value = userFirst;
            if (inputLast && userLast) inputLast.value = userLast;
            if (inputEmail && cleanEmail) inputEmail.value = cleanEmail;

            return false;
          }

          // Si l'utilisateur est sur inscription (signup) et n'a pas encore de profil, création dans profiles
          if (!profile) {
            try {
              await SupabaseRest.upsertProfile({
                id: userObj.id,
                first_name: userFirst,
                last_name: userLast,
                full_name: `${userFirst} ${userLast}`.trim(),
                email: cleanEmail,
                whatsapp_number: "",
                avatar_url: userAvatar,
                credits: 100,
                created_at: userObj.created_at || new Date().toISOString()
              }, accessToken);
            } catch (upsertErr) {
              console.warn("Création profil OAuth Supabase:", upsertErr);
            }
          }
        }

        const oauthMeta = userObj.app_metadata || {};
        const activePlan = oauthMeta.plan || profile?.plan || serverUser?.plan?.type || 'trial';
        const planStatus = oauthMeta.plan_status || profile?.plan_status || serverUser?.plan?.status || 'active';
        const planCycle = oauthMeta.plan_cycle || profile?.plan_cycle || serverUser?.plan?.cycle || 'monthly';
        const isPaid = (activePlan && activePlan !== 'trial' && activePlan !== 'free' && activePlan !== 'expired' && planStatus === 'active');
        const maxTokens = isPaid ? (activePlan === 'basic' ? 1000 : activePlan === 'pro' ? 3000 : 10000) : 100;
        const remainingCredits = typeof profile?.credits === 'number' ? profile.credits : (typeof serverUser?.credits === 'number' ? serverUser.credits : (isPaid ? maxTokens : 100));
        const userCreatedAt = userObj.created_at || profile?.created_at || serverUser?.createdAt || new Date().toISOString();

        let oauthPhone = (profile?.whatsapp_number || (serverUser ? serverUser.fullPhone : "")).toString().trim();
        if (oauthPhone === 'Non lié' || oauthPhone === 'Inconnu' || oauthPhone === 'Non configuré' || oauthPhone === 'WhatsApp non configuré') oauthPhone = "";
        const parsedOAuthPhone = this.splitPhone(oauthPhone);

        const loggedInUser = serverUser ? {
          ...serverUser,
          fullPhone: parsedOAuthPhone.full,
          whatsapp_number: parsedOAuthPhone.full,
          phoneCountry: parsedOAuthPhone.country,
          phoneNumber: parsedOAuthPhone.number,
          provider: "google"
        } : {
          id: userObj.id,
          firstName: profile?.first_name || userFirst,
          lastName: profile?.last_name || userLast,
          email: profile?.email || cleanEmail,
          phoneCountry: parsedOAuthPhone.country,
          phoneNumber: parsedOAuthPhone.number,
          fullPhone: parsedOAuthPhone.full,
          whatsapp_number: parsedOAuthPhone.full,
          company: "Mon Entreprise",
          role: "Administrateur",
          avatarUrl: profile?.avatar_url || userAvatar,
          provider: "google",
          plan: {
            name: isPaid ? `Formule ${activePlan.toUpperCase()}` : "Essai Gratuit 7j 🦾",
            type: activePlan,
            status: planStatus,
            cycle: planCycle,
            activatedAt: oauthMeta.plan_activated_at || profile?.plan_activated_at || null,
            expiresAt: oauthMeta.plan_expires_at || profile?.plan_expires_at || null,
            badge: isPaid ? activePlan.toUpperCase() : "ESSAI",
            tokensUsed: Math.max(0, maxTokens - remainingCredits),
            tokensMax: maxTokens
          },
          createdAt: userCreatedAt
        };

        this.saveCurrentUser(loggedInUser);
        if (parsedOAuthPhone.full) {
          try {
            localStorage.setItem('vendia_connected_phone', parsedOAuthPhone.full);
            window.currentWhatsAppPhone = parsedOAuthPhone.full;
          } catch(e) {}
        }
        try {
          localStorage.setItem('vendia_user_registered_' + (loggedInUser.id || userObj.id), userCreatedAt);
        } catch(e) {}

        // Redirection vers le dashboard pour l'utilisateur authentifié avec succès
        window.location.replace("dashboard.html");
        return true;
      } catch (err) {
        console.error("Erreur traitement callback OAuth:", err);
        return false;
      }
    },

    /**
     * ==============================================================================
     * 6. MISE À JOUR DU PROFIL DANS SUPABASE (TABLE PROFILES)
     * ==============================================================================
     */
    async updateProfile(updates) {
      const current = this.getCurrentUser();

      if (updates.phoneNumber && !this.isValidPhone(updates.phoneNumber)) {
        return { success: false, error: "Numéro WhatsApp invalide." };
      }

      const rawCombined = `${updates.phoneCountry || current.phoneCountry || '+225'} ${updates.phoneNumber || current.phoneNumber || ''}`;
      const parsedPhone = this.splitPhone(rawCombined, updates.phoneCountry || current.phoneCountry || '+225');

      const updated = {
        ...current,
        ...updates,
        phoneCountry: parsedPhone.country,
        phoneNumber: parsedPhone.number,
        fullPhone: parsedPhone.full,
        whatsapp_number: parsedPhone.full
      };

      // Synchronisation directe avec la table 'profiles' de Supabase
      if (current.id) {
        try {
          await SupabaseRest.updateProfile(current.id, {
            first_name: updated.firstName || "",
            last_name: updated.lastName || "",
            whatsapp_number: parsedPhone.full,
            avatar_url: updated.avatarUrl || current.avatarUrl || "",
            updated_at: new Date().toISOString()
          });
        } catch (err) {
          console.warn("Avertissement mise à jour table profiles:", err);
        }
      }

      if (parsedPhone.full) {
        try {
          localStorage.setItem('vendia_connected_phone', parsedPhone.full);
          window.currentWhatsAppPhone = parsedPhone.full;
        } catch(e) {}
      }

      this.saveCurrentUser(updated);
      this.syncProfileUI(updated);
      if (typeof window.applyWhatsAppState === 'function') {
        window.applyWhatsAppState(window.currentWhatsAppStatus || 'DISCONNECTED', updated.fullPhone || '');
      }
      return { success: true, user: updated };
    },

    /**
     * ==============================================================================
     * 7. SYNCHRONISATION EN DIRECT DU PROFIL DANS LE DOM
     * ==============================================================================
     */
    syncProfileUI(user) {
      if (!user) user = this.getCurrentUser();
      if (!user) return;

      const fullName = `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Utilisateur VANDIAS";
      const initials = ((user.firstName?.[0] || "") + (user.lastName?.[0] || "")).toUpperCase() || "V";

      // 1. Profil Sidebar
      const sidebarName = document.getElementById("user-display-name");
      if (sidebarName) sidebarName.textContent = fullName;

      const sidebarRole = document.getElementById("user-display-role");
      if (sidebarRole) sidebarRole.textContent = user.role || "Admin Entreprise";

      const avatarBadge = document.getElementById("user-avatar-badge");
      const mobileAvatarBadge = document.getElementById("header-avatar-initial");
      if (avatarBadge) {
        const safeAvatar = this.sanitizeUrl(user.avatarUrl);
        const safeName = this.escapeHtml(fullName);
        if (safeAvatar) {
          avatarBadge.innerHTML = `<img src="${safeAvatar}" alt="${safeName}" class="user-avatar-img">`;
          if (mobileAvatarBadge) mobileAvatarBadge.innerHTML = `<img src="${safeAvatar}" alt="${safeName}" class="user-avatar-img">`;
        } else {
          avatarBadge.textContent = initials;
          avatarBadge.classList.add("avatar-initials");
          if (mobileAvatarBadge) mobileAvatarBadge.textContent = initials;
        }
      }

      // 2. Bannière de bienvenue
      
        
        const affiliateLinkEl = document.getElementById("affiliate-link-input");
        if (affiliateLinkEl) {
            const codeToUse = user.affiliateCode || ("REF-" + (user.firstName || "").substring(0,3) + Math.floor(Math.random()*1000)).toUpperCase();
            affiliateLinkEl.value = window.location.origin + "/?ref=" + codeToUse;
        }

        
      // 3. Statut WhatsApp connecté personnel
      let userPhone = (
        window.currentWhatsAppPhone || 
        localStorage.getItem('vendia_connected_phone') || 
        user.fullPhone || 
        user.whatsapp_number || 
        user.phone || 
        user.phoneNumber || 
        ""
      ).toString().trim();
      if (userPhone === 'Non lié' || userPhone === 'Inconnu' || userPhone === 'Non configuré' || userPhone === 'WhatsApp non configuré') {
        userPhone = "";
      }
      const parsedPhone = this.splitPhone(userPhone, user.phoneCountry || '+225');
      const hasPhone = !!parsedPhone.full && parsedPhone.rawNumber.length >= 6;
      const formattedPhone = hasPhone ? parsedPhone.full : '';

      const welcomeNames = document.querySelectorAll(".welcome-name");
      welcomeNames.forEach(el => {
        el.textContent = user.firstName || "Cher Partenaire";
      });

      const isWaConnected = (window.currentWhatsAppStatus === 'CONNECTED');
      const headerNum = document.getElementById("header-connected-num");
      const sidebarNum = document.getElementById("sidebar-connected-num");
      if (headerNum) {
        if (isWaConnected) {
          headerNum.textContent = formattedPhone || "Ligne Connectée";
        } else {
          headerNum.textContent = hasPhone ? formattedPhone : "WhatsApp non configuré";
        }
      }
      if (sidebarNum) {
        if (isWaConnected) {
          sidebarNum.textContent = formattedPhone || "IA Active";
        } else {
          sidebarNum.textContent = hasPhone ? formattedPhone : "Non configuré";
        }
      }

      if (typeof window.applyWhatsAppState === 'function') {
        window.applyWhatsAppState(window.currentWhatsAppStatus || 'DISCONNECTED', formattedPhone);
      }

      // 4. Champs de configuration Profil
      const setFullName = document.getElementById("settings-display-fullname");
      if (setFullName) setFullName.textContent = fullName;
      const setEmail = document.getElementById("settings-display-email");
      if (setEmail) setEmail.textContent = user.email || "En attente";
      const setPhone = document.getElementById("settings-display-phone");
      if (setPhone) setPhone.textContent = hasPhone ? formattedPhone : "Non configuré";

      const teamLeadName = document.getElementById("team-lead-name");
      if (teamLeadName) teamLeadName.textContent = fullName;
      const teamLeadEmail = document.getElementById("team-lead-email");
      if (teamLeadEmail) teamLeadEmail.textContent = user.email || "admin@vandias.com";

      // 5. Champs d'édition du formulaire modal
      const inputFirst = document.getElementById("profile-firstname");
      if (inputFirst) inputFirst.value = user.firstName || "";
      const inputLast = document.getElementById("profile-lastname");
      if (inputLast) inputLast.value = user.lastName || "";
      const inputEmail = document.getElementById("profile-email");
      if (inputEmail) inputEmail.value = user.email || "";
      const selectCountry = document.getElementById("profile-phone-country");
      if (selectCountry && parsedPhone.country) {
        selectCountry.value = parsedPhone.country;
        try { selectCountry.dispatchEvent(new Event('change')); } catch(e) {}
      }
      const inputPhone = document.getElementById("profile-phone-number");
      if (inputPhone) inputPhone.value = parsedPhone.number || parsedPhone.rawNumber || "";
      const inputCompany = document.getElementById("profile-company");
      if (inputCompany) inputCompany.value = user.company || "";
      const inputRole = document.getElementById("profile-role");
      if (inputRole) inputRole.value = user.role || "";

      // 6. Aperçu de l'avatar dans le modal
      const avatarPreview = document.getElementById("profile-avatar-preview");
      if (avatarPreview) {
        const safeAvatar = this.sanitizeUrl(user.avatarUrl);
        const safeName = this.escapeHtml(fullName);
        if (safeAvatar) {
          avatarPreview.innerHTML = `<img src="${safeAvatar}" alt="${safeName}" class="avatar-preview-img">`;
        } else {
          avatarPreview.innerHTML = `<span class="avatar-preview-initials">${this.escapeHtml(initials)}</span>`;
        }
      }

      // 7. Plan & Crédits IA dans la barre latérale
      const planNameEl = document.getElementById("sidebar-plan-name");
      const planTokensMaxEl = document.getElementById("sub-tokens-max");
      const planTokensUsedEl = document.getElementById("sub-tokens-used");
      const planPctEl = document.getElementById("sub-token-pct");
      const planFillEl = document.getElementById("sub-token-fill");
      const subCreditsLabel = document.getElementById("sub-credits-label");
      
      if (subCreditsLabel) subCreditsLabel.textContent = "Solde Crédits IA";

      if (user.plan) {
        if (planNameEl) planNameEl.textContent = user.plan.name || "Essai Gratuit 7j 🚀";
        const max = user.plan.tokensMax || 100;
        const credits = (typeof user.credits === 'number') 
          ? user.credits 
          : (max - (user.plan.tokensUsed || 0));
        const remainingPct = max > 0 ? Math.min(100, Math.max(0, (credits / max) * 100)).toFixed(0) : 100;

        if (planTokensMaxEl) planTokensMaxEl.textContent = `sur ${max.toLocaleString("fr-FR")} inclus`;
        if (planTokensUsedEl) planTokensUsedEl.textContent = `${credits} crédit${credits > 1 ? 's' : ''} disponible${credits > 1 ? 's' : ''}`;
        if (planPctEl) planPctEl.textContent = `${remainingPct}% restants`;
        if (planFillEl) {
          planFillEl.style.width = `${remainingPct}%`;
          planFillEl.style.background = remainingPct > 20 ? "linear-gradient(90deg, #25D366, #10b981)" : "linear-gradient(90deg, #f59e0b, #ef4444)";
        }

        const billingCreditsDisplay = document.getElementById("billing-credits-display");
        if (billingCreditsDisplay) {
          billingCreditsDisplay.innerHTML = `Crédits IA : <strong>${credits} disponibles sur ${max} inclus</strong>`;
        }
      }

      // 8. Code & Lien de Parrainage Personnalisé
      const affCodeInput = document.getElementById("affiliate-code-input");
      const affLinkInput = document.getElementById("affiliate-link-input");
      const userAffCode = user.affiliateCode || user.affiliate_code;
      if (userAffCode) {
        if (affCodeInput) affCodeInput.value = userAffCode;
        if (affLinkInput) affLinkInput.value = `${window.location.origin}/?ref=${userAffCode}`;
        const affWaShare = document.getElementById("btn-share-affiliate-wa");
        if (affWaShare) {
          affWaShare.href = "https://wa.me/?text=" + encodeURIComponent(
            `Bonjour ! Je te recommande VANDIAS AI pour automatiser tes ventes et paiements Wave sur WhatsApp 24/7. Inscris-toi avec mon lien officiel : ${window.location.origin}/?ref=${userAffCode} ou mon code parrainage ${userAffCode}`
          );
        }
      }
    },

    /**
     * ==============================================================================
     * 8. VÉRIFICATION DE SESSION SUPABASE AU CHARGEMENT DE LA PAGE
     * ==============================================================================
     */
    async checkSession() {
      const user = this.getCurrentUser();
      if (!user || !user.id) return;

      try {
        const profile = await SupabaseRest.getProfile(user.id);
        if (profile) {
          const profilePlan = profile.plan || user.plan?.type;
          const isPaid = (profilePlan && profilePlan !== 'trial' && profilePlan !== 'free' && profilePlan !== 'expired' && (profile.plan_status === 'active' || user.plan?.status === 'active'));
          const maxTokens = (profilePlan === 'basic' ? 1000 : profilePlan === 'pro' ? 3000 : profilePlan === 'business' ? 10000 : 100);
          const usedTokens = Math.max(0, maxTokens - (profile.credits ?? maxTokens));
          const persistentCreatedAt = user.createdAt || profile.created_at || localStorage.getItem('vendia_user_registered_' + user.id);

          // Récupération stricte du numéro personnel depuis Supabase
          let profilePhone = (profile.whatsapp_number || profile.phone || user.fullPhone || user.whatsapp_number || localStorage.getItem('vendia_connected_phone') || "").toString().trim();
          if (profilePhone === 'Non lié' || profilePhone === 'Inconnu' || profilePhone === 'Non configuré' || profilePhone === 'WhatsApp non configuré') {
            profilePhone = "";
          }
          const parsedPhone = this.splitPhone(profilePhone, user.phoneCountry || '+225');

          const syncedUser = {
            ...user,
            createdAt: persistentCreatedAt || user.createdAt,
            firstName: profile.first_name || user.firstName,
            lastName: profile.last_name || user.lastName,
            fullPhone: parsedPhone.full,
            whatsapp_number: parsedPhone.full,
            phoneCountry: parsedPhone.country,
            phoneNumber: parsedPhone.number,
            avatarUrl: profile.avatar_url || user.avatarUrl,
            affiliateCode: profile.affiliate_code || user.affiliateCode,
            plan: {
              ...(user.plan || {}),
              type: profilePlan || user.plan?.type || 'trial',
              status: profile.plan_status || user.plan?.status || 'active',
              cycle: profile.plan_cycle || user.plan?.cycle || 'monthly',
              activatedAt: profile.plan_activated_at || user.plan?.activatedAt || null,
              expiresAt: profile.plan_expires_at || user.plan?.expiresAt || null,
              name: isPaid ? `Formule ${(profilePlan || 'pro').toUpperCase()}` : "Essai Gratuit 7j 🦾",
              tokensMax: maxTokens,
              tokensUsed: usedTokens
            }
          };
          this.saveCurrentUser(syncedUser);
          this.syncProfileUI(syncedUser);
          if (typeof updateTrialAndSubscriptionUI === 'function') {
            updateTrialAndSubscriptionUI();
          }
        } else {
          if (window.location.pathname.includes("dashboard.html")) {
            console.warn("[CHECK SESSION] Profil inexistant dans Supabase. Éjection immédiate du dashboard.");
            this.logout();
            return;
          }
        }
      } catch (err) {
        console.warn("Vérification session Supabase:", err);
      }
    },

    showToast(message, type = "success") {
      let toast = document.getElementById("vendia-global-toast");
      if (!toast) {
        toast = document.createElement("div");
        toast.id = "vendia-global-toast";
        toast.className = "vendia-toast";
        document.body.appendChild(toast);
      }

      const icon = type === "success" 
        ? '<i class="fa-solid fa-circle-check" style="color: #00c968;"></i>' 
        : '<i class="fa-solid fa-circle-exclamation" style="color: #f43f5e;"></i>';

      toast.className = `vendia-toast ${type} show`;
      toast.innerHTML = `
        <div class="toast-content">
          ${icon}
          <span>${this.escapeHtml(message)}</span>
        </div>
      `;

      clearTimeout(this._toastTimeout);
      this._toastTimeout = setTimeout(() => {
        toast.classList.remove("show");
      }, 3500);
    }
  };

  const COUNTRY_ISO_BY_VAL = {
    '+225': 'ci', '+229': 'bj', '+226': 'bf', '+221': 'sn', '+228': 'tg',
    '+223': 'ml', '+227': 'ne', '+224': 'gn', '+245': 'gw', '+234': 'ng',
    '+233': 'gh', '+220': 'gm', '+231': 'lr', '+232': 'sl', '+238': 'cv',
    '+222': 'mr', '+237': 'cm', '+242': 'cg', '+243': 'cd', '+241': 'ga',
    '+33': 'fr',  '+32': 'be',  '+41': 'ch',  '+1': 'us',   '+44': 'gb',
    '+34': 'es',  '+55': 'br',  '+212': 'ma', '+216': 'tn', '+213': 'dz'
  };

  // Gestionnaire de sélecteur de pays compact (Drapeau HD garanti PC & Mobile, indicateur seul affiché)
  function initCompactCountrySelectors() {
    const selects = document.querySelectorAll('.country-code-select');
    selects.forEach(sel => {
      // Insertion ou récupération du drapeau réel haute définition garanti visible sur PC Windows
      let flagImg = null;
      if (sel.parentElement && (sel.parentElement.classList.contains('phone-input-group') || sel.parentElement.classList.contains('auth-input-wrapper'))) {
        flagImg = sel.parentElement.querySelector('.country-flag-preview');
        if (!flagImg) {
          flagImg = document.createElement('img');
          flagImg.className = 'country-flag-preview';
          flagImg.alt = 'Drapeau';
          sel.parentElement.insertBefore(flagImg, sel);
        }
      }

      Array.from(sel.options).forEach(opt => {
        if (!opt.dataset.full) {
          opt.dataset.full = opt.text;
          const match = opt.text.match(/\+\d+/);
          opt.dataset.short = match ? match[0] : opt.text.split('·')[0].trim();
        }
      });

      const updateDisplay = () => {
        const opt = sel.options[sel.selectedIndex];
        if (opt && opt.dataset.short) opt.text = opt.dataset.short;
        const iso = COUNTRY_ISO_BY_VAL[sel.value] || 'ci';
        if (flagImg) {
          flagImg.src = `https://flagcdn.com/w40/${iso}.png`;
        }
      };

      const restoreFull = () => {
        const opt = sel.options[sel.selectedIndex];
        if (opt && opt.dataset.full) opt.text = opt.dataset.full;
      };

      updateDisplay();

      if (!sel.dataset.compactEvents) {
        sel.dataset.compactEvents = 'true';
        sel.addEventListener('mousedown', restoreFull);
        sel.addEventListener('focus', restoreFull);
        sel.addEventListener('touchstart', restoreFull, { passive: true });
        sel.addEventListener('keydown', restoreFull);
        sel.addEventListener('change', updateDisplay);
        sel.addEventListener('blur', updateDisplay);
      }
    });
  }

  // Expose to window
  window.AuthEngine = AuthEngine;
  window.SupabaseRest = SupabaseRest;
  window.initCompactCountrySelectors = initCompactCountrySelectors;

  // Initialisation au chargement du DOM
  document.addEventListener("DOMContentLoaded", async () => {
    initCompactCountrySelectors();
    await AuthEngine.handleOAuthCallback();
    AuthEngine.syncProfileUI();
    AuthEngine.checkSession();
  });

  // Re-synchronisation automatique si un modal ou formulaire s'ouvre
  document.addEventListener("click", () => {
    setTimeout(initCompactCountrySelectors, 60);
  });

})(window);
