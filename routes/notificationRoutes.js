const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middlewares/authMiddleware');
const notificationController = require('../controllers/notificationController');

/**
 * Client & Admin: Historique des notifications
 */
router.get('/', authMiddleware, notificationController.getNotifications);
router.put('/read', authMiddleware, notificationController.markAsRead);

module.exports = router;
