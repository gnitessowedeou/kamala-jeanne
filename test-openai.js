require('dotenv').config();
const { OpenAI } = require('openai');

if (!process.env.OPENAI_API_KEY) {
  console.error("⊬ Erreur : La clé OpenAI nest pas trouvée dans le fichier .env.");
  process.exit(1);
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function testOpenAI() {
  console.log("⌯⸏ Tentative de connexion à OpenAI avec ta clé ...");
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "Diqs bonjour et présente-toi en une phrase" }],
      max_tokens: 50
    });
    console.log("\n✅ SUCCÉS ! La clé est valide et l'IA répond :");
    console.log("⚼ L'IA dit : " + completion.choices[0].message.content);
  } catch (error) {
    console.error(`n
⋈ ERREUR OPENAI ⋈`);
    console.error(error.message);
  }
}

testOpenAI();
