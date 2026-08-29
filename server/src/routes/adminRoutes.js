const express = require("express");
const {
    listUsers,
    listRooms,
    updateUserRole,
    deleteUser,
    deleteRoomAsAdmin,
} = require("../controllers/adminController");
const { protect, requireAdmin } = require("../middleware/authMiddleware");

const router = express.Router();

// Every route here requires a valid JWT AND a current ADMIN role
router.use(protect, requireAdmin);

router.get("/users", listUsers);
router.patch("/users/:id/role", updateUserRole);
router.delete("/users/:id", deleteUser);

router.get("/rooms", listRooms);
router.delete("/rooms/:id", deleteRoomAsAdmin);

module.exports = router;
