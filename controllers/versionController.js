const { Organization, AdminLog } = require('../models');

/**
 * ============================================================
 * Version Controller — Gestion des Versions (Option B)
 * ============================================================
 * 
 * Panneau Super-Admin pour voir et gérer les versions
 * du code/licence utilisées par chaque organisation.
 * 
 * Les versions sont stockées dans Organization.settings.version.
 * 
 * Structure : {
 *   version: "1.2.0",
 *   updatedAt: "2026-04-10T14:00:00Z",
 *   updatedBy: "superadmin-id",
 *   previousVersion: "1.1.0"
 * }
 */

const CURRENT_VERSION = process.env.APP_VERSION || '1.0.0';

// ============================================================
// GET /api/v1/superadmin/versions
// Vue d'ensemble des versions de toutes les organisations
// ============================================================

exports.listVersions = async (req, res) => {
  try {
    const { page = 1, limit = 50, outdatedOnly } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows: orgs } = await Organization.findAndCountAll({
      attributes: ['id', 'name', 'slug', 'status', 'settings', 'createdAt', 'updatedAt'],
      order: [['name', 'ASC']],
      limit: parseInt(limit),
      offset
    });

    const versions = orgs.map(org => {
      const versionInfo = org.settings?.version || {};
      const orgVersion = versionInfo.version || '1.0.0';
      const isUpToDate = orgVersion === CURRENT_VERSION;

      return {
        organizationId: org.id,
        name: org.name,
        slug: org.slug,
        status: org.status,
        version: orgVersion,
        isUpToDate,
        lastUpdatedAt: versionInfo.updatedAt || org.createdAt,
        updatedBy: versionInfo.updatedBy || null,
        previousVersion: versionInfo.previousVersion || null
      };
    });

    // Filtrer uniquement les obsolètes si demandé
    const filteredVersions = outdatedOnly === 'true'
      ? versions.filter(v => !v.isUpToDate)
      : versions;

    const outdatedCount = versions.filter(v => !v.isUpToDate).length;

    res.status(200).json({
      message: 'Versions récupérées.',
      data: {
        currentVersion: CURRENT_VERSION,
        total: count,
        outdatedCount,
        upToDateCount: count - outdatedCount,
        page: parseInt(page),
        totalPages: Math.ceil(count / parseInt(limit)),
        organizations: filteredVersions
      }
    });
  } catch (err) {
    console.error('Erreur listVersions:', err);
    res.status(500).json({ error: 'Erreur interne.' });
  }
};

// ============================================================
// PUT /api/v1/superadmin/versions/:orgId
// Mettre à jour la version d'une organisation
// ============================================================

exports.updateVersion = async (req, res) => {
  try {
    const { orgId } = req.params;
    const { version } = req.body;

    if (!version || typeof version !== 'string') {
      return res.status(400).json({ error: 'Le numéro de version est requis (ex: "1.2.0").' });
    }

    // Vérifier le format sémantique (semver basique)
    if (!/^\d+\.\d+\.\d+$/.test(version)) {
      return res.status(400).json({ error: 'Format de version invalide. Utilisez le format X.Y.Z (ex: 1.2.0).' });
    }

    const org = await Organization.findByPk(orgId);
    if (!org) {
      return res.status(404).json({ error: 'Organisation introuvable.' });
    }

    const previousVersion = org.settings?.version?.version || '1.0.0';

    // Mettre à jour le settings
    const settings = { ...org.settings };
    settings.version = {
      version,
      updatedAt: new Date().toISOString(),
      updatedBy: req.user.id,
      previousVersion
    };

    await org.update({ settings });

    // Log d'audit
    await AdminLog.create({
      adminId: req.user.id,
      organizationId: null, // Action Super-Admin
      action: 'SYSTEM_CONFIG',
      targetType: 'Organization',
      targetId: orgId,
      changes: {
        before: { version: previousVersion },
        after: { version }
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']?.substring(0, 500),
      metadata: { action: 'UPDATE_VERSION', orgName: org.name }
    });

    res.status(200).json({
      message: `Version de "${org.name}" mise à jour : ${previousVersion} → ${version}.`,
      data: {
        organization: org.name,
        previousVersion,
        newVersion: version,
        updatedAt: new Date().toISOString()
      }
    });
  } catch (err) {
    console.error('Erreur updateVersion:', err);
    res.status(500).json({ error: 'Erreur interne.' });
  }
};
