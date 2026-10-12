const { createClient } = require('@supabase/supabase-js');
const { OpenAI } = require('openai');

const allowedOrigins = [
  'https://kamala-jeanne.vercel.app',
  'https://vandia.ai',
  'https://www.vandia.ai',
  'http://localhost:8080',
  'http://localhost:5173',
  'http://localhost:3000'
];

module.exports = async (req, res) => {
  const origin = req.headers.origin;
  const isAllowedOrigin = !origin || allowedOrigins.includes(origin) || origin.endsWith('.vercel.app');

  if (isAllowedOrigin && origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!isAllowedOrigin) {
    return res.status(403).json({ error: "Origine non autorisée par la politique de sécurité." });
  }

  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
    const openAiKey = process.env.OPENAI_API_KEY;

    // Vérification d'authentification obligatoire si Supabase est configuré
    if (supabaseUrl && supabaseKey) {
      if (!token) {
        return res.status(401).json({ error: "Authentification requise : Token manquant." });
      }
      const supabaseAuth = createClient(supabaseUrl, supabaseKey);
      const { data: { user }, error: authErr } = await supabaseAuth.auth.getUser(token);
      if (authErr || !user) {
        return res.status(401).json({ error: "Session invalide ou expirée." });
      }
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { userId, message } = body;
    if (!message || typeof message !== 'string') return res.status(400).json({ error: "Message requis" });
    if (message.length > 1000) return res.status(400).json({ error: "Message trop long (max 1000 caractères)" });

    let systemPrompt = "Tu es un assistant commercial WhatsApp intelligent, chaleureux et persuasif pour VANDIA AI.";
    if (userId && supabaseUrl && supabaseKey) {
      try {
        const supabase = createClient(supabaseUrl, supabaseKey);
        const { data: profile } = await supabase.from('profiles').select('ai_prompt').eq('id', userId).single();
        if (profile && profile.ai_prompt) systemPrompt = profile.ai_prompt;
      } catch (e) {}
    }

    if (!openAiKey) {
      return res.status(200).json({ 
        success: true, 
        reply: "Bonjour ! Je suis l'assistant IA VANDIA. Mon moteur est prêt à vous assister." 
      });
    }

    const openai = new OpenAI({ apiKey: openAiKey });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message }
      ],
      max_tokens: 250
    });

    const reply = completion.choices[0].message.content;
    return res.status(200).json({ success: true, reply });
  } catch (err) {
    console.error("Vercel AI Error:", err);
    return res.status(500).json({ error: err.message || "Erreur interne" });
  }
};