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

app.get("/", (req, res) => {
  res.json({
    status: "online",
    latestLivePix
  });
});

app.post("/webhook/livepix", (req, res) => {
  console.log("=== LIVEPIX WEBHOOK ===");
  console.log(JSON.stringify(req.body, null, 2));

  res.sendStatus(200);
});

app.get("/api/latest", (req, res) => {
  res.json(latestLivePix);
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});