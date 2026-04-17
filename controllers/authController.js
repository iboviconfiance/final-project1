const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const Joi = require('joi');
const { User, Organization, sequelize } = require('../models');
const discountService = require('../services/discountService');

// ============================================================
// SCHÉMAS DE VALIDATION (Joi)
// ============================================================

const registerSchema = Joi.object({
  orgName: Joi.string().min(2).max(100).required()
    .messages({
      'string.min': 'Le nom de l\'organisation doit contenir au moins 2 caractères.',
      'string.max': 'Le nom de l\'organisation ne peut pas dépasser 100 caractères.',
      'any.required': 'Le nom de l\'organisation est requis.'
    }),
  adminEmail: Joi.string().email().required()
    .messages({
      'string.email': 'Veuillez fournir un email valide.',
      'any.required': 'L\'email est requis.'
    }),
  password: Joi.string().min(8).max(100).required()
    .messages({
      'string.min': 'Le mot de passe doit contenir au moins 8 caractères.',
      'string.max': 'Le mot de passe ne peut pas dépasser 100 caractères.',
      'any.required': 'Le mot de passe est requis.'
    }),
  referralCode: Joi.string().alphanum().optional().allow('', null)
});

const loginSchema = Joi.object({
  email: Joi.string().email().required()
    .messages({
      'string.email': 'Veuillez fournir un email valide.',
      'any.required': 'L\'email est requis.'
    }),
  password: Joi.string().required()
    .messages({
      'any.required': 'Le mot de passe est requis.'
    })
});

// ============================================================
// FONCTIONS UTILITAIRES
// ============================================================

/**
 * Génère un slug propre à partir du nom d'une organisation
 */
const generateSlug = (name) => {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
};

/**
 * Génère un referral_code unique avec boucle de retry
 * Utilise crypto.randomBytes(6) pour 12 caractères hex (281 milliards de combinaisons)
 * En cas de collision (contrainte UNIQUE), retente jusqu'à maxRetries fois
 */
const crypto = require('crypto');
const generateUniqueReferralCode = async (maxRetries = 5) => {
  for (let i = 0; i < maxRetries; i++) {
    const code = crypto.randomBytes(6).toString('hex').toUpperCase();
    const existing = await User.findOne({ where: { referral_code: code } });
    if (!existing) {
      return code;
    }
  }
  throw new Error('Impossible de générer un code de parrainage unique après plusieurs tentatives.');
};

// ============================================================
// CONTRÔLEURS
// ============================================================

/**
 * POST /api/auth/register
 * Inscription d'une nouvelle organisation avec son premier administrateur.
 */
exports.register = async (req, res) => {
  // Validation Joi
  const { error, value } = registerSchema.validate(req.body, { abortEarly: false });
  if (error) {
    const messages = error.details.map(d => d.message);
    return res.status(400).json({ error: 'Erreur de validation.', details: messages });
  }

  const { orgName, adminEmail, password, referralCode } = value;

  // Démarrer une transaction Sequelize pour garantir l'intégrité
  const t = await sequelize.transaction();

  try {
    // 1. Vérifier si un utilisateur existe déjà avec cet email (DANS la transaction)
    const userExists = await User.findOne({
      where: { email: adminEmail },
      transaction: t
    });
    if (userExists) {
      await t.rollback();
      return res.status(400).json({ error: "Cet email est déjà utilisé." });
    }

    // 2. Traitement du parrainage (DANS la transaction)
    let referrerId = null;
    if (referralCode) {
      const referrer = await User.findOne({
        where: { referral_code: referralCode },
        transaction: t
      });
      if (referrer) {
        referrerId = referrer.id;
      } else {
        await t.rollback();
        return res.status(400).json({ error: 'Code de parrainage invalide.' });
      }
    }

    // 3. Génération d'un referral_code unique pour le nouvel utilisateur
    const newReferralCode = await generateUniqueReferralCode();

    // 4. Création de l'Organisation
    const baseSlug = generateSlug(orgName);
    const organization = await Organization.create({
      name: orgName,
      slug: baseSlug,
      status: 'active',
      affiliate_code: referralCode ? referralCode.toUpperCase() : null
    }, { transaction: t });

    // 5. Création de l'Utilisateur (Admin pour cette organisation)
    const user = await User.create({
      email: adminEmail,
      password,
      role: 'admin',
      organizationId: organization.id,
      referred_by: referrerId,
      referral_code: newReferralCode
    }, { transaction: t });

    // 6. Validation de la transaction
    await t.commit();

    // 7. Génération du JWT (sans fallback — JWT_SECRET est garanti par app.js)
    const token = jwt.sign(
      {
        id: user.id,
        role: user.role,
        organizationId: user.organizationId
      },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    // 8. Log de création (fire-and-forget)
    setImmediate(async () => {
      try {
        const { AdminLog } = require('../models');
        await AdminLog.create({
          adminId: user.id,
          organizationId: organization.id,
          action: 'CREATE_ORG',
          targetType: 'Organization',
          targetId: organization.id,
          changes: { orgName: organization.name, email: user.email },
          ipAddress: req.ip || req.connection?.remoteAddress,
          userAgent: req.headers['user-agent']?.substring(0, 500)
        });
      } catch (logErr) {
        console.error('⚠️ Erreur log inscription:', logErr.message);
      }
    });

    // Réponse de succès (on exclut le mot de passe)
    res.status(201).json({
      message: 'Inscription réalisée avec succès !',
      token,
      data: {
        organization: {
          id: organization.id,
          name: organization.name,
          slug: organization.slug
        },
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          referral_code: user.referral_code
        }
      }
    });

  } catch (error) {
    // Annuler tout en cas d'erreur
    if (!t.finished) {
      await t.rollback();
    }
    console.error("Erreur lors de l'inscription:", error);

    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ error: "Problème d'unicité : Cet email ou l'URL de cette organisation existe déjà." });
    }

    res.status(500).json({ error: 'Erreur interne du serveur lors de l\'inscription.' });
  }
};

/**
 * POST /api/auth/login
 * Connexion d'un utilisateur existant avec email et mot de passe.
 */
exports.login = async (req, res) => {
  // Validation Joi
  const { error, value } = loginSchema.validate(req.body, { abortEarly: false });
  if (error) {
    const messages = error.details.map(d => d.message);
    return res.status(400).json({ error: 'Erreur de validation.', details: messages });
  }

  const { email, password } = value;

  try {
    // 1. Rechercher l'utilisateur par email
    const user = await User.findOne({
      where: { email },
      include: [{
        model: Organization,
        as: 'organization',
        attributes: ['id', 'name', 'slug', 'status']
      }]
    });

    if (!user) {
      // Message volontairement vague pour ne pas révéler si l'email existe
      return res.status(401).json({ error: 'Email ou mot de passe incorrect.' });
    }

    // 2. Vérifier que l'organisation est active
    if (user.organization && user.organization.status === 'suspended') {
      return res.status(403).json({ error: 'Votre organisation est suspendue. Contactez l\'administrateur.' });
    }

    // 3. Comparer le mot de passe fourni avec le hash en BDD
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      // Même message vague pour ne pas révéler si l'email existe
      return res.status(401).json({ error: 'Email ou mot de passe incorrect.' });
    }

    // 4. Génération du JWT (sans fallback)
    const token = jwt.sign(
      {
        id: user.id,
        role: user.role,
        organizationId: user.organizationId
      },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    // 5. Réponse de succès
    res.status(200).json({
      message: 'Connexion réussie !',
      token,
      data: {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          referral_code: user.referral_code
        },
        organization: user.organization ? {
          id: user.organization.id,
          name: user.organization.name,
          slug: user.organization.slug,
          status: user.organization.status
        } : null
      }
    });

    // 6. Log de connexion (fire-and-forget — ne bloque pas la réponse)
    setImmediate(async () => {
      try {
        const { AdminLog } = require('../models');
        await AdminLog.create({
          adminId: user.id,
          organizationId: user.role === 'superadmin' ? null : user.organizationId,
          action: 'LOGIN',
          targetType: 'User',
          targetId: user.id,
          changes: {},
          ipAddress: req.ip || req.connection?.remoteAddress,
          userAgent: req.headers['user-agent']?.substring(0, 500),
          metadata: {
            role: user.role,
            orgName: user.organization?.name || null,
            loginAt: new Date().toISOString()
          }
        });
      } catch (logErr) {
        console.error('⚠️ Erreur log connexion:', logErr.message);
      }
    });

  } catch (error) {
    console.error('Erreur lors de la connexion:', error);
    res.status(500).json({ error: 'Erreur interne du serveur lors de la connexion.' });
  }
};

// ============================================================
// INSCRIPTION CLIENT (Self-Service)
// ============================================================

const clientRegisterSchema = Joi.object({
  email: Joi.string().email().required()
    .messages({
      'string.email': 'Veuillez fournir un email valide.',
      'any.required': 'L\'email est requis.'
    }),
  password: Joi.string().min(8).max(100).required()
    .messages({
      'string.min': 'Le mot de passe doit contenir au moins 8 caractères.',
      'any.required': 'Le mot de passe est requis.'
    }),
  organizationId: Joi.string().uuid().required()
    .messages({
      'string.guid': 'Organisation invalide.',
      'any.required': 'L\'organisation est requise.'
    }),
  firstName: Joi.string().min(1).max(50).optional().allow('', null),
  lastName: Joi.string().min(1).max(50).optional().allow('', null),
  phone: Joi.string().max(20).optional().allow('', null),
  referralCode: Joi.string().alphanum().optional().allow('', null)
});

/**
 * GET /api/auth/organizations
 * Liste les organisations actives (publiques).
 * Utilisé par le formulaire d'inscription client pour choisir son organisation.
 * 
 * SÉCURITÉ : Seuls le nom, slug et id sont exposés.
 * Le statut, les settings et les users ne sont PAS envoyés.
 */
exports.listPublicOrganizations = async (req, res) => {
  try {
    const organizations = await Organization.findAll({
      where: { status: 'active' },
      attributes: ['id', 'name', 'slug'],
      order: [['name', 'ASC']]
    });

    res.json({
      data: {
        organizations: organizations.map(org => ({
          id: org.id,
          name: org.name,
          slug: org.slug,
        }))
      }
    });
  } catch (error) {
    console.error('Erreur liste organisations:', error);
    res.status(500).json({ error: 'Erreur interne du serveur.' });
  }
};

/**
 * POST /api/auth/register-client
 * Inscription d'un client (abonné) dans une organisation existante.
 * Le client choisit son organisation et crée son compte avec le rôle "user".
 * 
 * SÉCURITÉ :
 * - Le rôle est FORCÉ à "user" (impossible de s'auto-attribuer admin)
 * - L'organisation doit être active
 * - L'email ne doit pas déjà exister
 */
exports.registerClient = async (req, res) => {
  const { error, value } = clientRegisterSchema.validate(req.body, { abortEarly: false });
  if (error) {
    const messages = error.details.map(d => d.message);
    return res.status(400).json({ error: 'Erreur de validation.', details: messages });
  }

  const { email, password, organizationId, firstName, lastName, phone, referralCode } = value;

  const t = await sequelize.transaction();

  try {
    // 1. Vérifier que l'organisation existe et est active
    const organization = await Organization.findOne({
      where: { id: organizationId, status: 'active' },
      transaction: t
    });
    if (!organization) {
      await t.rollback();
      return res.status(400).json({ error: 'Organisation introuvable ou inactive.' });
    }

    // 2. Vérifier que l'email n'est pas déjà utilisé
    const existingUser = await User.findOne({
      where: { email },
      transaction: t
    });
    if (existingUser) {
      await t.rollback();
      return res.status(400).json({ error: 'Cet email est déjà utilisé.' });
    }

    // 3. (Ancien Parrainage basique supprimé, on va utiliser DiscountService après)

    // 4. Générer un referral_code unique
    const newReferralCode = await generateUniqueReferralCode();

    // 5. Créer l'utilisateur avec le rôle FORCÉ "user"
    const user = await User.create({
      email,
      password,
      role: 'user', // ← FORCÉ — impossible de s'auto-promouvoir
      organizationId: organization.id,
      firstName: firstName || null,
      lastName: lastName || null,
      phone: phone || null,
      referral_code: newReferralCode
    }, { transaction: t });

    await t.commit();

    // --- MARKETING LOGIC: Enregistrer le parrainage (BtoC) avec Anti-Fraude ---
    if (referralCode) {
      try {
        await discountService.registerReferral(referralCode, user.id, organization.id, {
          ip: req.ip || req.connection?.remoteAddress,
          deviceId: req.headers['user-agent']?.substring(0, 200),
          phone: phone
        });
      } catch (refErr) {
        console.error('⚠️ Erreur création parrainage marketing:', refErr.message);
      }
    }

    // 6. Générer le JWT
    const token = jwt.sign(
      {
        id: user.id,
        role: user.role,
        organizationId: user.organizationId
      },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    // 7. Log de création (fire-and-forget)
    setImmediate(async () => {
      try {
        const { AdminLog } = require('../models');
        await AdminLog.create({
          adminId: user.id,
          organizationId: organization.id,
          action: 'CREATE_USER',
          targetType: 'User',
          targetId: user.id,
          changes: { email: user.email, role: user.role },
          ipAddress: req.ip || req.connection?.remoteAddress,
          userAgent: req.headers['user-agent']?.substring(0, 500)
        });
      } catch (logErr) {
        console.error('⚠️ Erreur log inscription client:', logErr.message);
      }
    });

    res.status(201).json({
      message: 'Inscription réussie ! Bienvenue.',
      token,
      data: {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          firstName: user.firstName,
          lastName: user.lastName,
          referral_code: user.referral_code
        },
        organization: {
          id: organization.id,
          name: organization.name,
          slug: organization.slug
        }
      }
    });

  } catch (error) {
    if (!t.finished) await t.rollback();
    console.error('Erreur inscription client:', error);

    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ error: 'Cet email est déjà utilisé.' });
    }

    res.status(500).json({ error: 'Erreur interne du serveur.' });
  }
};
