const { createClient } = require('@supabase/supabase-js');
const { OpenAI } = require('openai');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { userId, message } = body;
    if (!message) return res.status(400).json({ error: "Message requis" });

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
    const openAiKey = process.env.OPENAI_API_KEY;

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
        reply: "Bonjour ! Je suis l'assistant IA VANDIA. Comment puis-je vous aider aujourd'hui ?" 
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