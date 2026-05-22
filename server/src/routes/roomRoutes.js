const express = require('express');
const { createRoom, getRooms, deleteRoom } = require('../controllers/roomController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/create', protect, createRoom);
router.get('/', protect, getRooms);
router.delete('/:id', protect, deleteRoom);

module.exports = router;