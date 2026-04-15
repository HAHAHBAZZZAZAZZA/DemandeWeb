# Setup Supabase (stockage mondial)

1. Creer un projet Supabase.
2. Ouvrir **SQL Editor** puis executer le contenu de `supabase-schema.sql`.
3. Ouvrir `Project Settings > API` et copier:
   - `Project URL`
   - `anon public key`
4. Remplir `config.js`:

```js
window.WEB_SENDER_CONFIG = {
  supabaseUrl: "https://TON-PROJET.supabase.co",
  supabaseAnonKey: "TA_CLE_ANON_PUBLIQUE",
  bucket: "photos",
  staffPseudo: "Cookie02.",
  storageQuotaBytes: 2147483648 // 2 Go, adapte a ton offre Supabase
};
```

5. Deployer le dossier (Netlify, Vercel, GitHub Pages).

Important: cette version est fonctionnelle en public, mais les policies actuelles autorisent tous les visiteurs a lire/ajouter/supprimer.
Pour une securite staff stricte, il faut ajouter une auth staff backend (Edge Function/API).
