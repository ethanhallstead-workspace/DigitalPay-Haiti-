/* ═══════════════════════════════════════════════════════════
   DigitalPay — API Attribution Sécurisée PIN Free Fire
   Vercel Serverless Function
   Route : POST /api/assign-pin
   Body  : { idToken, packId, orderId }
   ═══════════════════════════════════════════════════════════ */

const admin = require('firebase-admin');

/* ═══ INITIALISATION FIREBASE ADMIN ═══ */
if (!admin.apps.length) {
  try {
    const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
    if (!b64) {
      throw new Error('Variable FIREBASE_SERVICE_ACCOUNT_B64 manquante dans Vercel.');
    }
    const serviceAccount = JSON.parse(
      Buffer.from(b64, 'base64').toString('utf8')
    );
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  } catch (e) {
    console.error('[assign-pin] Firebase Admin init error:', e.message);
  }
}

/* ═══ CONSTANTES ═══ */
const VALID_FF_PACKS = [
  'ff_110',
  'ff_310',
  'ff_520',
  'ff_1060',
  'ff_2180',
  'ff_5600'
];

const ALLOWED_ORIGINS = [
  'https://digitalpayhaiti.vercel.app',
  /\.vercel\.app$/,
  /localhost/
];

/* ═══ HANDLER ═══ */
module.exports = async (req, res) => {
  /* ─── CORS ─── */
  const origin = req.headers.origin || '';
  const isAllowed = ALLOWED_ORIGINS.some(o =>
    typeof o === 'string' ? origin === o : o.test(origin)
  ) || origin === '';

  res.setHeader('Access-Control-Allow-Origin', isAllowed ? (origin || '*') : 'null');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée.' });
  }

  /* ─── Vérification init Firebase ─── */
  if (!admin.apps.length) {
    console.error('[assign-pin] Firebase Admin non initialisé.');
    return res.status(500).json({ error: 'Configuration serveur invalide.' });
  }

  try {
    const db = admin.firestore();

    /* ─── Parsing body ─── */
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) { body = {}; }
    }
    body = body || {};

    const idToken = String(body.idToken || '').trim();
    const packId = String(body.packId || '').trim();
    const orderId = String(body.orderId || '').trim();

    /* ─── Validation entrées ─── */
    if (!idToken || !packId || !orderId) {
      return res.status(400).json({ error: 'Champs manquants.' });
    }
    if (!VALID_FF_PACKS.includes(packId)) {
      return res.status(400).json({ error: 'Pack invalide.' });
    }
    if (orderId.length > 60) {
      return res.status(400).json({ error: 'Référence invalide.' });
    }

    /* ─── Vérification token Firebase ─── */
    let decoded;
    try {
      decoded = await admin.auth().verifyIdToken(idToken);
    } catch (e) {
      console.warn('[assign-pin] Token invalide:', e.code);
      return res.status(401).json({ error: 'Token invalide ou expiré.' });
    }
    const uid = decoded.uid;

    /* ─── Récupération commande ─── */
    const orderRef = db.collection('orders').doc(orderId);
    const orderSnap = await orderRef.get();

    if (!orderSnap.exists) {
      return res.status(404).json({ error: 'Commande introuvable.' });
    }

    const order = orderSnap.data();

    /* ─── Vérifications métier ─── */
    if (order.userId !== uid) {
      return res.status(403).json({ error: 'Non autorisé.' });
    }

    if (order.status === 'rejete') {
      return res.status(400).json({ error: 'Commande rejetée.' });
    }

    /* ─── Déjà un PIN ? Renvoyer sans doublon ─── */
    if (order.pinCode) {
      return res.status(200).json({
        success: true,
        pinCode: order.pinCode,
        alreadyAssigned: true
      });
    }

    /* ─── Vérifier paiement ─── */
    const pm = order.paymentMethod || 'wallet';
    const hasPayment =
      pm === 'wallet' ||
      (order.transactionId && String(order.transactionId).trim().length > 3);

    if (!hasPayment) {
      return res.status(400).json({ error: 'Paiement non détecté.' });
    }

    /* ─── Attribution atomique via transaction ─── */
    const result = await db.runTransaction(async (tx) => {

      /* Re-lire la commande dans la transaction */
      const fresh = await tx.get(orderRef);
      if (!fresh.exists) {
        return { success: false, reason: 'order_missing' };
      }

      const freshData = fresh.data();

      if (freshData.pinCode) {
        return {
          success: true,
          pinCode: freshData.pinCode,
          alreadyAssigned: true
        };
      }

      /* Chercher un PIN dispo */
      const pinsQuery = db
        .collection('freefire_pins')
        .where('packId', '==', packId)
        .where('status', '==', 'disponible')
        .limit(1);

      const pinsSnap = await tx.get(pinsQuery);

      if (pinsSnap.empty) {
        return { success: false, reason: 'no_stock' };
      }

      const pinDoc = pinsSnap.docs[0];
      const pinData = pinDoc.data();

      /* Marquer le PIN vendu */
      tx.update(pinDoc.ref, {
        status: 'vendu',
        orderId: orderId,
        buyerId: uid,
        soldAt: admin.firestore.FieldValue.serverTimestamp()
      });

      /* Mettre à jour la commande */
      tx.update(orderRef, {
        pinCode: pinData.pinCode,
        redeemUrl: 'https://redeem.hype.games/',
        status: 'livre',
        deliveredAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return { success: true, pinCode: pinData.pinCode };
    });

    /* ─── Cas sans stock ─── */
    if (!result.success) {
      await orderRef.update({
        status: 'en_attente_stock',
        stockCheckedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      return res.status(200).json({
        success: false,
        reason: 'no_stock'
      });
    }

    /* ─── Succès ─── */
    return res.status(200).json(result);

  } catch (err) {
    console.error('[assign-pin] Erreur serveur:', err);
    return res.status(500).json({ error: 'Erreur serveur.' });
  }
};