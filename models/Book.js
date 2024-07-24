// models/Book.js
const mongoose = require("mongoose");

const BookSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    titleRaw: { type: String, required: true, select: false },
    author: { type: String, required: true },
    authorRaw: { type: String, required: true, select: false },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    borrowedTo: { type: String },
    series: { type: String },
    seriesRaw: { type: String, select: false },
  },
  {
    versionKey: false,
  }
);

module.exports = mongoose.model("Book", BookSchema);
