import express from "express";
import axios from "axios";
import cors from "cors";
import 'dotenv/config'

const app = express();

app.use(express.json());

app.use(
  cors({
    origin: "*",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Origin", "Content-Type", "Accept", "Authorization", "X-Request-With"],
  })
);

app.post("/api/getDocuments", async (request, response) => {
  try {
    const resData = await axios.post(`${process.env.QUATENUS_API_BASE_URL}/json/GetDocuments`, request.body);
    response.json(resData.data);
  } catch (error) {
    console.error("Erro (GetDocuments):", error.message);
    response.status(500).json({ error: "Erro ao consultar a API da Quatenus" });
  }
});

app.post("/api/getExternalContractItems", async (request, response) => {
  try {
    const resData = await axios.post(`${process.env.QUATENUS_API_BASE_URL}/GetExternalContractsItems`, request.body);
    response.json(resData.data);
  } catch (error) {
    console.error("Erro (GetExternalContractsItems):", error.message);
    response.status(500).json({ error: "Erro ao consultar a API da Quatenus" });
  }
});

app.post("/api/GetExternalContractsItemsDevices", async (request, response) => {
  try {
    const resData = await axios.post(`${process.env.QUATENUS_API_BASE_URL}/GetExternalContractsItemsDevices`, request.body);
    response.json(resData.data);
  } catch (error) {
    console.error("Erro (GetExternalContractsItemsDevices):", error.message);
    response.status(500).json({ error: "Erro ao consultar a API da Quatenus" });
  }
});

const PORT = process.env.PORT || 5556;

app.listen(PORT, () => {
  console.log(`Backend Rodando na porta ${PORT}`);
});
