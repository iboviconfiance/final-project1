const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// [POST] /api/auth/register
// Inscription d'une nouvelle organisation avec son premier compte administrateur.
router.post('/register', authController.register);

// [POST] /api/auth/login
// Connexion d'un utilisateur existant avec email et mot de passe.
router.post('/login', authController.login);

// [GET] /api/auth/organizations
// Liste les organisations actives (pour le formulaire d'inscription client).
// Route publique — seuls id, name, slug sont exposés.
router.get('/organizations', authController.listPublicOrganizations);

// [POST] /api/auth/register-client
// Inscription d'un client (abonné) dans une organisation existante.
// Le rôle est FORCÉ à "user" — impossible de s'auto-promouvoir.
router.post('/register-client', authController.registerClient);

module.exports = router;
