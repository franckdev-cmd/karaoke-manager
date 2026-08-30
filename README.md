# Karaoké SaaS — étape 1 : Auth Google + onboarding

Nouveau projet, propre, qui réutilisera la logique métier de `nyc-karaoke` (rotation, files
d'attente, etc.) aux étapes suivantes. Cette première étape pose :

- la connexion via **Google (OAuth Supabase)**
- l'écran d'onboarding qui demande **"par chanteurs" ou "par tables"**
- en mode chanteurs : génération d'un **QR code unique**
- en mode tables : création de **salles** puis de **tables** dans chaque salle

## 1. Créer le projet Supabase

1. https://supabase.com → New project.
2. Une fois créé : *Project Settings → API* → récupère `Project URL` et `anon public key`.
3. Dans *SQL Editor*, colle le contenu de `supabase-schema.sql` et exécute-le.

## 2. Vérifier l'authentification email dans Supabase

Rien à créer côté Google : Supabase gère nativement l'inscription par email + mot de passe
avec envoi automatique d'un lien de confirmation.

Dans Supabase → *Authentication → Providers → Email* :
- Vérifie que le provider **Email** est activé (il l'est par défaut)
- "Confirm email" doit être activé si tu veux forcer la vérification avant connexion
  (recommandé, activé par défaut)

Dans Supabase → *Authentication → URL Configuration* :
- **Site URL** : `http://localhost:3000` en dev, ton domaine réel en prod
- **Redirect URLs** : ajoute `http://localhost:3000/auth/callback` (et l'équivalent en prod)
  — c'est l'URL vers laquelle le lien de confirmation email redirige.

Optionnel : dans *Authentication → Email Templates*, tu peux personnaliser le texte du mail
de confirmation envoyé (logo, ton du message, etc.).

## 3. Variables d'environnement

Crée `.env.local` à la racine :

```
NEXT_PUBLIC_SUPABASE_URL=https://VOTRE_PROJECT_ID.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=VOTRE_ANON_KEY
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

En production (Vercel), mets `NEXT_PUBLIC_APP_URL` sur ton domaine réel, et ajoute aussi
ce domaine dans la liste "Redirect URLs" de Supabase → *Authentication → URL Configuration*.

## 4. Lancer en local

```bash
npm install
npm run dev
```

Ouvre `http://localhost:3000/login`.

## Ce qui est fait

- `/login` — formulaire classique email + mot de passe, avec bascule connexion/inscription
  et écran "vérifie ta boîte mail" après inscription
- `/auth/callback` — valide le lien de confirmation reçu par email (et gère aussi le retour
  OAuth si tu ajoutes un provider plus tard)
- `middleware.ts` — protège toutes les routes sauf `/login` et redirige vers l'onboarding
- `/onboarding` — crée automatiquement un `venue` pour le compte connecté, puis affiche
  les deux cartes de choix (chanteurs / tables) avec icônes SVG maison
- `/onboarding/singers` — génère et affiche le QR code unique
- `/onboarding/tables` — création de salles puis de tables (code 4 caractères par table,
  même logique que `nyc-karaoke`)
- `/manager` — page d'arrivée finale (à connecter à la vraie logique métier ensuite)

## Prochaines étapes (pas encore faites)

- Page publique `/r/[code]` pour l'inscription des chanteurs (mode "singers")
- Page publique `/register` pour la saisie du code table (mode "tables"), en reprenant
  l'écran de saisie animé de `nyc-karaoke/app/register`
- Portage de `Manager.tsx`, `rotation.ts`, `useQueue.ts` etc. adaptés au multi-établissement
  (chaque requête Supabase doit filtrer par `venue_id`)
- Thème clair complet du manager (actuellement le futur `Manager.tsx` est en thème sombre)
