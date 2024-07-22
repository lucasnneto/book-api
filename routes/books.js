// routes/books.js
const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const Book = require("../models/Book");
const User = require("../models/User");

// Obter todos os livros
router.get("/", async (req, res) => {
  try {
    const { query } = req.query;
    if (query) {
      const users = await User.find({
        username: { $regex: query, $options: "i" },
      });
      const userIds = users.map((user) => user._id);

      const books = await Book.find({
        $or: [
          { title: { $regex: query, $options: "i" } },
          { author: { $regex: query, $options: "i" } },
          { owner: { $in: userIds } },
        ],
      }).populate("owner borrowedBy");

      res.json(books);
    } else {
      const books = await Book.find().populate("owner borrowedBy");
      res.json(books);
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Adicionar livro
router.post("/", verifyToken, async (req, res) => {
  const { title, author } = req.body;
  try {
    const newBook = new Book({
      title,
      author,
      owner: req.user.id,
    });

    const savedBook = await newBook.save();

    res.json(savedBook);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Atualizar livro
router.put("/:id", verifyToken, async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) return res.status(404).json({ message: "Livro não encontrado" });

    if (book.owner.toString() !== req.user.id)
      return res.status(401).json({ message: "Não autorizado" });

    book.title = req.body.title || book.title;
    book.author = req.body.author || book.author;

    const updatedBook = await book.save();
    res.json(updatedBook);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Excluir livro
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) return res.status(404).json({ message: "Livro não encontrado" });

    if (book.owner.toString() !== req.user.id)
      return res.status(401).json({ message: "Não autorizado" });

    await Book.findByIdAndDelete(req.params.id);
    res.json({ message: "Livro removido" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Emprestar livro para alguém
router.post("/:id/borrow", verifyToken, async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) return res.status(404).json({ message: "Livro não encontrado" });

    if (book.owner.toString() === req.user.id) {
      book.borrowedBy = req.body.userId;
      const updatedBook = await book.save();
      res.json(updatedBook);
    } else {
      res
        .status(401)
        .json({ message: "Não autorizado a emprestar este livro" });
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Devolver livro
router.post("/:id/return", verifyToken, async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) return res.status(404).json({ message: "Livro não encontrado" });

    if (book.owner.toString() === req.user.id) {
      book.borrowedBy = null;
      const updatedBook = await book.save();
      res.json(updatedBook);
    } else {
      res.status(401).json({ message: "Não autorizado a devolver este livro" });
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Middleware para verificar token
function verifyToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) return res.status(401).json({ message: "Autorização negada" });

  try {
    const decoded = jwt.verify(token, "secretKey");
    req.user = decoded;
    next();
  } catch (err) {
    console.log(err);
    res.status(403).json({ message: "Token inválido" });
  }
}

module.exports = router;
