import express from "express";
import axios from "axios";
import mongoose from "mongoose";

const app = express();
app.use(express.json());

// ===== ENV =====
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const WA_TOKEN = process.env.WA_TOKEN;
const PHONE_ID = process.env.PHONE_ID;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const MONGO_URI = process.env.MONGO_URI;

// ===== MongoDB Connect =====
mongoose.connect(MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.error("MongoDB error:", err));

// ===== Schema =====
const userSchema = new mongoose.Schema({
  number: String,
  name: String,
});

const User = mongoose.model("User", userSchema);

// ===== Webhook Verify =====
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// ===== Webhook Receive =====
app.post("/webhook", async (req, res) => {
  try {
    const message = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

    if (!message) return res.sendStatus(200);

    const from = message.from;
    const text = message.text?.body?.toLowerCase().trim();

    console.log("User:", text);

    let reply = "samajh nahi aaya";

    // ===== DB check =====
    let user = await User.findOne({ number: from });

    // ===== SAVE NAME =====
    if (text.startsWith("mera naam")) {
      const name = text.replace("mera naam", "").trim();

      if (name) {
        if (user) {
          user.name = name;
          await user.save();
        } else {
          await User.create({ number: from, name });
        }

        console.log("Saved name:", name);
        reply = `ठीक है, याद रख लिया: ${name}`;
      } else {
        reply = "naam clear nahi mila";
      }
    }

    // ===== RECALL NAME =====
    else if (text.includes("mera naam kya hai")) {
      if (user && user.name) {
        reply = `तुम्हारा नाम ${user.name} है`;
      } else {
        reply = "मुझे अभी तुम्हारा नाम नहीं पता";
      }
    }

    // ===== AI FALLBACK =====
    else {
      const aiRes = await axios.post(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          model: "llama3-8b-8192",
          messages: [
            {
              role: "system",
              content: "You are a helpful WhatsApp assistant. Reply short."
            },
            { role: "user", content: text }
          ]
        },
        {
          headers: {
            Authorization: `Bearer ${GROQ_API_KEY}`,
            "Content-Type": "application/json"
          }
        }
      );

      reply = aiRes.data.choices[0].message.content;
    }

    // ===== Send Reply =====
    await axios.post(
      `https://graph.facebook.com/v18.0/${PHONE_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to: from,
        text: { body: reply }
      },
      {
        headers: {
          Authorization: `Bearer ${WA_TOKEN}`,
          "Content-Type": "application/json"
        }
      }
    );

    console.log("Reply:", reply);

    res.sendStatus(200);
  } catch (err) {
    console.error("ERROR:", err.response?.data || err.message);
    res.sendStatus(500);
  }
});

// ===== Server =====
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("Server running on port", PORT));
