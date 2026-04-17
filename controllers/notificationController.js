const { Notification } = require('../models');

/**
 * GET /api/notifications
 * Récupérer l'historique des notifications de l'utilisateur (paginée)
 */
async function getNotifications(req, res) {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const { count, rows } = await Notification.findAndCountAll({
      where: { userId },
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    const unreadCount = await Notification.count({
      where: { userId, isRead: false }
    });

    return res.json({
      data: rows,
      meta: {
        total: count,
        unreadCount,
        page: parseInt(page),
        totalPages: Math.ceil(count / limit)
      }
    });
  } catch (err) {
    console.error('Erreur getNotifications:', err);
    return res.status(500).json({ error: 'Erreur serveur.' });
  }
}

/**
 * PUT /api/notifications/read
 * Marquer une notification comme lue, ou toutes si id non fourni
 */
async function markAsRead(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.body;

    if (id) {
      await Notification.update({ isRead: true }, { where: { id, userId } });
    } else {
      await Notification.update({ isRead: true }, { where: { userId, isRead: false } });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('Erreur markAsRead:', err);
    return res.status(500).json({ error: 'Erreur serveur.' });
  }
}

module.exports = {
  getNotifications,
  markAsRead
};
