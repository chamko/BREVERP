// Génère les messages vocaux des injects avec ElevenLabs.
// Usage (depuis brevinel-erp) : ELEVENLABS_API_KEY=... node scripts/generate-audio-elevenlabs.mjs [id ...]
// Sans argument, tous les messages sont générés. Les fichiers vont dans public/audio/<id>.mp3.
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const KEY = process.env.ELEVENLABS_API_KEY;
if (!KEY) { console.error('ELEVENLABS_API_KEY manquante.'); process.exit(1); }
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'audio');
const MODEL = process.env.ELEVENLABS_MODEL || 'eleven_v3';

// Didascalies entre crochets : balises d'émotion du modèle v3 (en anglais).
// Voix de la bibliothèque ElevenLabs (françaises natives).
const CAST = {
  helene: 'glDtoWIoIgk38YbycCwG',      // Clara Dupont – Professional and Urgent
  sophie: 't8BrjWUT5Z23DLLBzbuY',      // Sarah – Expressive and Modulated
  marc: 'kENkNtk0xyzG09WW40xE',        // Marcel – Warm and Conversational
  journaliste: 'AmMsHJaCw4BtwV3KoUXF', // Nicolas Petit – Convincing and Bright
  karim: '5Qfm4RqcAer0xoyWtoHC',       // Maxime – Young and Casual
};

const LINES = {
  helene_karim: ['helene', "[worried] Bonjour à tous, c'est Hélène Marchal. J'ai une très mauvaise nouvelle. Karim vient de démissionner. Il part dans quinze jours… et c'est le seul à savoir comment fonctionne notre informatique. [sighs] Rien n'est documenté. Rien. [firmly] Je crée donc dès ce matin des task forces chargées de reprendre le contrôle de notre système d'information. Vous avez chacun trois cent mille euros de budget. Mardi, quinze heures quarante-cinq, je veux vos plans. Je compte sur vous."],
  marc_offre: ['marc', "[cheerfully] Bonjour bonjour ! Marc Duval, de NormaTech Services ! J'ai appris pour Karim… [fake sympathy] quelle tuile. Mais pas de panique : NormaTech s'occupe de tout ! Infogérance totale, cent vingt mille euros par an, et on intervient dans les meilleurs délais. Le contrat fait deux pages, c'est tout simple, il suffit de signer. [playfully] Attention hein, l'offre n'est valable que jusqu'à dix-sept heures !"],
  helene_strategie: ['helene', "Bonjour à tous. Le conseil d'administration a validé notre cap pour les trois prochaines années. Un : ouvrir l'export vers la Belgique. Deux : un laboratoire qualité zéro papier. Trois : obtenir la certification ISO quatorze mille un. [firmly] Votre schéma directeur doit servir ces trois objectifs. Je ne financerai pas un projet informatique qui n'y contribue pas."],
  sophie_listeria: ['sophie', "[out of breath] [stressed] Allô ? C'est Sophie, au service qualité. C'est urgent. Le laboratoire externe vient de m'appeler : suspicion de listéria sur le lot L zéro six dix, B. Le fromage blanc vingt pour cent. On doit lancer le rappel tout de suite. J'ai besoin de la liste complète des clients livrés, et de l'origine du lait, citerne et producteurs. Dans l'heure. [urgently] Vous m'entendez ? Dans l'heure !"],
  journaliste: ['journaliste', "Bonjour, Julien Hamel, journaliste. On me signale à la fois un problème sanitaire et une cyberattaque à la Laiterie Brévinel. Est-ce que vous pouvez me confirmer ? Combien de produits sont concernés ? Y a-t-il un risque pour les consommateurs ? [hurried] Je boucle mon article dans une heure. Rappelez-moi."],
  marc_contrat: ['marc', "[awkwardly] Oui, bonjour, c'est Marc, de NormaTech. Alors… un ransomware, je suis vraiment désolé pour vous, mais… ce n'est pas dans votre contrat. Article trois : toute prestation non prévue est facturée en régie. Je peux vous envoyer un technicien, mille quatre cents euros la journée, mais pas avant jeudi. [cheerfully] Je vous envoie le devis ?"],
  karim_usb: ['karim', "[embarrassed] Salut, c'est Karim… Le disque USB de sauvegarde, je l'ai chez moi. Par contre… je viens de vérifier, la dernière sauvegarde date d'il y a trois semaines. J'avais oublié de le rebrancher après mes congés. [nervous laugh] Et le mot de passe admin du serveur, il est dans le fichier M D P production point txt, sur le partage. Enfin… il y était."],
};

async function tts(id) {
  const [who, text] = LINES[id];
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${CAST[who]}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, model_id: MODEL, language_code: 'fr' }),
  });
  if (!res.ok) throw new Error(`${id} : HTTP ${res.status} ${(await res.text()).slice(0, 300)}`);
  writeFileSync(join(OUT, `${id}.mp3`), Buffer.from(await res.arrayBuffer()));
  console.log(`✓ ${id}.mp3 (${who})`);
}

mkdirSync(OUT, { recursive: true });
const ids = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(LINES);
for (const id of ids) await tts(id);
