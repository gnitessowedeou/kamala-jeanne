require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const { OpenAI } = require('openai');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// === 1. CONNEXION BDD ===
let supabase;
if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
  supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
  console.log("✅ Supabase connecté.");
}

// === 2. CONNEXION IA ===
let openai;
if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  console.log("✅ OpenAI connecté.");
}

// === 3. GESTIONNAIRE WHATSAPP MULTI-CLIENTS ===
const waClients = {};    // Stocke les sessions WhatsApp (ID Utilisateur -> Moteur)
const waSessionsQR = {}; // Stocke les QR codes générés
const waStatuses = {};   // DISCONNECTED, STARTING, QR_READY, CONNECTED
const waNumbers = {};    // Stocke le numéro de téléphone connecté

app.post('/api/whatsapp/start', async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: "userId manquant" });

  if (waStatuses[userId] === 'CONNECTED') return res.json({ status: 'CONNECTED', message: "Bot déjà actif" });
  if (waClients[userId]) {
    if (waStatuses[userId] === 'QR_READY') return res.json({ status: 'QR_READY', qr: waSessionsQR[userId] });
    return res.json({ status: waStatuses[userId] });
  }

  waStatuses[userId] = 'STARTING';
  
  // Lancement d'un navigateur invisible pour le client
  const client = new Client({
    authStrategy: new LocalAuth({ clientId: userId }),
    puppeteer: { args: ['--no-sandbox', '--disable-setuid-sandbox'] },
    webVersionCache: { type: 'remote', remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html' }
  });

  waClients[userId] = client;

  // Quand WhatsApp génère le QR Code
  client.on('qr', async (qr) => {
    const qrImage = await qrcode.toDataURL(qr); // Convertir en image affichable
    waSessionsQR[userId] = qrImage;
    waStatuses[userId] = 'QR_READY';
    console.log(`[WA] QR Code généré pour le client ${userId}`);
  });

  // Quand le client a scanné et est connecté
  client.on('ready', () => {
    waStatuses[userId] = 'CONNECTED';
    waNumbers[userId] = client.info ? client.info.wid.user : null;
    delete waSessionsQR[userId];
    console.log(`✅ [WA] Client ${userId} CONNECTÉ sur WhatsApp ! Numéro: ${waNumbers[userId]}`);
  });

  // Quand un prospect envoie un message au client
  client.on('message', async (msg) => {
    // Ignorer les anciens messages (plus de 60 secondes) pour viter de spammer lors de la connexion
    const now = Math.floor(Date.now() / 1000);
      console.log(`[DEBUG] Message reçu de ${msg.from}. Type: ${msg.type}. Body: "${msg.body}". TS: ${msg.timestamp}. Now: ${now}. Diff: ${now - msg.timestamp}`);
      if (msg.timestamp < now - 60) {
          console.log('[DEBUG] Message ignoré car trop vieux.');
          return;
      }

          if (msg.isStatus || msg.from.includes('@g.us')) return; // Ignorer statuts et groupes

      // Ignorer les réactions, les images/audios sans texte, et les appels
      if (msg.type !== 'chat' && msg.type !== 'location' && !msg.body) return;
      if (!msg.body || msg.body.trim() === '') return;

      
    console.log(`[WA] Message reçu sur le numéro du client ${userId} : ${msg.body}`);

    
      try {
        // Vrifier si le client a pay (Crdits > 0)
        // Rcuprer le profil du client (crdits ET prompt personnalis) et date de creation
        const { data: profile } = await supabase.from('profiles').select('credits, ai_prompt, created_at').eq('id', userId).single();
        
        let isExpired = false;
        if (profile && profile.created_at) {
           const created = new Date(profile.created_at);
           const now = new Date();
           const daysPassed = Math.floor((now - created) / (1000 * 60 * 60 * 24));
           if (daysPassed >= 7) {
              isExpired = true;
           }
        }

        // Bypass temporaire pour le test local ou coupure
        if (!profile || profile.credits <= 0 || isExpired) {
          console.log(`? [WA] Le client ${userId} n'a plus de crdits ou essai expir (${isExpired ? 'EXPIRE' : '0 CREDIT'}). L'IA s'arrte.`);
          return;
        }


      // Récupérer le prompt personnalisé ou utiliser un prompt par défaut
      const systemPrompt = (profile && profile.ai_prompt) ? profile.ai_prompt : "Tu es un assistant IA poli. Réponds brièvement.";

      // Demander à l'IA de répondre avec le prompt du client
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: msg.body }
        ],
        max_tokens: 150
      });

      const aiResponse = completion.choices[0].message.content;
      console.log(`[WA] L'IA rpond : ${aiResponse}`);

      await client.sendMessage(msg.from, aiResponse);

      // Dduire un crdit
      if (profile && profile.credits > 0) {
          const newCredits = profile.credits - 1;
          await supabase.from('profiles').update({ credits: newCredits }).eq('id', userId);
          console.log(`[WA] -1 crdit pour ${userId}. Reste: ${newCredits}`);
      }
    } catch (error) {
      console.error('Erreur WA/IA:', error);
    }
  });

  client.initialize().catch(err => {
      console.error("Erreur WA:", err);
      waStatuses[userId] = 'ERROR';
      delete waClients[userId];
  });

  res.json({ status: 'STARTING', message: "Génération du QR Code..." });
});

app.get('/api/whatsapp/status/:userId', (req, res) => {
  const { userId } = req.params;
  res.json({ status: waStatuses[userId] || 'DISCONNECTED', qr: waSessionsQR[userId] || null, phone: waNumbers[userId] || null });
});

// === 4. WEBHOOK DE FACTURATION ===
app.post('/api/payments/webhook', async (req, res) => {
  const { userId, planId } = req.body;
  if (!supabase) return res.status(500).json({ error: 'Supabase non configuré' });

  let creditsToAdd = 0;
  if (planId === 'basic') creditsToAdd = 2500;
  else if (planId === 'pro') creditsToAdd = 6000;
  else if (planId === 'business') creditsToAdd = 15000;
  else return res.status(400).json({ error: 'Forfait invalide' });

  try {
    const { data: profile } = await supabase.from('profiles').select('credits').eq('id', userId).single();
    const newBalance = (profile?.credits || 0) + creditsToAdd;
    await supabase.from('profiles').update({ credits: newBalance }).eq('id', userId);
    res.json({ success: true, message: `Paiement validé. ${creditsToAdd} crédits ajoutés.` });
  } catch (error) { res.status(500).json({ error: 'Erreur facturation' }); }
});

// === 5. CONFIGURATION IA ===
app.get('/api/ai/config/:userId', async (req, res) => {
    const { userId } = req.params;
    const { data, error } = await supabase.from('profiles').select('ai_prompt').eq('id', userId).single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ prompt: data.ai_prompt || "Tu es un assistant IA poli. Réponds brièvement." });
});

app.post('/api/ai/config', async (req, res) => {
    const { userId, prompt } = req.body;
    console.log('--- REQUETE API CONFIG ---');
    console.log('userId reçu:', userId);
    console.log('prompt reçu:', prompt);
    if (!userId || !prompt) return res.status(400).json({ error: "Données manquantes" });
    const { error } = await supabase.from('profiles').update({ ai_prompt: prompt }).eq('id', userId);
    if (error) {
        console.error('Erreur Supabase:', error.message);
        return res.status(500).json({ error: error.message });
    }
    console.log('Succès Supabase');
    res.json({ success: true });
});


// ============================================================================
// ROUTES DE PAIEMENT (SASPAY)
// ============================================================================
app.post('/api/payments/create-session', async (req, res) => {
    try {
        const { userId, planTier, amount } = req.body;
        
        // Recuperer infos utilisateur
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).single();
        if (!profile) return res.status(404).json({ error: 'User not found' });

        const saspayPayload = {
            amount: amount.toString(),
            currency: "XOF",
            customer_email: profile.email || "client@kamalajeanne.com",
            customer_name: (profile.first_name || "Client") + " " + (profile.last_name || ""),
            return_url: "https://kamala-jeanne.vercel.app/dashboard.html",
            metadata: {
                userId: userId,
                planTier: planTier
            }
        };

        const fetch = (await import('node-fetch')).default;
        const saspayRes = await fetch('https://api.saspay.me/api/v1/checkout-sessions/', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.SASPAY_SECRET_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(saspayPayload)
        });

        const data = await saspayRes.json();
        
        if (data.data && data.data.checkout_url) {
            res.json({ checkout_url: data.data.checkout_url });
        } else {
            console.error('Saspay Error:', data);
            res.status(500).json({ error: 'Erreur lors de la creation du paiement' });
        }
    } catch (err) {
        console.error('Payment Session Error:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

app.post('/api/payments/webhook', async (req, res) => {
    try {
        const payload = req.body;
        console.log('[SASPAY WEBHOOK]', payload);

        if (payload.event === 'transaction.success') {
            const userId = payload.data?.metadata?.userId;
            const planTier = payload.data?.metadata?.planTier;

            if (userId) {
                const credits = planTier === 'basic' ? 1000 : planTier === 'pro' ? 3000 : planTier === 'business' ? 10000 : 0;
                
                await supabase
                    .from('profiles')
                    .update({ 
                        credits: credits,
                        plan: planTier,
                        created_at: new Date().toISOString()
                    })
                    .eq('id', userId);
                    
                console.log(`[PAIEMENT] Compte ${userId} recharge avec ${credits} credits.`);
            }
        }
        res.status(200).send('Webhook OK');
    } catch (error) {
        console.error('Webhook Error:', error);
        res.status(500).send('Webhook Error');
    }
});

// Route par dfaut (Frontend)
app.use((req, res) => {
  if (!req.path.startsWith('/api')) res.sendFile(path.join(__dirname, 'index.html'));
  else res.status(404).json({ error: "Route API non trouvée" });
});


app.listen(PORT, () => {
  console.log(`[KAMALA JEANNE] Moteur Backend démarré sur http://localhost:${PORT}`);
});

// Fix pour forcer le maintien du processus Node.js en vie
setInterval(() => {}, 1000 * 60 * 60);



