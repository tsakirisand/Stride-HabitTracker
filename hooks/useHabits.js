import { useState, useEffect, useCallback, useRef } from 'react';
import * as habitService from '../services/habitService';

/**
 * Helper to get date string in YYYY-MM-DD format
 */
const getFormatDateStr = (date) => {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

/**
 * Custom hook to manage habits with real-time Firestore synchronization
 * @param {string} userId - The current user's ID
 */
export const useHabits = (userId) => {
  const [rawHabits, setRawHabits] = useState([]);
  const [habits, setHabits] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Always holds the latest habits state so callbacks can read it without stale closures
  const habitsRef = useRef({});
  // Tracks debounced progress writes: key = `${habitId}_${date}` → { pendingValue, timerId }
  const pendingProgressRef = useRef({});

  // Subscribe to habits on mount or userId change
  useEffect(() => {
    if (!userId) {
      setRawHabits([]);
      setHabits({});
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = habitService.subscribeToHabits(userId, (updatedHabits) => {
      setRawHabits(updatedHabits);
      
      const mapped = {};
      const today = new Date();
      const startDate = new Date(today);
      startDate.setMonth(today.getMonth() - 6);
      const endDate = new Date(today);
      endDate.setMonth(today.getMonth() + 6);

      const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dateStr = getFormatDateStr(d);
        const dayName = daysOfWeek[d.getDay()];
        
        updatedHabits.forEach(h => {
          const isScheduled = h.days?.includes(dayName);
          const isCompleted = h.completedDates?.includes(dateStr);
          const dailyProgress = h.progress?.[dateStr] || 0;
          
          // Logic: Scheduled OR (Not scheduled but was completed as a one-off)
          if (isScheduled || isCompleted) {
            if (!mapped[dateStr]) mapped[dateStr] = [];
            
            const targetVal = h.isNumeric ? (h.targetValue || 1) : 1;
            const currentVal = h.isNumeric ? dailyProgress : (isCompleted ? 1 : 0);

            mapped[dateStr].push({
              id: h.id,
              name: h.name,
              isDone: isCompleted,
              isNumeric: h.isNumeric,
              targetValue: targetVal,
              currentValue: currentVal,
            });
          }
        });
      }
      
      habitsRef.current = mapped;
      setHabits(mapped);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userId]);

  const addHabit = useCallback(async (habitData) => {
    if (!userId) return;
    try {
      const habitId = await habitService.addHabit(userId, habitData);
      // Optimistic update for rawHabits is complex due to Firestore return, 
      // but the real-time listener will catch it quickly.
      return habitId;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [userId]);

  const toggleHabit = useCallback(async (habitId, date) => {
    if (!userId) return;
    
    // Optimistic Update
    setHabits(prev => {
      const newHabits = { ...prev };
      if (newHabits[date]) {
        newHabits[date] = newHabits[date].map(h => {
          if (h.id === habitId) {
            return { ...h, isDone: !h.isDone };
          }
          return h;
        });
      }
      return newHabits;
    });

    try {
      await habitService.toggleHabit(userId, habitId, date);
    } catch (err) {
      setError(err.message);
      // Revert optimism if needed (simplified for now)
      throw err;
    }
  }, [userId]);

  const updateHabitProgress = useCallback(async (habitId, date, value) => {
    if (!userId) return;

    // Find the habit to get its targetValue
    const habit = rawHabits.find(h => h.id === habitId);
    const targetValue = habit?.targetValue || 1;

    // Optimistic Update
    setHabits(prev => {
      const newHabits = { ...prev };
      if (newHabits[date]) {
        newHabits[date] = newHabits[date].map(h => {
          if (h.id === habitId) {
            return { ...h, currentValue: value, isDone: value >= targetValue };
          }
          return h;
        });
      }
      return newHabits;
    });

    try {
      await habitService.updateHabitProgress(userId, habitId, date, value, targetValue);
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [userId, rawHabits]);

  const adjustHabitProgressAmount = useCallback((habitId, date, amount) => {
    if (!userId) return;

    const habit = rawHabits.find(h => h.id === habitId);
    const targetValue = habit?.targetValue || 1;
    const key = `${habitId}_${date}`;

    const pending = pendingProgressRef.current[key];
    if (pending?.timerId) clearTimeout(pending.timerId);

    // Compute next value purely synchronously:
    // - use the accumulated pending value as base on rapid taps
    // - fall back to the current value from habitsRef (always fresh, no stale closure)
    const baseVal = pending
      ? pending.pendingValue
      : (habitsRef.current[date]?.find(h => h.id === habitId)?.currentValue ?? 0);
    const nextVal = Math.max(0, baseVal + amount);

    // Optimistic update — pure, no side effects
    setHabits(prev => {
      const newHabits = { ...prev };
      if (newHabits[date]) {
        newHabits[date] = newHabits[date].map(h =>
          h.id === habitId ? { ...h, currentValue: nextVal, isDone: nextVal >= targetValue } : h
        );
      }
      habitsRef.current = newHabits;
      return newHabits;
    });

    // Schedule a single debounced write with the accumulated absolute value
    const timerId = setTimeout(async () => {
      delete pendingProgressRef.current[key];
      try {
        await habitService.updateHabitProgress(userId, habitId, date, nextVal, targetValue);
      } catch (err) {
        setError(err.message);
      }
    }, 600);

    pendingProgressRef.current[key] = { pendingValue: nextVal, timerId };
  }, [userId, rawHabits]);

  const deleteHabit = useCallback(async (habitId) => {
    if (!userId) return;
    try {
      await habitService.deleteHabit(userId, habitId);
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [userId]);

  const updateHabit = useCallback(async (habitId, updates) => {
    if (!userId) return;
    try {
      await habitService.updateHabit(userId, habitId, updates);
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [userId]);

  return {
    rawHabits,
    habits,
    loading,
    error,
    addHabit,
    toggleHabit,
    deleteHabit,
    updateHabit,
    updateHabitProgress,
    adjustHabitProgressAmount,
    isEmpty: rawHabits.length === 0 && !loading
  };
};
