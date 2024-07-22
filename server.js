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

app.use("/users", userRoutes);
app.use("/books", bookRoutes);
app.get("/", (req, res) => res.send("Express on Vercel."));
// Inicialização do servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
module.exports = app;
