#!/bin/zsh
# Génère les messages vocaux des injects avec les voix françaises de macOS.
# Usage : ./scripts/generate-audio.sh   (à lancer sur un Mac, depuis le dossier brevinel-erp)
set -euo pipefail
OUT="${0:A:h}/../public/audio"
TMP="$(mktemp -d)"
mkdir -p "$OUT"

speak() { # fichier voix débit texte
  say -v "$2" -r "$3" -o "$TMP/$1.aiff" "$4"
  afconvert -f m4af -d aac "$TMP/$1.aiff" "$OUT/$1.m4a"
  echo "✓ $1.m4a"
}

HELENE="Sandy (French (France))"
SOPHIE="Shelley (French (France))"
MARC="Thomas"
JOURNALISTE="Jacques"

speak helene_karim "$HELENE" 175 "Bonjour à tous, c'est Hélène Marchal. J'ai une très mauvaise nouvelle. Karim vient de démissionner. Il part dans quinze jours, et c'est le seul à savoir comment fonctionne notre informatique. Rien n'est documenté. Rien. Je crée donc dès ce matin des task forces chargées de reprendre le contrôle de notre système d'information. Vous avez chacun trois cent mille euros de budget. Mardi, quinze heures quarante-cinq, je veux vos plans. Je compte sur vous."

speak marc_offre "$MARC" 195 "Bonjour bonjour, Marc Duval, de NormaTech Services ! J'ai appris pour Karim, quelle tuile. Mais pas de panique : NormaTech s'occupe de tout ! Infogérance totale, cent vingt mille euros par an, et on intervient dans les meilleurs délais. Le contrat fait deux pages, c'est simple, il suffit de signer. Attention, l'offre n'est valable que jusqu'à dix-sept heures !"

speak helene_strategie "$HELENE" 175 "Bonjour à tous. Le conseil d'administration a validé notre cap pour les trois prochaines années. Un : ouvrir l'export vers la Belgique. Deux : un laboratoire qualité zéro papier. Trois : obtenir la certification ISO quatorze mille un. Votre schéma directeur doit servir ces trois objectifs. Je ne financerai pas un projet informatique qui n'y contribue pas."

speak sophie_listeria "$SOPHIE" 190 "Allô, c'est Sophie, au service qualité. C'est urgent. Le laboratoire externe vient de m'appeler : suspicion de listéria sur le lot L zéro six dix, B. Le fromage blanc vingt pour cent. On doit lancer le rappel tout de suite. J'ai besoin de la liste complète des clients livrés, et de l'origine du lait, citerne et producteurs. Dans l'heure. Vous m'entendez ? Dans l'heure !"

speak journaliste "$JOURNALISTE" 185 "Bonjour, Julien Hamel, journaliste. On me signale à la fois un problème sanitaire et une cyberattaque à la Laiterie Brévinel. Est-ce que vous pouvez me confirmer ? Combien de produits sont concernés ? Y a-t-il un risque pour les consommateurs ? Je boucle mon article dans une heure. Rappelez-moi."

speak marc_contrat "$MARC" 195 "Oui, bonjour, c'est Marc, de NormaTech. Alors, un ransomware, je suis vraiment désolé pour vous, mais ce n'est pas dans votre contrat. Article trois : toute prestation non prévue est facturée en régie. Je peux vous envoyer un technicien, mille quatre cents euros la journée, mais pas avant jeudi. Je vous envoie le devis ?"

rm -rf "$TMP"
