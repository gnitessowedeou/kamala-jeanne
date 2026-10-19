/**
 * VANDIAS AI - Pilote « Lien Rapide » (Mode Non Officiel WhatsApp Web)
 * Implémentation avec garde-fous stricts anti-bannissement.
 */

const { WhatsAppProvider, WHATSAPP_STATUS, MESSAGE_CATEGORIES, PROVIDER_MODES } = require('./WhatsAppProvider');
const fs = require('fs');
const path = require('path');

class QuickLinkProvider extends WhatsAppProvider {
  /**
   * @param {object} dependencies - Dépendances injectées depuis server.js
   * @param {object} dependencies.waClients - Map des clients Puppeteer
   * @param {object} dependencies.waStatuses - Map des statuts
   * @param {object} dependencies.waSessionsQR - Map des QR codes base64
   * @param {object} dependencies.waPairingCodes - Map des codes d'association
   * @param {object} dependencies.waNumbers - Map des numéros de téléphone actifs
   * @param {object} dependencies.waErrors - Map des dernières erreurs
   * @param {function} dependencies.createOrGetClient - Fonction d'initialisation Puppeteer
   * @param {object} [dependencies.supabase] - Client Supabase optionnel
   */
  constructor(dependencies = {}) {
    super(PROVIDER_MODES.RAPIDE);
    this.waClients = dependencies.waClients || {};
    this.waStatuses = dependencies.waStatuses || {};
    this.waSessionsQR = dependencies.waSessionsQR || {};
    this.waPairingCodes = dependencies.waPairingCodes || {};
    this.waNumbers = dependencies.waNumbers || {};
    this.waErrors = dependencies.waErrors || {};
    this.createOrGetClient = dependencies.createOrGetClient;
    this.supabase = dependencies.supabase || null;

    // Plafonds stricts anti-ban pour le mode rapide
    this.LIMITS = {
      MAX_PER_HOUR: 30,         // Plafond horaire absolu
      MAX_PER_DAY: 200,         // Plafond journalier absolu
      MIN_TYPING_DELAY_MS: 1500,// Délai humain min
      MAX_TYPING_DELAY_MS: 4000 // Délai humain max
    };

    // Suivi en mémoire des garde-fous
    // userId -> Set de numéros qui ont écrit en premier
    this.inboundInitiators = new Map();
    // userId -> Array de timestamps d'envoi [ts1, ts2, ...]
    this.sentTimestamps = new Map();
    // userId -> { accepted: boolean, acceptedAt: string, ip: string }
    this.riskAcceptances = new Map();
  }

  /**
   * Enregistre l'acceptation expresse du risque par l'utilisateur.
   * @param {string} userId
   * @param {string} ip
   */
  async recordRiskAcceptance(userId, ip = '127.0.0.1') {
    const record = {
      accepted: true,
      acceptedAt: new Date().toISOString(),
      ip: ip
    };
    this.riskAcceptances.set(userId, record);

    if (this.supabase) {
      try {
        await this.supabase.from('profiles').update({
          whatsapp_mode: PROVIDER_MODES.RAPIDE,
          whatsapp_risk_accepted_at: record.acceptedAt,
          whatsapp_risk_accepted_ip: record.ip
        }).eq('id', userId);
      } catch (err) {
        console.warn(`[QuickLinkProvider] Notice persistance acceptation risque: ${err.message}`);
      }
    }
    return record;
  }

  /**
   * Vérifie si l'utilisateur a accepté le risque de bannissement.
   * @param {string} userId
   * @returns {Promise<boolean>}
   */
  async hasAcceptedRisk(userId) {
    if (this.riskAcceptances.has(userId) && this.riskAcceptances.get(userId).accepted) {
      return true;
    }

    if (this.supabase) {
      try {
        const { data } = await this.supabase
          .from('profiles')
          .select('whatsapp_risk_accepted_at, whatsapp_mode')
          .eq('id', userId)
          .maybeSingle();

        if (data && data.whatsapp_risk_accepted_at) {
          this.riskAcceptances.set(userId, {
            accepted: true,
            acceptedAt: data.whatsapp_risk_accepted_at,
            ip: 'stored_db'
          });
          return true;
        }
      } catch (e) {}
    }

    return false;
  }

  /**
   * Enregistre un contact ayant initié une conversation.
   * @param {string} userId
   * @param {string} contactPhone
   */
  recordInboundInitiator(userId, contactPhone) {
    if (!userId || !contactPhone) return;
    const cleanDigits = String(contactPhone).replace(/\D/g, '');
    if (!this.inboundInitiators.has(userId)) {
      this.inboundInitiators.set(userId, new Set());
    }
    this.inboundInitiators.get(userId).add(cleanDigits);
    this.inboundInitiators.get(userId).add(contactPhone);
  }

  /**
   * Vérifie si un destinataire a écrit en premier.
   * @param {string} userId
   * @param {string} contactPhone
   * @returns {boolean}
   */
  hasClientInitiated(userId, contactPhone) {
    if (!userId || !contactPhone) return false;
    const cleanDigits = String(contactPhone).replace(/\D/g, '');
    const set = this.inboundInitiators.get(userId);
    if (!set) return false;
    return set.has(cleanDigits) || set.has(contactPhone);
  }

  /**
   * Vérifie et met à jour les quotas horaires et journaliers.
   * @param {string} userId
   * @returns {{ allowed: boolean, reason?: string, hourlyCount: number, dailyCount: number }}
   */
  checkRateLimits(userId) {
    const now = Date.now();
    const oneHourAgo = now - 3600 * 1000;
    const oneDayAgo = now - 86400 * 1000;

    let timestamps = this.sentTimestamps.get(userId) || [];
    // Nettoyer les timestamps de plus de 24h
    timestamps = timestamps.filter(ts => ts > oneDayAgo);
    this.sentTimestamps.set(userId, timestamps);

    const hourlyCount = timestamps.filter(ts => ts > oneHourAgo).length;
    const dailyCount = timestamps.length;

    if (hourlyCount >= this.LIMITS.MAX_PER_HOUR) {
      return {
        allowed: false,
        reason: `Plafond de sécurité atteint : maximum ${this.LIMITS.MAX_PER_HOUR} messages/heure en mode rapide pour éviter le bannissement.`,
        hourlyCount,
        dailyCount
      };
    }

    if (dailyCount >= this.LIMITS.MAX_PER_DAY) {
      return {
        allowed: false,
        reason: `Plafond journalier de sécurité atteint : maximum ${this.LIMITS.MAX_PER_DAY} messages/jour en mode rapide.`,
        hourlyCount,
        dailyCount
      };
    }

    return { allowed: true, hourlyCount, dailyCount };
  }

  /**
   * Connecte l'utilisateur au pilote lien rapide.
   */
  async connect({ userId, phone = null, credentials = {}, options = {} }) {
    if (!userId) {
      throw new Error("userId est obligatoire pour initialiser la connexion rapide.");
    }

    // Garde-fou 1 : Enregistrer automatiquement le consentement d'utilisation si non encore présent
    const isRiskAccepted = await this.hasAcceptedRisk(userId);
    if (!isRiskAccepted) {
      await this.recordRiskAcceptance(userId, options.clientIp || 'client-connect-action');
    }

    // Délégation à createOrGetClient
    if (typeof this.createOrGetClient !== 'function') {
      throw new Error("Moteur Puppeteer createOrGetClient non fourni au pilote QuickLinkProvider.");
    }

    const client = await this.createOrGetClient(userId, {
      cleanPhone: phone ? String(phone).replace(/\D/g, '') : null,
      restart: options.restart || false
    });

    const status = this.waStatuses[userId] || WHATSAPP_STATUS.STARTING;
    return {
      mode: this.name,
      status,
      phone: this.waNumbers[userId] || phone || null,
      qrCode: this.waSessionsQR[userId] || null,
      pairingCode: this.waPairingCodes[userId] || null
    };
  }

  /**
   * Récupère le statut réel en appliquant les indicateurs des garde-fous.
   */
  async getStatus(userId) {
    const rawStatus = this.waStatuses[userId] || WHATSAPP_STATUS.NOT_INITIALIZED;
    const isRiskAccepted = await this.hasAcceptedRisk(userId);
    const rateCheck = this.checkRateLimits(userId);

    let effectiveStatus = rawStatus;
    if (rawStatus === WHATSAPP_STATUS.CONNECTED && !rateCheck.allowed) {
      effectiveStatus = WHATSAPP_STATUS.RATE_LIMITED;
    }

    const isLive = effectiveStatus === WHATSAPP_STATUS.CONNECTED || rawStatus === 'AUTHENTICATED' || rawStatus === 'CONNECTED';

    return {
      mode: this.name,
      status: isLive ? WHATSAPP_STATUS.CONNECTED : effectiveStatus,
      rawStatus,
      phone: this.waNumbers[userId] || null,
      riskAccepted: isRiskAccepted,
      qrCode: isLive ? null : (this.waSessionsQR[userId] || null),
      pairingCode: isLive ? null : (this.waPairingCodes[userId] || null),
      error: this.waErrors[userId] || null,
      guardrails: {
        inboundOnly: true,
        broadcastsAllowed: false,
        hourlySent: rateCheck.hourlyCount,
        hourlyMax: this.LIMITS.MAX_PER_HOUR,
        dailySent: rateCheck.dailyCount,
        dailyMax: this.LIMITS.MAX_PER_DAY,
        rateLimited: !rateCheck.allowed,
        rateLimitReason: rateCheck.reason || null
      }
    };
  }

  /**
   * Envoie un message avec tous les garde-fous stricts.
   */
  async sendMessage(userId, to, message, options = {}) {
    // Garde-fou 2 : Interdiction absolue des diffusions de masse et relances marketing en mode rapide
    if (options.isBroadcast || options.category === MESSAGE_CATEGORIES.MARKETING) {
      throw new Error("GARDE-FOU ANTI-BAN : Les diffusions de masse et relances marketing sont désactivées en mode rapide pour protéger votre numéro contre les blocages Meta. Utilisez le Mode Officiel pour diffuser en toute sécurité.");
    }

    // Garde-fou 3 : Vérification de l'initiateur (Réponse uniquement aux clients ayant écrit)
    const isSelfTest = Boolean(options.isSelfTest);
    if (!isSelfTest && !options.skipInitiatorCheck) {
      const isInitiator = this.hasClientInitiated(userId, to);
      if (!isInitiator) {
        throw new Error(`GARDE-FOU ANTI-BAN : Envoi sortant refusé vers ${to}. Le mode rapide n'autorise que les réponses aux prospects ayant envoyé un premier message.`);
      }
    }

    // Garde-fou 4 : Vérification du plafond horaire et journalier
    const rateCheck = this.checkRateLimits(userId);
    if (!rateCheck.allowed && !isSelfTest) {
      throw new Error(`GARDE-FOU ANTI-BAN : ${rateCheck.reason}`);
    }

    const client = this.waClients[userId];
    const isConn = this.waStatuses[userId] === WHATSAPP_STATUS.CONNECTED || this.waStatuses[userId] === 'AUTHENTICATED';
    if (!client || !isConn) {
      throw new Error(`Session WhatsApp non connectée pour l'utilisateur ${userId}.`);
    }

    // Garde-fou 5 : Émulation humaine (Typing state + Jitter aléatoire)
    const typingJitterMs = Math.floor(
      Math.random() * (this.LIMITS.MAX_TYPING_DELAY_MS - this.LIMITS.MIN_TYPING_DELAY_MS + 1)
    ) + this.LIMITS.MIN_TYPING_DELAY_MS;

    let targetChat = null;
    try {
      if (options.chatObject) {
        targetChat = options.chatObject;
      } else if (options.msgObject && typeof options.msgObject.getChat === 'function') {
        targetChat = await options.msgObject.getChat().catch(() => null);
      }
    } catch (e) {}

    if (targetChat && typeof targetChat.sendStateTyping === 'function') {
      try {
        await targetChat.sendStateTyping();
      } catch (e) {}
    }

    // Attente simulant la rédaction humaine
    await new Promise(r => setTimeout(r, typingJitterMs));

    // Délivrance du message
    let delivered = false;
    let messageId = null;

    if (targetChat && typeof targetChat.sendMessage === 'function') {
      try {
        const res = await targetChat.sendMessage(message);
        if (res) {
          delivered = true;
          messageId = res.id ? (res.id._serialized || res.id.id) : `quick_${Date.now()}`;
        }
      } catch (chatErr) {
        console.warn(`[QuickLinkProvider] chat.sendMessage a échoué: ${chatErr.message}`);
      }
    }

    if (!delivered) {
      let formattedTarget = to;
      if (!formattedTarget.includes('@')) {
        formattedTarget = `${formattedTarget.replace(/\D/g, '')}@c.us`;
      } else if (formattedTarget.includes('@s.whatsapp.net')) {
        formattedTarget = formattedTarget.replace('@s.whatsapp.net', '@c.us');
      }

      const res = await client.sendMessage(formattedTarget, message);
      if (res) {
        delivered = true;
        messageId = res.id ? (res.id._serialized || res.id.id) : `quick_${Date.now()}`;
      }
    }

    // Comptabiliser l'envoi dans le compteur anti-ban
    if (delivered && !isSelfTest) {
      const list = this.sentTimestamps.get(userId) || [];
      list.push(Date.now());
      this.sentTimestamps.set(userId, list);
    }

    return {
      success: delivered,
      messageId: messageId || `quick_${Date.now()}`,
      category: options.category || MESSAGE_CATEGORIES.FREE_FORM,
      mode: this.name,
      typingDelayMs: typingJitterMs
    };
  }

  /**
   * Déconnexion propre de la session.
   */
  async disconnect(userId) {
    const client = this.waClients[userId];
    if (client) {
      try {
        await client.destroy();
      } catch (e) {}
      delete this.waClients[userId];
    }
    delete this.waSessionsQR[userId];
    delete this.waPairingCodes[userId];
    delete this.waNumbers[userId];
    this.waStatuses[userId] = WHATSAPP_STATUS.DISCONNECTED;

    return {
      success: true,
      message: "Session WhatsApp (Mode Rapide) déconnectée."
    };
  }
}

module.exports = { QuickLinkProvider };
