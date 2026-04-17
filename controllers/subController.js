const Joi = require('joi');
const { Plan, Transaction, Subscription, sequelize } = require('../models');
const subscriptionService = require('../services/subscriptionService');
const paymentManager = require('../services/payments/PaymentManager');
const discountService = require('../services/discountService');

// ============================================================
// SCHÉMAS DE VALIDATION
// ============================================================

const subscribeSchema = Joi.object({
  planId: Joi.string().uuid().required()
    .messages({
      'string.guid': 'L\'ID du plan doit être un UUID valide.',
      'any.required': 'L\'ID du plan est requis.'
    }),
  phoneNumber: Joi.string().pattern(/^\+?[0-9\s\-]{8,15}$/).required()
    .messages({
      'string.pattern.base': 'Numéro de téléphone invalide (ex: +242 06XXXXXXX).',
      'any.required': 'Le numéro de téléphone est requis.'
    }),
  paymentMethod: Joi.string().valid('mobile_money', 'card', 'bank_transfer', 'cash').required()
    .messages({
      'any.only': 'Méthode de paiement non supportée.',
      'any.required': 'La méthode de paiement est requise.'
    }),
  autoRenew: Joi.boolean().optional().default(false),
  metadata: Joi.object().optional().default({}),
  couponCode: Joi.string().optional().allow(null, '')
});

const createPlanSchema = Joi.object({
  name: Joi.string().min(2).max(100).required()
    .messages({
      'string.min': 'Le nom du plan doit contenir au moins 2 caractères.',
      'any.required': 'Le nom du plan est requis.'
    }),
  price: Joi.number().min(0).required()
    .messages({
      'number.min': 'Le prix ne peut pas être négatif.',
      'any.required': 'Le prix est requis.'
    }),
  duration_days: Joi.number().integer().min(1).required()
    .messages({
      'number.min': 'La durée doit être d\'au moins 1 jour.',
      'any.required': 'La durée en jours est requise.'
    }),
  description: Joi.string().optional().allow('', null)
});

// ============================================================
// CONTRÔLEURS
// ============================================================

/**
 * POST /api/subscriptions/plans
 * Crée un nouveau plan d'abonnement (admin uniquement).
 */
exports.createPlan = async (req, res) => {
  const { error, value } = createPlanSchema.validate(req.body, { abortEarly: false });
  if (error) {
    const messages = error.details.map(d => d.message);
    return res.status(400).json({ error: 'Erreur de validation.', details: messages });
  }

  try {
    const plan = await Plan.create({
      name: value.name,
      price: value.price,
      duration_days: value.duration_days,
      description: value.description || null,
      organizationId: req.user.organizationId
    });

    res.status(201).json({
      message: 'Plan créé avec succès.',
      data: { plan }
    });
  } catch (error) {
    console.error('Erreur création plan:', error);
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ error: 'Un plan avec ce nom existe déjà dans votre organisation.' });
    }
    res.status(500).json({ error: 'Erreur interne du serveur.' });
  }
};

/**
 * GET /api/subscriptions/plans
 * Liste les plans actifs de l'organisation de l'utilisateur.
 */
exports.getPlans = async (req, res) => {
  try {
    const plans = await Plan.findAll({
      where: {
        organizationId: req.user.organizationId,
        is_active: true
      },
      order: [['price', 'ASC']]
    });

    res.status(200).json({
      message: 'Plans récupérés avec succès.',
      data: { plans }
    });
  } catch (error) {
    console.error('Erreur récupération plans:', error);
    res.status(500).json({ error: 'Erreur interne du serveur.' });
  }
};

/**
 * POST /api/subscriptions/subscribe
 * ============================================================
 * FLOW SÉCURISÉ EN 2 PHASES :
 * 
 * PHASE 1 (ici) :
 *   1. Créer Transaction → status: 'pending'
 *   2. Créer Subscription → status: 'pending' (accès REFUSÉ)
 *   3. Appeler PaymentManager.initiatePayment() → routage auto
 *   4. Mettre à jour Transaction avec le providerRef
 * 
 * PHASE 2 (webhookController.confirmPayment) :
 *   5. Recevoir la confirmation du provider
 *   6. Valider signature + anti-replay
 *   7. Passer Transaction → 'success'
 *   8. Passer Subscription → 'active' (accès DÉBLOQUÉ)
 * 
 * L'accès n'est JAMAIS débloqué avant confirmation du paiement.
 * ============================================================
 */
exports.subscribe = async (req, res) => {
  const { error, value } = subscribeSchema.validate(req.body, { abortEarly: false });
  if (error) {
    const messages = error.details.map(d => d.message);
    return res.status(400).json({ error: 'Erreur de validation.', details: messages });
  }

  const t = await sequelize.transaction();

  try {
    // 1. Vérifier que le plan existe et appartient à l'organisation de l'utilisateur
    const plan = await Plan.findOne({
      where: {
        id: value.planId,
        organizationId: req.user.organizationId,
        is_active: true
      },
      transaction: t
    });

    if (!plan) {
      await t.rollback();
      return res.status(400).json({ error: 'Plan introuvable ou inactif pour votre organisation.' });
    }

    // 2. Vérifier qu'il n'y a pas déjà un abonnement actif sur ce plan
    const existingActive = await Subscription.findOne({
      where: {
        userId: req.user.id,
        planId: value.planId,
        status: ['active', 'grace_period']
      },
      transaction: t
    });

    if (existingActive) {
      await t.rollback();
      return res.status(400).json({ error: 'Vous avez déjà un abonnement actif pour ce plan.' });
    }

    // 3. Calculer les dates de l'abonnement
    const startDate = new Date();
    const endDate = subscriptionService.calculateEndDate(startDate, plan.duration_days);

    // 4. Calculer le PRIX FINAL via DiscountService (Sécurisé)
    const priceDetails = await discountService.calculateFinalPrice(
      plan.id,
      req.user.id,
      req.user.organizationId,
      value.couponCode
    );

    const checkAmount = parseFloat(priceDetails.finalPrice);

    // 5. Créer la Transaction de paiement → PENDING
    const paymentTransaction = await Transaction.create({
      userId: req.user.id,
      amount: checkAmount,
      currency: 'XAF',
      paymentMethod: value.paymentMethod,
      status: 'pending',         // ← PENDING jusqu'à confirmation webhook
      providerRef: null,         // ← Sera rempli après l'appel au provider
      providerName: null,
      metadata: {
        phoneNumber: value.phoneNumber,
        planName: plan.name,
        initiatedAt: new Date().toISOString(),
        couponId: priceDetails.couponId || null,
        discounts: priceDetails.discounts || []
      }
    }, { transaction: t });

    // 5. Créer l'Abonnement → PENDING (accès REFUSÉ)
    const subscription = await Subscription.create({
      userId: req.user.id,
      planId: plan.id,
      startDate,
      endDate,
      status: 'pending',        // ← PENDING = pas d'accès
      autoRenew: value.autoRenew
    }, { transaction: t });

    // 6. Lier la transaction à l'abonnement
    paymentTransaction.subscriptionId = subscription.id;
    await paymentTransaction.save({ transaction: t });

    // 7. Commit la transaction SQL AVANT l'appel au provider
    //    (pour que les données soient en BDD quand le webhook arrive)
    await t.commit();

    // 8. Initier le paiement via PaymentManager (routage automatique)
    //    Cette étape est HORS transaction car c'est un appel réseau externe
    try {
      const paymentResult = await paymentManager.initiatePayment({
        phoneNumber: value.phoneNumber,
        amount: checkAmount,
        currency: 'XAF',
        externalRef: paymentTransaction.id,  // Notre Transaction.id comme référence
        metadata: {
          description: `Abonnement ${plan.name}`,
          customerEmail: req.user.email,
          subscriptionId: subscription.id,
          ...value.metadata
        }
      });

      // 9. Mettre à jour la Transaction avec les infos du provider
      await paymentTransaction.update({
        providerRef: paymentResult.providerRef,
        providerName: paymentResult.providerName,
        metadata: {
          ...paymentTransaction.metadata,
          providerResponse: paymentResult.rawResponse,
          operatorDisplayName: paymentResult.operatorDisplayName
        }
      });

      // Réponse : paiement en attente de confirmation
      res.status(201).json({
        message: 'Paiement initié. En attente de confirmation de l\'opérateur.',
        data: {
          subscription: {
            id: subscription.id,
            startDate: subscription.startDate,
            endDate: subscription.endDate,
            status: 'pending',
            autoRenew: subscription.autoRenew
          },
          transaction: {
            id: paymentTransaction.id,
            amount: paymentTransaction.amount,
            currency: paymentTransaction.currency,
            paymentMethod: paymentTransaction.paymentMethod,
            status: 'pending',
            providerRef: paymentResult.providerRef,
            operator: paymentResult.operatorDisplayName
          },
          info: 'L\'abonnement sera activé automatiquement après confirmation du paiement.'
        }
      });

    } catch (paymentError) {
      // Si l'appel au provider échoue, marquer la transaction comme failed
      console.error('Erreur initiation paiement:', paymentError);
      await paymentTransaction.update({ status: 'failed' });
      await subscription.update({ status: 'expired' });

      return res.status(502).json({
        error: 'Erreur lors de l\'initiation du paiement.',
        details: paymentError.message
      });
    }

  } catch (error) {
    if (!t.finished) {
      await t.rollback();
    }
    console.error('Erreur souscription:', error);

    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ error: "Problème d'unicité. Réessayez." });
    }
    res.status(500).json({ error: 'Erreur interne du serveur.' });
  }
};

/**
 * GET /api/subscriptions/status
 * Statut en temps réel de l'abonnement avec lazy evaluation.
 */
exports.getStatus = async (req, res) => {
  try {
    const result = await subscriptionService.getActiveSubscription(req.user.id);

    if (!result) {
      return res.status(200).json({
        message: 'Aucun abonnement actif.',
        data: {
          hasActiveSubscription: false,
          subscription: null,
          statusInfo: null
        }
      });
    }

    res.status(200).json({
      message: 'Statut récupéré avec succès.',
      data: {
        hasActiveSubscription: result.statusInfo.isAccessAllowed,
        subscription: {
          id: result.subscription.id,
          startDate: result.subscription.startDate,
          endDate: result.subscription.endDate,
          status: result.subscription.status,
          autoRenew: result.subscription.autoRenew,
          plan: result.subscription.plan
        },
        statusInfo: {
          computedStatus: result.statusInfo.status,
          isAccessAllowed: result.statusInfo.isAccessAllowed,
          daysRemaining: result.statusInfo.daysRemaining,
          graceRemaining: result.statusInfo.graceRemaining,
          gracePeriodDays: subscriptionService.GRACE_PERIOD_DAYS
        }
      }
    });
  } catch (error) {
    console.error('Erreur vérification statut:', error);
    res.status(500).json({ error: 'Erreur interne du serveur.' });
  }
};

/**
 * GET /api/subscriptions/history
 * Historique complet des abonnements.
 */
exports.getHistory = async (req, res) => {
  try {
    const history = await subscriptionService.getSubscriptionHistory(req.user.id);

    res.status(200).json({
      message: 'Historique récupéré avec succès.',
      data: {
        count: history.length,
        subscriptions: history.map(h => ({
          subscription: {
            id: h.subscription.id,
            startDate: h.subscription.startDate,
            endDate: h.subscription.endDate,
            status: h.subscription.status,
            autoRenew: h.subscription.autoRenew,
            plan: h.subscription.plan,
            transactions: h.subscription.transactions
          },
          statusInfo: h.statusInfo
        }))
      }
    });
  } catch (error) {
    console.error('Erreur historique:', error);
    res.status(500).json({ error: 'Erreur interne du serveur.' });
  }
};

/**
 * MIDDLEWARE — checkAccess
 * Vérifie qu'un abonnement actif (ou grace period) existe.
 */
exports.checkAccess = async (req, res, next) => {
  try {
    const result = await subscriptionService.getActiveSubscription(req.user.id);

    if (!result || !result.statusInfo.isAccessAllowed) {
      return res.status(403).json({
        error: 'Accès refusé. Abonnement requis.',
        data: {
          hasActiveSubscription: false,
          suggestion: 'Veuillez souscrire à un plan pour accéder à ce service.'
        }
      });
    }

    req.subscription = result.subscription;
    req.subscriptionStatus = result.statusInfo;

    if (result.statusInfo.status === 'grace_period') {
      res.set('X-Subscription-Warning', `Grace period: ${result.statusInfo.graceRemaining} jours restants`);
    }

    next();
  } catch (error) {
    console.error('Erreur checkAccess middleware:', error);
    res.status(500).json({ error: 'Erreur interne lors de la vérification d\'accès.' });
  }
};
