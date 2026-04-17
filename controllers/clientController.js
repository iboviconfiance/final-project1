const Joi = require('joi');
const { User, Transaction, Subscription, Plan, Organization, sequelize } = require('../models');
const { Op, fn, col } = require('sequelize');
const { encryptPaymentMethod, decryptPaymentMethod, maskPhoneNumber } = require('../services/encryptionService');
const subscriptionService = require('../services/subscriptionService');

/**
 * ============================================================
 * Client Controller — Portail Self-Service Abonné
 * ============================================================
 * 
 * OBJECTIF :
 * L'abonné gère tout seul : profil, factures, consommation,
 * mode de paiement rapide. Moins il appelle l'admin, mieux c'est.
 * 
 * ACCÈS : authMiddleware uniquement (tout user authentifié)
 * 
 * FONCTIONNALITÉS :
 * - GET  /profile           → Profil complet + abonnement actif
 * - PUT  /profile           → Mise à jour infos personnelles
 * - GET  /invoices          → Historique des factures
 * - GET  /consumption       → Données de consommation (graphique)
 * - PUT  /payment-method    → Sauvegarder numéro MoMo (chiffré)
 * - GET  /payment-method    → Numéro masqué (****1234)
 * - DELETE /payment-method  → Supprimer le numéro sauvegardé
 */

// ── SCHÉMAS DE VALIDATION ────────────────────────────────

const updateProfileSchema = Joi.object({
  firstName: Joi.string().min(1).max(100).optional().allow(null, ''),
  lastName: Joi.string().min(1).max(100).optional().allow(null, ''),
  gender: Joi.string().valid('male', 'female', 'other').optional().allow(null),
  company: Joi.string().max(200).optional().allow(null, ''),
  phone: Joi.string().pattern(/^\+?[0-9\s\-]{8,20}$/).optional().allow(null, '')
    .messages({ 'string.pattern.base': 'Numéro de téléphone invalide.' }),
  email: Joi.string().email().optional()
    .messages({ 'string.email': 'Adresse email invalide.' })
});

const paymentMethodSchema = Joi.object({
  phoneNumber: Joi.string().pattern(/^\+?[0-9\s\-]{8,15}$/).required()
    .messages({
      'string.pattern.base': 'Numéro MoMo invalide (ex: +242 06XXXXXXX).',
      'any.required': 'Le numéro de téléphone est requis.'
    }),
  provider: Joi.string().valid('mtn', 'airtel', 'other').optional().default('mtn')
});

// ============================================================
// GET /api/client/profile
// Profil complet avec abonnement actif et jours restants
// ============================================================

exports.getProfile = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password'] },
      include: [{
        model: Organization,
        as: 'organization',
        attributes: ['id', 'name', 'slug', 'status']
      }]
    });

    if (!user) {
      return res.status(404).json({ error: 'Utilisateur introuvable.' });
    }

    // Récupérer l'abonnement actif
    let activeSubscription = null;
    let statusInfo = null;

    try {
      const result = await subscriptionService.getActiveSubscription(user.id);
      if (result) {
        activeSubscription = {
          id: result.subscription.id,
          startDate: result.subscription.startDate,
          endDate: result.subscription.endDate,
          status: result.subscription.status,
          autoRenew: result.subscription.autoRenew,
          plan: result.subscription.plan
        };
        statusInfo = result.statusInfo;
      }
    } catch (subErr) {
      console.error('⚠️ Erreur récup abonnement profil:', subErr.message);
    }

    // Masquer le numéro MoMo sauvegardé
    let savedPayment = null;
    if (user.savedPaymentMethod) {
      savedPayment = {
        maskedNumber: user.savedPaymentMethod.maskedNumber || '****',
        provider: user.savedPaymentMethod.provider || 'mtn',
        savedAt: user.savedPaymentMethod.savedAt || null
      };
    }

    res.status(200).json({
      message: 'Profil récupéré.',
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          gender: user.gender,
          company: user.company,
          phone: user.phone,
          role: user.role,
          referral_code: user.referral_code,
          createdAt: user.createdAt
        },
        organization: user.organization,
        subscription: activeSubscription,
        statusInfo,
        savedPaymentMethod: savedPayment
      }
    });
  } catch (err) {
    console.error('Erreur getProfile:', err);
    res.status(500).json({ error: 'Erreur interne.' });
  }
};

// ============================================================
// PUT /api/client/profile
// Mise à jour du profil (firstName, lastName, gender, company, phone, email)
// ============================================================

exports.updateProfile = async (req, res) => {
  const { error, value } = updateProfileSchema.validate(req.body, { abortEarly: false });
  if (error) {
    return res.status(400).json({ error: 'Erreur de validation.', details: error.details.map(d => d.message) });
  }

  try {
    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur introuvable.' });
    }

    // Si changement d'email, vérifier l'unicité
    if (value.email && value.email !== user.email) {
      const existing = await User.findOne({ where: { email: value.email } });
      if (existing) {
        return res.status(400).json({ error: 'Cet email est déjà utilisé par un autre compte.' });
      }
    }

    // Construire l'objet de mise à jour (ne mettre que les champs fournis)
    const updateData = {};
    const updatableFields = ['firstName', 'lastName', 'gender', 'company', 'phone', 'email'];

    for (const field of updatableFields) {
      if (value[field] !== undefined) {
        updateData[field] = value[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'Aucun champ à mettre à jour.' });
    }

    await user.update(updateData);

    res.status(200).json({
      message: 'Profil mis à jour avec succès.',
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          gender: user.gender,
          company: user.company,
          phone: user.phone
        }
      }
    });
  } catch (err) {
    console.error('Erreur updateProfile:', err);
    res.status(500).json({ error: 'Erreur interne.' });
  }
};

// ============================================================
// GET /api/client/invoices
// Historique des transactions/factures du client
// ============================================================

exports.getInvoices = async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const where = { userId: req.user.id };
    if (status) where.status = status;

    const { count, rows: transactions } = await Transaction.findAndCountAll({
      where,
      include: [{
        model: Subscription,
        as: 'subscription',
        attributes: ['id', 'startDate', 'endDate', 'status'],
        include: [{
          model: Plan,
          as: 'plan',
          attributes: ['id', 'name', 'price', 'duration_days']
        }]
      }],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset
    });

    res.status(200).json({
      message: 'Factures récupérées.',
      data: {
        total: count,
        page: parseInt(page),
        totalPages: Math.ceil(count / parseInt(limit)),
        invoices: transactions.map(t => ({
          id: t.id,
          amount: t.amount,
          currency: t.currency,
          paymentMethod: t.paymentMethod,
          status: t.status,
          providerRef: t.providerRef,
          createdAt: t.createdAt,
          subscription: t.subscription ? {
            id: t.subscription.id,
            plan: t.subscription.plan?.name,
            startDate: t.subscription.startDate,
            endDate: t.subscription.endDate,
            status: t.subscription.status
          } : null
        }))
      }
    });
  } catch (err) {
    console.error('Erreur getInvoices:', err);
    res.status(500).json({ error: 'Erreur interne.' });
  }
};

// ============================================================
// GET /api/client/consumption
// Données de consommation pour graphique côté client
// ============================================================

exports.getConsumption = async (req, res) => {
  try {
    const userId = req.user.id;

    // Tous les abonnements (historique complet)
    const subscriptions = await Subscription.findAll({
      where: { userId },
      include: [{
        model: Plan,
        as: 'plan',
        attributes: ['id', 'name', 'price', 'duration_days']
      }],
      order: [['startDate', 'ASC']]
    });

    // Abonnement actif
    let activeInfo = null;
    try {
      const result = await subscriptionService.getActiveSubscription(userId);
      if (result) {
        const now = new Date();
        const end = new Date(result.subscription.endDate);
        const start = new Date(result.subscription.startDate);
        const totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
        const daysUsed = Math.ceil((now - start) / (1000 * 60 * 60 * 24));
        const daysRemaining = Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)));
        const progressPercent = Math.min(100, Math.round((daysUsed / totalDays) * 100));

        activeInfo = {
          planName: result.subscription.plan?.name,
          startDate: result.subscription.startDate,
          endDate: result.subscription.endDate,
          status: result.statusInfo.status,
          totalDays,
          daysUsed,
          daysRemaining,
          progressPercent,
          isAccessAllowed: result.statusInfo.isAccessAllowed,
          graceRemaining: result.statusInfo.graceRemaining || null
        };
      }
    } catch (subErr) {
      console.error('⚠️ Erreur récup conso active:', subErr.message);
    }

    // Historique chronologique pour graphique
    const timeline = subscriptions.map(sub => ({
      planName: sub.plan?.name,
      startDate: sub.startDate,
      endDate: sub.endDate,
      status: sub.status,
      durationDays: sub.plan?.duration_days,
      price: sub.plan?.price
    }));

    // Dépenses totales
    const totalSpent = await Transaction.sum('amount', {
      where: { userId, status: 'success' }
    });

    res.status(200).json({
      message: 'Données de consommation récupérées.',
      data: {
        active: activeInfo,
        timeline,
        summary: {
          totalSubscriptions: subscriptions.length,
          activeSubscriptions: subscriptions.filter(s => ['active', 'grace_period'].includes(s.status)).length,
          totalSpent: parseFloat(totalSpent) || 0,
          currency: 'XAF'
        }
      }
    });
  } catch (err) {
    console.error('Erreur getConsumption:', err);
    res.status(500).json({ error: 'Erreur interne.' });
  }
};

// ============================================================
// PUT /api/client/payment-method
// Sauvegarder le numéro MoMo chiffré (paiement rapide)
// ============================================================

exports.savePaymentMethod = async (req, res) => {
  const { error, value } = paymentMethodSchema.validate(req.body, { abortEarly: false });
  if (error) {
    return res.status(400).json({ error: 'Erreur de validation.', details: error.details.map(d => d.message) });
  }

  try {
    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur introuvable.' });
    }

    // Chiffrer le numéro MoMo
    const encryptedData = encryptPaymentMethod(value.phoneNumber);

    await user.update({
      savedPaymentMethod: {
        ...encryptedData,
        provider: value.provider,
        savedAt: new Date().toISOString()
      }
    });

    res.status(200).json({
      message: 'Méthode de paiement sauvegardée avec succès.',
      data: {
        paymentMethod: {
          maskedNumber: encryptedData.maskedNumber,
          provider: value.provider,
          savedAt: new Date().toISOString()
        }
      }
    });
  } catch (err) {
    console.error('Erreur savePaymentMethod:', err);
    if (err.message && err.message.includes('ENCRYPTION_KEY')) {
      return res.status(500).json({ error: 'Erreur de configuration serveur (chiffrement).' });
    }
    res.status(500).json({ error: 'Erreur interne.' });
  }
};

// ============================================================
// GET /api/client/payment-method
// Récupérer le numéro masqué (sans déchiffrement)
// ============================================================

exports.getPaymentMethod = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: ['id', 'savedPaymentMethod']
    });

    if (!user || !user.savedPaymentMethod) {
      return res.status(200).json({
        message: 'Aucune méthode de paiement sauvegardée.',
        data: { paymentMethod: null }
      });
    }

    res.status(200).json({
      message: 'Méthode de paiement récupérée.',
      data: {
        paymentMethod: {
          maskedNumber: user.savedPaymentMethod.maskedNumber || '****',
          provider: user.savedPaymentMethod.provider || 'mtn',
          savedAt: user.savedPaymentMethod.savedAt || null
        }
      }
    });
  } catch (err) {
    console.error('Erreur getPaymentMethod:', err);
    res.status(500).json({ error: 'Erreur interne.' });
  }
};

// ============================================================
// DELETE /api/client/payment-method
// Supprimer le numéro MoMo sauvegardé
// ============================================================

exports.deletePaymentMethod = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur introuvable.' });
    }

    await user.update({ savedPaymentMethod: null });

    res.status(200).json({
      message: 'Méthode de paiement supprimée.',
      data: { paymentMethod: null }
    });
  } catch (err) {
    console.error('Erreur deletePaymentMethod:', err);
    res.status(500).json({ error: 'Erreur interne.' });
  }
};
