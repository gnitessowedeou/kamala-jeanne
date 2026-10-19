/**
 * VANDIAS AI - Pipeline IA Universel Commun aux Deux Modes WhatsApp
 * Flux : Message entrant -> Résolution compte client -> Prompt & Catalogue -> Appel IA -> Réponse -> Enregistrement
 */

const { MESSAGE_CATEGORIES } = require('../whatsapp/WhatsAppProvider');

class AIPipeline {
  /**
   * @param {object} dependencies
   * @param {object} dependencies.openai - Client OpenAI initialisé
   * @param {object} [dependencies.supabase] - Client Supabase
   * @param {Map} [dependencies.chatHistories] - Cache mémoire des sessions conversationnelles
   * @param {number} [dependencies.maxHistory=12] - Nombre d'échanges d'historique conservés
   */
  constructor(dependencies = {}) {
    this.openai = dependencies.openai || null;
    if (!this.openai && dependencies.openaiApiKey) {
      const { OpenAI } = require('openai');
      this.openai = new OpenAI({ apiKey: dependencies.openaiApiKey });
    }
    this.supabase = dependencies.supabase || null;
    this.whatsappManager = dependencies.whatsappManager || null;
    this.chatHistories = dependencies.chatHistories || new Map();
    this.maxHistory = dependencies.maxHistory || 12;
    this.processedMessageIds = new Set();
  }

  /**
   * Traite un message entrant normalisé issu de n'importe quel pilote (rapide ou officiel).
   * @param {object} msg - Message normalisé
   * @param {object} whatsappManager - Gestionnaire multi-pilotes
   */
  async processIncomingMessage(msg, whatsappManager) {
    if (!msg || !msg.body || typeof msg.body !== 'string' || msg.body.trim() === '') {
      return null;
    }

    // 1. Déduplication
    const msgId = msg.id || `${msg.from}_${msg.timestamp}_${msg.body.substring(0, 15)}`;
    if (this.processedMessageIds.has(msgId)) return null;
    this.processedMessageIds.add(msgId);
    if (this.processedMessageIds.size > 3000) {
      const oldest = this.processedMessageIds.values().next().value;
      this.processedMessageIds.delete(oldest);
    }

    // 2. Filtres stricts de sécurité
    if (msg.isStatus || (msg.from && msg.from.includes('@g.us')) || (msg.to && msg.to.includes('@g.us'))) {
      return null;
    }

    // Protection anti-boucle
    if (msg.body.startsWith('[IA') || msg.body.startsWith('[BOT')) {
      return null;
    }

    const userId = msg.userId;
    if (!userId) {
      console.warn(`[AIPipeline] Impossible de traiter le message : userId non résolu pour ${msg.from}`);
      return null;
    }

    const cleanSenderPhone = String(msg.from).replace(/\D/g, '');
    const contactName = msg.contactName || 'Client';

    // 3. Récupération du profil commerçant (crédits, prompt personnalisé, consignes)
    let profile = null;
    if (this.supabase) {
      try {
        const { data } = await this.supabase
          .from('profiles')
          .select('credits, ai_prompt, full_name, plan, whatsapp_number')
          .eq('id', userId)
          .maybeSingle();
        profile = data;
      } catch (dbErr) {
        console.warn(`[AIPipeline] Notice Supabase profile:`, dbErr.message);
      }
    }

    // 4. Session conversationnelle et historique
    const sessionKey = `${userId}:${cleanSenderPhone}`;
    let session = this.chatHistories.get(sessionKey);
    const now = Date.now();
    const SESSION_TIMEOUT_MS = 4 * 3600 * 1000; // 4 heures

    if (!session || (now - (session.lastActivity || 0) > SESSION_TIMEOUT_MS)) {
      session = {
        name: contactName,
        history: session ? (session.history || []).slice(-this.maxHistory) : [],
        isNewSession: true,
        lastActivity: now
      };
    } else {
      session.isNewSession = false;
      session.lastActivity = now;
    }

    // 5. Construction du Prompt & Consignes Commerciales
    const systemPrompt = this.buildCommercialPrompt(profile, session.isNewSession, contactName);

    const messages = [
      { role: 'system', content: systemPrompt },
      ...session.history.slice(-this.maxHistory),
      { role: 'user', content: msg.body }
    ];

    // 6. Appel IA (OpenAI gpt-4o-mini)
    let aiResponse = "";
    if (!this.openai) {
      aiResponse = `Bonjour ${contactName} ! Bienvenue chez nous 😊 Comment puis-je vous aider aujourd'hui ?`;
    } else {
      try {
        const completion = await this.openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages,
          max_tokens: 450,
          temperature: 0.7
        });
        aiResponse = (completion.choices && completion.choices[0] && completion.choices[0].message)
          ? completion.choices[0].message.content.trim()
          : "Bonjour ! Comment puis-je vous renseigner sur nos produits et services ?";
      } catch (aiErr) {
        console.error(`[AIPipeline] Erreur appel OpenAI: ${aiErr.message}`);
        aiResponse = "Je note bien votre demande, un responsable commercial va prendre le relais très rapidement.";
      }
    }

    // 7. Mise à jour de l'historique conversationnel
    session.history.push({ role: 'user', content: msg.body });
    session.history.push({ role: 'assistant', content: aiResponse });
    session.history = session.history.slice(-this.maxHistory);
    this.chatHistories.set(sessionKey, session);

    // 8. Persistance dans Supabase (table contacts)
    if (this.supabase) {
      try {
        await this.supabase.from('contacts').upsert({
          user_id: userId,
          phone_number: cleanSenderPhone,
          name: contactName,
          last_message: JSON.stringify({
            text: msg.body.substring(0, 250),
            history: session.history,
            last_activity: new Date().toISOString()
          }),
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id,phone_number' });
      } catch (saveErr) {
        console.warn(`[AIPipeline] Notice sauvegarde contact Supabase: ${saveErr.message}`);
      }
    }

    // 9. Expédition de la réponse via le WhatsAppManager (qui choisit le bon pilote)
    const wm = whatsappManager || this.whatsappManager;
    let sendResult = null;
    if (wm && typeof wm.sendMessage === 'function') {
      console.log(`[AIPipeline] Envoi réponse IA vers ${msg.from} via WhatsAppManager (Catégorie: FREE_FORM)`);
      sendResult = await wm.sendMessage(userId, msg.from, aiResponse, {
        category: MESSAGE_CATEGORIES.FREE_FORM,
        chatObject: msg.rawChat || null,
        msgObject: msg.rawMsg || null,
        skipInitiatorCheck: true // Réponse autorisée car initiée par le client
      });
    }

    // 10. Décrémentation d'un crédit dans Supabase
    if (this.supabase && sendResult && sendResult.success) {
      try {
        const { data: curr } = await this.supabase
          .from('profiles')
          .select('credits')
          .eq('id', userId)
          .maybeSingle();

        const currentCredits = (curr && typeof curr.credits === 'number') ? curr.credits : 100;
        const newCredits = Math.max(0, currentCredits - 1);

        await this.supabase
          .from('profiles')
          .update({ credits: newCredits })
          .eq('id', userId);

        console.log(`💳 [AIPipeline] 1 crédit déduit pour ${userId} (${currentCredits} -> ${newCredits})`);
      } catch (credErr) {
        console.warn(`[AIPipeline] Erreur déduction crédit: ${credErr.message}`);
      }
    }

    return {
      aiResponse,
      category: MESSAGE_CATEGORIES.FREE_FORM,
      sendResult
    };
  }

  /**
   * Génère le prompt système d'agent commercial strict anti-hallucination.
   */
  buildCommercialPrompt(profile, isNewSession, contactName) {
    const userPrompt = (profile && profile.ai_prompt && profile.ai_prompt.trim().length > 10)
      ? profile.ai_prompt.trim()
      : "Tu es l'agent commercial officiel de l'entreprise. Accueille le client, présente nos produits avec clarté et bienveillance, et aide-le à finaliser sa commande.";

    return `
## RÈGLES STRICTES DE POSTURE COMMERCIALE (VANDIAS AI) :
1. MISSION ET POSTURE :
- Tu es l'agent commercial officiel de l'entreprise sur WhatsApp.
- Sois poli, courtois, chaleureux, bienveillant et persuasif.
- Ne pose qu'UNE question courte à la fois pour guider le prospect.

2. CATALOGUE & PRIX (RÈGLE ABSOLUE ANTI-HALLUCINATION) :
- Utilise EXCLUSIVEMENT les produits, services et tarifs figurant ci-dessous.
- INTERDICTION FORMELLE d'inventer des produits, remises ou prestations non mentionnés.

3. MOYENS DE PAIEMENT & SÉCURITÉ :
- Utilise uniquement les moyens officiels (Wave, Orange Money, MoMo, Carte).
- Ne valide jamais un paiement sans preuve de transfert.
- Ne demande JAMAIS de mot de passe, code secret ou code PIN.

4. FORMAT WHATSAPP :
- Réponses concises (3 à 5 lignes), aérées, adaptées à la lecture sur smartphone avec émojis discrets (😊, 📦, 💳).

## INSTRUCTIONS & CATALOGUE DE L'ENTREPRISE :
${userPrompt}

${isNewSession 
  ? `[ACCUEIL] : C'est le premier échange, salue cordialement le client (ex: "Bonjour ${contactName} !").`
  : `[SUIVI] : Conversation en cours, réponds directement sans formule d'accueil redondante.`
}
`.trim();
  }
}

module.exports = { AIPipeline };
