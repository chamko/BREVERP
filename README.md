# BrévERP · le jeu de la Laiterie Brévinel (MGTAL43)

Un faux ERP pour le cours « Management des SI ». Les étudiants s'y connectent par équipe, l'animateur pilote les événements depuis une console, et un écran est projeté en salle.
Pas de dépendance npm, pas de base de données : l'état du jeu est stocké dans un fichier JSON.

| URL | Pour qui | Accès |
|---|---|---|
| `/` | Étudiants (ERP) | Code équipe |
| `/?code=CAMB` | Lien direct (QR code) | Connexion automatique |
| `/ecran` | Vidéoprojecteur | Libre (lecture seule) |
| `/console` | Animateur | `ADMIN_PASSWORD` |

## Déploiement sur Coolify

1. Pousser ce dossier `brevinel-erp` dans un dépôt Git (GitHub, GitLab ou Gitea ; privé, c'est très bien).
2. Dans Coolify : **+ New → Application → (Private) Repository**, choisir la branche, puis le build pack **Docker Compose**.
3. **Environment Variables** : `ADMIN_PASSWORD` = le mot de passe de la console. Le déploiement échoue volontairement s'il est absent.
4. **Domains** : sur le service `brevinel`, mettre `https://brevinel.ton-domaine.fr:3000`. Le `:3000` indique le port interne à Coolify, qui ne l'expose pas publiquement. Coolify génère le certificat HTTPS.
5. **Deploy**. Vérifier ensuite `https://…/health`, qui doit répondre `{"ok":true}`.

Bon à savoir :
- L'état du jeu (scores, achats, mains courantes) est dans le volume `brevinel-data`. Il survit aux redéploiements, et le serveur l'écrit immédiatement à l'arrêt.
- **Temps réel** : l'écran projeté et l'ERP se mettent à jour en direct (Server-Sent Events). Si les mises à jour n'arrivent plus et qu'il faut recharger la page, désactiver **Gzip compression** dans les réglages avancés de l'application Coolify.
- **Avant le cours**, cliquer sur « Réinitialiser la partie » dans la console pour effacer les tests.

Sans Coolify : `docker compose up -d --build` après avoir mis `ADMIN_PASSWORD=…` dans un fichier `.env` (en ajoutant `ports: ["3000:3000"]` pour un accès direct), ou `ADMIN_PASSWORD=xxx node server.js` (Node ≥ 20).

## Équipes par défaut

| Équipe | Code |
|---|---|
| Camembert | `CAMB` |
| Livarot | `LIVA` |
| Pont-l'Évêque | `PONT` |
| Neufchâtel | `NEUF` |
| Pavé d'Auge | `PAVE` |

Les noms, codes et couleurs se modifient dans la console. La liste se change dans `lib/seed.js`.

## Déroulé côté console

1. **J1 – ouverture** : envoyer l'inject « Démission de Karim ». Sur l'écran, cliquer une fois sur **🔇 Activer le son** pour que les messages vocaux soient joués.
2. **Ép.3, 4 et 6** : la boutique est ouverte, les équipes achètent (recrutements, infogérance, PRA, sondes…). Les achats de type **joker** (💾 sauvegarde, 🛟 PRA, 🌡 sondes) changent le déroulé de la crise.
3. **Ép.4 / 5** : injects « Offre NormaTech » puis « Courrier CNIL ».
4. **J2 – ép.6** : inject « Stratégie à 3 ans ». **Ép.7** : « Changement de besoin ».
5. **Ép.8 – la crise** : fermer la boutique, lancer un chrono de 45 min, puis envoyer les injects ① à ⑧ toutes les 4 à 6 minutes.
   - ② déclenche le **ransomware** : l'ERP est bloqué pour tout le monde.
     - Avec le **PRA**, l'équipe a un mode dégradé immédiat (lots en lecture seule, sans le fichier Excel) et retrouve tout en 2 min.
     - Avec la **sauvegarde 3-2-1**, l'équipe retrouve tout en 6 min.
     - Avec le **disque USB de Karim** (5 min), les données ont 3 semaines : aucun lot d'octobre.
     - Si l'équipe **paie la rançon** (80 k€), elle a une chance sur deux d'avoir une clé valide.
   - ⑥ déclenche l'**alarme de la chambre froide**. Seules les équipes qui ont acheté les sondes la voient dans l'ERP.
   - Le bouton **Débloquer** sur une équipe la sort de la crise à tout moment.
6. Distribuer les points de **confiance** au fil de l'eau, en renseignant un motif. Les mains courantes de toutes les équipes s'affichent en direct.
7. **Réinitialiser la partie** entre deux groupes.

## Le piège pédagogique du lot L0610-B

L'ERP indique 6 500 unités expédiées sur 9 500 produites. Les 3 000 restantes, dont **l'EHPAD de Coutances et la cuisine centrale scolaire de Vire**, ne figurent que dans `Expeditions_S41_v3_FINAL.xlsx`, dans les Fichiers partagés. Ce fichier est chiffré par le ransomware. Pour le retrouver, il faut une vraie sauvegarde.

## Messages vocaux

Ils sont dans `public/audio/` (.mp3) et ont été générés avec **ElevenLabs** (modèle `eleven_v3`, voix françaises natives de la bibliothèque) :

```bash
ELEVENLABS_API_KEY=... node scripts/generate-audio-elevenlabs.mjs            # tous les messages
ELEVENLABS_API_KEY=... node scripts/generate-audio-elevenlabs.mjs karim_usb  # un seul
```

Les textes et la distribution des voix sont modifiables dans le script. Il existe aussi une version de secours sans clé, avec les voix de macOS : `./scripts/generate-audio.sh` (fichiers .m4a, il faut alors remettre `.m4a` dans `lib/seed.js`).

---
Entreprise, personnes, clients et données fictifs. Les numéros de téléphone sont pris dans la plage que l'ARCEP réserve à la fiction.
