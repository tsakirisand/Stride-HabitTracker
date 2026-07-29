import { initializeApp } from 'firebase/app';
import { 
  initializeAuth, 
  getReactNativePersistence, 
  browserLocalPersistence 
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const firebaseConfig = {
  apiKey: "AIzaSyCmRkgihRPlnTlCKdNbJW3k2CGvCzjFHZY",
  authDomain: "stride-190c6.firebaseapp.com",
  projectId: "stride-190c6",
  storageBucket: "stride-190c6.firebasestorage.app",
  messagingSenderId: "393508081606",
  appId: "1:393508081606:web:03aaddf443a31a61636cc7"
};

const app = initializeApp(firebaseConfig);

const auth = initializeAuth(app, {
  persistence: Platform.OS === 'web' 
    ? browserLocalPersistence 
    : (getReactNativePersistence ? getReactNativePersistence(ReactNativeAsyncStorage) : browserLocalPersistence)
});

const db = getFirestore(app);

export { auth, db, app };

