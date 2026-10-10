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
        const { data: profile } = await supabase
                      .from('profiles')
                      .update({ 
                          credits: credits,
                          plan: planTier,
                          created_at: new Date().toISOString()
                      })
                      .eq('id', userId);
                      
                  console.log(`[PAIEMENT] Compte ${userId} recharge avec ${credits} credits.`);
                  
                  // LOGIQUE D'AFFILIATION 20%
                  try {
                      const amountPaid = parseFloat(payload.data?.amount || "0");
                      const { data: payer } = await supabase.from('profiles').select('referred_by').eq('id', userId).single();
                      if (payer && payer.referred_by && amountPaid > 0) {
                          const commission = Math.floor(amountPaid * 0.20);
                          const { data: sponsor } = await supabase.from('profiles').select('id, affiliate_balance').eq('affiliate_code', payer.referred_by).single();
                          if (sponsor) {
                              const newBalance = (parseFloat(sponsor.affiliate_balance) || 0) + commission;
                              await supabase.from('profiles').update({ affiliate_balance: newBalance }).eq('id', sponsor.id);
                              console.log(`[AFFILIATION] Commission de ${commission} FCFA versee au parrain ${payer.referred_by}`);
                          }
                      }
                  } catch(affErr) {
                      console.error("[AFFILIATION] Erreur webhook:", affErr.message);
                  }
            }
        }
        res.status(200).send('Webhook OK');
    } catch (error) {
        console.error('Webhook Error:', error);
        res.status(500).send('Webhook Error');
    }
});


// === 6. GET CONTACTS CRM ===
app.get('/api/contacts/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        const { data, error } = await supabase.from('contacts').select('*').eq('user_id', userId).order('updated_at', { ascending: false });
        if (error) throw error;
        res.json({ success: true, contacts: data });
    } catch (err) {
        console.error('Erreur fetch contacts:', err);
        res.status(500).json({ error: 'Erreur lors de la recuperation des contacts' });
    }
});


// === 7. DEMANDE DE RETRAIT (AFFILIATION) ===
app.post('/api/payouts/request', async (req, res) => {
    const { userId, amount, payout_method, payout_number } = req.body;
    try {
        const { data: profile } = await supabase.from('profiles').select('affiliate_balance').eq('id', userId).single();
        if (!profile || profile.affiliate_balance < amount) {
            return res.status(400).json({ error: 'Solde insuffisant pour ce retrait' });
        }
        
        // Dduire le solde
        await supabase.from('profiles').update({ affiliate_balance: profile.affiliate_balance - amount }).eq('id', userId);
        
        // Enregistrer la demande
        await supabase.from('payouts').insert({
            user_id: userId,
            amount: amount,
            payout_method: payout_method,
            payout_number: payout_number,
            status: 'PENDING'
        });
        
        res.json({ success: true, message: 'Demande de retrait enregistree avec succes' });
    } catch (err) {
        console.error('Erreur Payout:', err);
        res.status(500).json({ error: 'Erreur lors de la demande de retrait' });
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



