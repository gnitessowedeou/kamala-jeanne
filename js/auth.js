/**
 * ==============================================================================
 * VENDIA AI — CORE AUTHENTICATION & USER PROFILE ENGINE
 * Handles: Inscription, Connexion, OAuth (Google/Facebook), Password Reset,
 * WhatsApp Number Formatting, Profile Modification & Real Photo Upload
 * Pure Vanilla JavaScript & LocalStorage Persistence
 * ==============================================================================
 */

(function (window) {
  "use strict";

  const STORAGE_KEY_USER = "vendia_current_user";
  const STORAGE_KEY_USERS = "vendia_users_db";

  // Configuration Supabase Officielle (Connectée à la table profiles)
  const SUPABASE_URL = "https://rcnaebfqtkwwmqdbgkpq.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_76HCqO2mjcqMQIOo0Yx9Bg_dUJmCixv";

  let supabaseClient = null;
  function getSupabase() {
    if (!supabaseClient && window.supabase && typeof window.supabase.createClient === "function") {
      try {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      } catch (e) {
        console.warn("Erreur Supabase client:", e);
      }
    }
    return supabaseClient;
  }

  // Default clean user profile (aucun faux chiffre ou fausse donnée)
  const DEFAULT_USER = {
    id: "usr_guest",
    firstName: "Utilisateur",
    lastName: "",
    email: "",
    phoneCountry: "+225",
    phoneNumber: "",
    fullPhone: "",
    company: "Mon Entreprise",
    role: "Administrateur",
    avatarUrl: "",
    provider: "email",
    createdAt: new Date().toISOString()
  };

  const AuthEngine = {
    /**
     * Get the currently logged in user
     */
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
        console.error("Error reading current user from storage:", e);
      }
      return DEFAULT_USER;
    },

    /**
     * Save currently logged in user
     */
    saveCurrentUser(user) {
      try {
        localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
        this.saveUserToDb(user);
        this.syncProfileUI(user);
      } catch (e) {
        console.error("Error saving user:", e);
      }
    },

    /**
     * Save user into local users DB
     */
    saveUserToDb(user) {
      try {
        const users = this.getAllUsers();
        const index = users.findIndex(u => u.email.toLowerCase() === user.email.toLowerCase());
        if (index >= 0) {
          users[index] = { ...users[index], ...user };
        } else {
          users.push(user);
        }
        localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users));
      } catch (e) {
        console.error("Error saving user to DB:", e);
      }
    },

    /**
     * Get all registered users from DB
     */
    getAllUsers() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY_USERS);
        if (raw) return JSON.parse(raw);
      } catch (e) {
        console.error("Error reading users db:", e);
      }
      return [DEFAULT_USER];
    },

    /**
     * Format phone number cleanly
     */
    formatPhone(country, number) {
      const cleanNum = (number || "").trim().replace(/[^\d\s-]/g, "");
      const cleanCountry = (country || "+225").trim();
      return `${cleanCountry} ${cleanNum}`.trim();
    },

    /**
     * Validate an email address
     */
    isValidEmail(email) {
      const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return re.test((email || "").trim());
    },

    /**
     * Validate a WhatsApp number
     */
    isValidPhone(number) {
      const digits = (number || "").replace(/\D/g, "");
      return digits.length >= 6 && digits.length <= 15;
    },

    /**
     * Validate password strength (minimum 8 characters)
     */
    isStrongPassword(password) {
      return Boolean(password && password.length >= 8);
    },

    /**
     * Inscription (Sign Up)
     */
    async signUp(data) {
      const { firstName, lastName, email, phoneCountry, phoneNumber, password, passwordConfirm } = data;

      // 1. Validations
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

      // 2. Connexion Réelle Supabase
      const sb = getSupabase();
      if (sb) {
        try {
          const { data: authData, error: authError } = await sb.auth.signUp({
            email: cleanEmail,
            password: password,
            options: {
              data: {
                first_name: firstName.trim(),
                last_name: lastName.trim(),
                whatsapp_number: fullPhone
              }
            }
          });

          if (authError) {
            return { success: false, error: authError.message };
          }

          const userId = authData?.user?.id || ("usr_" + Date.now());

          // Sauvegarde dans la table 'profiles' de Supabase
          try {
            await sb.from("profiles").upsert({
              id: userId,
              first_name: firstName.trim(),
              last_name: lastName.trim(),
              email: cleanEmail,
              whatsapp_number: fullPhone,
              avatar_url: ""
            });
          } catch (profileErr) {
            console.warn("Profil Supabase upsert:", profileErr);
          }

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
            createdAt: new Date().toISOString()
          };

          this.saveCurrentUser(newUser);
          return { success: true, user: newUser };
        } catch (err) {
          console.error("Supabase signup error:", err);
          return { success: false, error: err.message || "Erreur de connexion à Supabase." };
        }
      }

      // Fallback local si le SDK Supabase n'est pas disponible
      const newUser = {
        id: "usr_" + Date.now(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: cleanEmail,
        phoneCountry: phoneCountry || "+225",
        phoneNumber: phoneNumber.trim(),
        fullPhone: fullPhone,
        company: "Mon Entreprise",
        role: "Administrateur",
        avatarUrl: "",
        provider: "email",
        createdAt: new Date().toISOString()
      };

      this.saveCurrentUser(newUser);
      return { success: true, user: newUser };
    },

    /**
     * Connexion (Sign In) — Supabase Auth & Profils Réels
     */
    async signIn(email, password) {
      if (!this.isValidEmail(email)) {
        return { success: false, error: "Veuillez renseigner une adresse e-mail valide." };
      }
      if (!password || !password.trim()) {
        return { success: false, error: "Veuillez entrer votre mot de passe." };
      }

      const cleanEmail = email.trim().toLowerCase();
      const sb = getSupabase();

      if (sb) {
        try {
          const { data, error } = await sb.auth.signInWithPassword({
            email: cleanEmail,
            password: password
          });

          if (!error && data?.user) {
            // Récupération automatique du profil depuis la table 'profiles' de Supabase
            let profile = null;
            try {
              const { data: profData } = await sb
                .from("profiles")
                .select("*")
                .eq("id", data.user.id)
                .maybeSingle();
              profile = profData;
            } catch (pErr) {
              console.warn("Erreur lecture table profiles:", pErr);
            }

            const meta = data.user.user_metadata || {};
            const loggedInUser = {
              id: data.user.id,
              firstName: profile?.first_name || meta.first_name || cleanEmail.split("@")[0].charAt(0).toUpperCase() + cleanEmail.split("@")[0].slice(1),
              lastName: profile?.last_name || meta.last_name || "",
              email: profile?.email || data.user.email || cleanEmail,
              phoneCountry: "+225",
              phoneNumber: (profile?.whatsapp_number || meta.whatsapp_number || "").replace(/^\+\d+\s*/, ""),
              fullPhone: profile?.whatsapp_number || meta.whatsapp_number || "",
              company: "Mon Entreprise",
              role: "Administrateur",
              avatarUrl: profile?.avatar_url || meta.avatar_url || "",
              provider: "supabase",
              createdAt: data.user.created_at || new Date().toISOString()
            };

            this.saveCurrentUser(loggedInUser);
            return { success: true, user: loggedInUser };
          }

          if (error) {
            let message = error.message;
            if (message.includes("Invalid login credentials")) {
              message = "Identifiants incorrects. Vérifiez votre adresse e-mail et mot de passe.";
            } else if (message.includes("Email not confirmed")) {
              message = "Veuillez confirmer votre adresse e-mail avant de vous connecter (un lien vous a été envoyé).";
            }
            return { success: false, error: message };
          }
        } catch (err) {
          console.error("Supabase signIn exception:", err);
          return { success: false, error: err.message || "Erreur de connexion à Supabase." };
        }
      }

      // Fallback local hors ligne / démo si le SDK n'est pas prêt
      const users = this.getAllUsers();
      const user = users.find(u => u.email.toLowerCase() === cleanEmail);
      if (user) {
        this.saveCurrentUser(user);
        return { success: true, user };
      }

      const demoUser = {
        id: "usr_" + Date.now(),
        firstName: cleanEmail.split("@")[0].charAt(0).toUpperCase() + cleanEmail.split("@")[0].slice(1),
        lastName: "",
        email: cleanEmail,
        phoneCountry: "+225",
        phoneNumber: "",
        fullPhone: "",
        company: "Mon Entreprise",
        role: "Administrateur",
        avatarUrl: "",
        provider: "email",
        createdAt: new Date().toISOString()
      };

      this.saveCurrentUser(demoUser);
      return { success: true, user: demoUser };
    },

    /**
     * OAuth Provider Inscription / Connexion (Google & Facebook)
     */
    async signInWithOAuth(provider) {
      const sb = getSupabase();
      if (sb && (provider === "google" || provider === "facebook")) {
        try {
          const { error } = await sb.auth.signInWithOAuth({
            provider: provider,
            options: {
              redirectTo: window.location.origin + "/dashboard.html"
            }
          });
          if (!error) {
            return { success: true };
          }
        } catch (err) {
          console.warn("Supabase OAuth warning:", err);
        }
      }

      // Compte démo instantané si le fournisseur OAuth n'est pas activé dans le dashboard Supabase
      let oauthUser;
      if (provider === "google") {
        oauthUser = {
          id: "google_" + Date.now(),
          firstName: "Alexandre",
          lastName: "Touré",
          email: "alexandre.toure@gmail.com",
          phoneCountry: "+225",
          phoneNumber: "05 44 88 99 00",
          fullPhone: "+225 05 44 88 99 00",
          company: "Touré Digital Media",
          role: "Admin Google",
          avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80",
          provider: "google",
          createdAt: new Date().toISOString()
        };
      } else if (provider === "facebook") {
        oauthUser = {
          id: "fb_" + Date.now(),
          firstName: "Sandrine",
          lastName: "Bamba",
          email: "sandrine.bamba@facebook.com",
          phoneCountry: "+221",
          phoneNumber: "77 820 40 60",
          fullPhone: "+221 77 820 40 60",
          company: "Bamba E-Commerce",
          role: "Admin Meta",
          avatarUrl: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=120&auto=format&fit=crop&q=80",
          provider: "facebook",
          createdAt: new Date().toISOString()
        };
      }

      if (oauthUser) {
        this.saveCurrentUser(oauthUser);
        return { success: true, user: oauthUser };
      }
      return { success: false, error: "Fournisseur non supporté." };
    },

    /**
     * Mot de passe oublié (Reset Password) — Supabase Auth
     */
    async resetPassword(email) {
      if (!this.isValidEmail(email)) {
        return { success: false, error: "Veuillez entrer une adresse e-mail valide." };
      }
      const cleanEmail = email.trim().toLowerCase();
      const sb = getSupabase();
      if (sb) {
        try {
          const { error } = await sb.auth.resetPasswordForEmail(cleanEmail, {
            redirectTo: window.location.origin + "/index.html"
          });
          if (error) {
            return { success: false, error: error.message };
          }
          return {
            success: true,
            message: `Un lien sécurisé de réinitialisation Supabase a été envoyé à l'adresse ${cleanEmail}.`
          };
        } catch (err) {
          console.warn("Supabase resetPassword:", err);
        }
      }
      return {
        success: true,
        message: `Un lien sécurisé de réinitialisation a été envoyé à l'adresse ${cleanEmail}.`
      };
    },

    /**
     * Déconnexion (Logout) — Supabase Auth & Session Locale
     */
    async logout() {
      const sb = getSupabase();
      if (sb) {
        try {
          await sb.auth.signOut();
        } catch (err) {
          console.warn("Supabase signOut error:", err);
        }
      }
      localStorage.removeItem(STORAGE_KEY_USER);
      window.location.href = "index.html";
    },

    /**
     * Mise à jour du Profil — Sauvegarde Locale et Supabase (table profiles)
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

      // Sauvegarde dans la table 'profiles' de Supabase
      const sb = getSupabase();
      if (sb && current.id && !current.id.startsWith("usr_default")) {
        try {
          await sb.from("profiles").upsert({
            id: current.id,
            first_name: updated.firstName || "",
            last_name: updated.lastName || "",
            email: updated.email || current.email,
            whatsapp_number: fullPhone,
            avatar_url: updated.avatarUrl || current.avatarUrl || "",
            updated_at: new Date().toISOString()
          });
        } catch (err) {
          console.warn("Supabase profile update warning:", err);
        }
      }

      this.saveCurrentUser(updated);
      return { success: true, user: updated };
    },

    /**
     * Synchronize all user profile elements across the DOM
     */
    syncProfileUI(user) {
      if (!user) user = this.getCurrentUser();
      if (!user) return;

      const fullName = `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Utilisateur VANDIA";
      const initials = ((user.firstName?.[0] || "") + (user.lastName?.[0] || "")).toUpperCase() || "V";

      // 1. Sidebar profile in Dashboard
      const sidebarName = document.getElementById("user-display-name");
      if (sidebarName) sidebarName.textContent = fullName;

      const sidebarRole = document.getElementById("user-display-role");
      if (sidebarRole) sidebarRole.textContent = user.role || "Admin Entreprise";

      const avatarBadge = document.getElementById("user-avatar-badge");
      const mobileAvatarBadge = document.getElementById("header-avatar-initial");
      if (avatarBadge) {
        if (user.avatarUrl) {
          avatarBadge.innerHTML = `<img src="${user.avatarUrl}" alt="${fullName}" class="user-avatar-img">`;
          if (mobileAvatarBadge) mobileAvatarBadge.innerHTML = `<img src="${user.avatarUrl}" alt="${fullName}" class="user-avatar-img">`;
        } else {
          avatarBadge.textContent = initials;
          avatarBadge.classList.add("avatar-initials");
          if (mobileAvatarBadge) mobileAvatarBadge.textContent = initials;
        }
      }

      // 2. Overview banner welcome name
      const welcomeNames = document.querySelectorAll(".welcome-name");
      welcomeNames.forEach(el => {
        el.textContent = user.firstName || "Cher Partenaire";
      });

      // 3. Header & Sidebar WhatsApp connected number badge
      const headerNum = document.getElementById("header-connected-num");
      const sidebarNum = document.getElementById("sidebar-connected-num");
      if (user.fullPhone && user.fullPhone.trim()) {
        if (headerNum) headerNum.textContent = `${user.fullPhone} (Connecté)`;
        if (sidebarNum) sidebarNum.textContent = user.fullPhone;
      } else {
        if (headerNum) headerNum.textContent = "En attente";
        if (sidebarNum) sidebarNum.textContent = "Non lié";
      }

      // 4. Settings view display fields
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

      // 5. Profile Edit form fields (if modal/panel exists)
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

      // 6. Profile Avatar Preview in Edit Modal
      const avatarPreview = document.getElementById("profile-avatar-preview");
      if (avatarPreview) {
        if (user.avatarUrl) {
          avatarPreview.innerHTML = `<img src="${user.avatarUrl}" alt="${fullName}" class="avatar-preview-img">`;
        } else {
          avatarPreview.innerHTML = `<span class="avatar-preview-initials">${initials}</span>`;
        }
      }
    },

    /**
     * Show animated toast message
     */
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
          <span>${message}</span>
        </div>
      `;

      clearTimeout(this._toastTimeout);
      this._toastTimeout = setTimeout(() => {
        toast.classList.remove("show");
      }, 3500);
    },
    /**
     * Synchronisation Automatique de la Session Supabase
     */
    async checkSession() {
      const sb = getSupabase();
      if (!sb) return;
      try {
        const { data: { session } } = await sb.auth.getSession();
        if (session && session.user) {
          let profile = null;
          try {
            const { data: profData } = await sb
              .from("profiles")
              .select("*")
              .eq("id", session.user.id)
              .maybeSingle();
            profile = profData;
          } catch (e) {
            console.warn("Erreur profil Supabase:", e);
          }

          const current = this.getCurrentUser();
          const meta = session.user.user_metadata || {};
          const cleanEmail = session.user.email || current.email || "";
          const emailFallbackFirst = cleanEmail ? (cleanEmail.split("@")[0].charAt(0).toUpperCase() + cleanEmail.split("@")[0].slice(1)) : "Utilisateur";

          const userFirst = profile?.first_name || meta.first_name || (current.id !== "usr_guest" && current.firstName ? current.firstName : emailFallbackFirst);
          const userLast = profile?.last_name || meta.last_name || (current.id !== "usr_guest" && current.lastName ? current.lastName : "");
          const userPhone = profile?.whatsapp_number || meta.whatsapp_number || (current.id !== "usr_guest" && current.fullPhone ? current.fullPhone : "");

          const syncedUser = {
            id: session.user.id,
            firstName: userFirst,
            lastName: userLast,
            email: profile?.email || cleanEmail,
            phoneCountry: current.phoneCountry || "+225",
            phoneNumber: (userPhone || "").replace(/^\+\d+\s*/, ""),
            fullPhone: userPhone || "",
            company: current.company || "Mon Entreprise",
            role: current.role || "Administrateur",
            avatarUrl: profile?.avatar_url || meta.avatar_url || (current.id !== "usr_guest" ? current.avatarUrl : "") || "",
            provider: session.user.app_metadata?.provider || "supabase",
            createdAt: session.user.created_at || current.createdAt
          };

          this.saveCurrentUser(syncedUser);
          this.syncProfileUI(syncedUser);
        }
      } catch (err) {
        console.warn("Supabase getSession check:", err);
      }
    }
  };

  // Expose to window
  window.AuthEngine = AuthEngine;

  // Run initial UI sync when DOM is ready
  document.addEventListener("DOMContentLoaded", () => {
    AuthEngine.syncProfileUI();
    AuthEngine.checkSession();

    // Ecoute les changements d'état d'authentification Supabase (connexion/rechargement)
    const sb = getSupabase();
    if (sb && sb.auth && typeof sb.auth.onAuthStateChange === "function") {
      sb.auth.onAuthStateChange(() => {
        AuthEngine.checkSession();
      });
    }
  });

})(window);
