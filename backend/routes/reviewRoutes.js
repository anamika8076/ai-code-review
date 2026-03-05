const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/reviewController');

// Create a new review
router.post('/', reviewController.reviewCode);




module.exports = router;