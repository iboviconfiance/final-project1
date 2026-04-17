require('dotenv').config();
const { sequelize, User, Organization, Plan } = require('./models');
const crypto = require('crypto');

async function seed() {
  console.log('🌱 Démarrage du seed de la base de données...');

  try {
    // 1. Connexion à la base
    await sequelize.authenticate();
    console.log('✅ Connexion DB réussie.');

    // 2. Synchronisation (sans drop pour ne rien casser, mais s'assure que les tables sont là)
    await sequelize.sync();

    // ==========================================
    // 3. CRÉATION DU SUPER-ADMIN
    // ==========================================
    const superAdminEmail = 'superadmin@diabo.com';
    let superAdmin = await User.findOne({ where: { email: superAdminEmail } });

    if (!superAdmin) {
      superAdmin = await User.create({
        email: superAdminEmail,
        password: 'password123', // Utilisé pour le test
        role: 'superadmin',
        referral_code: crypto.randomBytes(6).toString('hex').toUpperCase(),
        organizationId: null
      });
      console.log(`👑 Super-Admin créé: ${superAdminEmail} / mdp: password123`);
    } else {
      console.log(`👑 Super-Admin déjà existant: ${superAdminEmail}`);
    }

    // ==========================================
    // 4. CRÉATION DE L'ORGANISATION ET DE L'ADMIN
    // ==========================================
    let org = await Organization.findOne({ where: { slug: 'diabo-gym' } });
    if (!org) {
      org = await Organization.create({
        name: 'Diabo Gym',
        slug: 'diabo-gym',
        status: 'active'
      });
      console.log('🏢 Organisation "Diabo Gym" créée.');
    }

    const adminEmail = 'admin@diabo.com';
    let admin = await User.findOne({ where: { email: adminEmail } });
    
    if (!admin) {
      admin = await User.create({
        email: adminEmail,
        password: 'password123',
        role: 'admin',
        organizationId: org.id,
        referral_code: crypto.randomBytes(6).toString('hex').toUpperCase()
      });
      console.log(`👨‍💼 Admin créé: ${adminEmail} / mdp: password123`);
    } else {
      console.log(`👨‍💼 Admin déjà existant: ${adminEmail}`);
    }

    // ==========================================
    // 5. CRÉATION D'UN PLAN TEST
    // ==========================================
    let plan = await Plan.findOne({ where: { name: 'Abonnement Mensuel', organizationId: org.id } });
    if (!plan) {
      plan = await Plan.create({
        name: 'Abonnement Mensuel',
        price: 15000,
        duration_days: 30,
        description: 'Accès illimité à la salle pendant 1 mois',
        organizationId: org.id,
        is_active: true
      });
      console.log('💳 Plan "Abonnement Mensuel" (15000 XAF) créé.');
    }

    // ==========================================
    // 6. CRÉATION DU CLIENT
    // ==========================================
    const clientEmail = 'client@diabo.com';
    let client = await User.findOne({ where: { email: clientEmail } });

    if (!client) {
      client = await User.create({
        email: clientEmail,
        password: 'password123',
        role: 'user',
        organizationId: org.id,
        referral_code: crypto.randomBytes(6).toString('hex').toUpperCase()
      });
      console.log(`👤 Client test créé: ${clientEmail} / mdp: password123`);
    } else {
      console.log(`👤 Client déjà existant: ${clientEmail}`);
    }

    console.log('\n🎉 SEED GÉNÉRÉ AVEC SUCCÈS ! Vous pouvez maintenant tester.');
    console.log('Identifiants de test à utiliser :');
    console.log('- Super-Admin : superadmin@diabo.com / password123');
    console.log('- Admin       : admin@diabo.com      / password123');
    console.log('- Client      : client@diabo.com     / password123');

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur lors du seed :', error);
    process.exit(1);
  }
}

seed();
