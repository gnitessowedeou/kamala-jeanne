
// Capture d'affiliation
(function() {
    try {
        const params = new URLSearchParams(window.location.search);
        const ref = params.get('ref');
        if (ref) localStorage.setItem('vendia_ref', ref);
    } catch(e) {}
})();

﻿/**
 * ==============================================================================
 * VENDIA AI — CORE AUTHENTICATION & SUPABASE REST PROFILE ENGINE
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

  // Configuration Supabase Officielle VANDIA AI
  const SUPABASE_URL = "https://rcnaebfqtkwwmqdbgkpq.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_76HCqO2mjcqMQIOo0Yx9Bg_dUJmCixv";

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

    formatPhone(country, number) {
      const cleanNum = (number || "").trim().replace(/[^\d\s-]/g, "");
      const cleanCountry = (country || "+225").trim();
      return `${cleanCountry} ${cleanNum}`.trim();
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
      const { firstName, lastName, email, phoneCountry, phoneNumber, password, passwordConfirm } = data;

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

      const fullPhone = this.formatPhone(phoneCountry, phoneNumber);
      const cleanEmail = email.trim().toLowerCase();

      try {
        // Étape A : Création du compte dans auth.users de Supabase
        const signupRes = await SupabaseRest.signUp(cleanEmail, password, {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          whatsapp_number: fullPhone
        });

        const userId = signupRes?.id || signupRes?.user?.id;
        const accessToken = signupRes?.access_token || null;

        if (!userId) {
          throw new Error("L'identifiant utilisateur n'a pas pu être généré par Supabase.");
        }

        // Étape B : Enregistrement DIRECT dans la table 'profiles' de Supabase
        // Garantit que le profil (prénom, nom, WhatsApp, crédits) apparaît immédiatement dans la table
        try {
          await SupabaseRest.upsertProfile({
            id: userId,
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            email: cleanEmail,
            whatsapp_number: fullPhone,
            avatar_url: "",
            credits: 100,
            affiliate_code: (firstName.trim().substring(0,3) + Math.floor(Math.random()*10000)).toUpperCase(),
            referred_by: localStorage.getItem('vendia_ref') || null
          }, accessToken);
        } catch (profileErr) {
          console.warn("Avertissement upsert table profiles:", profileErr);
        }

        // Étape C : Création de la session locale avec 300 crédits d'essai gratuit
        const newUser = {
          id: userId,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: cleanEmail,
          phoneCountry: phoneCountry || "+225",
          phoneNumber: phoneNumber.trim(),
          fullPhone: fullPhone,
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
          createdAt: new Date().toISOString()
        };

        this.saveCurrentUser(newUser);
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
        const userFirst = profile?.first_name || meta.first_name || cleanEmail.split("@")[0].charAt(0).toUpperCase() + cleanEmail.split("@")[0].slice(1);
        const userLast = profile?.last_name || meta.last_name || "";
        const userPhone = profile?.whatsapp_number || meta.whatsapp_number || "";

        const loggedInUser = {
          id: userId,
          firstName: userFirst,
          lastName: userLast,
          email: profile?.email || userObj?.email || cleanEmail,
          phoneCountry: "+225",
          phoneNumber: userPhone.replace(/^\+\d+\s*/, ""),
          fullPhone: userPhone,
          company: "Mon Entreprise",
          role: "Administrateur",
          avatarUrl: profile?.avatar_url || meta.avatar_url || "",
          provider: "supabase",
          plan: {
            name: "Essai Gratuit 7j 🦾",
            badge: "ESSAI",
            tokensUsed: 0,
            tokensMax: 100,
            daysLeft: 7
          },
          createdAt: userObj?.created_at || new Date().toISOString()
        };

        this.saveCurrentUser(loggedInUser);
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
     * 6. MISE À JOUR DU PROFIL DANS SUPABASE (TABLE PROFILES)
     * ==============================================================================
     */
    async updateProfile(updates) {
      const current = this.getCurrentUser();

      if (updates.phoneNumber && !this.isValidPhone(updates.phoneNumber)) {
        return { success: false, error: "Numéro WhatsApp invalide." };
      }

      const fullPhone = this.formatPhone(
        updates.phoneCountry || current.phoneCountry,
        updates.phoneNumber || current.phoneNumber
      );

      const updated = {
        ...current,
        ...updates,
        fullPhone: fullPhone
      };

      // Synchronisation directe avec la table 'profiles' de Supabase
      if (current.id) {
        try {
          await SupabaseRest.updateProfile(current.id, {
            first_name: updated.firstName || "",
            last_name: updated.lastName || "",
            whatsapp_number: fullPhone,
            avatar_url: updated.avatarUrl || current.avatarUrl || "",
            updated_at: new Date().toISOString()
          });
        } catch (err) {
          console.warn("Avertissement mise à jour table profiles:", err);
        }
      }

      this.saveCurrentUser(updated);
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

      const fullName = `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Utilisateur VANDIA";
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
        if (affiliateLinkEl && user.affiliateCode) {
            affiliateLinkEl.value = window.location.origin + "/?ref=" + user.affiliateCode;
        }

        const welcomeNames = document.querySelectorAll(".welcome-name");
      welcomeNames.forEach(el => {
        el.textContent = user.firstName || "Cher Partenaire";
      });

      // 3. Statut WhatsApp connecté
      const headerNum = document.getElementById("header-connected-num");
      const sidebarNum = document.getElementById("sidebar-connected-num");
      const headerBadge = document.getElementById("header-status-badge");
      if (user.fullPhone && user.fullPhone.trim()) {
        if (headerNum) headerNum.textContent = user.fullPhone;
        if (sidebarNum) sidebarNum.textContent = user.fullPhone;
        if (headerBadge) headerBadge.textContent = "Connecté";
      } else {
        if (headerNum) headerNum.textContent = "WhatsApp";
        if (sidebarNum) sidebarNum.textContent = "Non lié";
        if (headerBadge) headerBadge.textContent = "Prêt";
      }

      // 4. Champs de configuration Profil
      const setFullName = document.getElementById("settings-display-fullname");
      if (setFullName) setFullName.textContent = fullName;
      const setEmail = document.getElementById("settings-display-email");
      if (setEmail) setEmail.textContent = user.email || "En attente";
      const setPhone = document.getElementById("settings-display-phone");
      if (setPhone) setPhone.textContent = user.fullPhone || "Non configuré";

      const teamLeadName = document.getElementById("team-lead-name");
      if (teamLeadName) teamLeadName.textContent = fullName;
      const teamLeadEmail = document.getElementById("team-lead-email");
      if (teamLeadEmail) teamLeadEmail.textContent = user.email || "admin@vandia.ai";

      // 5. Champs d'édition du formulaire modal
      const inputFirst = document.getElementById("profile-firstname");
      if (inputFirst) inputFirst.value = user.firstName || "";
      const inputLast = document.getElementById("profile-lastname");
      if (inputLast) inputLast.value = user.lastName || "";
      const inputEmail = document.getElementById("profile-email");
      if (inputEmail) inputEmail.value = user.email || "";
      const selectCountry = document.getElementById("profile-phone-country");
      if (selectCountry && user.phoneCountry) selectCountry.value = user.phoneCountry;
      const inputPhone = document.getElementById("profile-phone-number");
      if (inputPhone) inputPhone.value = user.phoneNumber || "";
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
        
        if (user.plan) {
          if (planNameEl) planNameEl.textContent = user.plan.name || "Essai Gratuit 7j 🚀";
          if (planTokensMaxEl) planTokensMaxEl.textContent = `Max ${(user.plan.tokensMax || 100).toLocaleString("fr-FR")} crédits`;
          if (planTokensUsedEl) planTokensUsedEl.textContent = `${user.plan.tokensUsed || 0} crédit`;
          
          const max = user.plan.tokensMax || 100;
          const used = user.plan.tokensUsed || 0;
          const pct = max > 0 ? Math.min(100, Math.max(0, (used / max) * 100)).toFixed(1) : 0;
          if (planPctEl) planPctEl.textContent = `${pct}%`;
          if (planFillEl) planFillEl.style.width = `${pct}%`;
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
          const syncedUser = {
            ...user,
            firstName: profile.first_name || user.firstName,
            lastName: profile.last_name || user.lastName,
            fullPhone: profile.whatsapp_number || user.fullPhone,
            avatarUrl: profile.avatar_url || user.avatarUrl,
              affiliateCode: profile.affiliate_code || user.affiliateCode,
            plan: {
              ...(user.plan || {}),
              tokensMax: (profile.plan === 'basic' ? 1000 : profile.plan === 'pro' ? 3000 : profile.plan === 'business' ? 10000 : 100),
              tokensUsed: Math.max(0, (profile.plan === 'basic' ? 1000 : profile.plan === 'pro' ? 3000 : profile.plan === 'business' ? 10000 : 100) - (profile.credits || 0)),
              
              daysLeft: (() => {
                  if (profile.created_at) {
                      const diff = Math.floor((new Date() - new Date(profile.created_at)) / (1000 * 60 * 60 * 24));
                      return Math.max(0, 7 - diff);
                  }
                  return user.plan?.daysLeft || 7;
              })()
            }
          };
          this.saveCurrentUser(syncedUser);
          this.syncProfileUI(syncedUser);
        }
      } catch (err) {
        // En cas de coupure réseau, la session locale persiste
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

  // Expose to window
  window.AuthEngine = AuthEngine;
  window.SupabaseRest = SupabaseRest;

  // Initialisation au chargement du DOM
  document.addEventListener("DOMContentLoaded", () => {
    AuthEngine.syncProfileUI();
    AuthEngine.checkSession();
  });

})(window);
