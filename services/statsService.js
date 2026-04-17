/**
 * ============================================================
 * Stats Service — Moteur d'Analytique pour le Dashboard
 * ============================================================
 * 
 * Calcule en temps réel :
 * - MRR (Monthly Recurring Revenue)
 * - Taux de churn (désabonnement)
 * - Taux de renouvellement
 * - Prévisions du mois prochain
 * - Inscriptions et expirations par jour
 */

const { Transaction, Subscription, Plan, User, Organization, sequelize } = require('../models');
const { Op, fn, col, literal } = require('sequelize');

/**
 * Calcule le MRR (Monthly Recurring Revenue) d'une organisation.
 * MRR = Somme des prix mensuels équivalents de tous les abonnements actifs.
 */
async function calculateMRR(organizationId) {
  const activeSubs = await Subscription.findAll({
    where: { status: ['active', 'grace_period'] },
    include: [{
      model: Plan,
      as: 'plan',
      where: organizationId ? { organizationId } : {},
      required: true
    }]
  });

  let mrr = 0;
  for (const sub of activeSubs) {
    // Convertir le prix en équivalent mensuel
    const dailyPrice = sub.plan.price / (sub.plan.duration_days || 30);
    mrr += dailyPrice * 30;
  }

  return Math.round(mrr);
}

/**
 * Calcule le taux de churn sur les 30 derniers jours.
 * Churn = (abonnés expirés sans renouvellement / total actifs en début de période) × 100
 */
async function calculateChurnRate(organizationId) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const planWhere = organizationId ? { organizationId } : {};

  // Abonnements qui ont expiré dans les 30 derniers jours
  const expired = await Subscription.count({
    where: {
      status: 'expired',
      endDate: { [Op.between]: [thirtyDaysAgo, new Date()] }
    },
    include: [{ model: Plan, as: 'plan', where: planWhere, required: true }]
  });

  // Total d'abonnements actifs il y a 30 jours (actifs + expirés récemment)
  const totalAtStart = await Subscription.count({
    where: {
      [Op.or]: [
        { status: ['active', 'grace_period'] },
        {
          status: 'expired',
          endDate: { [Op.gte]: thirtyDaysAgo }
        }
      ]
    },
    include: [{ model: Plan, as: 'plan', where: planWhere, required: true }]
  });

  if (totalAtStart === 0) return 0;
  return Math.round((expired / totalAtStart) * 100 * 10) / 10;
}

/**
 * Calcule le taux de renouvellement sur les 30 derniers jours.
 */
async function calculateRenewalRate(organizationId) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const planWhere = organizationId ? { organizationId } : {};

  // Abonnements dont la date de fin est passée dans les 30 derniers jours
  const expiring = await Subscription.count({
    where: {
      endDate: { [Op.between]: [thirtyDaysAgo, new Date()] }
    },
    include: [{ model: Plan, as: 'plan', where: planWhere, required: true }]
  });

  // Parmi ceux-là, combien sont encore actifs (= renouvelés)
  const renewed = await Subscription.count({
    where: {
      endDate: { [Op.between]: [thirtyDaysAgo, new Date()] },
      status: ['active', 'grace_period']
    },
    include: [{ model: Plan, as: 'plan', where: planWhere, required: true }]
  });

  if (expiring === 0) return 100;
  return Math.round((renewed / expiring) * 100 * 10) / 10;
}

/**
 * Prévision des revenus du mois prochain.
 * Basée sur le MRR actuel × taux de renouvellement.
 */
async function calculateForecast(organizationId) {
  const mrr = await calculateMRR(organizationId);
  const renewalRate = await calculateRenewalRate(organizationId);
  const forecast = Math.round(mrr * (renewalRate / 100));
  return { mrr, renewalRate, forecastRevenue: forecast, currency: 'XAF' };
}

/**
 * Statistiques complètes du dashboard pour une organisation.
 */
async function getOrgDashboardStats(organizationId) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfWeek = new Date();
  endOfWeek.setDate(endOfWeek.getDate() + 7);

  const planWhere = organizationId ? { organizationId } : {};

  const [
    activeSubscriptions,
    expiringThisWeek,
    totalRevenue,
    revenueThisMonth,
    newUsersThisMonth,
    mrr,
    churnRate,
    renewalRate,
    transactionsByStatus
  ] = await Promise.all([
    // Abonnés actifs
    Subscription.count({
      where: { status: ['active', 'grace_period'] },
      include: [{ model: Plan, as: 'plan', where: planWhere, required: true }]
    }),

    // Expirent cette semaine
    Subscription.count({
      where: {
        status: ['active', 'grace_period'],
        endDate: { [Op.between]: [now, endOfWeek] }
      },
      include: [{ model: Plan, as: 'plan', where: planWhere, required: true }]
    }),

    // CA total
    Transaction.sum('amount', {
      where: { status: 'success' },
      include: [{ model: User, as: 'user', where: organizationId ? { organizationId } : {}, required: true }]
    }),

    // CA ce mois
    Transaction.sum('amount', {
      where: {
        status: 'success',
        createdAt: { [Op.gte]: startOfMonth }
      },
      include: [{ model: User, as: 'user', where: organizationId ? { organizationId } : {}, required: true }]
    }),

    // Nouveaux inscrits ce mois
    User.count({
      where: {
        organizationId: organizationId || { [Op.ne]: null },
        createdAt: { [Op.gte]: startOfMonth }
      }
    }),

    calculateMRR(organizationId),
    calculateChurnRate(organizationId),
    calculateRenewalRate(organizationId),

    // Transactions par statut
    Transaction.findAll({
      attributes: ['status', [fn('COUNT', col('Transaction.id')), 'count']],
      include: [{ model: User, as: 'user', where: organizationId ? { organizationId } : {}, required: true, attributes: [] }],
      group: ['Transaction.status'],
      raw: true
    })
  ]);

  const forecast = await calculateForecast(organizationId);

  return {
    overview: {
      activeSubscriptions,
      expiringThisWeek,
      newUsersThisMonth,
      totalRevenue: totalRevenue || 0,
      revenueThisMonth: revenueThisMonth || 0,
      currency: 'XAF'
    },
    analytics: {
      mrr,
      churnRate,
      renewalRate,
      forecast: forecast.forecastRevenue
    },
    transactions: transactionsByStatus.reduce((acc, t) => {
      acc[t.status] = parseInt(t.count);
      return acc;
    }, {})
  };
}

/**
 * Inscriptions par jour (30 derniers jours) pour un graphique.
 */
async function getDailySignups(organizationId, days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const results = await User.findAll({
    where: {
      organizationId: organizationId || { [Op.ne]: null },
      createdAt: { [Op.gte]: startDate }
    },
    attributes: [
      [fn('DATE', col('createdAt')), 'date'],
      [fn('COUNT', col('id')), 'count']
    ],
    group: [fn('DATE', col('createdAt'))],
    order: [[fn('DATE', col('createdAt')), 'ASC']],
    raw: true
  });

  return results.map(r => ({ date: r.date, count: parseInt(r.count) }));
}

module.exports = {
  calculateMRR,
  calculateChurnRate,
  calculateRenewalRate,
  calculateForecast,
  getOrgDashboardStats,
  getDailySignups
};
