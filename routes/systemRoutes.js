const express = require('express');
const router = express.Router();
const systemController = require('../controllers/systemController');
const { authMiddleware } = require('../middlewares/authMiddleware');
const { checkPermission } = require('../middlewares/roleMiddleware');

// [GET] /api/v1/system/mode — Public
// Retourne le mode de fonctionnement (platform / license)
router.get('/mode', systemController.getSystemMode);

// [GET] /api/v1/system/qr-token — Authentifié
// Génère un QR Code rotatif pour l'abonné
router.get('/qr-token', authMiddleware, systemController.generateQrToken);

// [POST] /api/v1/system/verify-qr — Staff/Admin
// Vérifie un QR Code scanné à l'entrée
router.post('/verify-qr', authMiddleware, checkPermission('verify_access'), systemController.verifyQrCode);

module.exports = router;
