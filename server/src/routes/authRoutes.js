const express = require('express');
const { registerUSER, loginUSER, logoutUSER, getMe, changePassword} = require('../controllers/authController');
const { createRoom, getRooms, deleteRoom } = require('../controllers/roomController');
const router = express.Router();
const { protect }= require('../middleware/authMiddleware');



router.post('/register', registerUSER);
router.post('/login', loginUSER);
router.post('/logout', logoutUSER);
router.get('/me', protect, getMe);
router.post('/change-password', protect, changePassword);
router.post('/rooms', protect, createRoom);
router.get('/rooms', protect, getRooms);
router.delete('/rooms/:id', protect, deleteRoom);

module.exports = router;
// code for auth routes, including user registration, login, logout, and room management (create, get, delete)