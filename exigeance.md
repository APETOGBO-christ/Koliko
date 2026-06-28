Contexte & Vision
Tu construis Koliko, une application desktop Electron pour Windows et macOS. L'idée centrale : l'ordinateur devient un outil de discipline avant d'être un outil de divertissement. Tant que l'utilisateur n'a pas complété ses obligations du jour (définies par lui-même), les applications et sites de distraction sont bloqués au niveau système. Koliko ne demande pas de la volonté — il la remplace par une contrainte technique.

Stack technique

Electron 30+ (main process + renderer process)
React 18 + Tailwind CSS pour l'UI renderer
better-sqlite3 pour la base de données locale (pas de Supabase pour ce projet — tout est offline)
node-cron pour les tâches planifiées
electron-store pour la configuration persistante
Architecture Git : branch develop pour le dev, branch main pour les releases packagées


Fonctionnalités à construire
1. Planification de la journée (la veille au soir)
Chaque soir, une notification système apparaît à l'heure définie par l'utilisateur (ex : 21h30). Si l'utilisateur ne clique pas sur "Planifier ma journée" dans les 10 minutes, une fenêtre modale bloquante s'ouvre — elle ne peut pas être fermée sans avoir planifié.
L'interface de planification permet de :

Définir 3 à 7 obligations du lendemain (ex : "Méditation", "Sport", "Lecture 30 min")
Assigner à chaque obligation une plage horaire cible (optionnel)
Réordonner les obligations par drag & drop
Sauvegarder le plan en base SQLite

2. Déblocage par complétion (le cœur du système)
Au démarrage du PC, Koliko se lance automatiquement en arrière-plan (autolaunch via electron-auto-launch). Le système de blocage s'active dès que le plan du jour existe.
Logique de déblocage :

Tant qu'au moins une obligation n'est pas cochée → les distractions sont bloquées
Chaque obligation cochée → déblocage partiel ou total selon la configuration
Toutes les obligations cochées → déblocage complet, Koliko se met en mode "libre"

L'utilisateur coche ses obligations depuis une fenêtre compacte (toujours visible, coin bas-droit, 320×400px, alwaysOnTop: true).
3. Blocage système des distractions
Le blocage opère sur deux niveaux simultanément :
Niveau réseau — modification du fichier hosts :
js// main/blocker.js
// Ajouter dans /etc/hosts (Linux/Mac) ou C:\Windows\System32\drivers\etc\hosts (Windows)
const BLOCKED_DOMAINS = [
  'youtube.com', 'www.youtube.com',
  'netflix.com', 'www.netflix.com',
  'twitter.com', 'www.twitter.com',
  'x.com', 'www.x.com',
  'instagram.com', 'www.instagram.com',
  'tiktok.com', 'www.tiktok.com',
  'facebook.com', 'www.facebook.com',
  'twitch.tv', 'www.twitch.tv',
  'reddit.com', 'www.reddit.com',
];
// Chaque domaine → 0.0.0.0 domain.com
// Restaurer les lignes originales au déblocage
Koliko doit demander les droits administrateur au premier lancement pour pouvoir modifier ce fichier. Utiliser sudo-prompt sur Mac/Linux, et l'élévation UAC sur Windows via un script PowerShell embarqué.
Niveau processus — surveillance et fermeture :
js// Surveiller toutes les 30 secondes avec node-ps ou tasklist/ps aux
const BLOCKED_APPS = {
  win32:  ['vlc.exe', 'spotify.exe', 'steam.exe', 'epicgameslauncher.exe'],
  darwin: ['VLC', 'Spotify', 'Steam'],
  linux:  ['vlc', 'spotify', 'steam'],
};
// Si un processus bloqué est détecté → envoyer SIGTERM + afficher notification
// "Koliko : terminez vos obligations avant d'ouvrir Spotify"
4. Paramètres utilisateur
Une page de settings complète permet de configurer :

Heure de rappel planification (sélecteur d'heure)
Liste des domaines bloqués (ajout/suppression dynamique)
Liste des applications bloquées (ajout par sélection de fichier .exe / bundle macOS)
Mode strict : désactive la possibilité de quitter Koliko depuis la barre des tâches
PIN de secours : code 6 chiffres pour déverrouiller manuellement en cas d'urgence (avec log de l'utilisation)

5. Tableau de bord & historique
Page principale avec :

Taux de complétion sur les 30 derniers jours (graphe en barres, recharts via webview)
Streak actuel (nombre de jours consécutifs à 100%)
Heure moyenne de complétion de la première obligation
Liste des obligations les plus souvent ignorées


Structure du projet
koliko/
├── main/
│   ├── index.js          # entry point Electron
│   ├── blocker.js        # logique blocage hosts + processus
│   ├── scheduler.js      # node-cron, notifications, rappels
│   ├── database.js       # better-sqlite3, migrations
│   └── ipc.js            # tous les handlers IPC main↔renderer
├── renderer/
│   ├── pages/
│   │   ├── today.jsx     # vue du jour, cases à cocher
│   │   ├── plan.jsx      # planification du lendemain
│   │   ├── stats.jsx     # tableau de bord historique
│   │   └── settings.jsx  # paramètres
│   └── components/
├── assets/
│   └── icon.png
├── package.json
└── electron-builder.json # config packaging Windows + Mac

Base de données SQLite (schéma complet)
sql-- Plans journaliers
CREATE TABLE plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE,  -- format YYYY-MM-DD
  created_at TEXT DEFAULT (datetime('now')),
  locked INTEGER DEFAULT 0    -- 1 = plan validé, ne peut plus être modifié
);

-- Obligations
CREATE TABLE obligations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_id INTEGER REFERENCES plans(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  target_time TEXT,           -- ex: "07:00"
  position INTEGER NOT NULL,  -- ordre d'affichage
  completed INTEGER DEFAULT 0,
  completed_at TEXT           -- datetime réel de complétion
);

-- Log des déverrouillages PIN (audit)
CREATE TABLE pin_unlocks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reason TEXT,
  unlocked_at TEXT DEFAULT (datetime('now'))
);

-- Configuration clé-valeur
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

Contraintes importantes

Le main process gère tout ce qui touche au système (hosts, processus, notifications, cron). Le renderer ne fait qu'afficher et envoyer des events IPC.
Toutes les communications renderer→main passent par contextBridge + ipcRenderer. Pas d'accès direct à Node depuis le renderer (nodeIntegration: false, contextIsolation: true).
Le blocage hosts doit être atomique : sauvegarder le bloc original avant modification, et restaurer proprement à la suppression — même en cas de crash (vérification au démarrage).
Sur Windows, le fichier hosts nécessite un script PowerShell lancé en tant qu'administrateur. Générer ce script à la volée et l'exécuter via child_process.execFile.
L'application doit se packager avec electron-builder en .exe (Windows NSIS installer) et .dmg (macOS).
Tester l'architecture Git en committant chaque feature sur une branche dédiée (feature/blocker, feature/scheduler, feature/stats...) et en mergeant vers develop après validation.


Fonctionnalité 6 — Rappels d'obligations avec reprogrammation intelligente
Quand une obligation planifiée à une heure précise approche, Koliko ouvre un onglet discret dans le navigateur par défaut (ou une fenêtre Electron overlay) qui affiche le rappel.
Comportement du rappel :

15 minutes avant l'heure cible → notification système silencieuse : "Lecture dans 15 min"
À l'heure exacte → ouverture d'un overlay Electron (alwaysOnTop: true, 480×280px, centré) non bloquant avec trois options :

┌─────────────────────────────────────────────┐
│  📖  Il est 13h00 — Lecture (30 min)        │
│                                             │
│  Tu es sur quelque chose d'important ?      │
│                                             │
│  [✅ Je commence maintenant]                │
│  [🕐 Déplacer de 30 min]                   │
│  [🕑 Déplacer de 1h]                       │
└─────────────────────────────────────────────┘
Règles anti-procrastination sur le report :

Un report est autorisé maximum 2 fois par obligation et par jour
Au 2ème report, le bouton affiche un avertissement : "Dernier report possible"
Au 3ème déclenchement, les boutons de report disparaissent — seul "Je commence maintenant" reste
Si l'overlay est ignoré (pas de clic dans 5 minutes) → il se ferme et l'obligation est marquée "ignorée" dans les stats, pas cochée
Chaque report est loggé en base avec l'heure originale, l'heure reportée, et le nombre de reports cumulés

Schéma SQLite à ajouter :
sqlCREATE TABLE reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  obligation_id INTEGER REFERENCES obligations(id) ON DELETE CASCADE,
  original_time TEXT NOT NULL,
  rescheduled_to TEXT NOT NULL,
  report_count INTEGER DEFAULT 1,
  reported_at TEXT DEFAULT (datetime('now'))
);

Fonctionnalité 7 — Vidéo de confrontation avant le divertissement
Quand le système détecte une tentative d'accès à une distraction (site bloqué ou application bloquée) alors que des obligations sont encore en attente, au lieu de simplement bloquer, Koliko joue une vidéo choisie par l'utilisateur.
Principe : L'utilisateur a lui-même enregistré cette vidéo dans les settings — c'est sa propre voix, ses propres raisons, son propre visage qui lui parle. Personne d'autre ne peut le convaincre mieux que lui-même.
Comportement :
Quand une distraction est interceptée → une fenêtre Electron s'ouvre en plein écran (fullscreen: true, sans barre de titre, sans possibilité de la réduire) :
┌──────────────────────────────────────────────────────┐
│                                                      │
│         [         Vidéo en lecture         ]         │
│              (la vidéo de l'utilisateur)             │
│                                                      │
│   "Rappelle-toi pourquoi tu as commencé."            │
│                                                      │
│   Obligations restantes aujourd'hui : 2              │
│   • Lecture          → reportée 1 fois               │
│   • Révision CCNA    → pas encore commencée          │
│                                                      │
│   ══════════════════════════════  (barre de prog.)   │
│                          [Retourner au travail]      │
│                                           ↑          │
│              (apparaît seulement à la fin de la vid) │
└──────────────────────────────────────────────────────┘
Règles précises :

La vidéo ne peut pas être mise en pause, avancée, ou arrêtée — les contrôles sont désactivés
Le bouton "Retourner au travail" n'apparaît qu'à la fin de la vidéo — impossible de l'ignorer
Si l'utilisateur tente de fermer la fenêtre (Alt+F4, Cmd+Q) → la vidéo recommence depuis le début
Après la vidéo, deux choix seulement :

"Retourner au travail" → ferme la fenêtre, rien n'est débloqué
Aucun autre bouton — pas de "continuer quand même"


La tentative d'accès est loggée (quelle app / quel site, à quelle heure, est-ce que l'utilisateur est retourné au travail ou a quand même contourné)

Configuration dans les Settings :
Vidéo de motivation
───────────────────
[Choisir un fichier vidéo]   ← .mp4, .mov, .webm, max 100MB
Aperçu : motivation_v2.mp4 (1m 23s)

Durée minimale recommandée : 45 secondes
Conseil : Filme-toi en parlant de tes objectifs.
          Sois direct avec toi-même.
Schéma SQLite à ajouter :
sql-- Tentatives de distraction interceptées
CREATE TABLE distraction_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,              -- 'site' ou 'app'
  target TEXT NOT NULL,            -- ex: 'youtube.com' ou 'vlc.exe'
  video_watched INTEGER DEFAULT 0, -- 1 = a regardé jusqu'au bout
  returned_to_work INTEGER DEFAULT 0,
  attempted_at TEXT DEFAULT (datetime('now'))
);
Dans main/blocker.js, intercepter les tentatives ainsi :
js// Quand un domaine bloqué est détecté via le filtre de session Electron
session.defaultSession.webRequest.onBeforeRequest({ urls: blockedUrls }, (details, callback) => {
  const hasPendingObligations = db.prepare(
    `SELECT COUNT(*) as n FROM obligations
     WHERE plan_id = (SELECT id FROM plans WHERE date = date('now'))
     AND completed = 0`
  ).get().n > 0;

  if (hasPendingObligations) {
    openMotivationVideo(details.url); // ouvre la fenêtre plein écran
    callback({ cancel: true });
  } else {
    callback({ cancel: false }); // tout est coché → laisser passer
  }
});