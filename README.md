# CodeForge MCA 🔥

> **The ultimate coding practice platform for MCA students.**  
> Practice HackerRank-style problems in Java, C, Python and JavaScript — compete on the leaderboard, track your progress, and ace placement interviews.

---

## ✨ Features

| Feature | Details |
|---|---|
| 🧩 **Problem Set** | Admin-managed problems with examples, constraints & test cases |
| 🖥️ **Monaco Editor** | VS Code-grade editor with IntelliSense, auto-indent, 4 languages |
| 🛡️ **Anti-Cheat** | Paste disabled in editor, context-menu locked inside Monaco |
| 🏆 **Leaderboard** | Real-time ranked scoreboard |
| 📊 **Dashboard** | Per-user stats — solved, score, accuracy, runtime, language breakdown |
| 👤 **Profile** | Public profile with submission history |
| 🔐 **Auth** | Firebase email/password auth with role-based access (Student / Admin / Super-Admin) |
| 🛠️ **Admin Panel** | Full CRUD for problems; user role management (Super-Admin only) |
| 💬 **Comments** | Discussion thread per problem with likes/dislikes |

---

## 🚀 Getting Started

### Prerequisites

- **Node.js ≥ 20** (LTS recommended)
- **npm ≥ 10**
- A **Firebase project** with Firestore & Authentication enabled

### 1. Clone & install

```bash
git clone https://github.com/gandhirakshil152/CodeForge_MCA.git
cd CodeForge_MCA
npm install
```

### 2. Set up environment variables

```bash
# Copy the template
cp .env .env.local
```

Then open `.env.local` and fill in your Firebase project values:

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_MEASUREMENT_ID=...

# The account that is automatically granted superadmin on first registration
VITE_SUPER_ADMIN_EMAIL=you@example.com
```

> ⚠️ **Never commit `.env.local`** — it is already in `.gitignore`.

### 3. Run locally

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

---

## 🏗️ Build for Production

```bash
npm run build      # TypeScript check + Vite production build → dist/
npm run preview    # Serve the production build locally
```

The build is split into optimised chunks:
- `vendor` — React, React-DOM, React-Router, Framer Motion
- `firebase` — Firebase SDK
- `monaco` — Monaco editor (~2 MB, lazy-loaded)

### Deploy

Upload the `dist/` folder to any static host (Firebase Hosting, Netlify, Vercel, etc.).

**Firebase Hosting example:**

```bash
npm install -g firebase-tools
firebase login
firebase init hosting   # point public dir to "dist", set SPA rewrite
firebase deploy
```

Don't forget to also deploy your Firestore rules:

```bash
firebase deploy --only firestore:rules
```

---

## 🗂️ Project Structure

```
src/
├── components/
│   ├── ErrorBoundary.tsx   # Global error boundary
│   └── Navbar.tsx
├── contexts/
│   └── AuthContext.tsx     # Firebase auth + role management
├── data/
│   └── seedProblems.ts     # 10 real MCA placement problems (seed data)
├── pages/
│   ├── AdminPage.tsx
│   ├── AuthPage.tsx
│   ├── DashboardPage.tsx
│   ├── LeaderboardPage.tsx
│   ├── ProblemPage.tsx
│   ├── ProblemsPage.tsx
│   ├── ProfilePage.tsx
│   └── SplashPage.tsx
├── firebase.ts             # Firebase init (reads from env vars)
├── main.tsx
└── index.css               # Full design system (CSS variables + utilities)
firestore.rules             # Firestore security rules
```

---

## 🔐 Role System

| Role | Permissions |
|---|---|
| **Student** | Browse problems, submit code, comment, view leaderboard & dashboard |
| **Admin** | All of the above + add/edit/delete problems, view users |
| **Super Admin** | All of the above + promote/demote admins, delete user records |

The Super Admin role is automatically assigned on registration when the email matches `VITE_SUPER_ADMIN_EMAIL`. All other users start as Students.

---

## 🛡️ Security Notes

- All Firebase config values are loaded from **environment variables** — no secrets in source code.
- **Firestore rules** enforce server-side role checks independent of the frontend.
- Submission reads require authentication (no public raw-submission access).
- Monaco editor paste and context-menu are blocked to discourage copying.

---

## 📜 Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start Vite dev server with HMR |
| `npm run build` | Production build (TypeScript + Vite) |
| `npm run typecheck` | Type-check without emitting files |
| `npm run lint` | Run oxlint static analysis |
| `npm run preview` | Serve production build locally |

---

## 🤝 Contributing

1. Fork the repo
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Commit with a clear message
4. Open a pull request

---

## 📄 License

MIT © Rakshil Gandhi
