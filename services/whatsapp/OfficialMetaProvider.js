/**
 * VANDIAS AI - Pilote « Officiel » (WhatsApp Cloud API Meta v21.0)
 * Intégration Embedded Signup v4 (conforme aux exigences Meta post 15 octobre 2026)
 * et support de la Coexistence avec l'application WhatsApp Business.
 * 
 * NOTE DE SÉCURITÉ : Ce pilote ne sera pas activé en production sans l'accord
 * exprès de l'utilisateur (drapeau isPilotAuthorized = false par défaut).
 */

const { WhatsAppProvider, WHATSAPP_STATUS, MESSAGE_CATEGORIES, PROVIDER_MODES } = require('./WhatsAppProvider');
const https = require('https');

class OfficialMetaProvider extends WhatsAppProvider {
  /**
   * @param {object} config
   * @param {string} [config.graphApiVersion='v21.0'] - Version Graph API
   * @param {string} [config.appId] - Meta App ID
   * @param {string} [config.appSecret] - Meta App Secret
   * @param {string} [config.systemUserToken] - Jeton d'accès permanent Meta System User
   * @param {string} [config.loginConfigId] - ID de configuration Facebook Login for Business (Embedded Signup v4)
   * @param {string} [config.webhookVerifyToken] - Token de vérification du Webhook
   * @param {boolean} [config.isPilotAuthorized=false] - Verrou de sécurité
   * @param {object} [config.supabase] - Client Supabase
   */
  constructor(config = {}) {
    super(PROVIDER_MODES.OFFICIEL, config);
    this.graphApiVersion = config.graphApiVersion || 'v21.0';
    this.appId = config.appId || process.env.META_APP_ID || '';
    this.appSecret = config.appSecret || process.env.META_APP_SECRET || '';
    this.systemUserToken = config.systemUserToken || process.env.META_SYSTEM_USER_TOKEN || '';
    this.loginConfigId = config.loginConfigId || process.env.META_EMBEDDED_SIGNUP_CONFIG_ID || '';
    this.webhookVerifyToken = config.webhookVerifyToken || process.env.META_WEBHOOK_VERIFY_TOKEN || 'vandias_secure_webhook_token';
    this.supabase = config.supabase || null;

    // VERROU DE SÉCURITÉ STRICT : Pas de démarrage sans accord utilisateur
    this.isPilotAuthorized = Boolean(config.isPilotAuthorized || process.env.ENABLE_OFFICIAL_WHATSAPP_PILOT === 'true');

    // userId -> { wabaId, phoneNumberId, accessToken, phone, status, coexistenceActive }
    this.accounts = new Map();
  }

  /**
   * Active ou désactive l'autorisation d'exécuter le pilote officiel.
   * @param {boolean} authorized
   */
  setPilotAuthorization(authorized) {
    this.isPilotAuthorized = Boolean(authorized);
    console.log(`[OfficialMetaProvider] Autorisation du pilote officiel passée à : ${this.isPilotAuthorized}`);
  }

  /**
   * Enregistre la configuration OAuth issue du flux Embedded Signup v4.
   * Dans la v4 (obligatoire depuis le 15/10/2026), les paramètres sont configurés
   * en amont via le Login for Business config_id dans l'espace Meta Developers.
   * 
   * @param {string} userId - Identifiant du commerçant
   * @param {object} signupPayload
   * @param {string} signupPayload.wabaId - WhatsApp Business Account ID
   * @param {string} signupPayload.phoneNumberId - Phone Number ID
   * @param {string} signupPayload.code - Code d'autorisation temporaire reçu de FB.login
   * @param {string} [signupPayload.phone] - Numéro de téléphone vérifié
   */
  async handleEmbeddedSignupCallback(userId, signupPayload) {
    if (!this.isPilotAuthorized) {
      throw new Error("Lancement bloqué : Le pilote officiel WhatsApp Cloud API est en attente de votre accord préalable avant activation.");
    }

    const { wabaId, phoneNumberId, code, phone } = signupPayload;
    if (!wabaId || !phoneNumberId) {
      throw new Error("Embedded Signup v4 invalide : wabaId et phoneNumberId sont obligatoires.");
    }

    // Échange du code temporaire contre un jeton d'accès utilisateur système longue durée
    let accessToken = this.systemUserToken;
    if (code && this.appId && this.appSecret) {
      accessToken = await this.exchangeCodeForAccessToken(code);
    }

    // Souscription automatique du webhook aux événements de messages du WABA
    await this.subscribeWabaToWebhooks(wabaId, accessToken);

    const accountData = {
      wabaId,
      phoneNumberId,
      accessToken,
      phone: phone || null,
      status: WHATSAPP_STATUS.CONNECTED,
      coexistenceActive: true,
      registeredAt: new Date().toISOString()
    };

    this.accounts.set(userId, accountData);

    // Sauvegarde en base de données
    if (this.supabase) {
      try {
        await this.supabase.from('profiles').update({
          whatsapp_mode: PROVIDER_MODES.OFFICIEL,
          whatsapp_config: {
            waba_id: wabaId,
            phone_number_id: phoneNumberId,
            coexistence_enabled: true,
            embedded_signup_v4_registered_at: accountData.registeredAt
          }
        }).eq('id', userId);
      } catch (err) {
        console.warn(`[OfficialMetaProvider] Erreur sauvegarde config dans Supabase: ${err.message}`);
      }
    }

    return accountData;
  }

  /**
   * Échange le code OAuth d'Embedded Signup contre un jeton d'accès permanent.
   */
  async exchangeCodeForAccessToken(code) {
    const url = `https://graph.facebook.com/${this.graphApiVersion}/oauth/access_token?client_id=${this.appId}&client_secret=${this.appSecret}&code=${code}`;
    const res = await this._httpGet(url);
    if (!res || !res.access_token) {
      throw new Error(`Échec de l'échange de jeton Meta: ${JSON.stringify(res)}`);
    }
    return res.access_token;
  }

  /**
   * Abonne le WABA aux webhooks de VANDIAS AI.
   */
  async subscribeWabaToWebhooks(wabaId, accessToken) {
    const url = `https://graph.facebook.com/${this.graphApiVersion}/${wabaId}/subscribed_apps`;
    const res = await this._httpPost(url, {}, {
      Authorization: `Bearer ${accessToken}`
    });
    console.log(`[OfficialMetaProvider] Webhook WABA ${wabaId} souscrit :`, res);
    return res;
  }

  /**
   * Connecte l'utilisateur au pilote officiel.
   */
  async connect({ userId, phone = null, credentials = {}, options = {} }) {
    // Garde-fou utilisateur
    if (!this.isPilotAuthorized) {
      return {
        mode: this.name,
        status: WHATSAPP_STATUS.NOT_INITIALIZED,
        isPilotAuthorized: false,
        message: "Pilote officiel prêt mais en attente d'accord formel pour son lancement opérationnel.",
        config: {
          embeddedSignupVersion: 'v4',
          graphApiVersion: this.graphApiVersion,
          requiresFacebookLoginConfigId: true
        }
      };
    }

    let account = this.accounts.get(userId);

    // Essayer de charger la configuration depuis Supabase
    if (!account && this.supabase) {
      try {
        const { data } = await this.supabase
          .from('profiles')
          .select('whatsapp_config, whatsapp_number')
          .eq('id', userId)
          .maybeSingle();

        if (data && data.whatsapp_config && data.whatsapp_config.phone_number_id) {
          account = {
            wabaId: data.whatsapp_config.waba_id,
            phoneNumberId: data.whatsapp_config.phone_number_id,
            accessToken: this.systemUserToken,
            phone: data.whatsapp_number,
            status: WHATSAPP_STATUS.CONNECTED,
            coexistenceActive: true
          };
          this.accounts.set(userId, account);
        }
      } catch (e) {}
    }

    if (!account) {
      return {
        mode: this.name,
        status: WHATSAPP_STATUS.NOT_INITIALIZED,
        isPilotAuthorized: true,
        message: "Compte non configuré pour la Meta Cloud API. Veuillez finaliser le flux Embedded Signup v4.",
        config: {
          appId: this.appId,
          loginConfigId: this.loginConfigId,
          graphApiVersion: this.graphApiVersion
        }
      };
    }

    return {
      mode: this.name,
      status: WHATSAPP_STATUS.CONNECTED,
      phone: account.phone,
      wabaId: account.wabaId,
      phoneNumberId: account.phoneNumberId,
      coexistenceActive: account.coexistenceActive
    };
  }

  /**
   * Récupère le statut réel du compte Meta Cloud API.
   */
  async getStatus(userId) {
    if (!this.isPilotAuthorized) {
      return {
        mode: this.name,
        status: WHATSAPP_STATUS.NOT_INITIALIZED,
        isPilotAuthorized: false,
        message: "Pilote officiel WhatsApp Cloud API désactivé (en attente de votre accord formel).",
        guardrails: {
          inboundOnly: false,
          broadcastsAllowed: true, // Autorisé en mode officiel
          rateLimited: false
        }
      };
    }

    const account = this.accounts.get(userId);
    if (!account) {
      return {
        mode: this.name,
        status: WHATSAPP_STATUS.NOT_INITIALIZED,
        isPilotAuthorized: true,
        phone: null,
        message: "En attente de connexion via Meta Embedded Signup v4.",
        guardrails: {
          inboundOnly: false,
          broadcastsAllowed: true
        }
      };
    }

    return {
      mode: this.name,
      status: account.status || WHATSAPP_STATUS.CONNECTED,
      phone: account.phone || null,
      wabaId: account.wabaId,
      phoneNumberId: account.phoneNumberId,
      coexistenceActive: account.coexistenceActive,
      guardrails: {
        inboundOnly: false,
        broadcastsAllowed: true,
        officialCompliance: '100% Meta Graph API Cloud',
        rateLimited: false
      }
    };
  }

  /**
   * Envoi d'un message via WhatsApp Cloud API (Graph API).
   * Supporte :
   * - Réponses libres en format texte (dans la fenêtre de 24h)
   * - Modèles de messages approuvés (Marketing, Utility)
   */
  async sendMessage(userId, to, message, options = {}) {
    if (!this.isPilotAuthorized) {
      throw new Error("Pilote officiel bloqué : accord utilisateur préalable requis.");
    }

    const account = this.accounts.get(userId);
    if (!account || !account.phoneNumberId) {
      throw new Error(`Aucun numéro Meta Cloud API configuré pour l'utilisateur ${userId}.`);
    }

    const recipientPhone = String(to).replace(/\D/g, '');
    const category = options.category || MESSAGE_CATEGORIES.FREE_FORM;
    const token = account.accessToken || this.systemUserToken;

    let payload = {};

    // 1. Envoi par Modèle (Template Message) : requis hors fenêtre 24h ou pour marketing
    if (category === MESSAGE_CATEGORIES.MARKETING || category === MESSAGE_CATEGORIES.UTILITY || options.templateName) {
      payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: recipientPhone,
        type: 'template',
        template: {
          name: options.templateName || 'default_sales_alert',
          language: { code: options.languageCode || 'fr' },
          components: options.templateComponents || []
        }
      };
    } else {
      // 2. Envoi libre (Texte direct sous 24h de session client)
      payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: recipientPhone,
        type: 'text',
        text: {
          preview_url: false,
          body: typeof message === 'string' ? message : (message.text || '')
        }
      };
    }

    const url = `https://graph.facebook.com/${this.graphApiVersion}/${account.phoneNumberId}/messages`;
    const res = await this._httpPost(url, payload, {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    });

    if (!res || res.error) {
      const errDetail = res ? (res.error.message || JSON.stringify(res.error)) : 'Erreur inconnue Graph API';
      throw new Error(`Échec envoi WhatsApp Cloud API: ${errDetail}`);
    }

    const messageId = (res.messages && res.messages[0]) ? res.messages[0].id : `meta_${Date.now()}`;

    return {
      success: true,
      messageId,
      category,
      mode: this.name,
      metaResponse: res
    };
  }

  /**
   * Traitement d'un Webhook entrant Meta Cloud API.
   * Déclenche onIncomingMessage avec un format normalisé identique au pilote rapide.
   */
  async handleWebhookPayload(payload) {
    if (!payload || !payload.entry) return;

    for (const entry of payload.entry) {
      const changes = entry.changes || [];
      for (const change of changes) {
        if (change.field !== 'messages') continue;
        const val = change.value || {};
        const messages = val.messages || [];
        const contacts = val.contacts || [];
        const metadata = val.metadata || {};

        for (const msg of messages) {
          // Filtrer les statuts et types non textuels si nécessaire
          if (msg.type !== 'text') continue;

          let contactName = 'Client WhatsApp';
          if (contacts.length > 0 && contacts[0].profile && contacts[0].profile.name) {
            contactName = contacts[0].profile.name;
          }

          const normalized = {
            id: msg.id,
            from: msg.from,
            to: metadata.display_phone_number || metadata.phone_number_id,
            body: msg.text ? msg.text.body : '',
            timestamp: parseInt(msg.timestamp, 10) || Math.floor(Date.now() / 1000),
            contactName,
            isStatus: false,
            providerMode: PROVIDER_MODES.OFFICIEL,
            raw: msg
          };

          await this.emitIncomingMessage(normalized);
        }
      }
    }
  }

  /**
   * Déconnecte le compte Meta.
   */
  async disconnect(userId) {
    this.accounts.delete(userId);
    if (this.supabase) {
      try {
        await this.supabase.from('profiles').update({
          whatsapp_mode: PROVIDER_MODES.RAPIDE,
          whatsapp_config: null
        }).eq('id', userId);
      } catch (e) {}
    }
    return {
      success: true,
      message: "Liaison WhatsApp Cloud API déconnectée."
    };
  }

  // Utilitaires HTTP internes
  _httpPost(url, data, headers = {}) {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const postData = JSON.stringify(data);
      const req = https.request({
        hostname: urlObj.hostname,
        path: urlObj.pathname + urlObj.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          ...headers
        }
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try { resolve(JSON.parse(body)); } catch (e) { resolve({ raw: body }); }
        });
      });
      req.on('error', reject);
      req.write(postData);
      req.end();
    });
  }

  _httpGet(url, headers = {}) {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const req = https.request({
        hostname: urlObj.hostname,
        path: urlObj.pathname + urlObj.search,
        method: 'GET',
        headers: headers
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try { resolve(JSON.parse(body)); } catch (e) { resolve({ raw: body }); }
        });
      });
      req.on('error', reject);
      req.end();
    });
  }
}

module.exports = { OfficialMetaProvider };
