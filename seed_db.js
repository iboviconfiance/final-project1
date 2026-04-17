// seed_db.js
require('dotenv').config();
const { sequelize, User, Organization, Subscription, Plan } = require('./models');
const crypto = require('crypto');

async function seed() {
  try {
    console.log('🔄 Connexion à la base de données...');
    await sequelize.authenticate();
    
    // S'assurer que les tables existent (sans tout effacer)
    await sequelize.sync();
    console.log('✅ Base de données synchronisée.');

    // 1. Création de l'Organisation Test
    const [org, createdOrg] = await Organization.findOrCreate({
      where: { slug: 'gym-brazza' },
      defaults: {
        name: 'Gym Brazza Elite',
        settings: {
          currency: 'XAF',
          timezone: 'Africa/Brazzaville'
        }
      }
    });

    if (createdOrg) console.log('🏢 Organisation "Gym Brazza Elite" créée.');

    // 2. Création du Plan
    const [plan, createdPlan] = await Plan.findOrCreate({
      where: { name: 'Abonnement Mensuel' },
      defaults: {
        description: 'Accès complet 30 jours',
        price: 30000,
        duration_days: 30,
        organizationId: org.id
      }
    });

    // 3. Création du Super-Admin
    const [superAdmin, createdSA] = await User.findOrCreate({
      where: { email: 'superadmin@subflow.com' },
      defaults: {
        password: 'password123', // Sera hashé automatiquement par le Model
        firstName: 'Super',
        lastName: 'Admin',
        role: 'superadmin',
        isActive: true
      }
    });
    if (createdSA) console.log('👑 Super-Admin créé (superadmin@subflow.com / password123)');

    // 4. Création de l'Admin D'Organisation
    const [admin, createdAdmin] = await User.findOrCreate({
      where: { email: 'admin@gymbrazza.com' },
      defaults: {
        password: 'password123',
        firstName: 'Patron',
        lastName: 'Gym',
        role: 'admin',
        organizationId: org.id,
        isActive: true
      }
    });
    if (createdAdmin) console.log('👨‍💼 Admin de la Gym créé (admin@gymbrazza.com / password123)');

    // 5. Création d'un Client Test avec Abonnement Actif
    const [client, createdClient] = await User.findOrCreate({
      where: { email: 'client@test.com' },
      defaults: {
        password: 'password123',
        firstName: 'Jean',
        lastName: 'Dupont',
        phone: '+242060000000',
        role: 'user',
        organizationId: org.id,
        isActive: true
      }
    });

    if (createdClient) {
      console.log('👤 Client Test créé (client@test.com / password123)');
      
      // On lui donne un abonnement actif
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + 30); // Actif 30 jours
      
      await Subscription.create({
        userId: client.id,
        planId: plan.id,
        organizationId: org.id,
        status: 'active',
        startDate: new Date(),
        endDate: expirationDate,
        amountPaid: 30000,
        currency: 'XAF',
        planName: plan.name
      });
      console.log('✅ Abonnement actif ajouté au client.');
    }

    console.log('\n🎉 Tout est prêt pour tester !');
    console.log('\n--- IDENTIFIANTS DE TEST ---');
    console.log('Super-Admin : superadmin@subflow.com / password123');
    console.log('Propriétaire (L\'Admin du Dashboard) : admin@gymbrazza.com / password123');
    console.log('Client Final (Le sportif) : client@test.com / password123\n');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur lors du seeding:', error);
    process.exit(1);
  }
}

seed();
