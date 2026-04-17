/**
 * ============================================================
 * Discount Service — Cerveau de tous les calculs de réduction
 * ============================================================
 * 
 * RÈGLE D'OR : Le Frontend n'envoie JAMAIS le prix final.
 * Il envoie uniquement planId + couponCode.
 * C'est CE service qui recalcule tout au moment du paiement.
 * 
 * Protège contre :
 * - Manipulation JavaScript du prix côté client
 * - Utilisation d'un coupon expiré ou épuisé
 * - Auto-parrainage (triple check anti-fraude)
 */

const { Op } = require('sequelize');
const Coupon = require('../models/Coupon');
const UserCoupon = require('../models/UserCoupon');
const Referral = require('../models/Referral');
const { User, Subscription } = require('../models');

class DiscountService {

  /**
   * Valide un code promo et retourne le détail de la réduction.
   * Appelé AVANT le paiement (pour l'aperçu frontend).
   * 
   * @param {string} code - Code promo
   * @param {string} userId - ID du user
   * @param {string} organizationId - ID de l'org
   * @param {number} originalPrice - Prix du plan (XAF)
   * @returns {{ valid, discount, finalPrice, coupon, error }}
   */
  async validateCoupon(code, userId, organizationId, originalPrice) {
    if (!code || !code.trim()) {
      return { valid: false, error: 'Code requis.' };
    }

    const coupon = await Coupon.findOne({
      where: {
        code: code.trim().toUpperCase(),
        organizationId,
        isActive: true,
      },
    });

    if (!coupon) {
      return { valid: false, error: 'Code promo invalide.' };
    }

    // Vérifier expiration
    if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
      return { valid: false, error: 'Ce code promo a expiré.' };
    }

    // Vérifier limite d'utilisation globale
    if (coupon.maxUses !== null && coupon.currentUses >= coupon.maxUses) {
      return { valid: false, error: 'Ce code promo n\'est plus disponible.' };
    }

    // Vérifier montant minimum
    if (originalPrice < parseFloat(coupon.minPurchase || 0)) {
      return { valid: false, error: `Montant minimum : ${coupon.minPurchase} XAF.` };
    }

    // Vérifier usage unique par utilisateur
    const alreadyUsed = await UserCoupon.findOne({
      where: { userId, couponId: coupon.id },
    });

    if (alreadyUsed) {
      return { valid: false, error: 'Vous avez déjà utilisé ce code.' };
    }

    // Calculer la réduction
    const discount = this.calculateDiscount(coupon, originalPrice);
    const finalPrice = Math.max(0, originalPrice - discount);

    return {
      valid: true,
      discount,
      finalPrice,
      coupon: {
        id: coupon.id,
        code: coupon.code,
        type: coupon.type,
        value: parseFloat(coupon.value),
      },
      error: null,
    };
  }

  /**
   * Applique un coupon lors du paiement confirmé.
   * Incrémente le compteur et crée l'entrée UserCoupon.
   */
  async applyCoupon(couponId, userId, transactionId, discountAmount) {
    // Marquer comme utilisé pour cet user
    await UserCoupon.create({
      userId,
      couponId,
      transactionId,
      discountAmount,
    });

    // Incrémenter le compteur global
    await Coupon.increment('currentUses', { where: { id: couponId } });
  }

  /**
   * Calcul mathématique de la réduction.
   * Appelé UNIQUEMENT côté backend.
   */
  calculateDiscount(coupon, originalPrice) {
    if (coupon.type === 'fixed') {
      return Math.min(parseFloat(coupon.value), originalPrice);
    }
    if (coupon.type === 'percentage') {
      return Math.round(originalPrice * (parseFloat(coupon.value) / 100));
    }
    return 0;
  }

  /**
   * Calcule le prix final avec toutes les réductions possibles :
   * 1. Code promo (si fourni)
   * 2. Réduction parrainage filleul (si premier paiement + parrain)
   * 
   * C'est cette méthode qui est appelée au moment du paiement réel.
   * Le frontend n'envoie que : { planId, couponCode, phone }
   */
  async calculateFinalPrice(planId, userId, organizationId, couponCode = null) {
    const Plan = require('../models/Plan');
    const plan = await Plan.findByPk(planId);
    if (!plan) throw new Error('Plan introuvable.');

    let originalPrice = parseFloat(plan.price);
    let appliedDiscounts = [];
    let couponId = null;

    // 1. Vérifier si le user a une réduction parrainage (premier paiement)
    const referral = await Referral.findOne({
      where: {
        referredId: userId,
        organizationId,
        status: 'pending',
      },
    });

    if (referral && parseFloat(referral.referredDiscount) > 0) {
      const referralDiscount = Math.round(originalPrice * (parseFloat(referral.referredDiscount) / 100));
      originalPrice -= referralDiscount;
      appliedDiscounts.push({
        type: 'referral',
        label: 'Réduction parrainage',
        amount: referralDiscount,
        percent: parseFloat(referral.referredDiscount),
      });
    }

    // 2. Appliquer le code promo (si fourni)
    if (couponCode) {
      const couponResult = await this.validateCoupon(couponCode, userId, organizationId, originalPrice);
      if (couponResult.valid) {
        originalPrice = couponResult.finalPrice;
        couponId = couponResult.coupon.id;
        appliedDiscounts.push({
          type: 'coupon',
          label: `Code ${couponResult.coupon.code}`,
          amount: couponResult.discount,
          code: couponResult.coupon.code,
        });
      }
    }

    return {
      planId: plan.id,
      planName: plan.name,
      originalPrice: parseFloat(plan.price),
      finalPrice: Math.max(0, originalPrice),
      discounts: appliedDiscounts,
      totalDiscount: appliedDiscounts.reduce((sum, d) => sum + d.amount, 0),
      couponId,
      durationDays: plan.durationDays,
    };
  }

  // ─── PARRAINAGE ──────────────────────────────────────────

  /**
   * Génère un code de parrainage unique pour un utilisateur.
   * Format : PRENOM + 3 chiffres aléatoires (ex: JEAN242)
   */
  generateReferralCode(firstName) {
    const base = (firstName || 'USER')
      .toUpperCase()
      .replace(/[^A-Z]/g, '')
      .substring(0, 6);
    const rand = Math.floor(100 + Math.random() * 900); // 100-999
    return `${base}${rand}`;
  }

  /**
   * Enregistre un parrainage lors de l'inscription du filleul.
   * 
   * @param {string} referralCode - Code du parrain
   * @param {string} referredUserId - ID du filleul
   * @param {string} organizationId - ID de l'org
   * @param {object} metadata - { ip, deviceId, phone }
   */
  async registerReferral(referralCode, referredUserId, organizationId, metadata = {}) {
    if (!referralCode) return null;

    // Trouver le parrain par son code
    const referrer = await User.findOne({
      where: {
        referral_code: referralCode.toUpperCase(),
        organizationId,
      },
    });

    if (!referrer) return null;

    // Empêcher l'auto-parrainage
    if (referrer.id === referredUserId) return null;

    // Vérifier si ce parrainage existe déjà
    const existing = await Referral.findOne({
      where: { referrerId: referrer.id, referredId: referredUserId },
    });
    if (existing) return existing;

    // ─── Triple Check Anti-Fraude ───
    const fraudFlags = [];

    // Check 1 : Même IP
    if (metadata.ip && metadata.referrerIp && metadata.ip === metadata.referrerIp) {
      fraudFlags.push('SAME_IP');
    }

    // Check 2 : Même Device ID
    if (metadata.deviceId && metadata.referrerDeviceId && metadata.deviceId === metadata.referrerDeviceId) {
      fraudFlags.push('SAME_DEVICE');
    }

    // Check 3 : Même numéro MoMo
    if (metadata.phone && referrer.phone) {
      const cleanPhone = (p) => p.replace(/[\s\-\.\(\)\+]/g, '').slice(-9);
      if (cleanPhone(metadata.phone) === cleanPhone(referrer.phone)) {
        fraudFlags.push('SAME_PHONE');
      }
    }

    // Lire la config parrainage de l'org
    const { Organization } = require('../models');
    const org = await Organization.findByPk(organizationId);
    const referralConfig = org?.settings?.referral || {};

    const referral = await Referral.create({
      referrerId: referrer.id,
      referredId: referredUserId,
      referralCode: referralCode.toUpperCase(),
      status: fraudFlags.length > 0 ? 'rejected' : 'pending',
      rewardType: referralConfig.rewardType || 'days',
      rewardValue: referralConfig.rewardValue || 5,
      referredDiscount: referralConfig.referredDiscount || 10,
      organizationId,
      referrerPhone: referrer.phone,
      referredPhone: metadata.phone,
      referrerIp: metadata.referrerIp,
      referredIp: metadata.ip,
      referrerDeviceId: metadata.referrerDeviceId,
      referredDeviceId: metadata.deviceId,
      fraudFlags,
    });

    return referral;
  }

  /**
   * Complète un parrainage quand le filleul PAIE.
   * Appelé par le webhook controller après confirmation.
   * 
   * Crédite le bonus au parrain (+X jours).
   */
  async completeReferral(referredUserId, organizationId) {
    const referral = await Referral.findOne({
      where: {
        referredId: referredUserId,
        organizationId,
        status: 'pending',
        rewardApplied: false,
      },
    });

    if (!referral) return null;

    // Marquer comme complété
    referral.status = 'completed';
    referral.completedAt = new Date();
    referral.rewardApplied = true;
    await referral.save();

    // Appliquer le bonus au parrain
    if (referral.rewardType === 'days') {
      const subscription = await Subscription.findOne({
        where: {
          userId: referral.referrerId,
          status: { [Op.in]: ['active', 'grace_period'] },
        },
        order: [['endDate', 'DESC']],
      });

      if (subscription) {
        const bonusDays = parseFloat(referral.rewardValue) || 5;
        const currentEnd = new Date(subscription.endDate);
        currentEnd.setDate(currentEnd.getDate() + bonusDays);
        subscription.endDate = currentEnd;
        await subscription.save();
      }
    }

    return referral;
  }

  /**
   * Retourne les stats de parrainage d'un utilisateur.
   */
  async getReferralStats(userId, organizationId) {
    const user = await User.findByPk(userId, { attributes: ['referral_code'] });

    const referrals = await Referral.findAll({
      where: { referrerId: userId, organizationId },
      include: [{
        model: User,
        as: 'referred',
        attributes: ['id', 'firstName', 'lastName', 'email', 'createdAt'],
      }],
      order: [['createdAt', 'DESC']],
    });

    return {
      referralCode: user?.referral_code,
      totalReferred: referrals.length,
      completed: referrals.filter(r => r.status === 'completed').length,
      pending: referrals.filter(r => r.status === 'pending').length,
      totalBonusDays: referrals
        .filter(r => r.status === 'completed' && r.rewardType === 'days')
        .reduce((sum, r) => sum + parseFloat(r.rewardValue || 0), 0),
      referrals: referrals.map(r => ({
        id: r.id,
        status: r.status,
        referredName: r.referred ? `${r.referred.firstName || ''} ${r.referred.lastName || ''}`.trim() : 'Inconnu',
        referredEmail: r.referred?.email,
        createdAt: r.createdAt,
        completedAt: r.completedAt,
        rewardType: r.rewardType,
        rewardValue: parseFloat(r.rewardValue),
      })),
    };
  }
}

module.exports = new DiscountService();
