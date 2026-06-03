# L'Empire Contre-Intox — Calendrier

Calendrier mensuel des lives de **L'Empire Contre-Intox**, dans un style cartographie
impériale (parchemin patiné teal & or, cadre ouvragé, sceau central).

**🔗 En ligne :** https://thesamlepirate.github.io/empire-calendrier/

Le calendrier est **entièrement piloté par un fichier JSON** : aucune ligne de code à
toucher pour mettre à jour les événements ou ajouter un nouveau mois.

---

## 📁 Structure du projet

```
empire-calendrier/
├── index.html          ← l'application (HTML/CSS/JS autonome, lit le JSON)
├── data/
│   └── events.json     ← ★ LE SEUL FICHIER À ÉDITER pour le contenu
├── background.png      ← texture de fond (carte patinée)
├── Logo-ECI.jpg        ← emblème (sceau central + médaillon du pied de page)
├── README.md
└── CLAUDE.md           ← guide de maintenance pour l'agent / les contributeurs
```

Tout est statique : pas de build, pas de dépendance. GitHub Pages sert les fichiers tels quels.

---

## ✏️ Mettre à jour le calendrier

Tout se passe dans **`data/events.json`**.

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

## 🚀 Déploiement

Le site est publié via **GitHub Pages** (branche `main`, racine `/`).
Toute modification poussée sur `main` est redéployée automatiquement (~1 min) :

```bash
git add data/events.json
git commit -m "Calendrier : ajout des lives de juillet"
git push
```

---

## ⌨️ Raccourcis & accessibilité

- Clic (ou `Entrée` / `Espace`) sur un live → fenêtre de détails ; `Échap` ou clic extérieur pour fermer.
- Cellules d'événements focusables au clavier, `aria-label` complets.
- Respecte `prefers-reduced-motion` (désactive les animations).
- Responsive : agenda vertical défilable sur mobile.
