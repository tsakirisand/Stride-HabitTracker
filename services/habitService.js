import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
  query,
  getDocs,
  orderBy,
  onSnapshot,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  getDoc,
  runTransaction
} from 'firebase/firestore';
import { db } from '../firebase/config';

/**
 * Adds a new habit for a specific user
 */
export const addHabit = async (userId, habitData) => {
  try {
    const habitsRef = collection(db, 'users', userId, 'habits');
    const newHabit = {
      ...habitData,
      completedDates: [],
      createdAt: serverTimestamp(),
      // Add support for numeric habits if provided
      isNumeric: habitData.isNumeric || false,
      targetValue: habitData.targetValue || 1,
      name: habitData.name,
      days: habitData.days || [],
    };
    const docRef = await addDoc(habitsRef, newHabit);
    return { id: docRef.id, ...newHabit };
  } catch (error) {
    console.error("Error adding habit: ", error);
    throw error;
  }
};

/**
 * Fetches all habits for a user (one-time fetch)
 */
export const getHabits = async (userId) => {
  try {
    const habitsRef = collection(db, 'users', userId, 'habits');
    const q = query(habitsRef, orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error("Error getting habits: ", error);
    throw error;
  }
};

/**
 * Toggles a habit's completion status for a specific date
 */
export const toggleHabit = async (userId, habitId, date) => {
  try {
    const habitRef = doc(db, 'users', userId, 'habits', habitId);
    
    await runTransaction(db, async (transaction) => {
      const habitDoc = await transaction.get(habitRef);
      if (!habitDoc.exists()) throw new Error("Habit does not exist");

      const data = habitDoc.data();
      const completedDates = data.completedDates || [];
      const isCompleted = completedDates.includes(date);
      
      let nextCompletedDates;
      if (isCompleted) {
        nextCompletedDates = completedDates.filter(d => d !== date);
      } else {
        nextCompletedDates = [...completedDates, date];
      }

      transaction.update(habitRef, { 
        completedDates: nextCompletedDates,
        updatedAt: serverTimestamp()
      });
    });
  } catch (error) {
    console.error("Error toggling habit: ", error);
    throw error;
  }
};

/**
 * Deletes a habit
 */
export const deleteHabit = async (userId, habitId) => {
  try {
    const habitRef = doc(db, 'users', userId, 'habits', habitId);
    await deleteDoc(habitRef);
  } catch (error) {
    console.error("Error deleting habit: ", error);
    throw error;
  }
};

/**
 * Updates a habit document
 */
export const updateHabit = async (userId, habitId, updates) => {
  try {
    const habitRef = doc(db, 'users', userId, 'habits', habitId);
    await updateDoc(habitRef, {
      ...updates,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Error updating habit: ", error);
    throw error;
  }
};

/**
 * Updates daily progress for a numeric habit
 */
export const updateHabitProgress = async (userId, habitId, dateStr, value, targetValue) => {
  try {
    const habitRef = doc(db, 'users', userId, 'habits', habitId);
    
    await runTransaction(db, async (transaction) => {
      const habitDoc = await transaction.get(habitRef);
      if (!habitDoc.exists()) throw new Error("Habit does not exist");

      const data = habitDoc.data();
      const completedDates = data.completedDates || [];
      const isCompleted = completedDates.includes(dateStr);
      const shouldBeCompleted = value >= targetValue;

      const updates = {
        [`progress.${dateStr}`]: value,
        updatedAt: serverTimestamp()
      };

      if (shouldBeCompleted && !isCompleted) {
        updates.completedDates = [...completedDates, dateStr];
      } else if (!shouldBeCompleted && isCompleted) {
        updates.completedDates = completedDates.filter(d => d !== dateStr);
      }

      transaction.update(habitRef, updates);
    });
  } catch (error) {
    console.error("Error updating habit progress: ", error);
    throw error;
  }
};

/**
 * Updates daily progress for a numeric habit using an amount increment
 */
export const updateHabitProgressAmount = async (userId, habitId, dateStr, amount, targetValue) => {
  try {
    const habitRef = doc(db, 'users', userId, 'habits', habitId);
    
    await runTransaction(db, async (transaction) => {
      const habitDoc = await transaction.get(habitRef);
      if (!habitDoc.exists()) throw new Error("Habit does not exist");

      const data = habitDoc.data();
      const currentProgress = (data.progress && data.progress[dateStr]) || 0;
      const nextProgress = Math.max(0, currentProgress + amount);

      const completedDates = data.completedDates || [];
      const isCompleted = completedDates.includes(dateStr);
      const shouldBeCompleted = nextProgress >= targetValue;

      const updates = {
        [`progress.${dateStr}`]: nextProgress,
        updatedAt: serverTimestamp()
      };

      if (shouldBeCompleted && !isCompleted) {
        updates.completedDates = [...completedDates, dateStr];
      } else if (!shouldBeCompleted && isCompleted) {
        updates.completedDates = completedDates.filter(d => d !== dateStr);
      }

      transaction.update(habitRef, updates);
    });
  } catch (error) {
    console.error("Error adjusting habit progress amount: ", error);
    throw error;
  }
};


/**
 * Sets up a real-time listener for user's habits
 */
export const subscribeToHabits = (userId, callback) => {
  const habitsRef = collection(db, 'users', userId, 'habits');
  const q = query(habitsRef, orderBy('createdAt', 'desc'));
  
  return onSnapshot(q, (snapshot) => {
    const habits = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      // Ensure dates are strings for easier comparison in UI
      createdAt: doc.data().createdAt?.toDate?.() || new Date()
    }));
    callback(habits);
  }, (error) => {
    console.error("Error subscribing to habits: ", error);
  });
};
