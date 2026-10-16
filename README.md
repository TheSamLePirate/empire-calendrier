# L'Empire Contre-Intox — Calendrier

Calendrier mensuel des lives de **L'Empire Contre-Intox**, dans un style cartographie
impériale (parchemin patiné teal & or, cadre ouvragé, sceau central).

**🔗 En ligne :** https://thesamlepirate.github.io/empire-calendrier/

Le calendrier peut être modifié depuis **[l’espace de gestion](https://empire-contre-intox.com/empire-calendrier/admin/)** avec un compte du collectif : événements, création d’animateurs, bibliothèque d’avatars et import avec recadrage. Tous les membres peuvent modifier tout le contenu ; seuls les administrateurs gèrent les comptes.

Sur Portainer, le service calendrier du dépôt parent conserve les données dans SQLite et les portraits dans un volume persistant. Le fichier `data/events.json` sert à l’import initial et au fonctionnement statique local ; il n’est plus la source de vérité une fois la base initialisée. Le miroir lit la même API publique. Voir `../calendar-service/README.md` dans l’espace de travail pour les opérations serveur.

---

## 📁 Structure du projet

```
empire-calendrier/
├── index.html          ← l'application (HTML/CSS/JS autonome, lit le JSON)
├── data/
│   └── events.json     ← ★ LE SEUL FICHIER À ÉDITER pour le contenu
├── background.png      ← texture de fond (carte patinée)
├── Logo-ECI.jpg        ← emblème (sceau central + médaillon + favicon)
├── *.jpeg              ← avatars des organisateurs (ymir, lalie, provoxys, …)
├── og-image.png        ← aperçu social (auto-régénéré, ne pas éditer à la main)
├── scripts/gen-og.sh   ← génère l'aperçu social
├── .githooks/pre-commit← régénère l'aperçu avant chaque commit
├── README.md
└── CLAUDE.md           ← guide de maintenance pour l'agent / les contributeurs
```

> **Première utilisation après un clone :** activez le hook qui tient l'aperçu social à jour :
> ```bash
> git config core.hooksPath .githooks
> ```

Le frontal reste statique : aucun framework, aucun build et aucune dépendance npm. GitHub Pages sert les fichiers tels quels ; le JavaScript lit les données actuelles sur l’API publique du domaine principal. L’administration redirige vers ce domaine.

---

## ✏️ Mettre à jour le calendrier

En production, utiliser l’espace de gestion : les changements sont publiés au prochain chargement, sans redéploiement.

Les instructions JSON ci-dessous concernent **l’amorce d’une base neuve ou le mode statique local**. Modifier ce fichier ne met pas à jour une base déjà initialisée.

### Modèle de données

```json
{
  "brand": "L'Empire Contre-Intox",
  "motto": "Veritas Omnia Vincit",
  "submotto": "Science · Prière · Ad Astra Per Aspera",
  "defaultMonth": "auto",
  "months": {
    "2026-06": {
      "events": {
        "5":  { "time": "22H00", "title": "Les Sciences", "host": "Provoxys" },
        "10": { "time": "22H00", "title": "Harcèlement", "host": "Empire Contre-Intox" }
      }
    }
  }
}
```

| Champ | Niveau | Obligatoire | Description |
|-------|--------|:-----------:|-------------|
| `brand` | racine | non | Nom de la chaîne (kicker + pied de page) |
| `motto` / `submotto` | racine | non | Devises affichées dans le pied de page |
| `defaultMonth` | racine | non | `"auto"` (recommandé) ou une clé `"AAAA-MM"` à ouvrir par défaut |
| `hosts` | racine | non | Avatars des organisateurs : `"nom" → ["image1", "image2"]` |
| `months` | racine | **oui** | Dictionnaire des mois, clé au format `"AAAA-MM"` |
| `events` | mois | **oui** | Dictionnaire `"jour" → événement` (jour = `"1"`…`"31"`) |
| `time` | événement | **oui** | Heure affichée, ex. `"22H00"`, `"21H30"` |
| `title` | événement | **oui** | Titre du live |
| `host` | événement | non | Animateur / chaîne invitée (sert aussi à choisir l'avatar) |
| `avatar` | événement | non | Avatar(s) forcé(s) pour ce live (sinon déduits du `host`, puis du `title`) |
| `note` | événement | non | Texte personnalisé dans la fenêtre de détails |
| `url` | événement | non | Lien → ajoute un bouton « Rejoindre le live » |

### Avatars des organisateurs

Le bloc `hosts` associe un nom à une ou plusieurs images (placées à la racine du dépôt).
L'avatar s'affiche dans la case et dans la fenêtre de détails. Plusieurs images se
superposent légèrement (ex. `Ymir&Lalie`).

```json
"hosts": {
  "Ascèse Live":         ["Ascese.jpeg"],
  "Provoxys":            ["provoxys.jpeg"],
  "Ymir&Lalie":          ["ymir.jpeg", "lalie.jpeg"],
  "Empire Contre-Intox": ["Logo-ECI.jpg"]
}
```

Pour chaque événement, l'avatar est choisi dans l'ordre : champ `avatar` explicite →
sinon `hosts[host]` → sinon `hosts[title]` (pratique pour « Ascèse Live » qui n'a pas de `host`).

### Ajouter / modifier un événement

Ajoutez une entrée dans le bon mois, indexée par le **numéro du jour** :

```json
"2026-06": {
  "events": {
    "18": { "time": "20H00", "title": "Débat spécial", "host": "Ymir&Lalie",
            "url": "https://youtube.com/live/xxxx" }
  }
}
```

Les jours sans événement reçoivent automatiquement un glyphe alchimique discret.

#### Plusieurs lives le même jour

Mettez un **tableau** d'événements à la place d'un seul objet — ils s'affichent
empilés (du plus tôt au plus tard), chacun cliquable :

```json
"13": [
  { "time": "21H00", "title": "Réaction critique", "host": "Prehistoric Man" },
  { "time": "22H00", "title": "Quizzes Jeux", "host": "Ymir&Lalie" }
]
```

### Créer un nouveau mois

Ajoutez simplement une clé `"AAAA-MM"` dans `months`. **Rien d'autre.**
La grille (premier jour de la semaine, nombre de jours, nombre de lignes), le titre
(« Juillet 2026 »), l'année en chiffres romains et la navigation ‹ › sont calculés
automatiquement.

```json
"months": {
  "2026-06": { "events": { ... } },
  "2026-07": { "events": {} },          // ← nouveau mois, à remplir
  "2026-08": { "events": {} }
}
```

> Lundi est toujours la première colonne. La date du jour est mise en valeur
> automatiquement quand le mois affiché contient la date réelle.

---

## 👀 Aperçu en local

Le navigateur **bloque la lecture du JSON via `file://`**. Lancez un petit serveur :

```bash
cd empire-calendrier
python3 -m http.server 8000
# puis ouvrez http://localhost:8000/
```

- Voir un autre mois : `http://localhost:8000/?m=2026-07`
- Naviguer : flèches ‹ / › de part et d'autre du titre.

---

## 🖼️ Aperçu social (image de partage)

Quand le lien est partagé (Discord, X, WhatsApp…), c'est un **rendu du calendrier**
(`og-image.png`) qui s'affiche. Cette image est **régénérée automatiquement avant chaque
push** : un hook git `pre-commit` la reconstruit dès qu'un fichier visuel change et l'ajoute
au commit — vous n'avez rien à faire (pensez juste à activer le hook une fois après le clone,
voir plus haut). Régénération manuelle si besoin : `bash scripts/gen-og.sh`.

## 🚀 Déploiement

Le site est publié via **GitHub Pages** (branche `main`, racine `/`).
Toute modification poussée sur `main` est redéployée automatiquement (~1 min) :

```bash
git add data/events.json
git commit -m "Calendrier : ajout des lives de juillet"   # le hook régénère og-image.png
git push
```

---

## ⌨️ Raccourcis & accessibilité

- Clic (ou `Entrée` / `Espace`) sur un live → fenêtre de détails ; `Échap` ou clic extérieur pour fermer.
- Cellules d'événements focusables au clavier, `aria-label` complets.
- Respecte `prefers-reduced-motion` (désactive les animations).
- Responsive : agenda vertical défilable sur mobile.
