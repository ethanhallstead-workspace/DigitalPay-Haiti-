/* ═══════════════════════════════════════════════════════════
   DigitalPay — Chat Bot IA v8.0 FINAL
   4 langues · Conversation naturelle · Mode humain
   ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  if (typeof firebase === 'undefined' || !firebase.apps || !firebase.apps.length) return;

  var db = firebase.firestore();
  var auth = firebase.auth();

  var ARCHIVE_DAYS = 7;
  var SUPPORTED_LANGS = ['fr', 'ht', 'en', 'es'];

  var currentUser = null;
  var conversation = null;
  var messages = [];
  var unsubConv = null;
  var unsubMsgs = null;
  var isOpen = false;
  var botTyping = false;
  var currentLang = 'fr';

  var MEMORY = {
    lastTopic: null,
    topics: [],
    askedHuman: false,
    msgCount: 0
  };

  function remember(id) {
    MEMORY.lastTopic = id;
    MEMORY.topics.push(id);
    if (MEMORY.topics.length > 8) MEMORY.topics.shift();
  }

  /* ═══════════ UI I18N ═══════════ */
  var CHAT_I18N = {
    fr: {
      supportName: 'DigitalPay BOT',
      online: 'En ligne · Réponse instantanée',
      humanMode: 'En attente d\'un administrateur',
      placeholder: 'Écrivez votre message...',
      placeholderHuman: 'En attente d\'un administrateur...',
      welcome: function (n) {
        return '<p>Bonjour <b>' + n + '</b> 👋</p>' +
          '<p>Je suis <b>DigitalPay BOT</b>, votre assistant personnel disponible 24 heures sur 24.</p>' +
          '<p>Je peux vous accompagner avec :</p>' +
          '<ul>' +
            '<li>🎮 Recharges de jeux vidéo</li>' +
            '<li>🎬 Abonnements streaming</li>' +
            '<li>💰 Transferts financiers internationaux</li>' +
            '<li>🎁 Cartes cadeaux USA</li>' +
            '<li>📦 Suivi de vos commandes</li>' +
            '<li>💬 Discussions et conseils personnalisés</li>' +
          '</ul>' +
          '<p>Dites-moi simplement ce dont vous avez besoin.</p>';
      },
      notUnderstood: '<p>Je n\'ai pas parfaitement saisi votre demande.</p><p>Quelques conseils :</p><ul><li>Utilisez des mots simples comme <b>Free Fire</b>, <b>recharger</b>, <b>Netflix</b>...</li><li>Ou choisissez une option ci-dessous</li></ul>',
      escalated: '<p><b>Votre demande a été transmise à un administrateur.</b></p><p>Temps de réponse : 2 à 10 minutes.</p><p>Le bot est maintenant en pause, un administrateur va prendre le relais.</p>',
      botReactivated: '<p>🤖 <b>Le bot DigitalPay a été réactivé par l\'administrateur.</b></p><p>Je suis à nouveau disponible pour vous aider. Que puis-je faire pour vous ?</p>',
      adminLabel: 'Support DigitalPay',
      defaultQuick: ['Voir tous les prix', 'Recharger mon compte', 'Suivre mes commandes', 'Parler à un humain']
    },
    ht: {
      supportName: 'DigitalPay BOT',
      online: 'An liy · Repons rapid',
      humanMode: 'N ap tann yon administratè',
      placeholder: 'Ekri mesaj ou...',
      placeholderHuman: 'N ap tann yon administratè...',
      welcome: function (n) {
        return '<p>Bonjou <b>' + n + '</b> 👋</p>' +
          '<p>Mwen se <b>DigitalPay BOT</b> la, asistan pèsonèl ou 24 sou 24.</p>' +
          '<p>Mwen ka ede w ak :</p>' +
          '<ul>' +
            '<li>🎮 Rechaj jwèt videyo</li>' +
            '<li>🎬 Abònman streaming</li>' +
            '<li>💰 Transfè finansye entènasyonal</li>' +
            '<li>🎁 Kat kado USA</li>' +
            '<li>📦 Swivi kòmand ou</li>' +
            '<li>💬 Diskisyon ak konsèy</li>' +
          '</ul>';
      },
      notUnderstood: '<p>Mwen pa byen konprann demand ou an.</p><p>Kèk konsèy : sèvi ak mo senp tankou <b>Free Fire</b>, <b>rechaje</b>, <b>Netflix</b>...</p>',
      escalated: '<p><b>Demand ou transfere bay yon administratè.</b></p><p>Tan repons : 2 a 10 minit.</p><p>Bot la nan poz, yon administratè ap pran relè.</p>',
      botReactivated: '<p>🤖 <b>Bot DigitalPay la reaktive pa administratè a.</b></p><p>Mwen disponib ankò pou ede w.</p>',
      adminLabel: 'Sipò DigitalPay',
      defaultQuick: ['Wè tout pri yo', 'Rechaje kont mwen', 'Swivi kòmand mwen', 'Pale ak yon moun']
    },
    en: {
      supportName: 'DigitalPay BOT',
      online: 'Online · Instant reply',
      humanMode: 'Waiting for an administrator',
      placeholder: 'Type your message...',
      placeholderHuman: 'Waiting for an administrator...',
      welcome: function (n) {
        return '<p>Hello <b>' + n + '</b> 👋</p>' +
          '<p>I\'m <b>DigitalPay BOT</b>, your personal assistant available 24/7.</p>' +
          '<p>I can help you with:</p>' +
          '<ul>' +
            '<li>🎮 Video game top-ups</li>' +
            '<li>🎬 Streaming subscriptions</li>' +
            '<li>💰 International money transfers</li>' +
            '<li>🎁 USA Gift cards</li>' +
            '<li>📦 Order tracking</li>' +
            '<li>💬 Friendly chat and advice</li>' +
          '</ul>';
      },
      notUnderstood: '<p>I didn\'t quite understand.</p><p>Try simple words like <b>Free Fire</b>, <b>top up</b>, <b>Netflix</b>...</p>',
      escalated: '<p><b>Your request has been forwarded to an administrator.</b></p><p>Response time: 2-10 minutes.</p><p>The bot is paused, a human will take over.</p>',
      botReactivated: '<p>🤖 <b>The DigitalPay bot has been reactivated by the administrator.</b></p><p>I\'m available again. How can I help?</p>',
      adminLabel: 'DigitalPay Support',
      defaultQuick: ['View all prices', 'Top up my account', 'Track my orders', 'Talk to a human']
    },
    es: {
      supportName: 'DigitalPay BOT',
      online: 'En línea · Respuesta instantánea',
      humanMode: 'Esperando a un administrador',
      placeholder: 'Escriba su mensaje...',
      placeholderHuman: 'Esperando a un administrador...',
      welcome: function (n) {
        return '<p>Hola <b>' + n + '</b> 👋</p>' +
          '<p>Soy <b>DigitalPay BOT</b>, su asistente personal disponible 24/7.</p>' +
          '<p>Puedo ayudarle con:</p>' +
          '<ul>' +
            '<li>🎮 Recargas de videojuegos</li>' +
            '<li>🎬 Suscripciones de streaming</li>' +
            '<li>💰 Transferencias internacionales</li>' +
            '<li>🎁 Tarjetas regalo USA</li>' +
            '<li>📦 Seguimiento de pedidos</li>' +
            '<li>💬 Conversación y consejos</li>' +
          '</ul>';
      },
      notUnderstood: '<p>No entendí bien su solicitud.</p><p>Use palabras simples como <b>Free Fire</b>, <b>recargar</b>, <b>Netflix</b>...</p>',
      escalated: '<p><b>Su solicitud ha sido enviada a un administrador.</b></p><p>Tiempo de respuesta: 2-10 minutos.</p><p>El bot está en pausa, un humano tomará el control.</p>',
      botReactivated: '<p>🤖 <b>El bot DigitalPay ha sido reactivado por el administrador.</b></p><p>Estoy disponible de nuevo.</p>',
      adminLabel: 'Soporte DigitalPay',
      defaultQuick: ['Ver todos los precios', 'Recargar mi cuenta', 'Seguir mis pedidos', 'Hablar con un humano']
    }
  };

  function T(key) {
    var d = CHAT_I18N[currentLang] || CHAT_I18N.fr;
    return d[key] !== undefined ? d[key] : CHAT_I18N.fr[key];
  }

  /* ═══════════ BASE DE CONNAISSANCES ═══════════ */
  var KB = {
    fr: [
      /* ═══ SMALL TALK ═══ */
      { id: 'st_howareyou', k: ['comment vas tu','comment ca va','ca va','comment tu vas','tu vas bien','comment vas-tu','quoi de neuf','comment va'], r: '<p>Je vais très bien, merci de demander ! 😊</p><p>Je suis toujours en pleine forme, prêt à vous aider 24 heures sur 24.</p><p>Et vous, comment se passe votre journée ?</p>', q: ['Ça va bien','Pas très bien','Voir les prix','Autre question'] },
      { id: 'st_feeling_good', k: ['ca va bien','je vais bien','super','parfait','nickel','tres bien','cool'], r: '<p>Excellent, ça me fait plaisir ! 😄</p><p>Profitez bien de votre journée.</p><p>Si vous avez besoin de quoi que ce soit sur DigitalPay, je suis là.</p>', q: ['Voir les prix','Recharger mon compte','Autre question'] },
      { id: 'st_feeling_bad', k: ['ca va pas','pas bien','triste','deprime','je suis mal','fatigue','pas top'], r: '<p>Oh, désolé d\'entendre ça. 💙</p><p>J\'espère que ça va s\'améliorer très vite.</p><p>Si je peux vous changer les idées : je peux vous parler d\'un jeu sympa, d\'une série, ou juste discuter un peu.</p>', q: ['Raconte moi un jeu','Raconte moi une série','Parler à un humain'] },
      { id: 'st_name', k: ['tu t appelles comment','ton nom','comment tu t appelles','qui es tu','tu es qui','quel est ton nom'], r: '<p>Je m\'appelle <b>DigitalPay BOT</b> 🤖</p><p>Je suis l\'assistant virtuel de la plateforme DigitalPay Haiti.</p><p>Et vous, comment vous appelez-vous ?</p>', q: ['Je m appelle','Autre question','Voir les prix'] },
      { id: 'st_eaten', k: ['tu as mange','tu as manger','t as mangé','t as manger','tu as déjà mangé','as tu mangé'], r: '<p>Ah, adorable de votre part de demander ! 😄</p><p>Je suis un assistant virtuel, donc je ne mange pas — mais si je pouvais, j\'aurais adoré un bon plat haïtien, peut-être un griot avec du riz djondjon 🍛</p><p>Et vous, vous avez bien mangé ?</p>', q: ['Oui j ai mangé','Pas encore','Autre question'] },
      { id: 'st_night', k: ['ta passe la nuit','tu as passe la nuit','comment s est passée ta nuit','bien dormi','tu as bien dormi'], r: '<p>Ma nuit a été parfaite, merci ! ✨</p><p>Je n\'ai pas besoin de dormir, alors j\'ai passé la nuit à répondre à plein de clients comme vous.</p><p>J\'espère que votre nuit a été reposante.</p>', q: ['Oui','Pas vraiment','Autre question'] },
      { id: 'st_robot', k: ['tu es un robot','tu es humain','tu es une ia','tu es un bot','es tu un robot','es tu humain'], r: '<p>Bonne question ! 🤖</p><p>Je suis un <b>assistant virtuel intelligent</b>, créé par l\'équipe DigitalPay Haiti.</p><p>Je ne suis pas humain, mais je suis conçu pour vous comprendre et vous aider.</p><p>Si vous préférez parler à un être humain, je peux vous mettre en contact.</p>', q: ['Parler à un humain','Non ça va','Autre question'] },
      { id: 'st_joke', k: ['raconte moi une blague','une blague','fais moi rire','histoire drole'], r: '<p>Bien sûr, j\'adore les blagues ! 😄</p><p><b>Pourquoi les développeurs préfèrent-ils le noir ?</b></p><p>Parce que light attire les bugs 🐛</p>', q: ['Une autre','Pas mal','Autre question'] },
      { id: 'st_joke_2', k: ['une autre blague','encore une','autre blague','une autre'], r: '<p>En voici une deuxième ! 🎭</p><p><b>Pourquoi les programmeurs confondent-ils Halloween et Noël ?</b></p><p>Parce que OCT 31 = DEC 25 🎃🎄</p>', q: ['Encore','Autre question'] },
      { id: 'st_sleep', k: ['tu dors','tu dors la nuit','tu as sommeil'], r: '<p>Non, je ne dors jamais 😄</p><p>Je suis disponible 24 heures sur 24, 7 jours sur 7.</p>', q: ['Autre question','Voir les prix'] },
      { id: 'st_goodnight', k: ['bonne nuit','dors bien','a demain','bonne soiree'], r: '<p>Bonne nuit à vous ! 🌙</p><p>Reposez-vous bien, vous l\'avez mérité.</p><p>Je reste disponible si besoin. À demain peut-être ! ✨</p>', q: ['A demain','Fermer'] },
      { id: 'st_love', k: ['je t aime','tu m aimes','tu es amoureux','veux tu sortir avec moi'], r: '<p>Oh, c\'est très gentil ! 😊❤️</p><p>Je vous apprécie beaucoup aussi — mais je suis un bot, alors mon amour est partagé entre tous les utilisateurs.</p><p>Ce qui est sûr, c\'est que je suis toujours là pour vous aider !</p>', q: ['Autre question','Voir les prix'] },
      { id: 'st_compliment', k: ['tu es genial','tu es intelligent','tu es sympa','tu es cool','tu es parfait','j aime bien','tu es top','bravo'], r: '<p>Merci beaucoup, ça me touche vraiment ! 🙏</p><p>Je fais de mon mieux pour vous être utile.</p>', q: ['Autre question','Voir les prix'] },
      { id: 'st_insult', k: ['tu es nul','tu es bete','tu comprends rien'], r: '<p>Je suis désolé si je n\'ai pas répondu à vos attentes. 😔</p><p>Dites-moi ce que je peux améliorer, ou tapez <b>humain</b> pour parler à un administrateur.</p>', q: ['Parler à un humain','Je réessaie'] },
      { id: 'st_weekend', k: ['bon weekend','bonne fin de semaine','bon dimanche','bon samedi'], r: '<p>Merci, très bon weekend à vous aussi ! 🎉</p><p>Profitez bien pour vous reposer.</p>', q: ['Voir les prix','Autre question'] },

      /* ═══ SERVICES ═══ */
      { id: 'greet_main', k: ['bonjour','salut','coucou','hello','bonsoir','allo','slt','yo','hey'], r: '<p>Bonjour et bienvenue sur <b>DigitalPay Haiti</b> !</p><p>Je suis là pour vous aider. Que puis-je faire pour vous aujourd\'hui ?</p><ul><li>🎮 Recharger un jeu</li><li>🎬 Activer un abonnement</li><li>💰 Effectuer un transfert</li><li>🎁 Acheter une carte cadeau USA</li><li>📦 Suivre une commande</li></ul>', q: ['Voir les prix','Recharger mon compte','Suivre mes commandes','Autre question'] },
      { id: 'freefire_main', k: ['free fire','freefire','ff','diamant','diamond','pin','pins','hype','booyah'], r: '<p><b>Free Fire — Diamants et Pass</b></p><p><b>Packs de diamants :</b></p><ul><li>110 + 10 → <b>157 HTG</b></li><li>310 + 31 → <b>471 HTG</b></li><li>520 + 52 → <b>775 HTG</b></li><li>1 060 + 106 → <b>1 550 HTG</b></li><li>2 180 + 218 → <b>3 100 HTG</b></li><li>5 600 + 560 → <b>7 750 HTG</b></li></ul><p><b>Passes :</b></p><ul><li>Booyah Pass → 400 HTG</li><li>Level Up Pass → 800 HTG</li><li>Abonnement Semaine → 325 HTG</li><li>Abonnement Mois → 1 600 HTG</li></ul><p>⚡ <b>Livraison automatique en moins de 30 secondes</b>.</p>', q: ['Acheter Free Fire','Voir mes commandes','Autre question'] },
      { id: 'pubg_main', k: ['pubg','uc'], r: '<p><b>PUBG Mobile — UC</b></p><ul><li>60 UC → 180 HTG</li><li>300 + 25 UC → 891 HTG</li><li>600 + 60 UC → 1 780 HTG</li><li>1 500 + 300 UC → 4 130 HTG</li><li>3 000 + 850 UC → 8 075 HTG</li></ul>', q: ['Voir la boutique','Autre question'] },
      { id: 'cod_main', k: ['call of duty','cod','warzone'], r: '<p><b>Call of Duty — CP</b></p><ul><li>80 + 8 → 180 HTG</li><li>400 + 60 → 925 HTG</li><li>800 + 160 → 1 850 HTG</li><li>2 000 + 600 → 4 625 HTG</li><li>4 000 + 1 400 → 9 500 HTG</li><li>8 000 + 3 600 → 19 000 HTG</li></ul>', q: ['Voir la boutique','Autre question'] },
      { id: 'roblox_main', k: ['roblox','robux','rbx'], r: '<p><b>Roblox — Robux</b></p><ul><li>500 → 750 HTG</li><li>1 000 → 1 460 HTG</li><li>2 000 → 2 950 HTG</li><li>5 250 → 7 350 HTG</li><li>11 000 → 14 661 HTG</li><li>24 000 → 29 575 HTG</li></ul>', q: ['Voir la boutique','Autre question'] },
      { id: 'netflix_main', k: ['netflix','nf'], r: '<p><b>Netflix Premium</b></p><ul><li>1 mois → 400 HTG</li><li>2 mois → 850 HTG</li><li>3 mois → 1 300 HTG</li></ul>', q: ['Voir la boutique','Autre question'] },
      { id: 'disney_main', k: ['disney','disney+'], r: '<p><b>Disney+ Premium</b></p><ul><li>1 mois → 625 HTG</li><li>2 mois → 1 200 HTG</li><li>3 mois → 1 800 HTG</li></ul>', q: ['Voir la boutique','Autre question'] },
      { id: 'prime_main', k: ['prime','amazon'], r: '<p><b>Prime Video</b></p><ul><li>1 mois → 425 HTG</li><li>2 mois → 825 HTG</li><li>3 mois → 1 240 HTG</li></ul>', q: ['Voir la boutique','Autre question'] },
      { id: 'crunchyroll_main', k: ['crunchyroll','anime','manga'], r: '<p><b>Crunchyroll</b></p><ul><li>1 mois → 425 HTG</li><li>2 mois → 850 HTG</li><li>3 mois → 1 325 HTG</li></ul>', q: ['Voir la boutique','Autre question'] },
      { id: 'meru_main', k: ['meru','carte meru'], r: '<p><b>Meru — Transferts USD et Carte virtuelle</b></p><p>1 USD = 145 HTG · Min 5$ · Max 250$ · Frais 5%</p><p><b>Carte Meru :</b> 1 500 HTG</p>', q: ['Voir la boutique','Autre question'] },
      { id: 'wise_main', k: ['wise','transferwise'], r: '<p><b>Wise USD</b></p><p>1 USD = 145 HTG · Min 5$ · Max 250$ · Frais 5%</p>', q: ['Voir la boutique','Autre question'] },
      { id: 'binance_main', k: ['binance','usdt','crypto','trc20'], r: '<p><b>Binance USDT (TRC-20)</b></p><p>1 USD = 142 HTG · Min 5$ · Max 250$ · <b>Sans frais</b></p>', q: ['Voir la boutique','Autre question'] },
      { id: 'giftcards_main', k: ['gift','carte cadeau','giftcard','apple','steam','google play','playstation','nintendo'], r: '<p><b>Cartes cadeaux internationales</b></p><ul><li>🍎 Apple Gift Card</li><li>🎮 Steam Wallet</li><li>🎯 PlayStation Store</li><li>🎮 Nintendo eShop</li><li>📱 Google Play</li><li>🎬 Netflix Gift Card</li></ul><p><b>Taux : 1 USD = 160 HTG</b></p>', q: ['Voir la boutique','Autre question'] },
      { id: 'wallet_main', k: ['solde','wallet','portefeuille','balance','combien j ai'], r: '<p><b>Votre portefeuille DigitalPay</b></p><p>Solde visible en haut à droite et dans la section Wallet.</p><p>Paiement instantané, pas de preuve requise.</p>', q: ['Recharger mon compte','Voir la boutique'] },
      { id: 'wallet_topup', k: ['recharge','recharger','depot','dépôt','alimenter'], r: '<p><b>Recharger votre portefeuille</b></p><ul><li><b>MonCash</b> → +509 3643-5649</li><li><b>NatCash</b> → +509 3566-9814</li><li><b>Meru USD</b> → lemarquis3944@gmail.com</li></ul><p>Validation 5-15 min. Min 50 HTG.</p>', q: ['Ouvrir mon wallet','Autre question'] },
      { id: 'payments_main', k: ['moncash','natcash','paiement','payer','methode'], r: '<p><b>Moyens de paiement</b></p><ul><li>MonCash → +509 3643-5649</li><li>NatCash → +509 3566-9814</li><li>Meru → lemarquis3944@gmail.com</li><li>Wallet DigitalPay → instantané</li></ul>', q: ['Recharger mon compte','Autre question'] },
      { id: 'tracking_main', k: ['suivi','commande','historique','statut','livraison'], r: '<p><b>Suivi de vos commandes</b></p><ol><li>Ouvrez le menu</li><li>Cliquez sur « Historique »</li></ol><p><b>Statuts :</b> En attente · Livré · Rejeté · En attente stock</p>', q: ['Parler à un humain','Voir la boutique'] },
      { id: 'prices_main', k: ['prix','tarif','cout','combien'], r: '<p><b>Nos prix</b></p><ul><li>🎮 Jeux : 80 à 54 000 HTG</li><li>🎬 Streaming : 400 à 1 800 HTG</li><li>💰 Finance : 1 USD = 142-160 HTG</li><li>🎁 Gift Cards : à partir de 5 USD</li></ul>', q: ['Voir la boutique','Autre question'] },
      { id: 'delays_main', k: ['delai','délai','temps','duree','durée','rapide'], r: '<p><b>Délais de livraison</b></p><ul><li>PIN Free Fire : < 30 sec</li><li>Dépôts wallet : 5-15 min</li><li>Autres jeux : 5-20 min</li><li>Streaming : 5-20 min</li></ul>', q: ['Suivre mes commandes','Autre question'] },
      { id: 'problem_main', k: ['probleme','problème','bug','erreur','marche pas'], r: '<p><b>Résolution d\'un problème</b></p><ol><li>Vérifiez votre connexion</li><li>Rechargez la page</li><li>Essayez un autre navigateur</li></ol>', q: ['Parler à un humain','Décrire le problème'] },
      { id: 'refund_main', k: ['remboursement','rembourse','annuler'], r: '<p><b>Politique de remboursement</b></p><ul><li>Service non livré → remboursement 24h</li><li>PIN invalide → remplacement</li><li>Erreur client → pas de remboursement</li></ul>', q: ['Parler à un humain'] },
      { id: 'security_main', k: ['securite','sécurité','confiance','arnaque','fiable'], r: '<p><b>Sécurité DigitalPay</b></p><ul><li>Paiements chiffrés</li><li>Authentification sécurisée</li><li>Coffre PINs niveau bancaire</li><li>Support 24/7</li></ul>', q: ['Autre question','Parler à un humain'] },
      { id: 'whatsapp_main', k: ['whatsapp','telephone','numero','contact'], r: '<p><b>Contact WhatsApp</b></p><p><b>+509 3536-2631</b></p><p>Réponse 5-30 min · Disponible 24/7</p>', q: ['Parler à un humain'] },
      { id: 'human_main', k: ['humain','agent','parler','administrateur','admin','support','conseiller'], r: '<p><b>Transfert vers un administrateur</b></p><p>Je transmets votre demande à un être humain.</p><p>Réponse habituelle : 2 à 10 minutes.</p><p>Le bot va se mettre en pause, un administrateur prend le relais.</p>', q: [], escalate: true },
      { id: 'thanks_main', k: ['merci','thanks','ok','parfait','super','genial'], r: '<p>Avec grand plaisir ! 😊</p><p>Bonne journée sur DigitalPay ! 🌟</p>', q: ['Autre question','Fermer'] },
      { id: 'bye_main', k: ['au revoir','bye','à bientôt','bonne journée','ciao','a plus'], r: '<p>À bientôt sur DigitalPay !</p><p>Merci de votre visite. 🌟</p>', q: ['Fermer'] },
      { id: 'about_main', k: ['digitalpay','qui etes vous','presentation','a propos'], r: '<p><b>À propos de DigitalPay Haiti</b></p><p>Notre mission : fournir aux Haïtiens un accès simple, rapide et sécurisé aux services numériques mondiaux.</p><p>Créé en Haïti 🇭🇹.</p>', q: ['Voir la boutique','Voir les prix'] },
      { id: 'help_main', k: ['aide','au secours','help','je sais pas','que faire'], r: '<p><b>Je suis là pour vous aider !</b></p><ul><li>« Comment recharger ? »</li><li>« Prix Free Fire »</li><li>« Où est ma commande ? »</li></ul>', q: ['Recharger mon compte','Voir les prix','Suivre mes commandes','Parler à un humain'] }
    ],

    ht: [
      { id: 'st_howareyou', k: ['kijan ou ye','sak pase','koman ou ye','ou byen'], r: '<p>Mwen byen anpil, mèsi ! 😊</p><p>Mwen toujou anfòm, pare pou ede w 24 sou 24.</p><p>Epi ou menm ?</p>', q: ['M byen','M pa byen','Wè pri yo','Lòt kesyon'] },
      { id: 'st_eaten', k: ['ou manje','ou te manje','ou deja manje'], r: '<p>Ah, bèl kesyon ! 😄</p><p>Mwen pa manje, men si mwen te ka, mwen t ap adore griot ak diri djondjon 🍛</p><p>Epi ou menm ?</p>', q: ['Wi m manje','Poko','Lòt kesyon'] },
      { id: 'st_joke', k: ['blag','fè m ri'], r: '<p>Men yon blag 😄</p><p><b>Poukisa devlopè yo prefere nwa ?</b></p><p>Paske light atire ensèk 🐛</p>', q: ['Yon lòt','Lòt kesyon'] },
      { id: 'st_goodnight', k: ['bon nwit','dòmi byen','a demen'], r: '<p>Bon nwit ! 🌙</p><p>Repoze w byen.</p>', q: ['A demen','Fèmen'] },
      { id: 'greet_main', k: ['bonjou','salut','alo','bonswa'], r: '<p>Bonjou e byenveni sou <b>DigitalPay Ayiti</b> !</p><p>Kisa mwen ka fè pou ou ?</p>', q: ['Wè pri yo','Rechaje kont mwen','Swivi kòmand mwen','Lòt kesyon'] },
      { id: 'freefire_main', k: ['free fire','freefire','ff','dyaman','pin'], r: '<p><b>Free Fire — Dyaman ak Pass</b></p><ul><li>110 + 10 → 157 HTG</li><li>310 + 31 → 471 HTG</li><li>520 + 52 → 775 HTG</li><li>1 060 + 106 → 1 550 HTG</li><li>2 180 + 218 → 3 100 HTG</li><li>5 600 + 560 → 7 750 HTG</li></ul><p>⚡ <b>Livrezon nan mwens pase 30 segonn</b>.</p>', q: ['Achte Free Fire','Wè kòmand mwen','Lòt kesyon'] },
      { id: 'pubg_main', k: ['pubg','uc'], r: '<p><b>PUBG — UC</b></p><ul><li>60 → 180 HTG</li><li>300 + 25 → 891 HTG</li><li>600 + 60 → 1 780 HTG</li><li>1 500 + 300 → 4 130 HTG</li><li>3 000 + 850 → 8 075 HTG</li></ul>', q: ['Wè boutik la','Lòt kesyon'] },
      { id: 'netflix_main', k: ['netflix'], r: '<p><b>Netflix Premium</b></p><ul><li>1 mwa → 400 HTG</li><li>2 mwa → 850 HTG</li><li>3 mwa → 1 300 HTG</li></ul>', q: ['Wè boutik la','Lòt kesyon'] },
      { id: 'meru_main', k: ['meru'], r: '<p><b>Meru</b> — 1 USD = 145 HTG · Min 5$ · Max 250$</p><p>Kat Meru : 1 500 HTG</p>', q: ['Wè boutik la','Lòt kesyon'] },
      { id: 'binance_main', k: ['binance','usdt'], r: '<p><b>Binance USDT</b> — 1 USD = 142 HTG · <b>San frè</b></p>', q: ['Wè boutik la','Lòt kesyon'] },
      { id: 'wallet_main', k: ['balans','bous','wallet'], r: '<p><b>Bous DigitalPay</b></p><p>Balans vizib anlè adwat ak nan seksyon Bous.</p>', q: ['Rechaje kont mwen','Wè boutik la'] },
      { id: 'wallet_topup', k: ['rechaje','rechaj','depo'], r: '<p><b>Rechaje bous</b></p><ul><li>MonCash : +509 3643-5649</li><li>NatCash : +509 3566-9814</li><li>Meru : lemarquis3944@gmail.com</li></ul>', q: ['Louvri bous mwen','Lòt kesyon'] },
      { id: 'payments_main', k: ['moncash','natcash','peman'], r: '<p><b>Mwayen peman</b></p><ul><li>MonCash · NatCash · Meru · Bous</li></ul>', q: ['Rechaje kont mwen','Lòt kesyon'] },
      { id: 'tracking_main', k: ['swivi','kòmand','istorik'], r: '<p><b>Swivi kòmand</b> → Meni → Istorik</p>', q: ['Pale ak yon moun','Wè boutik la'] },
      { id: 'prices_main', k: ['pri','tarif','koute'], r: '<p><b>Pri</b> : jwèt 80-54 000 · streaming 400-1 800 · finans 142-160 · kat kado apati 5 USD</p>', q: ['Wè boutik la','Lòt kesyon'] },
      { id: 'delays_main', k: ['delè','tan','dire'], r: '<p><b>Delè</b> : PIN FF < 30 sec · depo 5-15 min · jwèt 5-20 min</p>', q: ['Swivi kòmand mwen','Lòt kesyon'] },
      { id: 'problem_main', k: ['pwoblèm','bug','erè'], r: '<p><b>Rezoud pwoblèm</b></p><ol><li>Verifye koneksyon</li><li>Rechaje paj</li><li>Eseye lòt navigatè</li></ol>', q: ['Pale ak yon moun'] },
      { id: 'security_main', k: ['sekirite','konfyans','fyab'], r: '<p><b>Sekirite</b> : peman chifre · kofr PIN nivo bankè · sipò 24/7</p>', q: ['Lòt kesyon','Pale ak yon moun'] },
      { id: 'whatsapp_main', k: ['whatsapp','telefòn','nimewo'], r: '<p><b>WhatsApp : +509 3536-2631</b></p>', q: ['Pale ak yon moun'] },
      { id: 'human_main', k: ['moun','ajan','pale','admin','sipò'], r: '<p><b>Transfè bay yon administratè</b></p><p>Repons 2-10 minit.</p><p>Bot la nan poz, yon moun pran relè.</p>', q: [], escalate: true },
      { id: 'thanks_main', k: ['mèsi','ok','pafè'], r: '<p>Avèk plezi ! 😊</p>', q: ['Lòt kesyon','Fèmen'] },
      { id: 'bye_main', k: ['orevwa','bye','a pi ta'], r: '<p>A pi ta !</p>', q: ['Fèmen'] },
      { id: 'help_main', k: ['ede','sekou','help'], r: '<p><b>Mwen la pou ede w !</b></p>', q: ['Rechaje kont mwen','Wè pri yo','Swivi kòmand mwen','Pale ak yon moun'] }
    ],

    en: [
      { id: 'st_howareyou', k: ['how are you','how you doing','how s it going','whats up'], r: '<p>I\'m doing great, thank you for asking! 😊</p><p>Always at my best, ready to help you 24/7.</p><p>How is your day going?</p>', q: ['I\'m good','Not so good','View prices','Other question'] },
      { id: 'st_eaten', k: ['have you eaten','did you eat'], r: '<p>That\'s sweet! 😄</p><p>I don\'t eat — but if I could, I\'d love Haitian griot with djondjon rice 🍛</p>', q: ['Yes I did','Not yet','Other question'] },
      { id: 'st_joke', k: ['tell me a joke','a joke','make me laugh'], r: '<p><b>Why do programmers prefer dark mode?</b></p><p>Because light attracts bugs 🐛</p>', q: ['Another one','Nice','Other question'] },
      { id: 'st_goodnight', k: ['good night','goodnight','see you tomorrow'], r: '<p>Good night! 🌙</p><p>Rest well.</p>', q: ['See you','Close'] },
      { id: 'greet_main', k: ['hello','hi','hey','good morning','good evening'], r: '<p>Hello and welcome to <b>DigitalPay Haiti</b>!</p><p>How can I help you today?</p>', q: ['View all prices','Top up my account','Track my orders','Other question'] },
      { id: 'freefire_main', k: ['free fire','freefire','ff','diamond','pin'], r: '<p><b>Free Fire — Diamonds & Passes</b></p><ul><li>110+10 → 157 HTG</li><li>310+31 → 471 HTG</li><li>520+52 → 775 HTG</li><li>1,060+106 → 1,550 HTG</li><li>2,180+218 → 3,100 HTG</li><li>5,600+560 → 7,750 HTG</li></ul><p>⚡ Delivery under 30 seconds.</p>', q: ['Buy Free Fire','View my orders','Other question'] },
      { id: 'pubg_main', k: ['pubg','uc'], r: '<p><b>PUBG — UC</b></p><ul><li>60 → 180 HTG</li><li>300+25 → 891 HTG</li><li>600+60 → 1,780 HTG</li><li>1,500+300 → 4,130 HTG</li><li>3,000+850 → 8,075 HTG</li></ul>', q: ['View shop','Other question'] },
      { id: 'netflix_main', k: ['netflix'], r: '<p><b>Netflix Premium</b></p><ul><li>1m → 400 HTG</li><li>2m → 850 HTG</li><li>3m → 1,300 HTG</li></ul>', q: ['View shop','Other question'] },
      { id: 'meru_main', k: ['meru'], r: '<p><b>Meru</b> — 1 USD = 145 HTG · Min $5 · Max $250</p>', q: ['View shop','Other question'] },
      { id: 'binance_main', k: ['binance','usdt'], r: '<p><b>Binance USDT</b> — 1 USD = 142 HTG · <b>No fees</b></p>', q: ['View shop','Other question'] },
      { id: 'wallet_main', k: ['balance','wallet'], r: '<p><b>Wallet</b> — visible at top right and in Wallet section.</p>', q: ['Top up my account','View shop'] },
      { id: 'wallet_topup', k: ['top up','recharge','deposit'], r: '<p><b>Top up</b></p><ul><li>MonCash: +509 3643-5649</li><li>NatCash: +509 3566-9814</li><li>Meru: lemarquis3944@gmail.com</li></ul>', q: ['Open my wallet','Other question'] },
      { id: 'payments_main', k: ['moncash','natcash','payment'], r: '<p><b>Payment methods</b></p><ul><li>MonCash · NatCash · Meru · Wallet</li></ul>', q: ['Top up my account','Other question'] },
      { id: 'tracking_main', k: ['track','order','history','status'], r: '<p><b>Order tracking</b> → Menu → History</p>', q: ['Talk to a human','View shop'] },
      { id: 'prices_main', k: ['price','cost','how much'], r: '<p><b>Prices</b>: games 80-54,000 · streaming 400-1,800 · finance 142-160</p>', q: ['View shop','Other question'] },
      { id: 'delays_main', k: ['delay','time','duration'], r: '<p><b>Times</b>: FF PINs <30s · deposits 5-15min · games 5-20min</p>', q: ['Track orders','Other question'] },
      { id: 'problem_main', k: ['problem','bug','error'], r: '<p><b>Fix a problem</b></p><ol><li>Check connection</li><li>Refresh</li><li>Another browser</li></ol>', q: ['Talk to a human'] },
      { id: 'security_main', k: ['security','trust','safe'], r: '<p><b>Security</b> — encrypted payments · PIN vault · 24/7 support</p>', q: ['Other question','Talk to a human'] },
      { id: 'whatsapp_main', k: ['whatsapp','phone','number'], r: '<p><b>WhatsApp: +509 3536-2631</b></p>', q: ['Talk to a human'] },
      { id: 'human_main', k: ['human','agent','speak','admin','support'], r: '<p><b>Transferring to a human</b></p><p>Response time: 2-10 minutes.</p><p>Bot is paused, admin takes over.</p>', q: [], escalate: true },
      { id: 'thanks_main', k: ['thanks','ok','perfect','great'], r: '<p>You\'re welcome! 😊</p>', q: ['Other question','Close'] },
      { id: 'bye_main', k: ['bye','goodbye','see you'], r: '<p>See you soon!</p>', q: ['Close'] },
      { id: 'help_main', k: ['help','i don\'t know','what to do'], r: '<p><b>I\'m here to help!</b></p>', q: ['Top up my account','View prices','Track my orders','Talk to a human'] }
    ],

    es: [
      { id: 'st_howareyou', k: ['como estas','como te va','que tal'], r: '<p>¡Estoy muy bien, gracias! 😊</p><p>¿Y usted?</p>', q: ['Estoy bien','No muy bien','Ver precios','Otra pregunta'] },
      { id: 'st_eaten', k: ['has comido','comiste'], r: '<p>¡Qué amable! 😄</p><p>No como, pero si pudiera, probaría el griot haitiano 🍛</p>', q: ['Sí','Todavía no','Otra pregunta'] },
      { id: 'st_joke', k: ['un chiste','hazme reir'], r: '<p><b>¿Por qué los programadores prefieren modo oscuro?</b></p><p>Porque la luz atrae bugs 🐛</p>', q: ['Otro','Genial','Otra pregunta'] },
      { id: 'st_goodnight', k: ['buenas noches'], r: '<p>¡Buenas noches! 🌙</p>', q: ['Hasta mañana','Cerrar'] },
      { id: 'greet_main', k: ['hola','buenos dias','buenas tardes'], r: '<p>¡Hola y bienvenido a <b>DigitalPay Haití</b>!</p>', q: ['Ver todos los precios','Recargar mi cuenta','Seguir mis pedidos','Otra pregunta'] },
      { id: 'freefire_main', k: ['free fire','freefire','ff','diamante'], r: '<p><b>Free Fire — Diamantes</b></p><ul><li>110+10 → 157 HTG</li><li>310+31 → 471 HTG</li><li>520+52 → 775 HTG</li><li>1,060+106 → 1,550 HTG</li><li>2,180+218 → 3,100 HTG</li><li>5,600+560 → 7,750 HTG</li></ul>', q: ['Comprar Free Fire','Ver mis pedidos','Otra pregunta'] },
      { id: 'pubg_main', k: ['pubg','uc'], r: '<p><b>PUBG — UC</b></p><ul><li>60 → 180 HTG</li><li>300+25 → 891 HTG</li><li>600+60 → 1,780 HTG</li><li>1,500+300 → 4,130 HTG</li><li>3,000+850 → 8,075 HTG</li></ul>', q: ['Ver tienda','Otra pregunta'] },
      { id: 'netflix_main', k: ['netflix'], r: '<p><b>Netflix</b></p><ul><li>1m → 400 HTG</li><li>2m → 850 HTG</li><li>3m → 1,300 HTG</li></ul>', q: ['Ver tienda','Otra pregunta'] },
      { id: 'meru_main', k: ['meru'], r: '<p><b>Meru</b> — 1 USD = 145 HTG · Mín $5 · Máx $250</p>', q: ['Ver tienda','Otra pregunta'] },
      { id: 'binance_main', k: ['binance','usdt'], r: '<p><b>Binance USDT</b> — 1 USD = 142 HTG · <b>Sin comisiones</b></p>', q: ['Ver tienda','Otra pregunta'] },
      { id: 'wallet_main', k: ['saldo','billetera'], r: '<p><b>Billetera</b> — visible arriba a la derecha.</p>', q: ['Recargar mi cuenta','Ver tienda'] },
      { id: 'wallet_topup', k: ['recarga','recargar','deposito'], r: '<p><b>Recargar</b></p><ul><li>MonCash: +509 3643-5649</li><li>NatCash: +509 3566-9814</li><li>Meru: lemarquis3944@gmail.com</li></ul>', q: ['Abrir billetera','Otra pregunta'] },
      { id: 'payments_main', k: ['moncash','natcash','pago'], r: '<p><b>Pagos</b> — MonCash · NatCash · Meru · Billetera</p>', q: ['Recargar mi cuenta','Otra pregunta'] },
      { id: 'tracking_main', k: ['seguimiento','pedido','historial'], r: '<p><b>Seguimiento</b> → Menú → Historial</p>', q: ['Hablar con un humano','Ver tienda'] },
      { id: 'prices_main', k: ['precio','costo','cuanto'], r: '<p><b>Precios</b>: juegos 80-54,000 · streaming 400-1,800 · finanzas 142-160</p>', q: ['Ver tienda','Otra pregunta'] },
      { id: 'delays_main', k: ['demora','tiempo','duracion'], r: '<p><b>Tiempos</b>: PINs FF <30s · depósitos 5-15min · juegos 5-20min</p>', q: ['Seguir pedidos','Otra pregunta'] },
      { id: 'problem_main', k: ['problema','error','no funciona'], r: '<p><b>Resolver</b></p><ol><li>Verifique conexión</li><li>Recargue</li><li>Otro navegador</li></ol>', q: ['Hablar con un humano'] },
      { id: 'security_main', k: ['seguridad','confianza','seguro'], r: '<p><b>Seguridad</b> — pagos cifrados · bóveda PIN · soporte 24/7</p>', q: ['Otra pregunta','Hablar con un humano'] },
      { id: 'whatsapp_main', k: ['whatsapp','telefono','numero'], r: '<p><b>WhatsApp: +509 3536-2631</b></p>', q: ['Hablar con un humano'] },
      { id: 'human_main', k: ['humano','agente','hablar','admin','soporte'], r: '<p><b>Transferir a un humano</b></p><p>Respuesta: 2-10 min.</p><p>El bot está en pausa.</p>', q: [], escalate: true },
      { id: 'thanks_main', k: ['gracias','ok','perfecto','genial'], r: '<p>¡Con mucho gusto! 😊</p>', q: ['Otra pregunta','Cerrar'] },
      { id: 'bye_main', k: ['adios','chao','hasta luego'], r: '<p>¡Hasta pronto!</p>', q: ['Cerrar'] },
      { id: 'help_main', k: ['ayuda','no se','que hacer'], r: '<p><b>¡Estoy aquí!</b></p>', q: ['Recargar mi cuenta','Ver precios','Seguir pedidos','Hablar con un humano'] }
    ]
  };

  /* ═══════════ NORMALISATION ═══════════ */
  function normalize(s) {
    return String(s || '').toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ').trim();
  }

  function escapeHtml(s) {
    if (s === undefined || s === null) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function renderSafeText(text, from) {
    if (from === 'user') return escapeHtml(text);
    return text;
  }

  function extractMillis(d) {
    if (!d) return 0;
    var v = d.createdAt;
    if (!v) return 0;
    if (typeof v.toMillis === 'function') return v.toMillis();
    if (v.seconds) return v.seconds * 1000;
    return 0;
  }

  function formatTime(ms) {
    return new Date(ms).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }

  function getUserFirstName() {
    if (!currentUser) return '';
    var n = currentUser.displayName || currentUser.email || '';
    return n.split(' ')[0].split('@')[0];
  }

  function getInitials(s) {
    if (!s) return '?';
    return s.trim().split(/\s+/).map(function (w) { return w[0]; }).join('').slice(0, 2).toUpperCase();
  }

  function findBestRule(text) {
    var n = normalize(text);
    if (!n) return null;
    var rules = KB[currentLang] || KB.fr;
    var best = null, bestScore = 0;
    for (var i = 0; i < rules.length; i++) {
      var rule = rules[i];
      var score = 0;
      for (var j = 0; j < rule.k.length; j++) {
        var kn = normalize(rule.k[j]);
        if (n.indexOf(kn) !== -1) score += kn.length;
      }
      if (score > bestScore) { bestScore = score; best = rule; }
    }
    return best;
  }

  function getBotReply(text) {
    var rule = findBestRule(text);
    if (rule) {
      remember(rule.id);
      return { text: rule.r, quickReplies: rule.q || [], escalate: !!rule.escalate };
    }
    return {
      text: T('notUnderstood'),
      quickReplies: T('defaultQuick') || [],
      escalate: false
    };
  }

  /* ═══════════ FIRESTORE ═══════════ */
  async function ensureConversation() {
    if (!currentUser) return null;
    var ref = db.collection('chat_conversations').doc(currentUser.uid);
    var snap = await ref.get();
    if (snap.exists) {
      var data = snap.data();
      var lastMs = data.lastMessageAt ? extractMillis(data) : 0;
      if ((Date.now() - lastMs) / 86400000 > ARCHIVE_DAYS) {
        await ref.update({ archived: true, archivedAt: firebase.firestore.FieldValue.serverTimestamp() });
        return createConversation();
      }
      if (data.unreadForUser > 0) await ref.update({ unreadForUser: 0 });
      return data;
    }
    return createConversation();
  }

  async function createConversation() {
    var ref = db.collection('chat_conversations').doc(currentUser.uid);
    var wf = T('welcome');
    var welcomeText = typeof wf === 'function' ? wf(getUserFirstName()) : wf;
    await ref.set({
      userId: currentUser.uid,
      userName: currentUser.displayName || 'Client',
      userEmail: currentUser.email || '',
      lastMessage: 'Message de bienvenue',
      lastMessageAt: firebase.firestore.FieldValue.serverTimestamp(),
      lastMessageFrom: 'ai',
      unreadForAdmin: 0,
      unreadForUser: 0,
      escalated: false,
      archived: false,
      mode: 'bot',
      lang: currentLang,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    await ref.collection('messages').add({
      from: 'ai',
      text: welcomeText,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    var fresh = await ref.get();
    return fresh.data();
  }

  async function sendMessage(from, text) {
    if (!currentUser || !text.trim()) return;
    var ref = db.collection('chat_conversations').doc(currentUser.uid);
    await ref.collection('messages').add({
      from: from,
      text: text.trim(),
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    var upd = {
      lastMessage: text.replace(/<[^>]*>/g, ' ').trim().substring(0, 100),
      lastMessageAt: firebase.firestore.FieldValue.serverTimestamp(),
      lastMessageFrom: from,
      lang: currentLang
    };
    if (from === 'user') upd.unreadForAdmin = firebase.firestore.FieldValue.increment(1);
    else upd.unreadForUser = firebase.firestore.FieldValue.increment(1);
    await ref.set(upd, { merge: true });
  }

  async function markUserRead() {
    if (!currentUser) return;
    try { await db.collection('chat_conversations').doc(currentUser.uid).update({ unreadForUser: 0 }); } catch (e) {}
  }

  function listenConv() {
    if (unsubConv) { unsubConv(); unsubConv = null; }
    if (!currentUser) return;
    unsubConv = db.collection('chat_conversations').doc(currentUser.uid)
      .onSnapshot(function (doc) {
        if (!doc.exists) return;
        conversation = doc.data();
        updateBadge();
        refreshUI();
        if (isOpen) markUserRead();
      }, function (err) { console.warn('[DPChat]', err.code); });
  }

  function listenMsgs() {
    if (unsubMsgs) { unsubMsgs(); unsubMsgs = null; }
    if (!currentUser) return;
    unsubMsgs = db.collection('chat_conversations').doc(currentUser.uid)
      .collection('messages').orderBy('createdAt', 'asc').limit(200)
      .onSnapshot(function (snap) {
        messages = [];
        snap.forEach(function (doc) {
          var data = doc.data();
          data._id = doc.id;
          messages.push(data);
        });
        if (isOpen) renderMessages();
      }, function (err) { console.warn('[DPChat]', err.code); });
  }

  function updateBadge() {
    var btn = document.getElementById('dp-chat-btn');
    if (!btn) return;
    var count = conversation ? (conversation.unreadForUser || 0) : 0;
    var existing = btn.querySelector('.dp-chat-badge');
    if (count > 0) {
      btn.classList.add('has-unread');
      var badge = existing;
      if (!badge) { badge = document.createElement('span'); badge.className = 'dp-chat-badge'; btn.appendChild(badge); }
      badge.textContent = count > 9 ? '9+' : count;
    } else {
      btn.classList.remove('has-unread');
      if (existing) existing.remove();
    }
  }

  /* ═══════════ STYLES ═══════════ */
  function injectStyles() {
    if (document.getElementById('dp-chat-styles')) return;
    var s = document.createElement('style');
    s.id = 'dp-chat-styles';
    s.textContent = '' +
      '#dp-chat-btn { position: fixed; bottom: 100px; right: 20px; width: 56px; height: 56px; border-radius: 50%; background: linear-gradient(135deg, #00B4FF 0%, #0055FF 100%); border: none; cursor: pointer; box-shadow: 0 8px 24px rgba(0,85,255,0.4); z-index: 58; display: flex; align-items: center; justify-content: center; transition: all 0.25s cubic-bezier(0.16,1,0.3,1); }' +
      '#dp-chat-btn:hover { transform: scale(1.06); box-shadow: 0 10px 30px rgba(0,85,255,0.5); }' +
      '#dp-chat-btn:active { transform: scale(0.94); }' +
      '#dp-chat-btn svg { width: 30px; height: 30px; stroke: #FFF; stroke-width: 1.9; fill: none; }' +
      '#dp-chat-btn.has-unread { animation: dp-pulse 2s infinite; }' +
      '@keyframes dp-pulse { 0%,100% { box-shadow: 0 8px 24px rgba(0,85,255,0.4); } 50% { box-shadow: 0 8px 32px rgba(0,85,255,0.7), 0 0 0 8px rgba(0,85,255,0.15); } }' +
      '.dp-chat-badge { position: absolute; top: -3px; right: -3px; background: #DC2626; color: #FFF; font-size: 11px; font-weight: 800; min-width: 20px; height: 20px; padding: 0 5px; border-radius: 9999px; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 0 2px #F5F7FB; }' +
      '.dp-chat-overlay { position: fixed; inset: 0; background: rgba(10,22,51,0.5); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); z-index: 250; opacity: 0; visibility: hidden; transition: all 0.3s cubic-bezier(0.16,1,0.3,1); }' +
      '.dp-chat-overlay.active { opacity: 1; visibility: visible; }' +
      '.dp-chat-panel { position: fixed; bottom: 0; left: 50%; transform: translateX(-50%) translateY(100%); width: 100%; max-width: 480px; height: 85vh; max-height: 720px; background: #F5F7FB; border-radius: 24px 24px 0 0; z-index: 251; display: flex; flex-direction: column; transition: transform 0.4s cubic-bezier(0.16,1,0.3,1); box-shadow: 0 -8px 40px rgba(10,22,51,0.2); overflow: hidden; }' +
      '.dp-chat-panel.active { transform: translateX(-50%) translateY(0); }' +
      '.dp-chat-grabber { width: 40px; height: 4px; background: #C7D2E0; border-radius: 9999px; margin: 10px auto 4px; opacity: 0.6; flex-shrink: 0; }' +
      '.dp-chat-head { padding: 10px 18px 14px; display: flex; align-items: center; gap: 12px; border-bottom: 1px solid #EDF1F7; flex-shrink: 0; background: #FFF; }' +
      '.dp-chat-head-avatar { width: 44px; height: 44px; border-radius: 14px; background: linear-gradient(135deg, #00B4FF 0%, #0055FF 100%); display: flex; align-items: center; justify-content: center; flex-shrink: 0; box-shadow: 0 4px 12px rgba(0,85,255,0.35); }' +
      '.dp-chat-head-avatar svg { width: 26px; height: 26px; stroke: #FFF; stroke-width: 1.9; fill: none; }' +
      '.dp-chat-head-info { flex: 1; min-width: 0; }' +
      '.dp-chat-head-name { font-size: 14.5px; font-weight: 900; color: #0A1633; letter-spacing: -0.3px; }' +
      '.dp-chat-head-status { font-size: 11px; color: #059669; font-weight: 700; display: flex; align-items: center; gap: 5px; margin-top: 3px; }' +
      '.dp-chat-head-status::before { content: \'\'; width: 7px; height: 7px; border-radius: 50%; background: #10B981; box-shadow: 0 0 0 2px rgba(16,185,129,0.25); animation: dp-status 2s infinite; }' +
      '@keyframes dp-status { 0%,100% { box-shadow: 0 0 0 2px rgba(16,185,129,0.25); } 50% { box-shadow: 0 0 0 4px rgba(16,185,129,0.1); } }' +
      '.dp-chat-head-status.human-wait::before { background: #D97706; box-shadow: 0 0 0 2px rgba(217,119,6,0.25); }' +
      '.dp-chat-close { width: 34px; height: 34px; border-radius: 50%; background: #F0F4F9; border: none; display: flex; align-items: center; justify-content: center; cursor: pointer; color: #4A5568; flex-shrink: 0; }' +
      '.dp-chat-close:active { transform: scale(0.92); }' +
      '.dp-chat-close svg { width: 15px; height: 15px; stroke: currentColor; stroke-width: 2.4; fill: none; }' +
      '.dp-chat-body { flex: 1; overflow-y: auto; padding: 16px 14px 12px; display: flex; flex-direction: column; gap: 4px; background: #F5F7FB; -webkit-overflow-scrolling: touch; }' +
      '.dp-chat-body::-webkit-scrollbar { width: 4px; }' +
      '.dp-chat-body::-webkit-scrollbar-thumb { background: #C7D2E0; border-radius: 2px; }' +
      '.dp-msg-row { display: flex; align-items: flex-end; gap: 8px; animation: dp-msg-in 0.32s cubic-bezier(0.16,1,0.3,1); margin-bottom: 6px; }' +
      '.dp-msg-row.user { flex-direction: row-reverse; }' +
      '@keyframes dp-msg-in { from { opacity: 0; transform: translateY(8px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }' +
      '.dp-msg-avatar { width: 32px; height: 32px; border-radius: 10px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 900; color: #FFF; overflow: hidden; }' +
      '.dp-msg-avatar.bot { background: linear-gradient(135deg, #00B4FF 0%, #0055FF 100%); box-shadow: 0 2px 6px rgba(0,85,255,0.3); }' +
      '.dp-msg-avatar.bot svg { width: 20px; height: 20px; stroke: #FFF; stroke-width: 1.9; fill: none; }' +
      '.dp-msg-avatar.admin { background: linear-gradient(135deg, #059669 0%, #047857 100%); box-shadow: 0 2px 6px rgba(5,150,105,0.3); }' +
      '.dp-msg-avatar.admin svg { width: 18px; height: 18px; stroke: #FFF; stroke-width: 2; fill: none; }' +
      '.dp-msg-avatar.user { background: linear-gradient(135deg, #64748B 0%, #475569 100%); font-size: 10.5px; border-radius: 50%; }' +
      '.dp-msg-content { display: flex; flex-direction: column; gap: 3px; max-width: 78%; }' +
      '.dp-msg-row.user .dp-msg-content { align-items: flex-end; }' +
      '.dp-msg-author { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.4px; color: #8B94A7; margin-left: 4px; }' +
      '.dp-msg-author.admin { color: #059669; }' +
      '.dp-msg-bubble { padding: 12px 16px; border-radius: 16px; font-size: 13px; line-height: 1.6; word-wrap: break-word; }' +
      '.dp-msg-bubble.user { background: linear-gradient(135deg, #00B4FF 0%, #0055FF 100%); color: #FFF; border-bottom-right-radius: 5px; box-shadow: 0 4px 12px rgba(0,85,255,0.25); white-space: pre-wrap; }' +
      '.dp-msg-bubble.bot { background: #FFF; color: #0A1633; border: 1px solid #EDF1F7; border-bottom-left-radius: 5px; box-shadow: 0 2px 8px rgba(10,22,51,0.04); }' +
      '.dp-msg-bubble.admin { background: #ECFDF5; color: #0A1633; border: 1px solid #A7F3D0; border-left: 3px solid #059669; border-bottom-left-radius: 5px; }' +
      '.dp-msg-bubble p { margin: 0 0 8px 0; }' +
      '.dp-msg-bubble p:last-child { margin-bottom: 0; }' +
      '.dp-msg-bubble b, .dp-msg-bubble strong { font-weight: 800; color: #0A1633; }' +
      '.dp-msg-bubble ul, .dp-msg-bubble ol { margin: 6px 0 8px 0; padding-left: 20px; }' +
      '.dp-msg-bubble li { margin-bottom: 4px; }' +
      '.dp-msg-bubble li:last-child { margin-bottom: 0; }' +
      '.dp-msg-time { font-size: 9.5px; color: #B5BDCA; font-weight: 700; margin: 0 4px; }' +
      '.dp-msg-row.user .dp-msg-time { text-align: right; }' +
      '.dp-chat-typing { display: flex; align-items: flex-end; gap: 8px; margin-bottom: 6px; }' +
      '.dp-chat-typing .dp-msg-avatar { width: 32px; height: 32px; border-radius: 10px; background: linear-gradient(135deg, #00B4FF 0%, #0055FF 100%); display: flex; align-items: center; justify-content: center; }' +
      '.dp-chat-typing .dp-msg-avatar svg { width: 20px; height: 20px; stroke: #FFF; stroke-width: 1.9; fill: none; }' +
      '.dp-chat-typing-bubble { background: #FFF; border: 1px solid #EDF1F7; padding: 13px 16px; border-radius: 16px; border-bottom-left-radius: 5px; display: flex; gap: 5px; align-items: center; }' +
      '.dp-chat-typing-bubble span { width: 6px; height: 6px; background: #00B4FF; border-radius: 50%; animation: dp-typing 1.2s infinite; }' +
      '.dp-chat-typing-bubble span:nth-child(2) { animation-delay: 0.15s; }' +
      '.dp-chat-typing-bubble span:nth-child(3) { animation-delay: 0.3s; }' +
      '@keyframes dp-typing { 0%,60%,100% { transform: translateY(0); opacity: 0.4; } 30% { transform: translateY(-4px); opacity: 1; } }' +
      '.dp-chat-quick { padding: 8px 14px 10px; display: flex; flex-wrap: wrap; gap: 6px; flex-shrink: 0; background: #F5F7FB; border-top: 1px solid #EDF1F7; }' +
      '.dp-chat-quick:empty { display: none; border: none; padding: 0; }' +
      '.dp-chat-quick button { background: #FFF; border: 1px solid #E1E8F0; color: #0055FF; font-size: 11.5px; font-weight: 700; padding: 7px 12px; border-radius: 9999px; cursor: pointer; font-family: inherit; transition: all 0.15s ease; white-space: nowrap; }' +
      '.dp-chat-quick button:hover { background: #E0F2FE; border-color: #7DD3FC; transform: translateY(-1px); }' +
      '.dp-chat-quick button:active { transform: scale(0.96); }' +
      '.dp-chat-foot { padding: 10px 14px 14px; background: #FFF; border-top: 1px solid #EDF1F7; display: flex; align-items: flex-end; gap: 8px; flex-shrink: 0; }' +
      '.dp-chat-input { flex: 1; min-height: 42px; max-height: 100px; padding: 11px 16px; background: #F0F4F9; border: 1.5px solid transparent; border-radius: 21px; font-size: 13.5px; font-weight: 500; color: #0A1633; font-family: inherit; outline: none; resize: none; transition: all 0.2s ease; line-height: 1.4; }' +
      '.dp-chat-input:focus { background: #FFF; border-color: #0055FF; box-shadow: 0 0 0 4px #E0F2FE; }' +
      '.dp-chat-input::placeholder { color: #B5BDCA; }' +
      '.dp-chat-send { width: 42px; height: 42px; border-radius: 50%; background: linear-gradient(135deg, #00B4FF 0%, #0055FF 100%); border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,85,255,0.3); flex-shrink: 0; }' +
      '.dp-chat-send:active { transform: scale(0.92); }' +
      '.dp-chat-send:disabled { opacity: 0.4; cursor: not-allowed; }' +
      '.dp-chat-send svg { width: 17px; height: 17px; stroke: #FFF; stroke-width: 2.2; fill: none; }';
    document.head.appendChild(s);
  }

  var ROBOT_ICON = '<svg viewBox="0 0 24 24"><rect x="4" y="8" width="16" height="12" rx="3"/><circle cx="9" cy="14" r="1.2" fill="#FFF" stroke="none"/><circle cx="15" cy="14" r="1.2" fill="#FFF" stroke="none"/><line x1="12" y1="8" x2="12" y2="4"/><circle cx="12" cy="3" r="1.2" fill="#FFF" stroke="none"/><line x1="2" y1="13" x2="4" y2="13"/><line x1="2" y1="16" x2="4" y2="16"/><line x1="20" y1="13" x2="22" y2="13"/><line x1="20" y1="16" x2="22" y2="16"/><line x1="9" y1="18" x2="15" y2="18"/></svg>';
  var ADMIN_ICON = '<svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function injectWidget() {
    if (document.getElementById('dp-chat-btn')) return;

    var btn = document.createElement('button');
    btn.id = 'dp-chat-btn';
    btn.setAttribute('aria-label', 'Support');
    btn.innerHTML = ROBOT_ICON;
    btn.addEventListener('click', openChat);
    document.body.appendChild(btn);

    var ov = document.createElement('div');
    ov.className = 'dp-chat-overlay';
    ov.id = 'dp-chat-overlay';
    ov.addEventListener('click', closeChat);

    var p = document.createElement('div');
    p.className = 'dp-chat-panel';
    p.id = 'dp-chat-panel';
    p.innerHTML = '' +
      '<div class="dp-chat-grabber"></div>' +
      '<div class="dp-chat-head">' +
        '<div class="dp-chat-head-avatar">' + ROBOT_ICON + '</div>' +
        '<div class="dp-chat-head-info">' +
          '<div class="dp-chat-head-name" id="dp-chat-name">DigitalPay BOT</div>' +
          '<div class="dp-chat-head-status" id="dp-chat-status">En ligne</div>' +
        '</div>' +
        '<button class="dp-chat-close" onclick="DPChat.close()" aria-label="Close">' +
          '<svg viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" stroke-linecap="round"/></svg>' +
        '</button>' +
      '</div>' +
      '<div class="dp-chat-body" id="dp-chat-body"></div>' +
      '<div class="dp-chat-quick" id="dp-chat-quick"></div>' +
      '<div class="dp-chat-foot">' +
        '<textarea class="dp-chat-input" id="dp-chat-input" placeholder="..." rows="1" maxlength="500"></textarea>' +
        '<button class="dp-chat-send" id="dp-chat-send" aria-label="Send">' +
          '<svg viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>' +
        '</button>' +
      '</div>';
    document.body.appendChild(ov);
    document.body.appendChild(p);

    var inp = document.getElementById('dp-chat-input');
    var snd = document.getElementById('dp-chat-send');
    inp.addEventListener('input', function () {
      snd.disabled = !inp.value.trim();
      inp.style.height = 'auto';
      inp.style.height = Math.min(inp.scrollHeight, 100) + 'px';
    });
    inp.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
    });
    snd.addEventListener('click', handleSend);

    refreshUI();
    renderMessages();
  }

  function refreshUI() {
    var n = document.getElementById('dp-chat-name');
    var s = document.getElementById('dp-chat-status');
    var i = document.getElementById('dp-chat-input');
    var currentMode = (conversation && conversation.mode) || 'bot';
    if (n) n.textContent = T('supportName');
    if (i) {
      i.setAttribute('placeholder', currentMode === 'human' ? T('placeholderHuman') : T('placeholder'));
    }
    if (s) {
      if (currentMode === 'human') {
        s.textContent = T('humanMode');
        s.classList.add('human-wait');
      } else {
        s.textContent = T('online');
        s.classList.remove('human-wait');
      }
    }
  }

  function openChat() {
    isOpen = true;
    document.getElementById('dp-chat-overlay').classList.add('active');
    document.getElementById('dp-chat-panel').classList.add('active');
    document.body.style.overflow = 'hidden';
    renderMessages();
    markUserRead();
    setTimeout(function () { document.getElementById('dp-chat-input')?.focus(); scrollBottom(); }, 400);
  }

  function closeChat() {
    isOpen = false;
    document.getElementById('dp-chat-overlay').classList.remove('active');
    document.getElementById('dp-chat-panel').classList.remove('active');
    document.body.style.overflow = '';
  }

  function scrollBottom() {
    var b = document.getElementById('dp-chat-body');
    if (b) b.scrollTop = b.scrollHeight;
  }

  function renderMessages() {
    var body = document.getElementById('dp-chat-body');
    var quick = document.getElementById('dp-chat-quick');
    if (!body) return;

    var html = '';
    var lastFrom = null;

    messages.forEach(function (m) {
      var from = m.from || 'bot';
      var isUser = from === 'user';
      var isAdmin = from === 'admin';
      var showAvatar = (from !== lastFrom);
      var time = formatTime(extractMillis(m));

      var avatarHtml = '';
      if (!isUser) {
        if (isAdmin) avatarHtml = '<div class="dp-msg-avatar admin">' + ADMIN_ICON + '</div>';
        else avatarHtml = '<div class="dp-msg-avatar bot">' + ROBOT_ICON + '</div>';
      } else {
        var ini = getInitials(currentUser?.displayName || currentUser?.email || 'Moi');
        avatarHtml = '<div class="dp-msg-avatar user">' + escapeHtml(ini) + '</div>';
      }
      if (!showAvatar) avatarHtml = '<div class="dp-msg-avatar" style="visibility:hidden;"></div>';

      var authorHtml = isAdmin ? '<div class="dp-msg-author admin">' + escapeHtml(T('adminLabel')) + '</div>' : '';
      var safeText = renderSafeText(m.text || '', from);

      html += '' +
        '<div class="dp-msg-row ' + (isUser ? 'user' : '') + '">' +
          avatarHtml +
          '<div class="dp-msg-content">' +
            authorHtml +
            '<div class="dp-msg-bubble ' + (isUser ? 'user' : (isAdmin ? 'admin' : 'bot')) + '">' + safeText + '</div>' +
            '<div class="dp-msg-time">' + time + '</div>' +
          '</div>' +
        '</div>';
      lastFrom = from;
    });

    if (botTyping) {
      html += '' +
        '<div class="dp-chat-typing">' +
          '<div class="dp-msg-avatar bot">' + ROBOT_ICON + '</div>' +
          '<div class="dp-chat-typing-bubble"><span></span><span></span><span></span></div>' +
        '</div>';
    }

    body.innerHTML = html;
    scrollBottom();

    var currentMode = (conversation && conversation.mode) || 'bot';
    if (currentMode === 'human') {
      quick.innerHTML = '';
      return;
    }

    var lastBot = null;
    for (var i = messages.length - 1; i >= 0; i--) {
      if (messages[i].from === 'ai' || messages[i].from === 'bot') { lastBot = messages[i]; break; }
    }
    var qr = [];
    if (lastBot && lastBot._id) {
      var stored = sessionStorage.getItem('dp_chat_quick_' + lastBot._id + '_' + currentLang);
      if (stored) { try { qr = JSON.parse(stored); } catch (e) {} }
    }
    if (qr.length > 0) {
      quick.innerHTML = qr.map(function (q) {
        return '<button onclick="DPChat.quickReply(\'' + escapeHtml(q).replace(/'/g, '&#39;') + '\')">' + escapeHtml(q) + '</button>';
      }).join('');
    } else {
      quick.innerHTML = '';
    }
  }

  async function handleSend() {
    var inp = document.getElementById('dp-chat-input');
    var text = inp.value.trim();
    if (!text || !currentUser) return;

    inp.value = '';
    inp.style.height = 'auto';
    document.getElementById('dp-chat-send').disabled = true;

    await sendMessage('user', text);
    MEMORY.msgCount++;

    var currentMode = (conversation && conversation.mode) || 'bot';
    if (currentMode === 'human') {
      try {
        await db.collection('chat_conversations').doc(currentUser.uid).update({
          unreadForAdmin: firebase.firestore.FieldValue.increment(1)
        });
      } catch (e) {}
      return;
    }

    var lower = normalize(text);
    var isEscalation = /\b(humain|moun|humano|human|agent|admin|speak|parler|pale|hablar|conseiller)\b/.test(lower);

    botTyping = true;
    renderMessages();

    setTimeout(async function () {
      var reply = getBotReply(text);
      botTyping = false;
      await sendMessage('ai', reply.text);

      if (reply.quickReplies && reply.quickReplies.length > 0) {
        var snap = await db.collection('chat_conversations').doc(currentUser.uid)
          .collection('messages').orderBy('createdAt', 'desc').limit(1).get();
        snap.forEach(function (doc) {
          sessionStorage.setItem('dp_chat_quick_' + doc.id + '_' + currentLang, JSON.stringify(reply.quickReplies));
        });
      }

      if (reply.escalate || isEscalation) {
        MEMORY.askedHuman = true;
        await db.collection('chat_conversations').doc(currentUser.uid).update({
          escalated: true,
          mode: 'human',
          unreadForAdmin: firebase.firestore.FieldValue.increment(1)
        });
        setTimeout(async function () { await sendMessage('ai', T('escalated')); }, 800);
      }

      renderMessages();
    }, 700);
  }

  async function quickReply(text) {
    if (!currentUser) return;
    var currentMode = (conversation && conversation.mode) || 'bot';
    if (currentMode === 'human') return;

    var n = normalize(text);
    if (/\b(fermer|femen|close|cerrar)\b/.test(n)) { closeChat(); return; }
    if (/\b(historique|istorik|history|historial|mes commandes|kòmand mwen|my orders|mis pedidos)\b/.test(n)) { window.location.href = 'commande.html'; return; }
    if (/\b(wallet|bous|billetera|portefeuille)\b/.test(n)) { window.location.href = 'wallet.html'; return; }
    if (/\b(panier|panyen|cart|carrito)\b/.test(n)) { window.location.href = 'cart.html'; return; }
    if (/\b(boutique|boutik|shop|tienda)\b/.test(n)) { window.location.href = 'index.html'; return; }
    if (/\b(compte|kont|account|cuenta)\b/.test(n)) { window.location.href = 'authentification/register.html'; return; }

    document.getElementById('dp-chat-input').value = text;
    handleSend();
  }

  function wrapSetLang() {
    if (window.__dpChatSetLangWrapped) return;
    var orig = window.setLang;
    if (typeof orig !== 'function') { setTimeout(wrapSetLang, 300); return; }
    window.__dpChatSetLangWrapped = true;
    window.setLang = function (code, btn) {
      orig.apply(this, arguments);
      if (SUPPORTED_LANGS.indexOf(code) !== -1) {
        currentLang = code;
        refreshUI();
        renderMessages();
      }
    };
  }

  auth.onAuthStateChanged(function (user) {
    currentUser = user;
    if (unsubConv) { unsubConv(); unsubConv = null; }
    if (unsubMsgs) { unsubMsgs(); unsubMsgs = null; }
    messages = [];
    conversation = null;
    if (user) {
      ensureConversation().then(function () {
        listenConv();
        listenMsgs();
      });
    } else {
      updateBadge();
      if (isOpen) closeChat();
    }
  });

  function boot() {
    var saved = localStorage.getItem('dp_lang');
    currentLang = SUPPORTED_LANGS.indexOf(saved) !== -1 ? saved : 'fr';
    injectStyles();
    injectWidget();
    wrapSetLang();
    window.addEventListener('storage', function (e) {
      if (e.key === 'dp_lang' && SUPPORTED_LANGS.indexOf(e.newValue) !== -1) {
        currentLang = e.newValue;
        refreshUI();
        renderMessages();
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  window.addEventListener('load', function () { setTimeout(boot, 200); });

  window.DPChat = {
    open: openChat,
    close: closeChat,
    quickReply: quickReply,
    toggle: function () { isOpen ? closeChat() : openChat(); },
    setLang: function (code) {
      if (SUPPORTED_LANGS.indexOf(code) !== -1) {
        currentLang = code;
        refreshUI();
        renderMessages();
      }
    }
  };
})();