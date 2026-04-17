/**
 * ============================================================
 * CONFIGURATION DES PROVIDERS PAR PAYS ET OPÉRATEUR
 * ============================================================
 * 
 * POUR VENDRE L'APPLICATION DANS UN NOUVEAU PAYS :
 * 
 * 1. Ajouter le pays dans cette config avec ses préfixes téléphoniques
 * 2. Créer le fichier du provider dans providers/ (hérite de BaseProvider)
 * 3. Ajouter les clés API dans .env
 * 4. C'est tout. Zéro modification du PaymentManager ou des contrôleurs.
 * 
 * L'architecture Open/Closed Principle garantit que le système
 * est OUVERT à l'extension mais FERMÉ à la modification.
 */

module.exports = {

  // ============================================================
  // CONGO-BRAZZAVILLE (+242)
  // ============================================================
  CG: {
    countryName: 'Congo-Brazzaville',
    countryCode: '+242',
    currency: 'XAF',
    operators: {
      'mtn-congo': {
        prefixes: ['06'],
        providerClass: 'MtnCongoProvider',
        displayName: 'MTN MoMo Congo'
      },
      'airtel-congo': {
        prefixes: ['05'],
        providerClass: 'AirtelCongoProvider',
        displayName: 'Airtel Money Congo'
      }
    }
  },

  // ============================================================
  // GABON (+241) — Exemple d'extension future
  // ============================================================
  GA: {
    countryName: 'Gabon',
    countryCode: '+241',
    currency: 'XAF',
    operators: {
      'airtel-gabon': {
        prefixes: ['74', '77', '07'],
        providerClass: 'AirtelGabonProvider',
        displayName: 'Airtel Money Gabon'
      }
      // Pour ajouter Moov Gabon : créer MoovGabonProvider.js + ajouter ici
    }
  },

  // ============================================================
  // SÉNÉGAL (+221) — Exemple d'extension future
  // ============================================================
  SN: {
    countryName: 'Sénégal',
    countryCode: '+221',
    currency: 'XOF',
    operators: {
      'orange-senegal': {
        prefixes: ['77', '78', '76'],
        providerClass: 'OrangeSenegalProvider',
        displayName: 'Orange Money Sénégal'
      },
      'free-senegal': {
        prefixes: ['76'],
        providerClass: 'FreeSenegalProvider',
        displayName: 'Free Money Sénégal'
      }
    }
  },

  // ============================================================
  // CAMEROUN (+237) — Exemple d'extension future
  // ============================================================
  CM: {
    countryName: 'Cameroun',
    countryCode: '+237',
    currency: 'XAF',
    operators: {
      'mtn-cameroun': {
        prefixes: ['67', '68', '65'],
        providerClass: 'MtnCamerounProvider',
        displayName: 'MTN MoMo Cameroun'
      },
      'orange-cameroun': {
        prefixes: ['69', '66'],
        providerClass: 'OrangeCamerounProvider',
        displayName: 'Orange Money Cameroun'
      }
    }
  },

  // ============================================================
  // KENYA (+254) — Exemple d'extension future
  // ============================================================
  KE: {
    countryName: 'Kenya',
    countryCode: '+254',
    currency: 'KES',
    operators: {
      'mpesa-kenya': {
        prefixes: ['7', '1'],
        providerClass: 'MpesaKenyaProvider',
        displayName: 'M-Pesa Kenya'
      }
    }
  },

  // ============================================================
  // FALLBACK — Agrégateur international
  // Utilisé quand aucun opérateur direct n'est trouvé
  // ============================================================
  fallback: {
    providerClass: 'AggregatorProvider',
    displayName: 'CinetPay (Agrégateur Multi-pays)'
  },

  // ============================================================
  // ENVIRONNEMENT DE TEST
  // ============================================================
  TEST: {
    countryName: 'Test',
    countryCode: '+000',
    currency: 'XAF',
    operators: {
      'mock': {
        prefixes: ['00'],
        providerClass: 'MockProvider',
        displayName: 'Mock Provider (Tests)'
      }
    }
  }
};
