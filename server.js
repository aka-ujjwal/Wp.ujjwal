import express from "express";
import axios from "axios";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 10000;

// ================= VERIFY WEBHOOK =================
app.get("/webhook", (req, res) => {
  const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  } else {
    return res.sendStatus(403);
  }
});

// ================= RECEIVE MESSAGE =================
app.post("/webhook", async (req, res) => {
  try {
    const message =
      req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

    if (message) {
      const from = message.from;
      const text = message.text?.body;

      console.log("User:", text);

      // 🔥 AI (Groq)
      const aiRes = await axios.post(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          model: "llama3-8b-8192",
          messages: [
            {
              role: "system",
              content: "Reply short like WhatsApp chat.",
            },
            {
              role: "user",
              content: text,
            },
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );

      const reply = aiRes.data.choices[0].message.content;

      console.log("AI:", reply);

      // 📩 Send reply to WhatsApp
      await axios.post(
        `https://graph.facebook.com/v19.0/${process.env.PHONE_ID}/messages`,
        {
          messaging_product: "whatsapp",
          to: from,
          text: { body: reply },
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.WA_TOKEN}`,
            "Content-Type": "application/json",
          },
        }
      );

      console.log("Message sent");
    }

    res.sendStatus(200);
  } catch (err) {
    console.error("ERROR:", err.response?.data || err.message);
    res.sendStatus(500);
  }
});

// ================= START SERVER =================
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
