# Stride Habit Tracker 🏃‍♂️📅

Stride is a premium, feature-rich React Native and Expo habit tracking application designed to help users build consistency and achieve their personal goals. It integrates seamlessly with Firebase (Authentication and Firestore) for real-time synchronization and secure cloud backups.

---

## 🌟 Key Features

- **Flexible Habit Types**:
  - **Standard Habits**: Simple toggle checkoffs (e.g., "Read 20 pages").
  - **Numeric/Target Habits**: Log progressive metrics with specific targets (e.g., "Drink 2500ml Water", "Do 50 Pushups").
- **Smart Habit Scheduling**: Schedule habits to recur on specific days of the week.
- **Streak Tracking**:
  - **Individual Streaks**: Tracks consecutive completion days for each individual habit.
  - **Master Streak**: Celebrates consecutive days where 100% of all scheduled habits are completed.
- **Interactive Calendar Dashboard**: Scroll through a 1-year history to view past completions and plan ahead.
- **Drag-and-Drop Reordering**: Organise your habits list effortlessly using intuitive press-and-drag interactions.
- **Rich Data Analytics**: Deep dive into your productivity with weekly and monthly completion statistics.
- **Firebase Sync**: Supports anonymous sign-in and email logins, keeping habit histories securely backed up and synced in real-time.
- **Beautiful Dark Theme UI**: Sleek, modern dark mode with smooth animations and responsive feedback.

---

## 🛠️ Tech Stack

- **Framework**: [Expo](https://expo.dev) & [React Native](https://reactnative.dev)
- **Routing**: [Expo Router](https://docs.expo.dev/router/introduction) (file-based navigation)
- **Database & Auth**: [Firebase v12](https://firebase.google.com) (Firestore & Auth)
- **Animations & Layout**: [React Native Reanimated](https://docs.swmansion.com/react-native-reanimated/) & [React Native Draggable FlatList](https://github.com/computerjazz/react-native-draggable-flatlist)
- **Icons**: Expo Vector Icons (Ionicons)

---

## 📂 Project Structure

```text
├── app/                  # Expo Router file-based entry screens
│   ├── (auth)/           # Authentication screens (Login, Sign-Up, Welcome)
│   ├── (tabs)/           # Core application tabs
│   │   ├── index.tsx     # Home Dashboard (Habit list, Calendar, Reordering)
│   │   ├── explore.tsx   # Statistics & Analytics Screen
│   │   └── settings.tsx  # User Settings & Sign Out
│   ├── _layout.tsx       # Root layout navigator & Providers wrapper
│   └── modal.tsx         # Add / Edit Habit detail form
├── components/           # Custom UI elements (themed views, navigation, buttons)
├── context/              # Global state management (HabitsContext)
├── firebase/             # Firestore, Auth config, and initialization
├── hooks/                # Custom React hooks (useHabits, theme styling)
├── services/             # Firebase data access layer
└── utils/                # Helper utilities and date formatters
```

---

## 🚀 Getting Started

### Prerequisites

Make sure you have Node.js and npm installed on your system.

### 1. Clone the repository and install dependencies

```bash
git clone https://github.com/andreast0702-sudo/Stride-HabitTracker.git
cd Stride-HabitTracker
npm install
```

### 2. Configure Firebase

Create a Firebase project at [Firebase Console](https://console.firebase.google.com/) and create web config credentials. Add a config file or update configuration in `firebase/config.js` with your specific API keys:

```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

### 3. Run the development server

Start the Expo bundler:

```bash
npx expo start
```

Use the printed options to open the application in:
- **iOS Simulator**: Press `i`
- **Android Emulator**: Press `a`
- **Web Browser**: Press `w`
- **Expo Go App**: Scan the QR code with your mobile device

---

## 🛡️ License

This project is licensed under the MIT License.
