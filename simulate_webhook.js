// simulate_webhook.js
require('dotenv').config();
const crypto = require('crypto');

/**
 * Script de Test/Simulation Webhook MTN MoMo (Congo Brazzaville)
 * 
 * UTILISATION : 
 * Ouvrez un terminal à la racine et lancez :
 * node simulate_webhook.js <ID_TRANSACTION_OU_PROVIDER_REF>
 * 
 * Remplacez <ID_TRANSACTION...> par l'ID d'une transaction ayant le statut 'pending' 
 * fraîchement créée via le frontend.
 */

const transactionId = process.argv[2];

if (!transactionId) {
  console.log('🔴 ERREUR: Vous devez fournir un référence de transaction (providerRef ou id).');
  console.log('Exemple: node simulate_webhook.js 036e65a0-53bc-4fc4-bc70-e4a1bfca63c2');
  process.exit(1);
}

const secret = process.env.MTN_CONGO_WEBHOOK_SECRET;
if (!secret) {
  console.log('🔴 ERREUR: Impossible de lire MTN_CONGO_WEBHOOK_SECRET dans le fichier .env');
  console.log('Assurez-vous d\'avoir configuré cette variable.');
  process.exit(1);
}

// Construction du Faux Payload reçu depuis MTN
const payload = {
  referenceId: `REF-MTN-${Date.now()}`,
  externalId: transactionId, 
  status: "SUCCESSFUL", // On simule un paiement validé
  financialTransactionId: `FTN-${Math.floor(Math.random() * 1000000000)}`,
  amount: "5000",
  currency: "XAF",
  payer: {
    partyIdType: "MSISDN",
    partyId: "242060000000"
  },
  timestamp: Date.now() // Valide la sécurité Anti-Replay (< 5min)
};

const payloadString = JSON.stringify(payload);

// Création de la Signature HMAC Attendue par ton middleware de sécurité
const signature = crypto
  .createHmac('sha256', secret)
  .update(Buffer.from(payloadString))
  .digest('hex');

console.log('📡 Préparation de la requête HMAC-SHA256 simulée...');
console.log(`Transaction Ciblée : ${transactionId}`);
console.log(`Signature générée  : ${signature}`);

// Exécution de l'appel HTTP vers ton serveur local
fetch('http://localhost:3000/api/v1/webhooks/mtn-congo', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-momo-signature': signature // Le coeur de la sécurité
  },
  body: payloadString
})
  .then(async (res) => {
    const text = await res.text();
    console.log(`\n✅ Réponse du serveur local (${res.status}):`);
    console.log(text);
  })
  .catch((err) => {
    console.error('\n❌ Échec de la connexion à http://localhost:3000');
    console.error('Assure-toi que ton serveur Backend est en cours d\'exécution (npm run dev)');
  });
