const express = require('express');
const { registerUSER, loginUSER, logoutUSER, getMe} = require('../controllers/authController');
const router = express.Router();
const { protect }= require('../middleware/authMiddleware');


router.post('/register', registerUSER);
router.post('/login', loginUSER);
router.post('/logout', logoutUSER);
router.get('/me', protect, getMe);


module.exports = router;