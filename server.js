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

  // Renova 1 minuto antes de expirar
  tokenExpiresAt =
    Date.now() + ((data.expires_in - 60) * 1000);

  return accessToken;
}


// ========================================
// CRIAR WEBHOOK
// ========================================

async function createWebhook() {

  try {

    const token = await getAccessToken();

    const response = await fetch(
      "https://api.livepix.gg/v2/webhooks",
      {
        method: "POST",

        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },

        body: JSON.stringify({
          url: `https://livepix-overlay.onrender.com/webhook/livepix`
        })
      }
    );

    const data = await response.text();

    console.log("=== CRIAÇÃO DO WEBHOOK ===");
    console.log(response.status);
    console.log(data);

  } catch (error) {

    console.error(
      "Erro ao criar webhook:",
      error.message
    );

  }

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
// PÁGINA INICIAL
// ========================================

app.get("/", (req, res) => {

  res.json({
    status: "online",
    latestLivePix
  });

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

      console.log(
        "Evento ignorado."
      );

      return;
    }

    const paymentId = data.resource.id;

    console.log(
      "Pagamento recebido:",
      paymentId
    );

    const payment = await getPayment(
      paymentId
    );

    console.log(
      "=== PAGAMENTO COMPLETO ==="
    );

    console.log(
      JSON.stringify(payment, null, 2)
    );

    const paymentData =
      payment.data || payment;

    /*
      O endpoint de pagamentos fornece:
      id
      proof
      reference
      amount
      currency
      createdAt

      O nome/mensagem do doador pode estar
      disponível através dos dados relacionados
      ao pagamento.
    */

    latestLivePix = {

      name:
        paymentData.username ||
        paymentData.name ||
        "LivePix",

      amount:
        paymentData.amount ?? null,

      currency:
        paymentData.currency ?? null,

      updatedAt:
        new Date().toISOString()

    };

    console.log(
      "=== ÚLTIMO LIVEPIX ATUALIZADO ==="
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
  async () => {

    console.log(
      `Servidor rodando na porta ${PORT}`
    );

    await createWebhook();

  }
);