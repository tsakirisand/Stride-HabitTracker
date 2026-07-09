import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';
import React, { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { auth, db } from '../firebase/config';
import { useHabits } from '../hooks/useHabits';

export type Habit = {
  id: string;
  name: string;
  isDone: boolean;
  isNumeric?: boolean;
  targetValue?: number;
  currentValue?: number;
};

export type HabitsState = {
  [dateString: string]: Habit[];
};

type HabitsContextType = {
  user: User | null;
  isAuthReady: boolean;
  habits: HabitsState;
  globalHabitOrder: string[];
  setGlobalHabitOrder: React.Dispatch<React.SetStateAction<string[]>>;
  isLoaded: boolean;
  addHabit: (habitData: any) => Promise<string | undefined>;
  toggleHabit: (habitId: string, date: string) => Promise<void>;
  deleteHabit: (habitId: string) => Promise<void>;
  updateHabit: (habitId: string, updates: any) => Promise<void>;
  updateHabitProgress: (habitId: string, date: string, value: number) => Promise<void>;
  adjustHabitProgressAmount: (habitId: string, date: string, amount: number) => Promise<void>;
  rawHabits: any[];
};

const HabitsContext = createContext<HabitsContextType | undefined>(undefined);

export function HabitsProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u || null);
      setIsAuthReady(true);
    });
    return unsub;
  }, []);

  const {
    habits: fireHabits,
    loading: fireLoading,
    addHabit: fireAddHabit,
    toggleHabit: fireToggleHabit,
    deleteHabit: fireDeleteHabit,
    updateHabit: fireUpdateHabit,
    updateHabitProgress: fireUpdateHabitProgress,
    adjustHabitProgressAmount: fireAdjustHabitProgressAmount,
    rawHabits
  } = useHabits(user?.uid || '');

  const [globalHabitOrder, setGlobalHabitOrder] = useState<string[]>([]);
  const [isUserDataLoaded, setIsUserDataLoaded] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);



  // Load global habit order from Firestore user document in real-time
  useEffect(() => {
    if (!user) {
      setGlobalHabitOrder([]);
      setIsUserDataLoaded(true);
      return;
    }

    const userRef = doc(db, 'users', user.uid);
    const unsubscribe = onSnapshot(userRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data.globalHabitOrder) setGlobalHabitOrder(data.globalHabitOrder);
      }
      setIsUserDataLoaded(true);
    }, (error) => {
      console.error('Failed to listen to user data', error);
      setIsUserDataLoaded(true);
    });

    return unsubscribe;
  }, [user]);

  // Save global habit order to Firestore when it changes
  useEffect(() => {
    if (!user || !isLoaded) return;

    const saveOrder = async () => {
      try {
        const userRef = doc(db, 'users', user.uid);
        // Filter out any invalid items before saving
        const cleanOrder = globalHabitOrder.filter(item => typeof item === 'string' && item.length > 0);
        await setDoc(userRef, {
          globalHabitOrder: cleanOrder,
          updatedAt: new Date()
        }, { merge: true });
      } catch (e) {
        console.error('Failed to save habit order', e);
      }
    };
    saveOrder();
  }, [globalHabitOrder, user, isLoaded]);

  const [isMigrated, setIsMigrated] = useState(false);

  useEffect(() => {
    if (!fireLoading && !isMigrated && rawHabits.length > 0 && globalHabitOrder.length > 0) {
      const cleanOrder = globalHabitOrder.filter(item => typeof item === 'string' && item.length > 0);

      const newOrder = Array.from(new Set(
        cleanOrder.map(item => {
          if (rawHabits.some((h: any) => h.id === item)) return item;
          const found = rawHabits.find((h: any) => h.name && typeof h.name === 'string' && h.name.toLowerCase() === item?.toLowerCase?.());
          return found ? (found as any).id : item;
        })
      )).filter(Boolean) as string[];

      const hasChanged = JSON.stringify(newOrder) !== JSON.stringify(globalHabitOrder);
      if (hasChanged) {
        console.log("Migrating and deduplicating globalHabitOrder");
        setGlobalHabitOrder(newOrder);
      }
      setIsMigrated(true);
    }
  }, [fireLoading, isMigrated, rawHabits, globalHabitOrder]);

  useEffect(() => {
    if (!fireLoading && isUserDataLoaded) {
      setIsLoaded(true);
    }
  }, [fireLoading, isUserDataLoaded]);

  const addHabit = useCallback(async (habitData: any) => {
    return await fireAddHabit(habitData);
  }, [fireAddHabit]);

  const toggleHabit = useCallback(async (habitId: string, date: string) => {
    await fireToggleHabit(habitId, date);
  }, [fireToggleHabit]);

  const deleteHabit = useCallback(async (habitId: string) => {
    await fireDeleteHabit(habitId);
    setGlobalHabitOrder(prev => prev.filter(id => id !== habitId));
  }, [fireDeleteHabit]);

  const updateHabit = useCallback(async (habitId: string, updates: any) => {
    await fireUpdateHabit(habitId, updates);
  }, [fireUpdateHabit]);

  const updateHabitProgress = useCallback(async (habitId: string, date: string, value: number) => {
    await fireUpdateHabitProgress(habitId, date, value);
  }, [fireUpdateHabitProgress]);

  const adjustHabitProgressAmount = useCallback(async (habitId: string, date: string, amount: number) => {
    await fireAdjustHabitProgressAmount(habitId, date, amount);
  }, [fireAdjustHabitProgressAmount]);

  return (
    <HabitsContext.Provider value={{
      user,
      isAuthReady,
      habits: fireHabits,
      globalHabitOrder,
      setGlobalHabitOrder,
      isLoaded,
      addHabit,
      toggleHabit,
      deleteHabit,
      updateHabit,
      updateHabitProgress,
      adjustHabitProgressAmount,
      rawHabits,
    }}>
      {children}
    </HabitsContext.Provider>
  );
}

export function useHabitsContext() {
  const context = useContext(HabitsContext);
  if (context === undefined) {
    throw new Error('useHabitsContext must be used within a HabitsProvider');
  }
  return context;
}
