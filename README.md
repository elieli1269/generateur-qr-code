# Générateur QR Code

Application complète pour créer et personnaliser des codes QR : liens, mots-clés, Wi‑Fi, e-mail, téléphone, SMS, contact (vCard).

- Couleurs, formes des modules, coins, logo au centre
- Cadres extérieurs (nu, filet, étiquette, ticket, tampon, enseigne)
- Export PNG / SVG, collection locale, planche multi-codes
- Interface en français

## Utilisation (web)

Ouvrez `index.html` dans un navigateur moderne, ou servez le dossier :

```bash
npx serve .
```

## Exécutable Windows

Le workflow GitHub Actions produit un `.exe` portable et un installeur NSIS.

1. Onglet **Actions** de ce dépôt
2. Workflow **Build Windows**
3. **Run workflow**
4. Téléchargez l’artefact `generateur-qr-windows`

### En local

```bash
npm install
npm run build:win
```

Les binaires sortent dans `release/`.

## Microsoft Store (optionnel)

Pour un paquet MSIX via PWABuilder, définissez dans le dépôt :

| Type | Nom | Rôle |
|------|-----|------|
| Variable | `PWA_URL` | URL publique de l’app déployée |
| Secret | `STORE_PACKAGE_ID` | Package ID (Partner Center) |
| Secret | `STORE_PUBLISHER` | CN=… Publisher ID |
| Secret | `STORE_PUBLISHER_DISPLAY_NAME` | Nom éditeur |

Puis lancez le workflow avec l’option **package_store**.

## Licence

MIT
