# CLAUDE.md — Guide de maintenance

Contexte pour Claude Code (et tout contributeur) travaillant sur ce dépôt.
Lis aussi `README.md` pour la vue d'ensemble.

## Ce qu'est le projet

Calendrier mensuel des lives de **L'Empire Contre-Intox**, page statique unique
(`index.html`) déployée sur **GitHub Pages** (`main` / racine). Esthétique :
cartographie impériale — parchemin patiné teal & or, cadre ouvragé à engrenages,
sceau central (le logo + anneau de boussole), typographies Cinzel / Cormorant Garamond.

Pas de framework, pas de build, pas de dépendance npm. **N'introduis aucun outil de build.**

## Carte des fichiers

| Fichier | Rôle | Faut-il l'éditer ? |
|---------|------|--------------------|
| `data/events.json` | **Source de vérité du contenu** (mois + événements + branding) | **Oui** — pour tout changement de contenu |
| `index.html` | App complète : CSS + moteur JS qui lit le JSON et rend la grille | Seulement pour le design / comportement |
| `background.png` | Texture de fond de la carte | Rarement |
| `Logo-ECI.jpg` | Sceau central + médaillon + favicon | Rarement |
| `*.jpeg` (ymir, lalie, …) | Avatars des organisateurs | À l'ajout d'un organisateur |
| `og-image.png` | Aperçu social (1200×630) | **Non — auto-régénéré** par le hook |
| `scripts/gen-og.sh` | Génère l'aperçu social | Rarement |
| `.githooks/pre-commit` | Régénère l'aperçu avant chaque commit | Rarement |
| `README.md` | Doc utilisateur | Si le modèle de données change |

## Modèle de données (`data/events.json`)

```jsonc
{
  "brand": "L'Empire Contre-Intox",   // kicker + pied de page (optionnel)
  "motto": "Veritas Omnia Vincit",     // pied de page (optionnel)
  "submotto": "Science · Prière · …",  // pied de page (optionnel)
  "defaultMonth": "auto",              // "auto" ou clé "AAAA-MM"
  "hosts": {                           // avatars des organisateurs (optionnel)
    "Ymir&Lalie": ["ymir.jpeg", "lalie.jpeg"],   // plusieurs = portraits superposés
    "Provoxys":   ["provoxys.jpeg"]
  },
  "months": {
    "AAAA-MM": {
      "events": {
        // valeur = un objet (1 live) OU un tableau d'objets (plusieurs lives le même jour)
        "<jour>": {                    // jour = "1".."31" (chaîne)
          "time":  "22H00",            // requis — heure affichée telle quelle
          "title": "…",                // requis
          "host":  "…",                // optionnel — animateur/chaîne (sert aussi à l'avatar)
          "avatar": ["x.jpeg"],        // optionnel — force l'avatar (sinon via host puis title)
          "note":  "…",                // optionnel — remplace le texte de la modale
          "url":   "https://…"         // optionnel — bouton « Rejoindre le live »
        }
      }
    }
  }
}
```

## Ce qui est AUTOMATIQUE (ne pas coder en dur)

Le moteur de `index.html` calcule tout seul, à partir de la clé `"AAAA-MM"` :

- **Le titre** du mois en français (« Juillet 2026 ») et l'**année en chiffres romains** du kicker.
- La **grille** : premier jour (lundi = 1ʳᵉ colonne, via `(getDay()+6)%7`), nombre de
  jours du mois, et nombre de lignes (`--rows`, 5 ou 6) — la grille remplit l'écran.
- Le **marqueur « Aujourd'hui »** si le mois affiché contient la date réelle.
- Les **glyphes** des jours libres (palette `GLYPH_POOL`, choix déterministe par jour).
- L'**avatar** d'un live : champ `avatar` explicite, sinon `hosts[host]`, sinon `hosts[title]`.
- La **mise en page** s'adapte au contenu : 1 live = grand format ; plusieurs = liste compacte
  (heures en haut, empilées) ; les titres longs rétrécissent (`sizeCls`) et sont tronqués
  proprement (le texte complet reste dans la modale).
- La **navigation ‹ ›** : dérivée des clés de `months` triées ; flèche grisée s'il n'y a pas de voisin.
- Le **mois par défaut** (`defaultMonth: "auto"`) : mois courant s'il existe, sinon le mois
  passé le plus récent, sinon le dernier. `?m=AAAA-MM` dans l'URL force un mois.

➡️ **Conséquence : pour ajouter un mois, il suffit d'ajouter une clé `"AAAA-MM"` dans `months`.**

## Tâches courantes

### Ajouter / modifier un événement
1. Édite `data/events.json` → bon mois → `events` → clé = numéro du jour.
2. Valide le JSON (voir ci-dessous), prévisualise, puis déploie.

### Créer le mois suivant
1. Ajoute `"AAAA-MM": { "events": { … } }` dans `months` (ordre chronologique de préférence).
2. Remplis les événements. Le reste est automatique.

### Changer le branding / les devises
Édite `brand`, `motto`, `submotto` à la racine du JSON.

## Vérifier (toujours avant de pousser)

```bash
# 1. JSON valide
python3 -c "import json; json.load(open('data/events.json')); print('JSON OK')"

# 2. Aperçu (file:// bloque fetch → serveur obligatoire)
python3 -m http.server 8000   # http://localhost:8000/  et  /?m=AAAA-MM
```

Pour une vérification visuelle automatisée (capture d'écran headless) :

```bash
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
"$CHROME" --headless=new --disable-gpu --hide-scrollbars \
  --window-size=1440,900 --virtual-time-budget=3000 \
  --screenshot=preview.png "http://localhost:8000/?m=2026-07"
```

## Aperçu social (og-image.png) — RÉGÉNÉRÉ AVANT CHAQUE PUSH

`index.html` référence `og-image.png` (1200×630) comme image de partage (Open Graph /
Twitter). C'est un **rendu du calendrier** : il doit toujours refléter le contenu déployé.

⚠️ **Règle : l'aperçu social est régénéré avant chaque push.** C'est **automatisé** par un
hook git **pre-commit** (`.githooks/pre-commit`) : dès qu'un fichier visuel
(`index.html`, `data/**`, avatars, `background.png`, `Logo-ECI.jpg`) est en staging, le hook
exécute `scripts/gen-og.sh`, régénère l'image et l'ajoute au commit. Chaque commit — donc
chaque push — embarque ainsi un aperçu à jour.

> Pourquoi pre-commit et pas pre-push : la révision poussée est figée au moment du
> `git push`. Un hook pre-push ne pourrait pas faire entrer la nouvelle image dans le même
> envoi. On régénère donc au commit, ce que le push transporte ensuite.

**Activation (une fois par clone) :**
```bash
git config core.hooksPath .githooks
```

**Régénérer à la main si besoin :**
```bash
bash scripts/gen-og.sh
```

`gen-og.sh` rend le mode **`?og=1`** (sans horloge ni poussière → carte nette et stable),
via un serveur local (file:// ne charge pas le JSON) + Google Chrome (`$CHROME`). Sans Chrome,
l'étape est ignorée sans bloquer le commit. Pense à incrémenter `?v=N` sur les balises
`og:image`/`twitter:image` de `index.html` pour forcer les réseaux à recharger l'aperçu.

## Déployer

GitHub Pages se met à jour à chaque push sur `main` (~1 min) :

```bash
git add -A && git commit -m "…" && git push
```

Au `commit`, le hook `pre-commit` régénère `og-image.png` si un fichier visuel a changé
(vérifie d'abord `git config core.hooksPath` = `.githooks`).

Compte GitHub actif : **TheSamLePirate** (`gh auth status`). URL :
https://thesamlepirate.github.io/empire-calendrier/

## Pièges / conventions

- ⚠️ **`file://` ne charge pas le JSON** (CORS). Toujours tester via un serveur HTTP.
- Garde le JSON **strict** (pas de commentaires, pas de virgule finale).
- `time` est une **chaîne libre** affichée telle quelle (`"22H00"`, `"21H30"`) ; dans la
  modale, le `H` est transformé en « h » pour la lecture.
- Direction artistique : **sobre**. Les symboles (glyphes, sceau, boussole, engrenages,
  filigranes) doivent rester **discrets** (faibles opacités). Ne pas les rendre criards.
- Lundi est la première colonne (semaine FR). Ne pas repasser en dimanche-first.
- Pas de build/framework : rester en HTML/CSS/JS statique et autonome.
- **Aperçu social régénéré avant chaque push** via le hook `pre-commit` (activer une fois :
  `git config core.hooksPath .githooks`). Le mode `?og=1` produit la carte propre.
