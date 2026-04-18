import express from "express";
import axios from "axios";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 10000;

const VERIFY_TOKEN = "mytoken"; // same jo meta me dala
const ACCESS_TOKEN = process.env.WA_TOKEN;

// 🔹 Webhook verify
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  } else {
    return res.sendStatus(403);
  }
});

// 🔹 Receive messages
app.post("/webhook", async (req, res) => {
  console.log("Incoming:", JSON.stringify(req.body, null, 2));

  try {
    const message =
      req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

    if (message) {
      const from = message.from;
      const text = message.text?.body;

      console.log("User:", from, "Message:", text);

      // 🔹 Reply send
      await axios.post(
        `https://graph.facebook.com/v18.0/${process.env.PHONE_ID}/messages`,
        {
          messaging_product: "whatsapp",
          to: from,
          text: { body: "Reply: " + text },
        },
        {
          headers: {
            Authorization: `Bearer ${ACCESS_TOKEN}`,
            "Content-Type": "application/json",
          },
        }
      );
    }

    res.sendStatus(200);
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.sendStatus(500);
  }
});

app.get("/", (req, res) => {
  res.send("Server running");
});

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
