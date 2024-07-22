const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const app = express();
const cors = require("cors");

// Configuração do CORS
app.use(cors());

// Configuração do body-parser
app.use(bodyParser.json());

// Conexão com o banco de dados MongoDB
mongoose.connect(process.env.MONGO_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Rotas
const userRoutes = require("./routes/users");
const bookRoutes = require("./routes/books");

app.use("/api/users", userRoutes);
app.use("/api/books", bookRoutes);

// Inicialização do servidor
const PORT = process.env.PORT;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
