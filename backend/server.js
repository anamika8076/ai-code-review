require("dotenv").config();

const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");

const reviewRoutes = require("./routes/reviewRoutes");

const app = express();


// -------- MIDDLEWARE --------

// Enable CORS
app.use(cors());

// Log requests
app.use(morgan("dev"));

// Limit request size
app.use(express.json({ limit: "1mb" }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 50,
  message: {
    error: "Too many requests. Please try again later."
  }
});

app.use(limiter);


// -------- ROUTES --------

app.use("/api/reviews", reviewRoutes);


// -------- GLOBAL ERROR HANDLER --------

app.use((err, req, res, next) => {

  console.error(err);

  res.status(500).json({
    error: "Internal server error"
  });

});



// -------- SERVER START --------

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {

  console.log(`🚀 Server running on port ${PORT}`);

});




