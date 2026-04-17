/**
 * ============================================================
 * SERVICE D'ABONNEMENT — Logique métier pure
 * ============================================================
 * 
 * LOGIQUE MATHÉMATIQUE DE TRANSITION DES STATUTS :
 * 
 * On utilise une approche "Lazy Evaluation" (évaluation paresseuse).
 * Au lieu d'un cron job qui tourne en permanence pour mettre à jour
 * les statuts, on calcule le statut RÉEL à chaque vérification d'accès.
 * 
 * ┌─────────────────────────────────────────────────────────────┐
 * │                    TIMELINE D'UN ABONNEMENT                │
 * │                                                             │
 * │  startDate          endDate        endDate + GRACE          │
 * │     │                  │                │                   │
 * │     ▼                  ▼                ▼                   │
 * │  ───┼──────────────────┼────────────────┼──────────▶ temps  │
 * │     │    ACTIVE        │  GRACE_PERIOD  │  EXPIRED          │
 * │     │   (accès OK)     │  (accès OK*)   │  (accès REFUSÉ)   │
 * │                                                             │
 * │  * Grace Period = avertissement, pas de coupure immédiate   │
 * └─────────────────────────────────────────────────────────────┘
 * 
 * FORMULES :
 * 
 *   endDate = startDate + duration_days
 *   graceDeadline = endDate + GRACE_PERIOD_DAYS
 * 
 *   Si now ≤ endDate                     → status = 'active'
 *   Si endDate < now ≤ graceDeadline      → status = 'grace_period'
 *   Si now > graceDeadline                → status = 'expired'
 * 
 * Le statut en BDD est mis à jour "à la demande" (write-through)
 * lors de chaque appel à computeSubscriptionStatus().
 * Cela élimine tout besoin de cron et garantit la cohérence.
 */

const { Subscription, Plan, Transaction, sequelize } = require('../models');

// ============================================================
// CONSTANTES
// ============================================================

/** Nombre de jours de grâce après expiration */
const GRACE_PERIOD_DAYS = 3;

// ============================================================
// FONCTIONS UTILITAIRES
// ============================================================

/**
 * Calcule la date de fin d'abonnement à partir de la date de début
 * et de la durée du plan en jours.
 * 
 * @param {Date} startDate - Date de début de l'abonnement
 * @param {number} durationDays - Durée du plan en jours
 * @returns {Date} La date de fin calculée
 * 
 * Formule : endDate = startDate + (durationDays × 86400000 ms)
 */
const calculateEndDate = (startDate, durationDays) => {
  const start = new Date(startDate);
  const end = new Date(start.getTime() + (durationDays * 24 * 60 * 60 * 1000));
  return end;
};

/**
 * Calcule le statut réel d'un abonnement en fonction du temps actuel.
 * C'est le cœur de la Lazy Evaluation.
 * 
 * @param {Date} endDate - Date de fin de l'abonnement
 * @returns {{ status: string, isAccessAllowed: boolean, daysRemaining: number, graceRemaining: number }}
 * 
 * Mathématiquement :
 *   daysRemaining = ceil((endDate - now) / 86400000)
 *   graceRemaining = ceil((graceDeadline - now) / 86400000)
 */
const computeSubscriptionStatus = (endDate) => {
  const now = new Date();
  const end = new Date(endDate);
  const graceDeadline = new Date(end.getTime() + (GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000));

  const msPerDay = 24 * 60 * 60 * 1000;
  const daysRemaining = Math.ceil((end.getTime() - now.getTime()) / msPerDay);
  const graceRemaining = Math.ceil((graceDeadline.getTime() - now.getTime()) / msPerDay);

  // Cas 1 : now ≤ endDate → ACTIVE
  if (now <= end) {
    return {
      status: 'active',
      isAccessAllowed: true,
      daysRemaining,
      graceRemaining: GRACE_PERIOD_DAYS
    };
  }

  // Cas 2 : endDate < now ≤ graceDeadline → GRACE_PERIOD
  if (now <= graceDeadline) {
    return {
      status: 'grace_period',
      isAccessAllowed: true, // Accès maintenu pendant la période de grâce
      daysRemaining: 0,
      graceRemaining
    };
  }

  // Cas 3 : now > graceDeadline → EXPIRED
  return {
    status: 'expired',
    isAccessAllowed: false,
    daysRemaining: 0,
    graceRemaining: 0
  };
};

/**
 * Synchronise le statut d'un abonnement en BDD si le statut calculé
 * diffère du statut stocké. (Write-through cache pattern)
 * 
 * @param {Subscription} subscription - L'instance Sequelize de l'abonnement
 * @returns {Promise<{ subscription: Subscription, statusInfo: object }>}
 */
const syncSubscriptionStatus = async (subscription) => {
  const statusInfo = computeSubscriptionStatus(subscription.endDate);

  // Mise à jour en BDD uniquement si le statut a changé
  if (subscription.status !== statusInfo.status) {
    subscription.status = statusInfo.status;
    await subscription.save();
  }

  return { subscription, statusInfo };
};

/**
 * Crée un abonnement complet avec transaction de paiement.
 * Tout est encapsulé dans une transaction SQL pour l'atomicité.
 * 
 * @param {object} params
 * @param {string} params.userId - UUID de l'utilisateur
 * @param {string} params.planId - UUID du plan choisi
 * @param {string} params.organizationId - UUID de l'organisation (sécurité)
 * @param {string} params.paymentMethod - Méthode de paiement
 * @param {string|null} params.providerRef - Référence fournisseur (Mobile Money)
 * @param {object} params.metadata - Métadonnées supplémentaires
 * @returns {Promise<{ subscription: Subscription, transaction: Transaction }>}
 */
const createSubscription = async ({ userId, planId, organizationId, paymentMethod, providerRef = null, metadata = {} }) => {
  const t = await sequelize.transaction();

  try {
    // 1. Récupérer le plan ET vérifier qu'il appartient à la bonne organisation
    const plan = await Plan.findOne({
      where: {
        id: planId,
        organizationId,  // SÉCURITÉ : isolation multi-tenant
        is_active: true
      },
      transaction: t
    });

    if (!plan) {
      throw new Error('Plan introuvable ou inactif pour votre organisation.');
    }

    // 2. Vérifier qu'il n'y a pas déjà un abonnement actif sur ce plan
    const existingActive = await Subscription.findOne({
      where: {
        userId,
        planId,
        status: ['active', 'grace_period']
      },
      transaction: t
    });

    if (existingActive) {
      throw new Error('Vous avez déjà un abonnement actif ou en période de grâce pour ce plan.');
    }

    // 3. Calculer les dates
    const startDate = new Date();
    const endDate = calculateEndDate(startDate, plan.duration_days);

    // 4. Créer la transaction de paiement
    const paymentTransaction = await Transaction.create({
      userId,
      amount: plan.price,
      currency: 'XAF',
      paymentMethod,
      status: 'success', // En prod, ceci serait 'pending' jusqu'à confirmation du provider
      providerRef,
      metadata
    }, { transaction: t });

    // 5. Créer l'abonnement (actif car le paiement est validé)
    const subscription = await Subscription.create({
      userId,
      planId,
      startDate,
      endDate,
      status: 'active',
      autoRenew: false
    }, { transaction: t });

    // 6. Lier la transaction à l'abonnement
    paymentTransaction.subscriptionId = subscription.id;
    await paymentTransaction.save({ transaction: t });

    // 7. Commit
    await t.commit();

    return { subscription, transaction: paymentTransaction };

  } catch (error) {
    if (!t.finished) {
      await t.rollback();
    }
    throw error;
  }
};

/**
 * Récupère l'abonnement actif d'un utilisateur avec statut synchronisé.
 * 
 * @param {string} userId - UUID de l'utilisateur
 * @returns {Promise<{ subscription: Subscription, statusInfo: object } | null>}
 */
const getActiveSubscription = async (userId) => {
  const subscription = await Subscription.findOne({
    where: {
      userId,
      status: ['active', 'grace_period', 'pending']
    },
    include: [{
      model: Plan,
      as: 'plan',
      attributes: ['id', 'name', 'price', 'duration_days']
    }],
    order: [['createdAt', 'DESC']]
  });

  if (!subscription) {
    return null;
  }

  // Synchroniser le statut avec la réalité temporelle
  return syncSubscriptionStatus(subscription);
};

/**
 * Récupère l'historique complet des abonnements d'un utilisateur.
 * 
 * @param {string} userId - UUID de l'utilisateur
 * @returns {Promise<Array>}
 */
const getSubscriptionHistory = async (userId) => {
  const subscriptions = await Subscription.findAll({
    where: { userId },
    include: [
      {
        model: Plan,
        as: 'plan',
        attributes: ['id', 'name', 'price', 'duration_days']
      },
      {
        model: Transaction,
        as: 'transactions',
        attributes: ['id', 'amount', 'currency', 'paymentMethod', 'status', 'providerRef', 'createdAt']
      }
    ],
    order: [['createdAt', 'DESC']]
  });

  // Synchroniser le statut de chaque abonnement
  const results = [];
  for (const sub of subscriptions) {
    const { subscription, statusInfo } = await syncSubscriptionStatus(sub);
    results.push({
      subscription,
      statusInfo
    });
  }

  return results;
};

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  GRACE_PERIOD_DAYS,
  calculateEndDate,
  computeSubscriptionStatus,
  syncSubscriptionStatus,
  createSubscription,
  getActiveSubscription,
  getSubscriptionHistory
};
