/**
 * VANDIAS AI - WhatsApp Provider Abstract Interface
 * Base contract for both Quick Link (Unofficial) and Official Meta Cloud API drivers.
 */

const WHATSAPP_STATUS = {
  NOT_INITIALIZED: 'NOT_INITIALIZED',
  AWAITING_RISK_ACCEPTANCE: 'AWAITING_RISK_ACCEPTANCE',
  STARTING: 'STARTING',
  QR_READY: 'QR_READY',
  CODE_READY: 'CODE_READY',
  AUTHENTICATED: 'AUTHENTICATED',
  CONNECTED: 'CONNECTED',
  RECONNECTING: 'RECONNECTING',
  RATE_LIMITED: 'RATE_LIMITED',
  DISCONNECTED: 'DISCONNECTED',
  ERROR: 'ERROR'
};

const MESSAGE_CATEGORIES = {
  FREE_FORM: 'free_form',       // Réponse libre dans la fenêtre de session client (24h)
  MARKETING: 'marketing',       // Modèle promotionnel ou campagne sortante
  UTILITY: 'utility',           // Modèle de commande, confirmation, livraison
  SERVICE: 'service'            // Modèle de support après-vente
};

const PROVIDER_MODES = {
  RAPIDE: 'rapide',             // Mode Baileys / whatsapp-web.js (Liaison rapide émulée)
  OFFICIEL: 'officiel'          // Mode WhatsApp Cloud API Meta (Embedded Signup v4)
};

class WhatsAppProvider {
  /**
   * @param {string} name - Provider identifier ('rapide' | 'officiel')
   * @param {object} [config={}] - Optional provider configuration
   */
  constructor(name, config = {}) {
    if (new.target === WhatsAppProvider) {
      throw new TypeError("Impossible d'instancier directement WhatsAppProvider (classe abstraite).");
    }
    this.name = name;
    this.config = config;
    this.incomingMessageHandlers = new Set();
  }

  /**
   * Initialise ou rétablit la connexion WhatsApp pour un utilisateur.
   * @param {object} params
   * @param {string} params.userId - Identifiant unique de l'utilisateur
   * @param {string} [params.phone] - Numéro pour pairing code (mode rapide) ou phone_number_id (mode officiel)
   * @param {object} [params.credentials] - Clés ou jetons d'authentification
   * @param {object} [params.options] - Options supplémentaires
   * @returns {Promise<{ status: string, [key: string]: any }>}
   */
  async connect(params) {
    throw new Error(`Méthode connect() non implémentée pour le pilote [${this.name}].`);
  }

  /**
   * Récupère l'état réel et actuel de la connexion d'un utilisateur.
   * @param {string} userId - Identifiant unique de l'utilisateur
   * @returns {Promise<{ mode: string, status: string, phone: string|null, [key: string]: any }>}
   */
  async getStatus(userId) {
    throw new Error(`Méthode getStatus() non implémentée pour le pilote [${this.name}].`);
  }

  /**
   * Envoie un message WhatsApp sortant à un destinataire.
   * @param {string} userId - Identifiant unique de l'utilisateur expéditeur
   * @param {string} to - Numéro ou WID du destinataire
   * @param {string|object} message - Texte ou payload template du message
   * @param {object} [options] - Options (category, delay, templateData, etc.)
   * @returns {Promise<{ success: boolean, messageId: string, category: string, [key: string]: any }>}
   */
  async sendMessage(userId, to, message, options = {}) {
    throw new Error(`Méthode sendMessage() non implémentée pour le pilote [${this.name}].`);
  }

  /**
   * Enregistre un gestionnaire d'événements pour les messages entrants.
   * @param {function} callback - Callback recevant le message normalisé
   */
  onIncomingMessage(callback) {
    if (typeof callback === 'function') {
      this.incomingMessageHandlers.add(callback);
    }
  }

  /**
   * Déclenche les écouteurs de messages entrants enregistrés.
   * @protected
   * @param {object} normalizedMessage
   */
  async emitIncomingMessage(normalizedMessage) {
    for (const handler of this.incomingMessageHandlers) {
      try {
        await handler(normalizedMessage);
      } catch (err) {
        console.error(`[WhatsAppProvider:${this.name}] Erreur dans le gestionnaire de message entrant:`, err);
      }
    }
  }

  /**
   * Déconnecte et libère la session de l'utilisateur.
   * @param {string} userId - Identifiant unique de l'utilisateur
   * @returns {Promise<{ success: boolean, message: string }>}
   */
  async disconnect(userId) {
    throw new Error(`Méthode disconnect() non implémentée pour le pilote [${this.name}].`);
  }
}

module.exports = {
  WhatsAppProvider,
  WHATSAPP_STATUS,
  MESSAGE_CATEGORIES,
  PROVIDER_MODES
};
