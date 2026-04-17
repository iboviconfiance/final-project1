const cron = require('node-cron');
const { Op } = require('sequelize');
const { Subscription, User, Plan, Organization } = require('../models');
const { sendExpirationAlert } = require('./notificationService');

/**
 * ============================================================
 * SERVICE CRON — Tâches Planifiées (Relances / Expirations)
 * ============================================================
 * 
 * Exécute des tâches en arrière-plan automatiquement (ex: vérifier
 * les abonnements expirés ou sur le point de l'être).
 */

const initCronJobs = () => {
  console.log('⏱️  CronService: Initialisation des tâches planifiées...');

  // 1. Relances : Abonnements qui expirent dans exactement 3 jours
  // Tourne tous les jours à 08h00 du matin
  cron.schedule('0 8 * * *', async () => {
    console.log('⏱️  CronService: Exécution de la vérification des expirations (J-3)...');
    try {
      const today = new Date();
      // On cible J+3
      const targetDateStart = new Date(today);
      targetDateStart.setDate(today.getDate() + 3);
      targetDateStart.setHours(0, 0, 0, 0);

      const targetDateEnd = new Date(today);
      targetDateEnd.setDate(today.getDate() + 3);
      targetDateEnd.setHours(23, 59, 59, 999);

      // Trouver les abonnements concernés
      const expiringSubscriptions = await Subscription.findAll({
        where: {
          endDate: { [Op.between]: [targetDateStart, targetDateEnd] },
          status: 'active'
        },
        include: [
          { model: User, as: 'user' },
          { model: Plan, as: 'plan', include: [{ model: Organization, as: 'organization' }] }
        ]
      });

      console.log(`⏱️  CronService: ${expiringSubscriptions.length} abonnement(s) expire(nt) dans 3 jours.`);

      for (const sub of expiringSubscriptions) {
        if (!sub.user || !sub.plan || !sub.plan.organization) continue;

        // Préparer les données pour le template email/SMS
        const emailData = {
          planName: sub.plan.name,
          daysRemaining: 3,
          endDate: sub.endDate,
          graceDays: sub.plan.organization.settings?.billing?.grace_period_days || 3,
          orgName: sub.plan.organization.name,
          renewUrl: `${process.env.APP_URL || 'http://localhost:3000'}/client/renew` // Lier vers le front client
        };

        // Envoi de la notification
        await sendExpirationAlert(sub.user.email, emailData);
      }
    } catch (err) {
      console.error('❌ CronService Erreur (Expirations J-3):', err);
    }
  });

  // 2. Tâche de passage au statut "grace_period" ou "expired"
  // Tourne tous les jours à 00h01
  cron.schedule('1 0 * * *', async () => {
    console.log('⏱️  CronService: Mise à jour des statuts d\'abonnement expirés...');
    try {
      const now = new Date();

      // Trouver tous les abonnements passés mais encore "active" ou "grace_period"
      const expiredSubs = await Subscription.findAll({
        where: {
          endDate: { [Op.lt]: now },
          status: { [Op.in]: ['active', 'grace_period'] }
        },
        include: [{ model: Plan, as: 'plan', include: [{ model: Organization, as: 'organization' }] }]
      });

      let graceCount = 0;
      let expiredCount = 0;

      for (const sub of expiredSubs) {
        const graceDays = sub.plan?.organization?.settings?.billing?.grace_period_days || 0;
        const cutoffDate = new Date(sub.endDate);
        cutoffDate.setDate(cutoffDate.getDate() + graceDays);

        if (now > cutoffDate) {
          // Hors période de grâce -> expiré completement
          await sub.update({ status: 'expired' });
          expiredCount++;
        } else if (sub.status === 'active') {
          // Entre la fin d'abonnement et la fin de grace period -> passe en grace_period
          await sub.update({ status: 'grace_period' });
          graceCount++;
        }
      }

      console.log(`⏱️  CronService: ${graceCount} abonnements mis en grace_period, ${expiredCount} mis en expired.`);
    } catch (err) {
      console.error('❌ CronService Erreur (Mise à jour statuts):', err);
    }
  });

  // 3. Archivage des notifications (Double Stockage)
  // Tourne une fois par semaine (dimanche à 03h00)
  cron.schedule('0 3 * * 0', async () => {
    console.log('⏱️  CronService: Nettoyage et Archivage des Notifications...');
    try {
      const { Notification, NotificationArchive } = require('../models');
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

      // A) Trouver toutes les notifications de plus de 90 jours
      const oldNotifs = await Notification.findAll({
        where: { createdAt: { [Op.lt]: ninetyDaysAgo } }
      });

      if (oldNotifs.length > 0) {
        // B) Transférer dans l'archive
        const archiveData = oldNotifs.map(n => ({
          id: n.id,
          userId: n.userId,
          organizationId: n.organizationId,
          type: n.type,
          title: n.title,
          message: n.message,
          data: n.data,
          isRead: n.isRead,
          severityLevel: n.severityLevel,
          originalCreatedAt: n.createdAt
        }));
        await NotificationArchive.bulkCreate(archiveData, { ignoreDuplicates: true });

        // C) Supprimer de la table active (elles sont maintenant dans l'archive)
        await Notification.destroy({
          where: { id: { [Op.in]: oldNotifs.map(n => n.id) } }
        });
        console.log(`❕ CronService: ${archiveData.length} notifications archivées.`);
      }

      // D) Purge de l'archive: Supprimer definitivement info/success
      const deletedInfo = await NotificationArchive.destroy({
        where: {
          severityLevel: { [Op.in]: ['info', 'success'] }
        }
      });

      // E) Purge de l'archive: Supprimer definitivement > 1 an
      const deletedDanger = await NotificationArchive.destroy({
        where: {
          originalCreatedAt: { [Op.lt]: oneYearAgo }
        }
      });

      console.log(`❕ CronService: Purge definitive -> ${deletedInfo} mineures (> 90j), ${deletedDanger} majeures (> 1 an).`);
    } catch (err) {
      console.error('❌ CronService Erreur (Archivage Notifs):', err);
    }
  });
};

module.exports = { initCronJobs };
