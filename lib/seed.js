'use strict';
// Données du jeu « 48h pour sauver la Laiterie Brévinel » (entreprise fictive).

const TEAMS = [
  { id: 't1', name: 'Camembert', color: '#FEC718', code: 'CAMB' },
  { id: 't2', name: 'Livarot', color: '#E8572A', code: 'LIVA' },
  { id: 't3', name: "Pont-l'Évêque", color: '#2A9D8F', code: 'PONT' },
  { id: 't4', name: 'Neufchâtel', color: '#6A4C93', code: 'NEUF' },
  { id: 't5', name: "Pavé d'Auge", color: '#1D70B8', code: 'PAVE' },
];

const START_BUDGET = 300000;
const START_CONFIANCE = 50;

// Catalogue d'achats : les jokers (backup, pra, sondes) changent le déroulé de la crise.
const CATALOGUE = [
  { id: 'recrut_resp', cat: 'Organisation', name: 'Responsable informatique (CDI)', price: 65000, desc: "Pilote le SI au quotidien, interlocuteur des prestataires. Salaire chargé annuel." },
  { id: 'tech_support', cat: 'Organisation', name: 'Technicien support (CDI)', price: 42000, desc: 'Postes de travail, imprimantes, comptes utilisateurs. Salaire chargé annuel.' },
  { id: 'rssi_part', cat: 'Organisation', name: 'RSSI à temps partagé (2 j/mois)', price: 18000, desc: 'Politique de sécurité, analyse de risques, sensibilisation.' },
  { id: 'dpo_ext', cat: 'Organisation', name: 'DPO externalisé', price: 9000, desc: 'Délégué à la protection des données : registre, conformité RGPD, lien avec la CNIL.' },
  { id: 'infog_part', cat: 'Sous-traitance', name: 'Infogérance partielle (SLA 4 h ouvrées)', price: 48000, desc: 'Serveurs et réseau supervisés par NormaTech, avec pénalités si le SLA est dépassé.' },
  { id: 'infog_tot', cat: 'Sous-traitance', name: 'Infogérance totale', price: 120000, desc: 'NormaTech gère tout le SI. Attention au contrat et à la réversibilité.' },
  { id: 'sauvegarde', cat: 'Sécurité', name: 'Sauvegarde externalisée 3-2-1 + tests', price: 15000, joker: 'backup', desc: '3 copies, 2 supports, 1 hors site. Test de restauration chaque trimestre.' },
  { id: 'pra', cat: 'Sécurité', name: 'PCA / PRA + exercice annuel', price: 25000, joker: 'pra', desc: "Plan de continuité et de reprise d'activité, mode dégradé documenté." },
  { id: 'phishing', cat: 'Sécurité', name: 'Formation anti-phishing (tous salariés)', price: 6000, desc: 'Sensibilisation et campagnes de faux phishing.' },
  { id: 'mfa', cat: 'Sécurité', name: 'MFA + gestionnaire de mots de passe', price: 8000, desc: 'Double authentification sur la messagerie et les accès distants.' },
  { id: 'clim_onduleur', cat: 'Infrastructure', name: 'Salle serveur : clim + onduleur', price: 14000, desc: 'Sortir le serveur du placard de la salle de pause.' },
  { id: 'sondes', cat: 'Projets', name: 'Sondes connectées chambres froides', price: 22000, joker: 'sondes', desc: "Températures en temps réel dans l'ERP et alertes SMS." },
  { id: 'audit_rgpd', cat: 'Projets', name: 'Audit RGPD + registre des traitements', price: 12000, desc: 'Cartographie des données personnelles, plan de mise en conformité.' },
  { id: 'ged_labo', cat: 'Projets', name: 'GED labo « zéro papier »', price: 35000, desc: 'Dématérialisation des enregistrements qualité du laboratoire.' },
  { id: 'crm', cat: 'Projets', name: 'CRM commercial', price: 30000, desc: 'Gestion de la relation client grande distribution et restauration collective.' },
  { id: 'bi', cat: 'Projets', name: 'Tableaux de bord BI', price: 25000, desc: 'Indicateurs production, qualité et ventes pour la direction.' },
  { id: 'mes', cat: 'Projets', name: 'MES (pilotage atelier)', price: 90000, desc: 'Suivi de production en temps réel, traçabilité automatique des lots.' },
  { id: 'erp_cloud', cat: 'Projets', name: 'Nouvel ERP en SaaS', price: 140000, desc: "Remplacement de BrévERP 2009 : projet sur 18 mois, licences de l'année 1." },
];

// Injects : `effect` déclenche une action côté serveur.
const INJECTS = [
  { id: 'j1_karim', day: 'J1', label: 'Démission de Karim', from: 'Hélène Marchal, PDG', subject: 'URGENT – Karim nous quitte', audio: 'helene_karim.mp3',
    body: "Bonjour à tous,\n\nKarim vient de m'annoncer sa démission. Il part dans 15 jours. Il est le seul à savoir comment fonctionne notre informatique, et rien n'est documenté.\n\nJe crée dès aujourd'hui des task forces SI. Mardi à 15h45, chaque équipe me présentera son plan pour reprendre le contrôle de notre système d'information. Vous disposez chacun d'un budget de 300 000 €.\n\nJe compte sur vous.\nHélène Marchal" },
  { id: 'j1_normatech', day: 'J1', label: 'Offre NormaTech', from: 'Marc Duval, NormaTech Services', subject: 'Offre exceptionnelle – valable jusqu\'à 17h !', audio: 'marc_offre.mp3',
    body: "Bonjour,\n\nJ'ai appris le départ de Karim, toutes mes condoléances 😉\n\nNormaTech vous propose une INFOGÉRANCE TOTALE : on s'occupe de tout, vous ne vous occupez de rien. Tarif préférentiel de 120 000 €/an, intervention « dans les meilleurs délais ».\n\nOffre valable jusqu'à 17h aujourd'hui. Le contrat (2 pages) est prêt, il ne manque que votre signature.\n\nMarc Duval\nIngénieur commercial – NormaTech Services" },
  { id: 'j1_cnil', day: 'J1', label: 'Courrier CNIL', from: 'CNIL – Service des contrôles', subject: 'Notification de contrôle – Plainte n° 26-0471', audio: null,
    body: "Madame la Présidente,\n\nLa Commission nationale de l'informatique et des libertés a été saisie d'une plainte d'un salarié de votre société, chauffeur collecteur, indiquant que son véhicule serait géolocalisé en permanence, y compris le week-end et en dehors de ses heures de travail.\n\nEn application de l'article 58 du RGPD, une mission de contrôle se rendra dans vos locaux. Merci de tenir à disposition :\n- le registre des activités de traitement ;\n- les coordonnées de votre délégué à la protection des données ;\n- l'information délivrée aux salariés concernés ;\n- les durées de conservation des données de géolocalisation ;\n- les mesures de sécurité protégeant les données bancaires des producteurs.\n\n(Courrier fictif – exercice pédagogique)" },
  { id: 'j2_strategie', day: 'J2', label: 'Stratégie à 3 ans', from: 'Hélène Marchal, PDG', subject: 'Notre cap pour 2029', audio: 'helene_strategie.mp3',
    body: "Bonjour à tous,\n\nLe conseil d'administration a validé notre cap pour les 3 prochaines années :\n1. Ouvrir l'export vers la Belgique ;\n2. Un laboratoire qualité zéro papier ;\n3. Obtenir la certification ISO 14001.\n\nVotre schéma directeur doit servir ces trois objectifs. Je ne financerai pas un projet informatique qui n'y contribue pas.\n\nHélène" },
  { id: 'j2_changement', day: 'J2', label: 'Changement de besoin (MES)', from: 'Directeur de production', subject: 'Petite modif sur le MES…', audio: null,
    body: "Salut l'équipe projet,\n\nJe sais qu'on a validé le cahier des charges ce matin, mais finalement on voudrait aussi que le MES suive la consommation d'énergie de chaque ligne, pour l'ISO 14001. Et tant qu'à faire, une appli mobile pour les chefs d'équipe.\n\nÇa ne change rien au délai ni au budget, hein ?\n\nPS : le roi Gustave Adolphe vous passe le bonjour." },
  { id: 'c_listeria', day: 'Crise', label: '① Listeria lot L0610-B', from: 'Sophie Arnaud, Responsable QSE', subject: 'ALERTE – Suspicion Listeria lot L0610-B', audio: 'sophie_listeria.mp3',
    body: "ALERTE QUALITÉ\n\nLe laboratoire externe nous signale une suspicion de Listeria monocytogenes sur le lot L0610-B (fromage blanc 20 %, 500 g).\n\nNous devons lancer une procédure de retrait / rappel IMMÉDIATEMENT :\n- identifier tous les clients livrés avec ce lot ;\n- identifier les producteurs et la citerne d'origine ;\n- informer la DDPP.\n\nJ'ai besoin de la liste complète des expéditions dans l'heure.\nSophie" },
  { id: 'c_ransom', day: 'Crise', label: '② RANSOMWARE', from: 'LockLait', subject: '!!! VOS FICHIERS ONT ÉTÉ CHIFFRÉS !!!', audio: null, effect: 'ransom_on',
    body: "Tous vos fichiers et votre ERP ont été chiffrés par LockLait.\nPour récupérer vos données : 80 000 € en Bitcoin sous 72 heures.\nN'appelez pas la police.\n\n(Simulation pédagogique)" },
  { id: 'c_gms', day: 'Crise', label: '③ Exigence de la GMS', from: 'Centrale d\'achat NordOuest Distribution', subject: 'Retrait lot L0610-B – liste des magasins sous 4h', audio: null,
    body: "Madame, Monsieur,\n\nNous avons été informés d'un possible rappel concernant votre lot L0610-B.\n\nConformément à notre cahier des charges fournisseurs, nous exigeons sous 4 heures :\n- la liste exhaustive des entrepôts et magasins livrés ;\n- les quantités par point de livraison ;\n- le texte de l'affichette de rappel consommateurs.\n\nÀ défaut, nous procéderons au retrait de l'ensemble de vos références et appliquerons les pénalités prévues.\n\nService Qualité Fournisseurs" },
  { id: 'c_journaliste', day: 'Crise', label: '④ Appel d\'un journaliste', from: 'Ouest-Normandie Info (fictif)', subject: 'Message vocal – demande d\'interview', audio: 'journaliste.mp3',
    body: "Bonjour, ici Julien Hamel, journaliste. On me signale un problème sanitaire et une cyberattaque à la Laiterie Brévinel. Pouvez-vous me confirmer ? Je boucle mon article dans une heure." },
  { id: 'c_usb', day: 'Crise', label: '⑤ Sauvegarde USB', from: 'Karim Benali', subject: 'RE: la sauvegarde ?', audio: 'karim_usb.mp3',
    body: "Salut,\n\nLe disque USB de sauvegarde, je l'ai chez moi. Par contre je viens de vérifier : la dernière sauvegarde date d'il y a 3 semaines, j'avais oublié de le rebrancher après mes congés…\n\nEt le mot de passe admin du serveur, c'est dans le fichier MDP_production.txt sur le partage. Enfin, c'était.\n\nKarim" },
  { id: 'c_froid', day: 'Crise', label: '⑥ Chambre froide n°2 à +9 °C', from: 'Chef d\'équipe production', subject: 'Chambre froide 2 – température anormale', audio: null, effect: 'cold_on',
    body: "Je passe devant la CF2 (fromages frais) : le thermomètre indique +9 °C. La porte était mal fermée ? Le compresseur ? Je ne sais pas depuis combien de temps.\n\nLe relevé de ce matin à 7h42 était bon. Qu'est-ce qu'on fait des produits ?" },
  { id: 'c_normatech', day: 'Crise', label: '⑦ NormaTech injoignable', from: 'Marc Duval, NormaTech Services', subject: 'Message vocal – NormaTech', audio: 'marc_contrat.mp3',
    body: "Bonjour, c'est Marc. Alors là, un ransomware, je suis désolé, mais ce n'est pas dans votre contrat. On peut vous envoyer quelqu'un, mais en régie : 1 400 € la journée, et pas avant jeudi." },
  { id: 'c_cnil72', day: 'Crise', label: '⑧ CNIL : 72h', from: 'Votre avocat', subject: 'Violation de données – obligation de notification', audio: null,
    body: "Rappel important : si l'attaque a touché des données personnelles (salariés, RIB des producteurs, géolocalisation des chauffeurs), vous avez 72 heures pour notifier la violation à la CNIL (article 33 du RGPD), et éventuellement informer les personnes concernées.\n\nQui chez vous est en charge de cette notification ?" },
];

// --- Données ERP générées de façon déterministe ---------------------------------

function prng(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PRODUCTS = [
  'Yaourt nature 4×125 g', 'Yaourt fraise 4×125 g', 'Fromage blanc 20 % 500 g',
  'Crème fraîche épaisse 30 % 20 cl', 'Petits-suisses 6×60 g', 'Yaourt brassé vanille 4×125 g',
];

const CLIENTS = [
  "Centrale d'achat NordOuest Distribution – entrepôt de Rouen",
  'Hypermarché Le Grand Bocage – Saint-Lô',
  'Supermarché FraisMarché – Caen Nord',
  'Supermarché Les Halles – Bayeux',
  'Supérette du Port – Granville',
  'Épicerie fine Le Comptoir – Honfleur',
  'Cuisine centrale scolaire – Vire',
  "Restaurant d'entreprise – Cherbourg",
  'Grossiste RHF Normandie Frais – Lisieux',
  'EHPAD Les Tilleuls – Coutances',
];

const FARMS = [
  ['GAEC des Pommiers', 'Torigny-les-Villes'], ['EARL Lemonnier', 'Condé-sur-Vire'], ['GAEC de la Haye', 'Tessy-Bocage'],
  ['Ferme Hébert', 'Percy-en-Normandie'], ['EARL du Vieux Moulin', 'Canisy'], ['GAEC Lebrun Frères', 'Marigny-le-Lozon'],
  ['Ferme de la Butte', 'Saint-Clair-sur-l\'Elle'], ['EARL Marie & Fils', 'Moyon-Villages'], ['GAEC du Bocage Vert', 'Villedieu-les-Poêles'],
  ['Ferme Guérin', 'Cerisy-la-Salle'], ['EARL des Trois Chênes', 'Gavray'], ['GAEC Hamel-Leroux', 'Hambye'],
  ['Ferme du Mesnil', 'Saint-Jean-d\'Elle'], ['EARL Lecoufle', 'Pont-Hébert'], ['GAEC de la Vallée', 'Gourfaleur'],
  ['Ferme Duval-Morin', 'Remilly-les-Marais'], ['EARL Les Prés Salés', 'Montmartin-sur-Mer'], ['GAEC du Calvaire', 'Bréhal'],
  ['Ferme Lefranc', 'Quettreville-sur-Sienne'], ['EARL Bisson', 'Saint-Sauveur-Villages'], ['GAEC Les Hautes Terres', 'Saint-Lô'],
  ['Ferme de la Chesnaie', 'Agneaux'], ['EARL Desmonts', 'Carentan-les-Marais'], ['GAEC du Pont Neuf', 'Thèreval'],
];

const DRIVERS = ['Patrick L.', 'Nadia B.', 'Sébastien G.', 'Jérôme H.', 'Céline R.', 'Mickaël D.'];

const pad = (n) => String(n).padStart(2, '0');
const fmt = (d) => `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;

function buildErpData() {
  const rnd = prng(14062026);
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const int = (a, b) => a + Math.floor(rnd() * (b - a + 1));

  const producteurs = FARMS.map(([nom, commune], i) => {
    let iban = 'FR76';
    for (let k = 0; k < 23; k++) iban += (k % 4 === 0 ? ' ' : '') + int(0, 9);
    return {
      id: `P${pad(i + 1)}`, nom, commune,
      telephone: `02 61 91 ${pad(int(10, 99))} ${pad(int(10, 99))}`, // plage réservée à la fiction (ARCEP)
      iban, volumeMoyen: int(1800, 6500),
    };
  });

  const lots = [];
  for (let day = 1; day <= 12; day++) {
    const prod = new Date(Date.UTC(2026, 9, day));
    ['A', 'B', 'C'].forEach((suffix, j) => {
      const code = `L${pad(day)}10-${suffix}`;
      const produit = PRODUCTS[(day * 3 + j) % PRODUCTS.length];
      const collecte = new Date(prod.getTime() - 86400000);
      const nbProd = int(5, 8);
      const origine = [...producteurs].sort(() => rnd() - 0.5).slice(0, nbProd).map((p) => p.id);
      const quantite = int(18, 46) * 250;
      let reste = quantite;
      const expeditions = [];
      const nbExp = day >= 11 ? int(0, 2) : int(3, 5);
      const used = new Set();
      for (let k = 0; k < nbExp && reste > 500; k++) {
        let c; do { c = pick(CLIENTS); } while (used.has(c)); used.add(c);
        const q = Math.min(reste, int(4, 14) * 250);
        reste -= q;
        expeditions.push({ client: c, quantite: q, date: fmt(new Date(prod.getTime() + int(1, 3) * 86400000)), bl: `BL-26-${int(10000, 99999)}` });
      }
      lots.push({
        code, produit, dateProduction: fmt(prod), dlc: fmt(new Date(prod.getTime() + 24 * 86400000)), quantite,
        citerne: `CIT-${int(1, 6)}`, dateCollecte: fmt(collecte), origine,
        statutLabo: day >= 11 ? 'En attente' : 'Conforme', expeditions, excel: false,
      });
    });
  }

  // Le lot de la crise : une partie des expéditions n'existe que dans un fichier Excel.
  const crisis = lots.find((l) => l.code === 'L0610-B');
  crisis.produit = 'Fromage blanc 20 % 500 g';
  crisis.quantite = 9500;
  crisis.statutLabo = 'Conforme (libéré le 07/10)';
  crisis.expeditions = [
    { client: "Centrale d'achat NordOuest Distribution – entrepôt de Rouen", quantite: 4000, date: '07/10/2026', bl: 'BL-26-48211' },
    { client: 'Hypermarché Le Grand Bocage – Saint-Lô', quantite: 1500, date: '07/10/2026', bl: 'BL-26-48215' },
    { client: 'Supermarché Les Halles – Bayeux', quantite: 1000, date: '08/10/2026', bl: 'BL-26-48302' },
  ];
  crisis.excel = true;
  lots.filter((l) => ['L0310-A', 'L0810-C', 'L0910-B'].includes(l.code)).forEach((l) => { l.excel = true; });

  const excelRows = [
    { lot: 'L0310-A', client: 'Supérette du Port – Granville', quantite: 750, date: '04/10/2026', saisiPar: 'Karim' },
    { lot: 'L0610-B', client: 'EHPAD Les Tilleuls – Coutances', quantite: 500, date: '08/10/2026', saisiPar: 'Karim' },
    { lot: 'L0610-B', client: 'Cuisine centrale scolaire – Vire', quantite: 1750, date: '08/10/2026', saisiPar: 'Karim' },
    { lot: 'L0610-B', client: 'Grossiste RHF Normandie Frais – Lisieux', quantite: 750, date: '09/10/2026', saisiPar: 'Stagiaire' },
    { lot: 'L0810-C', client: 'Épicerie fine Le Comptoir – Honfleur', quantite: 500, date: '09/10/2026', saisiPar: 'Karim' },
    { lot: 'L0910-B', client: "Restaurant d'entreprise – Cherbourg", quantite: 1000, date: '10/10/2026', saisiPar: 'Stagiaire' },
  ];

  const camions = DRIVERS.map((chauffeur, i) => ({
    id: `CIT-${i + 1}`, chauffeur,
    historique: [
      { quand: 'lun. 12/10 05:40', lieu: `Tournée collecte – ${FARMS[(i * 4) % FARMS.length][1]}` },
      { quand: 'dim. 11/10 03:12', lieu: `Stationné – domicile du chauffeur (${FARMS[(i * 4 + 2) % FARMS.length][1]})` },
      { quand: 'sam. 10/10 21:47', lieu: `Parking supermarché – ${FARMS[(i * 4 + 1) % FARMS.length][1]}` },
      { quand: 'sam. 10/10 14:05', lieu: 'Laiterie Brévinel – quai de dépotage' },
    ],
  }));

  const fichiers = [
    { nom: 'Expeditions_S41_v3_FINAL.xlsx', taille: '84 Ko', modifie: '10/10/2026 18:02', type: 'excel' },
    { nom: 'Tracabilite_labo_2026.xlsx', taille: '1,2 Mo', modifie: '09/10/2026 16:40', type: 'texte', contenu: 'Résultats analyses labo interne – saisie manuelle depuis le cahier papier. Onglets : JANV … OCT. (Dernière saisie : 09/10, lots jusqu\'à L0910-C.)' },
    { nom: 'MDP_production.txt', taille: '1 Ko', modifie: '14/03/2019 09:15', type: 'texte', contenu: 'Compte atelier : production / Brevinel2009!\nAdmin serveur : admin / Karim1985\nWifi : Laiterie_Invites / yaourt123\nERP compta : bruno / Bruno2014' },
    { nom: 'Paie_septembre_2026.xlsx', taille: '312 Ko', modifie: '30/09/2026 11:20', type: 'texte', contenu: '140 lignes – noms, numéros de sécurité sociale, salaires, IBAN des salariés. Fichier accessible à tous les utilisateurs du partage.' },
    { nom: 'Contrat_NormaTech_2014.pdf', taille: '96 Ko', modifie: '02/06/2014 10:00', type: 'texte', contenu: "CONTRAT DE PRESTATION INFORMATIQUE (2 pages)\nArt. 1 – NormaTech assure la maintenance du matériel informatique de la société.\nArt. 2 – Les interventions ont lieu dans les meilleurs délais.\nArt. 3 – Toute prestation non prévue est facturée en régie.\nArt. 4 – Le contrat est reconduit tacitement chaque année.\n(Pas de SLA, pas de pénalités, pas de clause de réversibilité, pas de clause de confidentialité.)" },
    { nom: 'Procedure_sauvegarde.docx', taille: '0 Ko', modifie: '12/01/2018 17:55', type: 'texte', contenu: '(fichier vide)' },
  ];

  return { producteurs, lots, excelRows, camions, fichiers };
}

function initialState() {
  return {
    version: 1,
    teams: TEAMS.map((t) => ({ ...t, confiance: START_CONFIANCE, budget: START_BUDGET, purchases: [], log: [], restore: { status: 'none' } })),
    sent: [],
    history: [],
    ransom: { active: false, since: null },
    coldAlarm: false,
    shopOpen: true,
    timer: null,
    lastInject: null,
  };
}

module.exports = { CATALOGUE, INJECTS, buildErpData, initialState };
