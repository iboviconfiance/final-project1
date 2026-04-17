/**
 * Routes Coupons + Referrals
 * 
 * Client : POST /validate (vérifier un code)
 * Admin  : CRUD coupons + stats + referrals config
 */
const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middlewares/authMiddleware');
const { checkPermission } = require('../middlewares/roleMiddleware');
const couponCtrl = require('../controllers/couponController');
const referralCtrl = require('../controllers/referralController');

// ── Client ─────────────────────────────────────
router.post('/validate', authMiddleware, couponCtrl.validateCoupon);

// ── Client : Mes parrainages ───────────────────
router.get('/referrals/my', authMiddleware, referralCtrl.getMyReferrals);

// ── Admin : CRUD Coupons ───────────────────────
router.get('/', authMiddleware, checkPermission('manage_billing'), couponCtrl.listCoupons);
router.post('/', authMiddleware, checkPermission('manage_billing'), couponCtrl.createCoupon);
router.put('/:id', authMiddleware, checkPermission('manage_billing'), couponCtrl.updateCoupon);
router.delete('/:id', authMiddleware, checkPermission('manage_billing'), couponCtrl.deleteCoupon);
router.get('/stats', authMiddleware, checkPermission('view_reports'), couponCtrl.couponStats);

// ── Admin : Parrainages de l'org ───────────────
router.get('/referrals/admin', authMiddleware, checkPermission('view_reports'), referralCtrl.getOrgReferrals);
router.get('/referrals/config', authMiddleware, checkPermission('manage_billing'), referralCtrl.getReferralConfig);
router.put('/referrals/config', authMiddleware, checkPermission('manage_billing'), referralCtrl.updateReferralConfig);

module.exports = router;
