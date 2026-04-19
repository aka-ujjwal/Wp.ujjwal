import express from "express";
import axios from "axios";

const app = express();
app.use(express.json());

// ======================
// ENV VARIABLES
// ======================
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const WA_TOKEN = process.env.WA_TOKEN;
const PHONE_ID = process.env.PHONE_ID;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

// ======================
// MEMORY (IN-RAM)
// ======================
const memory = {};
const MAX_HISTORY = 10;

// ======================
// WEBHOOK VERIFY
// ======================
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token === VERIFY_TOKEN) {
    console.log("Webhook verified");
    return res.status(200).send(challenge);
  } else {
    return res.sendStatus(403);
  }
});

// ======================
// RECEIVE MESSAGE
// ======================
app.post("/webhook", async (req, res) => {
  try {
    const message =
      req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

    if (message) {
      const from = message.from;
      const text = message.text?.body || "";

      console.log("User:", text);

      // ======================
      // MEMORY SAVE (USER)
      // ======================
      if (!memory[from]) memory[from] = [];

      memory[from].push({
        role: "user",
        content: text,
      });

      // limit memory
      memory[from] = memory[from].slice(-MAX_HISTORY);

      // ======================
      // AI CALL (GROQ)
      // ======================
      const aiRes = await axios.post(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          model: "llama-3.1-8b-instant",
          messages: [
            {
              role: "system",
              content:
                "You are a helpful WhatsApp assistant. Reply short and clear.",
            },
            ...memory[from],
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${GROQ_API_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );

      const reply =
        aiRes.data.choices?.[0]?.message?.content || "No reply";

      console.log("AI:", reply);

      // ======================
      // MEMORY SAVE (AI)
      // ======================
      memory[from].push({
        role: "assistant",
        content: reply,
      });

      memory[from] = memory[from].slice(-MAX_HISTORY);

      // ======================
      // SEND TO WHATSAPP
      // ======================
      await axios.post(
        `https://graph.facebook.com/v18.0/${PHONE_ID}/messages`,
        {
          messaging_product: "whatsapp",
          to: from,
          text: { body: reply },
        },
        {
          headers: {
            Authorization: `Bearer ${WA_TOKEN}`,
            "Content-Type": "application/json",
          },
        }
      );

      console.log("Reply sent");
    }

    res.sendStatus(200);
  } catch (err) {
    console.error("ERROR:", err.response?.data || err.message);
    res.sendStatus(200);
  }
});

// ======================
// SERVER START
// ======================
const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
