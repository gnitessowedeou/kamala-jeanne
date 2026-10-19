/**
 * VANDIAS AI - Gestionnaire Centralisé Multi-Pilotes WhatsApp (WhatsAppManager)
 * Route les requêtes vers le bon pilote ('rapide' ou 'officiel') selon le compte client,
 * applique le suivi des coûts et pilote les garde-fous.
 */

const { WHATSAPP_STATUS, MESSAGE_CATEGORIES, PROVIDER_MODES } = require('./WhatsAppProvider');
const { QuickLinkProvider } = require('./QuickLinkProvider');
const { OfficialMetaProvider } = require('./OfficialMetaProvider');

class WhatsAppManager {
  /**
   * @param {object} options
   * @param {object} options.quickLinkDeps - Dépendances injectées pour le pilote rapide
   * @param {object} options.metaConfig - Configuration pour le pilote officiel Meta
   * @param {object} [options.supabase] - Client Supabase
   * @param {object} [options.aiPipeline] - Pipeline IA universel
   */
  constructor(options = {}) {
    this.supabase = options.supabase || null;
    this.aiPipeline = options.aiPipeline || null;

    // Instanciation des deux pilotes
    this.quickLinkProvider = new QuickLinkProvider({
      ...options.quickLinkDeps,
      supabase: this.supabase
    });

    this.officialMetaProvider = new OfficialMetaProvider({
      ...options.metaConfig,
      supabase: this.supabase
    });

    // Cache mémoire des modes par utilisateur (défaut : 'rapide')
    this.userModes = new Map();

    // Journal d'utilisation et de suivi des coûts :
    // userId -> Array<{ timestamp, recipient, category, mode, messageId, creditsDeducted }>
    this.usageLogs = new Map();

    // Écoute unifiée des messages entrants sur les deux pilotes
    this.setupIncomingListeners();
  }

  /**
   * Branche le pipeline IA commun sur les deux pilotes.
   */
  setupIncomingListeners() {
    const handleIncoming = async (normalizedMsg) => {
      console.log(`[WhatsAppManager] Message entrant reçu via mode [${normalizedMsg.providerMode}] de ${normalizedMsg.from}: "${normalizedMsg.body}"`);

      // Garde-fou Mode Rapide : Enregistrer l'expéditeur comme ayant initié la conversation
      if (normalizedMsg.providerMode === PROVIDER_MODES.RAPIDE && normalizedMsg.userId) {
        this.quickLinkProvider.recordInboundInitiator(normalizedMsg.userId, normalizedMsg.from);
      }

      if (this.aiPipeline && typeof this.aiPipeline.processIncomingMessage === 'function') {
        try {
          await this.aiPipeline.processIncomingMessage(normalizedMsg, this);
        } catch (err) {
          console.error(`[WhatsAppManager] Erreur traitement pipeline IA commun:`, err);
        }
      }
    };

    this.quickLinkProvider.onIncomingMessage(handleIncoming);
    this.officialMetaProvider.onIncomingMessage(handleIncoming);
  }

  /**
   * Résout le mode WhatsApp configuré pour un utilisateur ('rapide' | 'officiel').
   * @param {string} userId
   * @returns {Promise<string>}
   */
  async getUserMode(userId) {
    if (this.userModes.has(userId)) {
      return this.userModes.get(userId);
    }

    if (this.supabase && userId) {
      try {
        const { data } = await this.supabase
          .from('profiles')
          .select('whatsapp_mode')
          .eq('id', userId)
          .maybeSingle();

        if (data && data.whatsapp_mode) {
          const mode = data.whatsapp_mode === PROVIDER_MODES.OFFICIEL ? PROVIDER_MODES.OFFICIEL : PROVIDER_MODES.RAPIDE;
          this.userModes.set(userId, mode);
          return mode;
        }
      } catch (e) {}
    }

    // Défaut standard
    const defaultMode = PROVIDER_MODES.RAPIDE;
    this.userModes.set(userId, defaultMode);
    return defaultMode;
  }

  /**
   * Modifie le mode actif pour un utilisateur.
   * @param {string} userId
   * @param {string} newMode - 'rapide' | 'officiel'
   */
  async setUserMode(userId, newMode) {
    if (![PROVIDER_MODES.RAPIDE, PROVIDER_MODES.OFFICIEL].includes(newMode)) {
      throw new Error(`Mode WhatsApp invalide: ${newMode}. Valeurs acceptées: 'rapide' ou 'officiel'.`);
    }

    this.userModes.set(userId, newMode);

    if (this.supabase && userId) {
      try {
        await this.supabase.from('profiles').update({
          whatsapp_mode: newMode
        }).eq('id', userId);
      } catch (err) {
        console.warn(`[WhatsAppManager] Erreur persistance changement de mode: ${err.message}`);
      }
    }

    return { success: true, mode: newMode };
  }

  /**
   * Récupère l'instance du pilote approprié pour un utilisateur.
   * @param {string} userId
   * @returns {Promise<WhatsAppProvider>}
   */
  async getProviderForUser(userId) {
    const mode = await this.getUserMode(userId);
    return mode === PROVIDER_MODES.OFFICIEL ? this.officialMetaProvider : this.quickLinkProvider;
  }

  /**
   * Connecte l'utilisateur selon son mode sélectionné.
   */
  async connect(userId, options = {}) {
    const mode = options.mode || await this.getUserMode(userId);
    if (options.mode) {
      await this.setUserMode(userId, options.mode);
    }

    const provider = mode === PROVIDER_MODES.OFFICIEL ? this.officialMetaProvider : this.quickLinkProvider;
    return await provider.connect({
      userId,
      phone: options.phone || null,
      credentials: options.credentials || {},
      options
    });
  }

  /**
   * Enregistre l'acceptation expresse du risque (requis pour le mode rapide).
   */
  async recordRiskAcceptance(userId, ip = '127.0.0.1') {
    return await this.quickLinkProvider.recordRiskAcceptance(userId, ip);
  }

  /**
   * Récupère le statut réel consolidé avec comparaison des modes.
   */
  async getStatus(userId) {
    const currentMode = await this.getUserMode(userId);
    const activeProvider = currentMode === PROVIDER_MODES.OFFICIEL ? this.officialMetaProvider : this.quickLinkProvider;
    const activeStatus = await activeProvider.getStatus(userId);

    // Récupérer également le résumé d'utilisation et de coût
    const usage = this.getUsageBreakdown(userId);

    return {
      currentMode,
      ...activeStatus,
      usage,
      modesInfo: {
        rapide: {
          name: "Lien Rapide (WhatsApp Web)",
          riskLevel: "ÉLEVÉ (Émulation non officielle)",
          guardrailsActive: true,
          broadcastsAllowed: false,
          inboundOnly: true,
          hourlyCap: 30,
          dailyCap: 200,
          description: "Connexion instantanée par QR Code sans changer de numéro. Réservé aux réponses entrantes."
        },
        officiel: {
          name: "Officiel (Meta Cloud API)",
          riskLevel: "ZÉRO (100% Conforme Meta)",
          guardrailsActive: false,
          broadcastsAllowed: true,
          inboundOnly: false,
          coexistenceAvailable: true,
          description: "Validation officielle Meta. Débloque les diffusions de masse, les modèles marketing et l'assistance illimitée."
        }
      }
    };
  }

  /**
   * Envoi d'un message avec routage, garde-fous et journalisation des coûts.
   */
  async sendMessage(userId, to, message, options = {}) {
    const provider = await this.getProviderForUser(userId);
    const mode = provider.name;
    const category = options.category || MESSAGE_CATEGORIES.FREE_FORM;

    // Exécution de l'envoi via le pilote actif (qui lèvera une exception en cas de violation des garde-fous)
    const result = await provider.sendMessage(userId, to, message, options);

    // Journalisation du message pour le suivi des coûts
    await this.logMessageUsage(userId, {
      recipient: to,
      category,
      mode,
      messageId: result.messageId,
      creditsDeducted: 1
    });

    return result;
  }

  /**
   * Journalise un envoi de message pour la facturation et les quotas.
   */
  async logMessageUsage(userId, entry) {
    const record = {
      timestamp: Date.now(),
      iso: new Date().toISOString(),
      recipient: entry.recipient,
      category: entry.category,
      mode: entry.mode,
      messageId: entry.messageId,
      creditsDeducted: entry.creditsDeducted || 1
    };

    if (!this.usageLogs.has(userId)) {
      this.usageLogs.set(userId, []);
    }
    const list = this.usageLogs.get(userId);
    list.push(record);
    if (list.length > 1000) list.shift();

    // Persistance dans Supabase si la table existe
    if (this.supabase && userId) {
      try {
        await this.supabase.from('whatsapp_message_logs').insert({
          user_id: userId,
          recipient: entry.recipient,
          category: entry.category,
          provider_mode: entry.mode,
          message_id: entry.messageId,
          credits_deducted: entry.creditsDeducted || 1,
          created_at: record.iso
        });
      } catch (dbErr) {
        // Table optionnelle, aucun blocage si absente
      }
    }
  }

  /**
   * Calcule la ventilation des messages par catégorie pour le compte client.
   */
  getUsageBreakdown(userId) {
    const list = this.usageLogs.get(userId) || [];
    const breakdown = {
      total: list.length,
      byCategory: {
        [MESSAGE_CATEGORIES.FREE_FORM]: 0,
        [MESSAGE_CATEGORIES.MARKETING]: 0,
        [MESSAGE_CATEGORIES.UTILITY]: 0,
        [MESSAGE_CATEGORIES.SERVICE]: 0
      },
      byMode: {
        [PROVIDER_MODES.RAPIDE]: 0,
        [PROVIDER_MODES.OFFICIEL]: 0
      }
    };

    for (const item of list) {
      if (breakdown.byCategory[item.category] !== undefined) {
        breakdown.byCategory[item.category]++;
      }
      if (breakdown.byMode[item.mode] !== undefined) {
        breakdown.byMode[item.mode]++;
      }
    }

    return breakdown;
  }

  /**
   * Déconnecte l'utilisateur du mode actif.
   */
  async disconnect(userId) {
    const provider = await this.getProviderForUser(userId);
    return await provider.disconnect(userId);
  }
}

module.exports = { WhatsAppManager };
