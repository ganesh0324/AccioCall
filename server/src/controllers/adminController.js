const prisma = require("../config/db");

// List every user (never expose password hashes)
const listUsers = async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            select: {
                id: true,
                email: true,
                fullName: true,
                role: true,
                createdAt: true,
                _count: { select: { rooms: true } },
            },
            orderBy: { createdAt: "desc" },
        });

        res.status(200).json({ users });
    } catch (error) {
        console.error("Error listing users:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// List every room, with its host's basic info
const listRooms = async (req, res) => {
    try {
        const rooms = await prisma.room.findMany({
            include: {
                host: { select: { id: true, email: true, fullName: true } },
            },
            orderBy: { createdAt: "desc" },
        });

        res.status(200).json({ rooms });
    } catch (error) {
        console.error("Error listing rooms:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// Promote/demote a user. Prevents an admin from demoting themselves,
// which would otherwise lock them out with no other admin to undo it.
const updateUserRole = async (req, res) => {
    try {
        const userId = parseInt(req.params.id, 10);
        const { role } = req.body;

        if (!["USER", "ADMIN"].includes(role)) {
            return res.status(400).json({ message: "Role must be USER or ADMIN" });
        }

        if (userId === req.user.userId && role === "USER") {
            return res.status(400).json({ message: "You cannot remove your own admin access" });
        }

        const user = await prisma.user.update({
            where: { id: userId },
            data: { role },
            select: { id: true, email: true, fullName: true, role: true },
        });

        res.status(200).json({ user });
    } catch (error) {
        if (error.code === "P2025") {
            return res.status(404).json({ message: "User not found" });
        }
        console.error("Error updating user role:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// Delete a user. Their rooms are deleted first since Room.hostId
// is a required, restrict-on-delete foreign key.
const deleteUser = async (req, res) => {
    try {
        const userId = parseInt(req.params.id, 10);

        if (userId === req.user.userId) {
            return res.status(400).json({ message: "You cannot delete your own account" });
        }

        await prisma.$transaction([
            prisma.room.deleteMany({ where: { hostId: userId } }),
            prisma.user.delete({ where: { id: userId } }),
        ]);

        res.status(200).json({ message: "User deleted successfully" });
    } catch (error) {
        if (error.code === "P2025") {
            return res.status(404).json({ message: "User not found" });
        }
        console.error("Error deleting user:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// Admin-only room delete: unlike roomController.deleteRoom, not restricted to the host
const deleteRoomAsAdmin = async (req, res) => {
    try {
        const roomId = parseInt(req.params.id, 10);

        await prisma.room.delete({ where: { id: roomId } });

        res.status(200).json({ message: "Room deleted successfully" });
    } catch (error) {
        if (error.code === "P2025") {
            return res.status(404).json({ message: "Room not found" });
        }
        console.error("Error deleting room:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

module.exports = { listUsers, listRooms, updateUserRole, deleteUser, deleteRoomAsAdmin };
