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
    let productsList = [];
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

      try {
        const { data: prods } = await this.supabase
          .from('products')
          .select('name, price, currency, description, variants, stock')
          .eq('user_id', userId)
          .eq('is_active', true);
        if (prods && Array.isArray(prods) && prods.length > 0) {
          productsList = prods;
        }
      } catch (prodErr) {
        // Table optionnelle si non encore migrée
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
    const systemPrompt = this.buildCommercialPrompt(profile, session.isNewSession, contactName, productsList);

    const messages = [
      { role: 'system', content: systemPrompt },
      ...session.history.slice(-this.maxHistory),
      { role: 'user', content: msg.body }
    ];

    // 6. Appel IA (OpenAI gpt-4o-mini avec Outil de Paiement SasPay)
    let aiResponse = "";
    if (!this.openai) {
      aiResponse = `Bonjour ${contactName} ! Bienvenue chez nous 😊 Comment puis-je vous aider aujourd'hui ?`;
    } else {
      try {
        const tools = [
          {
            type: 'function',
            function: {
              name: 'create_payment_link',
              description: "Génère un lien de paiement sécurisé officiel SasPay (Carte Bancaire VISA/Mastercard & Mobile Money multi-pays) pour le client lorsqu'il souhaite commander ou régler un ou plusieurs produits/services.",
              parameters: {
                type: 'object',
                properties: {
                  amount: {
                    type: 'number',
                    description: 'Le montant total exact à payer en FCFA (XOF), calculé en additionnant le prix exact de chaque produit choisi par le client selon le catalogue de l\'entreprise.'
                  },
                  product_names: {
                    type: 'string',
                    description: 'Le nom ou la liste des produits/services commandés par le client.'
                  }
                },
                required: ['amount', 'product_names']
              }
            }
          }
        ];

        const completion = await this.openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages,
          tools,
          tool_choice: 'auto',
          max_tokens: 450,
          temperature: 0.7
        });

        const choice = completion.choices && completion.choices[0];
        const msgObj = choice ? choice.message : null;

        if (msgObj && msgObj.tool_calls && msgObj.tool_calls.length > 0) {
          const toolCall = msgObj.tool_calls[0];
          if (toolCall.function && toolCall.function.name === 'create_payment_link') {
            let args = {};
            try { args = JSON.parse(toolCall.function.arguments || '{}'); } catch(e) {}
            const amount = Number(args.amount) || 0;
            const productNames = args.product_names || 'Commande';

            console.log(`[AIPipeline] 💳 Tool create_payment_link déclenché pour ${userId}: ${amount} FCFA (${productNames})`);
            const paymentUrl = await this.generateSasPayPaymentLink({
              userId,
              amount,
              productNames,
              customerPhone: cleanSenderPhone,
              customerName: contactName,
              profile
            });

            messages.push(msgObj);
            messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify({
                status: paymentUrl ? 'success' : 'failed',
                payment_url: paymentUrl || null,
                amount,
                currency: 'XOF',
                product_names: productNames
              })
            });

            const followUp = await this.openai.chat.completions.create({
              model: 'gpt-4o-mini',
              messages,
              max_tokens: 450,
              temperature: 0.7
            });

            aiResponse = (followUp.choices && followUp.choices[0] && followUp.choices[0].message)
              ? followUp.choices[0].message.content.trim()
              : (paymentUrl 
                  ? `Parfait ! Voici votre lien de paiement sécurisé pour ${productNames} (${amount} FCFA) : ${paymentUrl}`
                  : "Votre commande est bien notée. Un responsable commercial va vous communiquer les modalités de paiement.");
          } else {
            aiResponse = (msgObj && msgObj.content) ? msgObj.content.trim() : "Bonjour ! Comment puis-je vous aider ?";
          }
        } else {
          aiResponse = (msgObj && msgObj.content)
            ? msgObj.content.trim()
            : "Bonjour ! Comment puis-je vous renseigner sur nos produits et services ?";
        }
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
   * Génère dynamiquement une session de paiement SasPay pour un client WhatsApp.
   */
  async generateSasPayPaymentLink({ userId, amount, productNames, customerPhone, customerName, profile }) {
    try {
      if (!amount || amount <= 0) return null;

      // 1. Clé SasPay personnalisée du commerçant si enregistrée dans ses intégrations
      let merchantSecret = null;
      let merchantName = profile?.full_name || 'VANDIAS';
      if (this.supabase && userId) {
        try {
          const { data: uData } = await this.supabase.auth.admin.getUserById(userId);
          const integ = uData?.user?.app_metadata?.integrations || [];
          const sasItem = integ.find(x => x.key === 'saspay');
          if (sasItem) {
            if (sasItem.secretKey && sasItem.secretKey.startsWith('sk_')) {
              merchantSecret = sasItem.secretKey.trim();
            }
            if (sasItem.beneficiary) {
              merchantName = sasItem.beneficiary;
            }
          }
        } catch (mErr) {
          console.warn('[AIPipeline] Notice lecture intégration SasPay commerçant:', mErr.message);
        }
      }

      const secretKey = merchantSecret || process.env.SASPAY_SECRET_KEY || process.env.SAASPAY_SECRET_KEY || process.env.SASPAY_KEY || process.env.SAASPAY_KEY || process.env.SASPAY_API_KEY;
      if (!secretKey) {
        console.warn(`[AIPipeline] Aucune clé SasPay disponible pour générer le lien de ${userId}`);
        return null;
      }

      const fetch = (await import('node-fetch')).default;
      const cleanPhone = String(customerPhone || '').replace(/\D/g, '');
      const safeEmail = `client.${cleanPhone || Date.now()}@vandias.com`;

      const payload = {
        amount: String(Math.round(amount)),
        currency: 'XOF',
        customer_name: customerName || 'Client WhatsApp',
        customer_email: safeEmail,
        customer_phone: cleanPhone ? ('+' + cleanPhone) : '',
        description: `Commande ${productNames} - ${merchantName}`,
        return_url: 'https://vandias.com',
        metadata: {
          userId,
          merchantName,
          customerPhone: cleanPhone,
          productNames,
          source: 'whatsapp_ai_order'
        }
      };

      const res = await fetch('https://api.saspay.me/api/v1/checkout-sessions/', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${secretKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (data && data.data && data.data.checkout_url) {
        console.log(`✅ [AIPipeline] Lien SasPay généré avec succès pour ${userId} (${amount} FCFA, ${productNames}): ${data.data.checkout_url}`);
        return data.data.checkout_url;
      } else {
        console.warn('[AIPipeline] Erreur retour SasPay:', data);
        return null;
      }
    } catch (err) {
      console.error('[AIPipeline] Exception création lien SasPay:', err.message);
      return null;
    }
  }

  /**
   * Génère le prompt système d'agent commercial strict anti-hallucination.
   */
  buildCommercialPrompt(profile, isNewSession, contactName, productsList = []) {
    const userPrompt = (profile && profile.ai_prompt && profile.ai_prompt.trim().length > 10)
      ? profile.ai_prompt.trim()
      : "Tu es l'agent commercial officiel de l'entreprise. Accueille le client, présente nos produits avec clarté et bienveillance, et aide-le à finaliser sa commande.";

    let catalogSection = "";
    if (productsList && productsList.length > 0) {
      const itemsText = productsList.map(p => {
        const stockStr = (p.stock === -1 || p.stock === null || p.stock === undefined) ? "Stock illimité" : (p.stock > 0 ? `${p.stock} unités dispo` : "RUPTURE TEMPORAIRE");
        let line = `• ${p.name} : ${p.price} ${p.currency || 'FCFA'} (${stockStr})`;
        if (p.description) line += ` - ${p.description}`;
        if (p.variants && Array.isArray(p.variants) && p.variants.length > 0) line += ` (Variantes: ${p.variants.join(', ')})`;
        return line;
      }).join('\n');

      catalogSection = `\n### CATALOGUE PRODUITS OFFICIEL EN TEMPS RÉEL (SYNCHRONISÉ PAR LE COMMERÇANT) :\n${itemsText}\n`;
    }

    return `
## RÈGLES STRICTES DE POSTURE COMMERCIALE (VANDIAS AI) :
1. MISSION ET POSTURE :
- Tu es l'agent commercial officiel de l'entreprise sur WhatsApp.
- Sois poli, courtois, chaleureux, bienveillant et persuasif.
- Ne pose qu'UNE question courte à la fois pour guider le prospect.

2. CATALOGUE & PRIX (RÈGLE ABSOLUE ANTI-HALLUCINATION) :
- Utilise EXCLUSIVEMENT les produits, services et tarifs figurant ci-dessous.
- INTERDICTION FORMELLE d'inventer des produits, remises ou prestations non mentionnés.
- Si le client choisit plusieurs produits, additionne les prix avec exactitude pour lui donner le total précis.

3. MOYENS DE PAIEMENT & SÉCURITÉ :
- Utilise uniquement les moyens officiels (Wave, Orange Money, MoMo, Carte Bancaire).
- Pour tout client qui souhaite passer commande, régler par carte bancaire, ou résidant au Congo (Brazzaville ou Kinshasa RDC), Cameroun, Gabon, ou hors zone : utilise SYSTÉMATIQUEMENT l'outil officiel 'create_payment_link' pour lui générer son lien sécurisé SasPay avec le montant total exact calculé.
- Ne valide jamais un paiement sans preuve de transfert ou confirmation de session.
- Ne demande JAMAIS de mot de passe, code secret ou code PIN.

4. FORMAT WHATSAPP :
- Réponses concises (3 à 5 lignes), aérées, adaptées à la lecture sur smartphone avec émojis discrets (😊, 📦, 💳).

5. POLYGLOTTE AFRICAIN & ASSISTANCE VOCALE :
- Tu es polyglotte et t'adaptes naturellement à la langue du client : Français, Anglais, Lingala (Congo RDC / Brazzaville), Swahili, etc.
- Si le client s'exprime en Lingala (ex: "Mbote", "Nalingi..."), réponds-lui chaleureusement en Lingala ou en français très clair.
- Si le client a du mal à écrire ou s'il hésite, propose-lui cordialement d'envoyer un message vocal (en Français, Lingala ou Anglais), en le rassurant que tu l'écoutes et le comprends parfaitement ! 😊

## INSTRUCTIONS & CONSIGNES DU COMMERÇANT :
${userPrompt}
${catalogSection}
${isNewSession 
  ? `[ACCUEIL] : C'est le premier échange, salue cordialement le client (ex: "Bonjour ${contactName} !").`
  : `[SUIVI] : Conversation en cours, réponds directement sans formule d'accueil redondante.`
}
`.trim();
  }
}

module.exports = { AIPipeline };
