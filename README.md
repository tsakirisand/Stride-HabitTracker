# Stride Habit Tracker 🏃‍♂️📅

Stride is a premium, feature-rich React Native and Expo habit tracking application designed to help users build consistency and achieve their personal goals. It runs seamlessly as a mobile app (iOS & Android) and as a **Production Web App** with static rendering, real-time Firebase sync, and automated cloud deployments.

---

## 🌟 Key Features

- **Cross-Platform & Web Support**: Works smoothly on iOS, Android, and Web Browsers (PWA ready).
- **Flexible Habit Types**:
  - **Standard Habits**: Simple toggle checkoffs (e.g., "Read 20 pages").
  - **Numeric/Target Habits**: Log progressive metrics with specific targets (e.g., "Drink 2500ml Water", "Do 50 Pushups").
- **Smart Habit Scheduling**: Schedule habits to recur on specific days of the week.
- **Streak Tracking**:
  - **Individual Streaks**: Tracks consecutive completion days for each individual habit.
  - **Master Streak**: Celebrates consecutive days where 100% of all scheduled habits are completed.
- **Interactive Calendar Dashboard**: Scroll through a 1-year history to view past completions and plan ahead.
- **Drag-and-Drop Reordering**: Organize your habits list effortlessly using intuitive press-and-drag interactions.
- **Rich Data Analytics**: Deep dive into your productivity with weekly and monthly completion statistics.
- **Firebase Sync**: Supports anonymous sign-in and email logins, keeping habit histories securely backed up and synced in real-time.
- **Beautiful Dark Theme UI**: Sleek, modern dark mode with smooth animations and responsive feedback.

---

## 🛠️ Tech Stack

- **Framework**: [Expo](https://expo.dev) & [React Native](https://reactnative.dev)
- **Web Engine**: [React Native Web](https://necolas.github.io/react-native-web/) & Expo Static Export
- **Routing**: [Expo Router](https://docs.expo.dev/router/introduction) (file-based navigation)
- **Database & Auth**: [Firebase v12](https://firebase.google.com) (Firestore & Auth)
- **Animations & Layout**: [React Native Reanimated](https://docs.swmansion.com/react-native-reanimated/) & [React Native Draggable FlatList](https://github.com/computerjazz/react-native-draggable-flatlist)
- **Deployments**: GitHub Pages, Vercel (`vercel.json`), and Firebase Hosting

---

## 📂 Project Structure

```text
├── .github/workflows/   # Automated GitHub Pages CI/CD workflow
├── app/                  # Expo Router file-based entry screens
│   ├── (auth)/           # Authentication screens (Login, Sign-Up, Welcome)
│   ├── (tabs)/           # Core application tabs
│   │   ├── index.tsx     # Home Dashboard (Habit list, Calendar, Reordering)
│   │   ├── explore.tsx   # Statistics & Analytics Screen
│   │   └── settings.tsx  # User Settings & Sign Out
│   ├── _layout.tsx       # Root layout navigator & Providers wrapper
│   └── modal.tsx         # Add / Edit Habit detail form
├── assets/               # Brand assets, custom logos, and favicons
├── components/           # Custom UI elements (themed views, navigation, buttons)
├── context/              # Global state management (HabitsContext)
├── firebase/             # Firestore, Auth config, and initialization
├── hooks/                # Custom React hooks (useHabits, theme styling)
├── services/             # Firebase data access layer
├── vercel.json           # Vercel static Expo deployment configuration
└── firebase.json         # Firebase Hosting & Cloud Functions configuration
```

---

## 🚀 Getting Started

### Prerequisites

Make sure you have Node.js and npm installed on your system.

### 1. Clone the repository and install dependencies

```bash
git clone https://github.com/tsakirisand/Stride-HabitTracker.git
cd Stride-HabitTracker
npm install
```

### 2. Configure Firebase

Update configuration in `firebase/config.js` with your Firebase API keys. The app automatically selects `browserLocalPersistence` for web builds and React Native persistence for mobile.

---

## 💻 Web App & Production Builds

### 1. Run Web Development Server
```bash
npm run web
# or: npx expo start --web
```

### 2. Export Web Production Bundle
Generate optimized static web production files in the `dist` directory:
```bash
npm run build:web
```

### 3. Preview Production Build Locally
```bash
npx serve dist
```

---

## 🌐 Deployment Options

### GitHub Pages (Automated & CLI)

- **CLI Deployment**:
  ```bash
  npm run deploy:gh-pages
  ```
- **Automated CI/CD**: A GitHub Actions workflow (`.github/workflows/deploy.yml`) builds and deploys to GitHub Pages automatically whenever changes are pushed to `main`.

### Vercel Deployment
Deploy directly using the Vercel CLI or by connecting your repository on [Vercel Dashboard](https://vercel.com):
```bash
npx vercel
```
*(Pre-configured with `vercel.json` for single-page routing)*

### Firebase Hosting
```bash
firebase deploy --only hosting
```

---

## 🛡️ License

This project is licensed under the MIT License.
