const express = require("express");

const app = express();

app.use(express.json());

const PORT = process.env.PORT || 10000;

let latestLivePix = {
  name: "Aguardando...",
  amount: null,
  currency: null,
  updatedAt: null
};

let accessToken = null;
let tokenExpiresAt = 0;


// ========================================
// OBTER TOKEN DO LIVEPIX
// ========================================

async function getAccessToken() {

  if (accessToken && Date.now() < tokenExpiresAt) {
    return accessToken;
  }

  const params = new URLSearchParams();

  params.append("grant_type", "client_credentials");
  params.append("client_id", process.env.LIVEPIX_CLIENT_ID);
  params.append("client_secret", process.env.LIVEPIX_CLIENT_SECRET);
  params.append("scope", "account:read wallet:read webhooks");

  const response = await fetch(
    "https://oauth.livepix.gg/oauth2/token",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: params
    }
  );

  if (!response.ok) {

    const error = await response.text();

    throw new Error(
      `Erro ao obter token: ${response.status} ${error}`
    );

  }

  const data = await response.json();

  accessToken = data.access_token;

  tokenExpiresAt =
    Date.now() + ((data.expires_in - 60) * 1000);

  return accessToken;
}


// ========================================
// CONSULTAR WEBHOOKS EXISTENTES
// ========================================

async function getWebhooks() {

  const token = await getAccessToken();

  const response = await fetch(
    "https://api.livepix.gg/v2/webhooks",
    {
      headers: {
        "Authorization": `Bearer ${token}`
      }
    }
  );

  if (!response.ok) {

    const error = await response.text();

    throw new Error(
      `Erro ao consultar webhooks: ${response.status} ${error}`
    );

  }

  return await response.json();
}


// ========================================
// BUSCAR PAGAMENTO
// ========================================

async function getPayment(paymentId) {

  const token = await getAccessToken();

  const response = await fetch(
    `https://api.livepix.gg/v2/payments/${paymentId}`,
    {
      headers: {
        "Authorization": `Bearer ${token}`
      }
    }
  );

  if (!response.ok) {

    const error = await response.text();

    throw new Error(
      `Erro ao consultar pagamento: ${response.status} ${error}`
    );

  }

  return await response.json();
}


// ========================================
// BUSCAR MENSAGEM
// ========================================

async function getMessage(messageId) {

  const token = await getAccessToken();

  const response = await fetch(
    `https://api.livepix.gg/v2/messages/${messageId}`,
    {
      headers: {
        "Authorization": `Bearer ${token}`
      }
    }
  );

  if (!response.ok) {

    const error = await response.text();

    throw new Error(
      `Erro ao consultar mensagem: ${response.status} ${error}`
    );

  }

  return await response.json();
}


// ========================================
// PÁGINA INICIAL
// ========================================

app.get("/", (req, res) => {

  res.json({
    status: "online",
    latestLivePix
  });

});


// ========================================
// LISTAR WEBHOOKS
// ========================================

app.get("/api/webhooks", async (req, res) => {

  try {

    const webhooks = await getWebhooks();

    res.json(webhooks);

  } catch (error) {

    console.error(
      "Erro ao consultar webhooks:",
      error.message
    );

    res.status(500).json({
      error: error.message
    });

  }

});


// ========================================
// WEBHOOK LIVEPIX
// ========================================

app.post("/webhook/livepix", async (req, res) => {

  console.log("=== LIVEPIX WEBHOOK ===");

  console.log(
    JSON.stringify(req.body, null, 2)
  );

  // Responde imediatamente ao LivePix
  res.sendStatus(200);

  try {

    const data = req.body;

    if (
      data.event !== "new" ||
      !data.resource ||
      !data.resource.id
    ) {

      console.log("Evento ignorado.");

      return;
    }

    const resourceId = data.resource.id;

    console.log(
      "Recurso recebido:",
      resourceId
    );

    console.log(
      "Tipo:",
      data.resource.type
    );


    // ========================================
    // PAGAMENTO
    // ========================================

    if (data.resource.type === "payment") {

      const payment = await getPayment(resourceId);

      console.log("=== PAGAMENTO ===");

      console.log(
        JSON.stringify(payment, null, 2)
      );

      const paymentData =
        payment.data || payment;

      latestLivePix = {

        name: "LivePix",

        amount:
          paymentData.amount ?? null,

        currency:
          paymentData.currency ?? null,

        updatedAt:
          new Date().toISOString()

      };

    }


    // ========================================
    // MENSAGEM
    // ========================================

    if (data.resource.type === "message") {

      const message = await getMessage(resourceId);

      console.log("=== MENSAGEM ===");

      console.log(
        JSON.stringify(message, null, 2)
      );

      const messageData =
        message.data || message;

      latestLivePix = {

        name:
          messageData.username ||
          "LivePix",

        amount:
          messageData.amount ?? null,

        currency:
          messageData.currency ?? null,

        updatedAt:
          new Date().toISOString()

      };

    }


    console.log(
      "=== ÚLTIMO LIVEPIX ==="
    );

    console.log(
      JSON.stringify(
        latestLivePix,
        null,
        2
      )
    );

  } catch (error) {

    console.error(
      "Erro processando LivePix:",
      error
    );

  }

});


// ========================================
// API PARA O OVERLAY
// ========================================

app.get("/api/latest", (req, res) => {

  res.json(latestLivePix);

});


// ========================================
// INICIAR SERVIDOR
// ========================================

app.listen(
  PORT,
  "0.0.0.0",
  () => {

    console.log(
      `Servidor rodando na porta ${PORT}`
    );

  }
);