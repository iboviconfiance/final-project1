/**
 * ============================================================
 * SERVICE DE GÉNÉRATION DE REÇUS PDF
 * ============================================================
 * 
 * Génère des reçus de paiement professionnels avec :
 * - En-tête organisation (nom, date)
 * - Détails de la transaction (numéro, montant, méthode)
 * - Détails de l'abonnement (plan, période)
 * - QR Code de validation (scan pour vérifier l'authenticité)
 * - Pied de page légal
 * 
 * Le PDF est généré en mémoire (Buffer) pour l'envoi par email
 * sans écriture sur disque — optimisé pour le serverless et le perf.
 */

const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');

// ============================================================
// UTILITAIRES
// ============================================================

/**
 * Formate un montant en XAF avec séparateur de milliers
 * @param {number} amount
 * @returns {string} ex: "5 000 XAF"
 */
const formatXAF = (amount) => {
  return new Intl.NumberFormat('fr-FR').format(amount) + ' XAF';
};

/**
 * Formate une date en format français lisible
 * @param {Date} date
 * @returns {string} ex: "10/04/2026 à 14h30"
 */
const formatDate = (date) => {
  const d = new Date(date);
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  }) + ' à ' + d.toLocaleTimeString('fr-FR', {
    hour: '2-digit', minute: '2-digit'
  });
};

/**
 * Formate une date courte
 * @param {Date} date
 * @returns {string} ex: "10/04/2026"
 */
const formatDateShort = (date) => {
  return new Date(date).toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  });
};

/**
 * Dessine une ligne horizontale dans le PDF
 */
const drawLine = (doc, y, marginLeft = 50, marginRight = 50) => {
  doc.strokeColor('#E0E0E0')
    .lineWidth(0.5)
    .moveTo(marginLeft, y)
    .lineTo(doc.page.width - marginRight, y)
    .stroke();
};

// ============================================================
// GÉNÉRATION DU REÇU PDF
// ============================================================

/**
 * Génère un reçu de paiement professionnel au format PDF.
 * Retourne un Buffer contenant le PDF en mémoire.
 * 
 * @param {object} data
 * @param {object} data.organization - { name, slug }
 * @param {object} data.transaction - { id, amount, currency, paymentMethod, providerRef, providerName, createdAt }
 * @param {object} data.subscription - { startDate, endDate }
 * @param {object} data.plan - { name, duration_days, price }
 * @param {object} data.user - { email }
 * @returns {Promise<Buffer>} Le PDF sous forme de Buffer
 */
const generateReceipt = async (data) => {
  const { organization, transaction, subscription, plan, user } = data;

  // Générer le QR Code en base64 (contient l'URL de vérification)
  const verificationUrl = `${process.env.APP_URL || 'https://app.example.com'}/verify/${transaction.id}`;
  const qrCodeDataUrl = await QRCode.toDataURL(verificationUrl, {
    width: 120,
    margin: 1,
    color: { dark: '#1a1a2e', light: '#ffffff' }
  });
  // Convertir data URL en Buffer pour pdfkit
  const qrCodeBuffer = Buffer.from(qrCodeDataUrl.split(',')[1], 'base64');

  // Référence lisible pour le reçu
  const receiptRef = `REC-${transaction.id.substring(0, 8).toUpperCase()}`;

  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
      info: {
        Title: `Reçu ${receiptRef}`,
        Author: organization.name,
        Subject: 'Reçu de paiement',
        Creator: 'Système de facturation automatique'
      }
    });

    // Collecter les chunks du PDF en mémoire
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageWidth = doc.page.width;
    const contentWidth = pageWidth - 100; // margins 50+50

    // ──────────────────────────────────────────────
    // HEADER — Nom de l'organisation + Date
    // ──────────────────────────────────────────────
    doc.rect(0, 0, pageWidth, 100).fill('#1a1a2e');

    doc.fill('#ffffff')
      .fontSize(22)
      .font('Helvetica-Bold')
      .text(organization.name.toUpperCase(), 50, 30, { width: contentWidth * 0.6 });

    doc.fontSize(10)
      .font('Helvetica')
      .text(`Émis le ${formatDate(new Date())}`, 50, 60, {
        width: contentWidth,
        align: 'right'
      });

    doc.fill('#a0a0ff')
      .fontSize(10)
      .text(receiptRef, 50, 75, {
        width: contentWidth,
        align: 'right'
      });

    // ──────────────────────────────────────────────
    // TITRE — REÇU DE PAIEMENT
    // ──────────────────────────────────────────────
    let y = 120;

    doc.fill('#1a1a2e')
      .fontSize(18)
      .font('Helvetica-Bold')
      .text('REÇU DE PAIEMENT', 50, y, { align: 'center' });

    y += 35;

    // Badge de statut
    const statusText = transaction.status === 'success' ? '✓ PAYÉ' : '⏳ EN ATTENTE';
    const statusColor = transaction.status === 'success' ? '#16a34a' : '#f59e0b';
    doc.roundedRect(pageWidth / 2 - 40, y, 80, 25, 12)
      .fill(statusColor);
    doc.fill('#ffffff')
      .fontSize(11)
      .font('Helvetica-Bold')
      .text(statusText, pageWidth / 2 - 40, y + 7, { width: 80, align: 'center' });

    y += 45;
    drawLine(doc, y);
    y += 15;

    // ──────────────────────────────────────────────
    // SECTION — Informations client
    // ──────────────────────────────────────────────
    doc.fill('#666666').fontSize(9).font('Helvetica').text('CLIENT', 50, y);
    y += 15;
    doc.fill('#1a1a2e').fontSize(11).font('Helvetica-Bold').text(user.email, 50, y);
    y += 25;
    drawLine(doc, y);
    y += 15;

    // ──────────────────────────────────────────────
    // SECTION — Détails du plan
    // ──────────────────────────────────────────────
    doc.fill('#666666').fontSize(9).font('Helvetica').text('PLAN D\'ABONNEMENT', 50, y);
    y += 18;

    // Tableau de détails
    const details = [
      ['Plan', plan.name],
      ['Durée', `${plan.duration_days} jours`],
      ['Période', `Du ${formatDateShort(subscription.startDate)} au ${formatDateShort(subscription.endDate)}`]
    ];

    for (const [label, value] of details) {
      doc.fill('#444444').fontSize(10).font('Helvetica').text(label, 50, y);
      doc.fill('#1a1a2e').fontSize(10).font('Helvetica-Bold').text(value, 250, y);
      y += 20;
    }

    y += 10;
    drawLine(doc, y);
    y += 15;

    // ──────────────────────────────────────────────
    // SECTION — Détails de la transaction
    // ──────────────────────────────────────────────
    doc.fill('#666666').fontSize(9).font('Helvetica').text('TRANSACTION', 50, y);
    y += 18;

    const methodLabels = {
      'mobile_money': 'Mobile Money',
      'card': 'Carte bancaire',
      'bank_transfer': 'Virement bancaire',
      'cash': 'Espèces'
    };

    const txnDetails = [
      ['Méthode', methodLabels[transaction.paymentMethod] || transaction.paymentMethod],
      ['Opérateur', transaction.providerName || 'N/A'],
      ['Réf. Provider', transaction.providerRef || 'N/A'],
      ['Date', formatDate(transaction.createdAt)]
    ];

    for (const [label, value] of txnDetails) {
      doc.fill('#444444').fontSize(10).font('Helvetica').text(label, 50, y);
      doc.fill('#1a1a2e').fontSize(10).font('Helvetica-Bold').text(value, 250, y);
      y += 20;
    }

    y += 10;
    drawLine(doc, y);
    y += 15;

    // ──────────────────────────────────────────────
    // SECTION — Montant total (mis en valeur)
    // ──────────────────────────────────────────────
    doc.rect(50, y, contentWidth, 50).fill('#f0f4ff');

    doc.fill('#444444')
      .fontSize(12)
      .font('Helvetica')
      .text('MONTANT TOTAL', 70, y + 10);

    doc.fill('#1a1a2e')
      .fontSize(20)
      .font('Helvetica-Bold')
      .text(formatXAF(transaction.amount), 70, y + 8, {
        width: contentWidth - 40,
        align: 'right'
      });

    y += 70;

    // ──────────────────────────────────────────────
    // QR CODE — Vérification
    // ──────────────────────────────────────────────
    const qrSize = 100;
    const qrX = (pageWidth - qrSize) / 2;
    doc.image(qrCodeBuffer, qrX, y, { width: qrSize, height: qrSize });

    y += qrSize + 8;
    doc.fill('#888888')
      .fontSize(8)
      .font('Helvetica')
      .text('Scannez pour vérifier l\'authenticité de ce reçu', 50, y, {
        width: contentWidth,
        align: 'center'
      });

    y += 12;
    doc.fill('#aaaaaa')
      .fontSize(7)
      .text(verificationUrl, 50, y, {
        width: contentWidth,
        align: 'center'
      });

    // ──────────────────────────────────────────────
    // FOOTER — Mentions légales
    // ──────────────────────────────────────────────
    const footerY = doc.page.height - 80;
    drawLine(doc, footerY);
    doc.fill('#999999')
      .fontSize(7)
      .font('Helvetica')
      .text(
        'Ce reçu est généré automatiquement et fait foi de paiement. ' +
        'Aucune signature manuscrite n\'est requise. ' +
        `Document généré le ${formatDate(new Date())} par le système de facturation de ${organization.name}.`,
        50,
        footerY + 10,
        { width: contentWidth, align: 'center', lineGap: 3 }
      );

    doc.fill('#bbbbbb')
      .fontSize(6)
      .text(`ID Transaction: ${transaction.id}`, 50, footerY + 45, {
        width: contentWidth,
        align: 'center'
      });

    // Finaliser le PDF
    doc.end();
  });
};

// ============================================================
// ARCHIVAGE PDF
// ============================================================

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/** Dossier d'archivage des reçus PDF */
const STORAGE_DIR = path.join(__dirname, '..', 'storage', 'receipts');

/**
 * Archive un PDF sur le système de fichiers avec une clé d'accès unique.
 * La clé permet le re-téléchargement sans re-génération.
 * 
 * En production, remplacer par un upload vers S3/GCS/Azure Blob.
 * 
 * @param {Buffer} pdfBuffer - Le PDF en mémoire
 * @param {string} transactionId - ID de la transaction (pour le nommage)
 * @returns {{ accessKey: string, storagePath: string, sizeBytes: number }}
 */
const storePDF = (pdfBuffer, transactionId) => {
  // Créer le dossier si nécessaire
  if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
  }

  // Générer une clé d'accès cryptographique (32 chars hex = 16 bytes)
  const accessKey = crypto.randomBytes(16).toString('hex');
  const filename = `${accessKey}.pdf`;
  const storagePath = path.join(STORAGE_DIR, filename);

  // Écrire le PDF sur disque
  fs.writeFileSync(storagePath, pdfBuffer);

  return {
    accessKey,
    storagePath,
    sizeBytes: pdfBuffer.length
  };
};

/**
 * Supprime un PDF archivé (pour nettoyage — jamais via l'API).
 * @param {string} storagePath
 */
const deletePDF = (storagePath) => {
  if (storagePath && fs.existsSync(storagePath)) {
    fs.unlinkSync(storagePath);
  }
};

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  generateReceipt,
  storePDF,
  deletePDF,
  formatXAF,
  formatDate,
  formatDateShort,
  STORAGE_DIR
};
