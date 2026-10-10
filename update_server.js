const fs = require('fs');
let serverJs = fs.readFileSync('C:/Users/DELL/KAMALA JEANNE/server.js', 'utf8');

// 1. Add userConversations
if (!serverJs.includes('userConversations = {}')) {
    serverJs = serverJs.replace(client.on('message', async msg => {, const userConversations = {};\n\nclient.on('message', async msg => {);
}

// 2. Define customerPhone
serverJs = serverJs.replace(
    const userId = Object.keys(waClients).find(key => waClients[key] === client);,
    const userId = Object.keys(waClients).find(key => waClients[key] === client);\n      const contact = await msg.getContact();\n      const customerPhone = contact.id.user;
);

// 3. Update OpenAI call
const oldOpenAI =       // Demander  l'IA de rpondre
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: msg.body }
        ],
        max_tokens: 150
      });

      const aiReply = completion.choices[0].message.content;;

const newOpenAI =       // --- DEBUT GESTION DE LA MEMOIRE (HISTORIQUE) ---
      if (!userConversations[customerPhone]) {
          userConversations[customerPhone] = [];
      }

      userConversations[customerPhone].push({ role: "user", content: msg.body });

      if (userConversations[customerPhone].length > 6) {
          userConversations[customerPhone] = userConversations[customerPhone].slice(-6);
      }

      const messagesToSend = [
          { role: "system", content: systemPrompt },
          ...userConversations[customerPhone]
      ];

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: messagesToSend,
        max_tokens: 150
      });

      const aiReply = completion.choices[0].message.content;
      userConversations[customerPhone].push({ role: "assistant", content: aiReply });
      // --- FIN GESTION DE LA MEMOIRE ---;

serverJs = serverJs.replace(oldOpenAI, newOpenAI);

fs.writeFileSync('C:/Users/DELL/KAMALA JEANNE/server.js', serverJs, 'utf8');
console.log('Script updated successfully!');