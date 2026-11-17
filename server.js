import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs";
import { createAuthenticatedClient, isPendingGrant } from "@interledger/open-payments";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// Reads private.key from local file OR cloud environment variable
const privateKey = process.env.PRIVATE_KEY_CONTENT
  ? process.env.PRIVATE_KEY_CONTENT.replace(/\\n/g, "\n")
  : fs.readFileSync(process.env.PRIVATE_KEY_PATH, "utf8");

const client = await createAuthenticatedClient({
  walletAddressUrl: process.env.MAIN_TILL_WALLET,
  privateKey: privateKey,
  keyId: process.env.KEY_ID,
});

let savedOutgoingToken = null;
let pendingGrantData = null;

// Sends real WhatsApp message via Twilio Sandbox
async function sendRealWhatsApp(messageText) {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.VENDOR_PHONE) {
    console.log("Twilio env vars not set, skipping live WhatsApp message.");
    return false;
  }
  try {
    const sid = process.env.TWILIO_ACCOUNT_SID.trim();
    const token = process.env.TWILIO_AUTH_TOKEN.trim();
    const auth = Buffer.from(sid + ":" + token).toString("base64");

    const params = new URLSearchParams({
      From: process.env.TWILIO_WHATSAPP_FROM.trim(),
      To: process.env.VENDOR_PHONE.trim(),
      Body: messageText,
    });

    const twilioUrl = "https://api.twilio.com/2010-04-01/Accounts/" + sid + "/Messages.json";

    const response = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        Authorization: "Basic " + auth,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const data = await response.json();
    console.log("Twilio WhatsApp Response:", data.sid || data);
    return response.ok;
  } catch (err) {
    console.error("Twilio WhatsApp Error:", err);
    return false;
  }
}

// STEP 1: One-time browser authorization
app.get("/api/authorize", async (req, res) => {
  try {
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const sendingWallet = await client.walletAddress.get({
      url: process.env.MAIN_TILL_WALLET,
    });

    const grant = await client.grant.request(
      { url: sendingWallet.authServer },
      {
        access_token: {
          access: [
            {
              type: "outgoing-payment",
              actions: ["create", "read"],
              identifier: sendingWallet.id,
              limits: {
                debitAmount: {
                  value: "50000",
                  assetCode: sendingWallet.assetCode,
                  assetScale: sendingWallet.assetScale,
                },
              },
            },
          ],
        },
        interact: {
          start: ["redirect"],
          finish: {
            method: "redirect",
            uri: `${baseUrl}/api/callback`,
            nonce: "smarttill-nonce-123",
          },
        },
      }
    );

    if (isPendingGrant(grant)) {
      pendingGrantData = grant;
      return res.redirect(grant.interact.redirect);
    }

    savedOutgoingToken = grant.access_token.value;
    res.send("Already authorized! Go back to the home page.");
  } catch (error) {
    console.error("Auth Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// STEP 2: Redirect back after approval
app.get("/api/callback", async (req, res) => {
  try {
    const { interact_ref } = req.query;
    const finalizedGrant = await client.grant.continue(
      {
        url: pendingGrantData.continue.uri,
        accessToken: pendingGrantData.continue.access_token.value,
      },
      { interact_ref }
    );

    savedOutgoingToken = finalizedGrant.access_token.value;
    res.send(`<h2>✅ Mummy Emma's SmartTill Approved!</h2><p><a href="/">Click here to return to Store Dashboard</a></p>`);
  } catch (error) {
    console.error("Callback Error:", error);
    res.status(500).send("Callback error: " + error.message);
  }
});

async function sendSplitPayment(receiverWalletUrl, amountInCents) {
  if (!savedOutgoingToken) {
    throw new Error("Till not authorized yet! Visit /api/authorize first.");
  }

  const sendingWallet = await client.walletAddress.get({
    url: process.env.MAIN_TILL_WALLET,
  });
  const receivingWallet = await client.walletAddress.get({
    url: receiverWalletUrl,
  });

  const incomingGrant = await client.grant.request(
    { url: receivingWallet.authServer },
    {
      access_token: {
        access: [{ type: "incoming-payment", actions: ["create", "read"] }],
      },
    }
  );

  const incomingPayment = await client.incomingPayment.create(
    {
      url: receivingWallet.resourceServer,
      accessToken: incomingGrant.access_token.value,
    },
    {
      walletAddress: receivingWallet.id,
      incomingAmount: {
        value: amountInCents.toString(),
        assetCode: receivingWallet.assetCode,
        assetScale: receivingWallet.assetScale,
      },
    }
  );

  const quoteGrant = await client.grant.request(
    { url: sendingWallet.authServer },
    {
      access_token: {
        access: [{ type: "quote", actions: ["create", "read"] }],
      },
    }
  );

  const quote = await client.quote.create(
    {
      url: sendingWallet.resourceServer,
      accessToken: quoteGrant.access_token.value,
    },
    {
      walletAddress: sendingWallet.id,
      receiver: incomingPayment.id,
      method: "ilp",
    }
  );

  const outgoingPayment = await client.outgoingPayment.create(
    {
      url: sendingWallet.resourceServer,
      accessToken: savedOutgoingToken,
    },
    {
      walletAddress: sendingWallet.id,
      quoteId: quote.id,
    }
  );

  return outgoingPayment;
}

// MAIN ENDPOINT: Splits via Open Payments + Sends Real WhatsApp Message
app.post("/api/simulate-sale", async (req, res) => {
  try {
    const { amount, source } = req.body;
    const totalCents = Number(amount) || 1000;
    const label = source || "Counter Sale";

    const restockCents = Math.floor(totalCents * 0.7);
    const profitCents = totalCents - restockCents;

    const restockTx = await sendSplitPayment(process.env.RESTOCK_WALLET, restockCents);
    const profitTx = await sendSplitPayment(process.env.PROFIT_WALLET, profitCents);

    const ngnTotal = ((totalCents / 100) * 1000).toLocaleString();
    const ngnRestock = ((restockCents / 100) * 1000).toLocaleString();
    const ngnProfit = ((profitCents / 100) * 1000).toLocaleString();

    const waMessage =
      `🛍️ *SmartTill NG Alert (${label})*\n` +
      `Hello Mummy Emma! You just received *₦${ngnTotal}* (€${(totalCents / 100).toFixed(2)}).\n\n` +
      `🔒 *₦${ngnRestock}* (70%) locked in Restock Box.\n` +
      `💵 *₦${ngnProfit}* (30%) sent to Daily Profit.\n\n` +
      `Settled automatically via Interledger Open Payments.`;

    const whatsappSent = await sendRealWhatsApp(waMessage);

    res.json({
      success: true,
      whatsappSent,
      split: {
        total: totalCents / 100,
        restockSaved: restockCents / 100,
        dailyProfit: profitCents / 100,
      },
      transactions: {
        restockId: restockTx.id,
        profitId: profitTx.id,
      },
    });
  } catch (error) {
    console.error("Split Error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Mummy Emma's SmartTill API running on http://localhost:${PORT}`);
});
