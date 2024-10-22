// routes/books.js
const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const Book = require("../models/Book");
const User = require("../models/User");
const mongoose = require("mongoose");

router.get("/", async (req, res) => {
  try {
    const { filter, owner } = req.query;

    // Objeto para armazenar as condições de filtro
    let query = {};

    // Se o parâmetro "filter" for passado, filtra por title, author, borrowedTo ou series
    if (filter) {
      const filterRaw = removeAccents(filter.toUpperCase().replace(/ /g, ""));
      query.$or = [
        { titleRaw: { $regex: filterRaw, $options: "i" } }, // Busca por título (insensitive)
        { authorRaw: { $regex: filterRaw, $options: "i" } }, // Busca por autor (insensitive)
        { seriesRaw: { $regex: filterRaw, $options: "i" } }, // Busca por série (insensitive)
      ];
    }

    // Se o parâmetro "owner" for passado, filtra pelos livros do dono especificado
    if (owner) {
      query.owner = owner;
    }

    // Busca os livros que atendem aos critérios
    const books = await Book.find(query).populate("owner", "username");

    res.status(200).json(books);
  } catch (error) {
    res.status(500).json({ message: "Erro ao buscar livros", error });
  }
});

// Obter todos os livros
router.get("/series", async (req, res) => {
  try {
    const pipeline = [
      {
        $lookup: {
          from: "users",
          localField: "owner",
          foreignField: "_id",
          as: "ownerDetails",
        },
      },
      {
        $unwind: "$ownerDetails",
      },
      {
        $project: {
          "ownerDetails.password": 0,
        },
      },
      {
        $group: {
          _id: "$series",
          books: {
            $push: {
              _id: "$_id",
              title: "$title",
              author: "$author",
              owner: "$ownerDetails",
              borrowedTo: "$borrowedTo",
            },
          },
          count: {
            $sum: 1,
          },
        },
      },
      {
        $project: {
          series: "$_id",
          books: "$books",
          count: "$count",
          _id: 0,
        },
      },
    ];
    const { filter, owner } = req.query;
    if (owner) {
      pipeline.unshift({
        $match: {
          owner: new mongoose.Types.ObjectId(owner),
        },
      });
    } else if (filter) {
      const users = await User.find({
        username: { $regex: filter, $options: "i" },
      });
      const filterRaw = removeAccents(filter.toUpperCase().replace(/ /g, ""));
      const userIds = users.map((user) => user._id);
      pipeline.unshift({
        $match: {
          $or: [
            { titleRaw: { $regex: filterRaw, $options: "i" } },
            { authorRaw: { $regex: filterRaw, $options: "i" } },
            { seriesRaw: { $regex: filterRaw, $options: "i" } },
            { owner: { $in: userIds } },
          ],
        },
      });
    }

    const books = await Book.aggregate([pipeline]);
    res.json(books);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Adicionar VARIOS livro
router.post("/", verifyToken, async (req, res) => {
  const { books } = req.body;
  const booksMap = books.map((book) => ({
    ...book,
    series: book.series ? book.series.trim() : null,
    title: book.title.trim(),
    author: book.author.trim(),
    titleRaw: removeAccents(book.title.toUpperCase().replace(/ /g, "")),
    seriesRaw: book.series
      ? removeAccents(book.series.toUpperCase().replace(/ /g, ""))
      : null,
    authorRaw: removeAccents(book.author.toUpperCase().replace(/ /g, "")),
    owner: new mongoose.Types.ObjectId(req.user.id),
  }));
  try {
    const savedBook = await Book.insertMany(booksMap);

    res.json(savedBook);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Atualizar livro
router.put("/", verifyToken, async (req, res) => {
  try {
    const { ids, books } = req.body;
    //TODO FAZER MAP DE RAW - MESMO DO POST
    const book = await Book.find({
      _id: ids.map((id) => new mongoose.Types.ObjectId(id)),
      owner: new mongoose.Types.ObjectId(req.user.id),
    });

    if (book.length !== ids.length)
      return res.status(401).json({ message: "Não autorizado" });

    //BUG ALTERAR CODIGO PARA PARA USAR MAP E PASSAR DE 1 POR UM
    const updatedBook = await Book.updateMany(
      {
        _id: ids.map((id) => new mongoose.Types.ObjectId(id)),
      },
      books
    );

    res.json(updatedBook);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Excluir livro
router.post("/delete", verifyToken, async (req, res) => {
  try {
    const { ids } = req.body;
    const book = await Book.find({
      _id: ids.map((id) => new mongoose.Types.ObjectId(id)),
      owner: new mongoose.Types.ObjectId(req.user.id),
    });

    if (book.length !== ids.length)
      return res.status(401).json({ message: "Não autorizado" });

    await Book.deleteMany({
      _id: ids.map((id) => new mongoose.Types.ObjectId(id)),
    });

    await Book.findByIdAndDelete(req.params.id);
    res.json({ message: "Livros removidos" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Emprestar livro para alguém
router.post("/borrow", verifyToken, async (req, res) => {
  try {
    const { idsBook, nameBorrow } = req.body;
    const book = await Book.find({
      _id: idsBook.map((id) => new mongoose.Types.ObjectId(id)),
      owner: new mongoose.Types.ObjectId(req.user.id),
    });

    if (book.length !== idsBook.length)
      return res.status(401).json({ message: "Não autorizado" });

    await Book.updateMany(
      {
        _id: idsBook.map((id) => new mongoose.Types.ObjectId(id)),
      },
      {
        borrowedTo: nameBorrow.trim(),
      }
    );
    res.json({ message: "Livros Atualizados" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Devolver livro
router.post("/return", verifyToken, async (req, res) => {
  try {
    const { idsBook } = req.body;
    const book = await Book.find({
      _id: idsBook.map((id) => new mongoose.Types.ObjectId(id)),
      owner: new mongoose.Types.ObjectId(req.user.id),
    });

    if (book.length !== idsBook.length)
      return res.status(401).json({ message: "Não autorizado" });

    await Book.updateMany(
      {
        _id: idsBook.map((id) => new mongoose.Types.ObjectId(id)),
      },
      {
        borrowedTo: null,
      },
      {
        new: true,
      }
    );
    res.json({ message: "Livros Atualizados" });
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
function removeAccents(str) {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

module.exports = router;
