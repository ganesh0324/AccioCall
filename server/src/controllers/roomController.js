const prisma = require("../config/db");

// Create a new room
const createRoom = async (req, res) => {
    try {
        const { roomName } = req.body;

        const newRoom = await prisma.room.create({
            data: {
                roomName,
                hostId: req.user.userId
            }
        });

        res.status(201).json(newRoom);

    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: "Server error while creating room"
        });
    }
};

// Get all rooms
const getRooms = async (req, res) => {
    try {
        const rooms = await prisma.room.findMany();

        res.status(200).json(rooms);

    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: "Server error while fetching rooms"
        });
    }
};

// Delete a room
const deleteRoom = async (req, res) => {
    try {
        const roomId = req.params.id;

        // Find room first
        const room = await prisma.room.findUnique({
            where: {
                id: parseInt(roomId)
            }
        });

        // Check if room exists
        if (!room) {
            return res.status(404).json({
                message: "Room not found"
            });
        }

        // Only owner can delete
        if (room.hostId !== req.user.userId) {
            return res.status(403).json({
                message: "You are not authorized to delete this room"
            });
        }

        // Delete room
        await prisma.room.delete({
            where: {
                id: parseInt(roomId)
            }
        });

        res.status(200).json({
            message: "Room deleted successfully"
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: "Server error while deleting room"
        });
    }
};

module.exports = {
    createRoom,
    getRooms,
    deleteRoom
};