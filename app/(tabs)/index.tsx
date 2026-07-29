import { useHabitsContext } from '@/context/HabitsContext';
import { Ionicons } from '@expo/vector-icons';
import { triggerHaptic } from '@/utils/haptics';
import { useRouter } from 'expo-router';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import DraggableFlatList, { RenderItemParams, ScaleDecorator } from 'react-native-draggable-flatlist';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';


type Habit = {
  id: string;
  name: string;
  isDone: boolean;
  isNumeric?: boolean;
  targetValue?: number;
  currentValue?: number;
};

type SectionDivider = { id: string; type: 'section-divider'; label: string };
type ListItem = Habit | SectionDivider;

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAYS_OF_WEEK_SHORT = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const CALENDAR_ITEM_WIDTH = 60;

let globalHasRedirected = false;

export default function StrideApp() {
  const { habits, globalHabitOrder, setGlobalHabitOrder, isLoaded, addHabit, toggleHabit: contextToggleHabit, deleteHabit: contextDeleteHabit, updateHabit: contextUpdateHabit, updateHabitProgress: contextUpdateHabitProgress, adjustHabitProgressAmount: contextAdjustHabitProgressAmount, rawHabits } = useHabitsContext();
  const router = useRouter();

  // Auto-pitch premium on first launch in session - REMOVED
  useEffect(() => {
    // Premium redirect removed to make app fully free
  }, []);

  // Edit mode global state
  const [isGlobalEditMode, setIsGlobalEditMode] = useState(false);

  // Modal state
  const [isModalVisible, setModalVisible] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [editingHabitName, setEditingHabitName] = useState('');

  const [newHabitName, setNewHabitName] = useState('');
  const [selectedDaysOfWeek, setSelectedDaysOfWeek] = useState<number[]>([]);
  const [isNumeric, setIsNumeric] = useState(false);
  const [targetGoal, setTargetGoal] = useState('1');

  // Context Menu state
  const [longPressedHabit, setLongPressedHabit] = useState<Habit | null>(null);
  const [isContextMenuVisible, setIsContextMenuVisible] = useState(false);

  const calendarDates = useMemo(() => {
    const dates = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const start = new Date(today);
    start.setDate(today.getDate() - 180);

    for (let i = 0; i <= 365; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      dates.push(d);
    }
    return dates;
  }, []);

  const getFormatDateStr = (date: Date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  const todayStr = getFormatDateStr(new Date());
  const [selectedDateStr, setSelectedDateStr] = useState<string>(todayStr);
  const isFutureDate = selectedDateStr > todayStr;

  const currentDayHabits = useMemo(() => {
    const dayHabits = habits[selectedDateStr] || [];
    if (globalHabitOrder.length === 0) return dayHabits;

    const mapped = dayHabits.map((el, i) => ({ index: i, value: el }));
    mapped.sort((a, b) => {
      // Sort completed items to the bottom if we are not in edit mode
      if (!isGlobalEditMode) {
        if (a.value.isDone && !b.value.isDone) return 1;
        if (!a.value.isDone && b.value.isDone) return -1;
      }

      const aId = a.value.id;
      const bId = b.value.id;

      const aIdx = globalHabitOrder.indexOf(aId);
      const bIdx = globalHabitOrder.indexOf(bId);

      const validA = aIdx !== -1 ? aIdx : 9999;
      const validB = bIdx !== -1 ? bIdx : 9999;

      if (validA !== validB) {
        return validA - validB;
      }
      return a.index - b.index; // Fallback to original placement for stable sort
    });

    return mapped.map(el => el.value);
  }, [habits, selectedDateStr, globalHabitOrder, isGlobalEditMode]);

  // Pre-calculate streaks for currently viewed habits (skips unscheduled days)
  const habitStreaks = useMemo(() => {
    const streaks: Record<string, number> = {};
    if (!habits || currentDayHabits.length === 0) return streaks;

    const allDates = Object.keys(habits).sort();
    if (allDates.length === 0) return streaks;
    const oldestDateStr = allDates[0];

    // Today's date info
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);
    const todayDateStr = getFormatDateStr(todayDate);

    currentDayHabits.forEach(h => {
      const habitId = h.id;
      let currentStreak = 0;
      let checkDate = new Date(todayDate);

      // 1. Give credit for today if completed
      const todayHabits = habits[todayDateStr] || [];
      const todayInstance = todayHabits.find(i => i.id === habitId);
      if (todayInstance?.isDone) {
        currentStreak += 1;
      }

      // 2. Look backwards
      checkDate.setDate(checkDate.getDate() - 1);

      while (true) {
        const testDateStr = getFormatDateStr(checkDate);
        if (testDateStr < oldestDateStr) break;

        const dayHabits = habits[testDateStr] || [];
        const instance = dayHabits.find(i => i.id === habitId);

        if (instance) {
          if (instance.isDone) {
            currentStreak++;
          } else {
            break; // Streak broken by missed scheduled day!
          }
        }

        checkDate.setDate(checkDate.getDate() - 1);
      }
      streaks[habitId] = currentStreak;
    });

    return streaks;
  }, [habits, currentDayHabits]);

  // Calculate master streak (consecutive days with 100% completion)
  // 1. Pre-calculate completion status for all dates (only depends on habits)
  const datesStatusMap = useMemo(() => {
    const map: Record<string, boolean> = {};
    const progressMap: Record<string, number> = {};

    calendarDates.forEach(date => {
      const dateStr = getFormatDateStr(date);
      const dayHabits = habits[dateStr] || [];
      const total = dayHabits.length;

      if (total === 0) {
        map[dateStr] = false;
        progressMap[dateStr] = 0;
      } else {
        const completedCount = dayHabits.reduce((acc, h) => {
          if (h.isNumeric && h.targetValue) return acc + Math.min(1, (h.currentValue || 0) / h.targetValue);
          return acc + (h.isDone ? 1 : 0);
        }, 0);
        const progress = completedCount / total;
        map[dateStr] = progress === 1;
        progressMap[dateStr] = progress;
      }
    });

    return { status: map, progress: progressMap };
  }, [habits, calendarDates]);

  // 2. Compute Master Streak based on pre-calculated data
  const masterStreakInfo = useMemo(() => {
    const selectedIdx = calendarDates.findIndex(d => getFormatDateStr(d) === selectedDateStr);
    if (selectedIdx === -1) return { count: 0, isPending: false };

    const selectedDateStrVal = getFormatDateStr(calendarDates[selectedIdx]);
    const isComplete = datesStatusMap.status[selectedDateStrVal];

    // 1. If Selected Day is NOT complete, check if we have a pending streak from the day before
    if (!isComplete) {
      if (selectedIdx > 0 && datesStatusMap.status[getFormatDateStr(calendarDates[selectedIdx - 1])]) {
        let count = 0;
        for (let i = selectedIdx - 1; i >= 0; i--) {
          if (datesStatusMap.status[getFormatDateStr(calendarDates[i])]) count++;
          else break;
        }
        return { count, isPending: true };
      }
      return { count: 0, isPending: false };
    }

    // 2. If the selected day IS complete, find the FULL CHAIN it belongs to
    if (isComplete) {
      let chainStart = selectedIdx;
      let chainEnd = selectedIdx;

      // Look backward (older dates, lower indices)
      for (let i = selectedIdx - 1; i >= 0; i--) {
        if (datesStatusMap.status[getFormatDateStr(calendarDates[i])]) chainStart = i;
        else break;
      }
      // Look forward (newer dates, higher indices, up to today)
      for (let i = selectedIdx + 1; i < calendarDates.length; i++) {
        if (datesStatusMap.status[getFormatDateStr(calendarDates[i])]) chainEnd = i;
        else break;
      }

      return { count: (chainEnd - chainStart) + 1, isPending: false };
    }

    return { count: 0, isPending: false };
  }, [datesStatusMap, calendarDates, selectedDateStr]);

  const dailyProgressMap = datesStatusMap.progress;

  const listData = useMemo((): ListItem[] => {
    if (isGlobalEditMode) return currentDayHabits;

    const pending = currentDayHabits.filter(h => !h.isDone);
    const done = currentDayHabits.filter(h => h.isDone);

    if (done.length === 0) return pending;

    const divider: SectionDivider = { id: '__finished_divider__', type: 'section-divider', label: 'Finished' };
    if (pending.length === 0) return [divider, ...done];
    return [...pending, divider, ...done];
  }, [currentDayHabits, isGlobalEditMode]);

  const flatListRef = useRef<FlatList>(null);
  const isInitialScrollDone = useRef(false);

  useEffect(() => {
    // Only attempt to scroll AFTER the data is loaded and FlatList is mounted
    if (isLoaded && !isInitialScrollDone.current) {
      const index = calendarDates.findIndex(d => getFormatDateStr(d) === todayStr);
      if (index !== -1 && flatListRef.current) {
        setTimeout(() => {
          flatListRef.current?.scrollToIndex({ index, animated: false, viewPosition: 0.5 });
          isInitialScrollDone.current = true;
        }, 50);
      }
    }
  }, [calendarDates, todayStr, isLoaded]);

  const moveHabitToNextDay = async (habitId: string) => {
    const habit = rawHabits.find(h => h.id === habitId);
    if (!habit) return;

    // Calculate current and next day names
    const selectedDate = new Date(selectedDateStr);
    const todayDayName = DAYS_OF_WEEK[selectedDate.getDay()];

    const nextDate = new Date(selectedDate);
    nextDate.setDate(selectedDate.getDate() + 1);
    const nextDayName = DAYS_OF_WEEK[nextDate.getDay()];

    const currentDays = habit.days || [];

    // Block if already scheduled for tomorrow
    if (currentDays.includes(nextDayName)) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert('Already scheduled', `${habit.name} is already scheduled for ${nextDayName}.`);
      setIsContextMenuVisible(false);
      return;
    }

    // Build new days: remove today, add tomorrow
    let newDays = currentDays.filter((d: string) => d !== todayDayName);
    newDays = [...newDays, nextDayName];

    try {
      await contextUpdateHabit(habitId, {
        days: newDays
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setIsContextMenuVisible(false);
    } catch (e) {
      console.error('Failed to move habit', e);
    }
  };

  const openAddModal = () => {
    const focusedDate = calendarDates.find(d => getFormatDateStr(d) === selectedDateStr);
    const dayIndex = focusedDate ? focusedDate.getDay() : new Date().getDay();

    setModalMode('add');
    setSelectedDaysOfWeek([dayIndex]);
    setNewHabitName('');
    setIsNumeric(false);
    setTargetGoal('1');
    setModalVisible(true);
  };

  const openEditModal = (habit: Habit) => {
    setModalMode('edit');
    setLongPressedHabit(habit);
    setEditingHabitName(habit.name);
    setNewHabitName(habit.name);

    const activeDays = new Set<number>();
    Object.entries(habits).forEach(([dateStr, dayHabits]) => {
      if (dayHabits.some(h => h.id === habit.id)) {
        const parts = dateStr.split('-');
        const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        activeDays.add(d.getDay());
      }
    });

    setSelectedDaysOfWeek(Array.from(activeDays));
    setIsNumeric(habit.isNumeric || false);
    setTargetGoal(String(habit.targetValue || 1));
    setModalVisible(true);
  };

  const handleAddOrEditHabit = async () => {
    if (newHabitName.trim().length === 0) return;
    if (selectedDaysOfWeek.length === 0) return;

    if (modalMode === 'add') {
      await handleAddHabit();
    } else {
      await handleSaveEdit();
    }
  };

  const handleAddHabit = async () => {
    const newHabitNameTrimmed = newHabitName.trim();
    if (!newHabitNameTrimmed) return;

    const days = selectedDaysOfWeek.map(idx => DAYS_OF_WEEK[idx]);

    try {
      await addHabit({
        name: newHabitNameTrimmed,
        days: days,
        isNumeric: isNumeric,
        targetValue: isNumeric ? parseInt(targetGoal, 10) || 1 : 1
      });
      setModalVisible(false);
    } catch (e) {
      console.error('Failed to add habit', e);
      Alert.alert('Error', 'Failed to add habit. Please try again.');
    }
  };

  const handleSaveEdit = async () => {
    const newNameTrimmed = newHabitName.trim();
    if (!newNameTrimmed || !longPressedHabit) return;

    const days = selectedDaysOfWeek.map(idx => DAYS_OF_WEEK[idx]);

    try {
      await contextUpdateHabit(longPressedHabit.id, {
        name: newNameTrimmed,
        days: days,
        isNumeric: isNumeric,
        targetValue: isNumeric ? parseInt(targetGoal, 10) || 1 : 1
      });
      setModalVisible(false);
      setLongPressedHabit(null);
    } catch (e) {
      console.error('Failed to update habit', e);
      Alert.alert('Error', 'Failed to update habit.');
    }
  };

  const handleDeleteFromThisDay = async () => {
    if (!longPressedHabit) return;

    const focusedDate = new Date(selectedDateStr);
    const dayName = DAYS_OF_WEEK[focusedDate.getDay()];

    // Find the current habit from rawHabits to get its existing schedule
    const habit = rawHabits.find(h => h.id === longPressedHabit.id);
    if (!habit) return;

    const newDays = (habit.days || []).filter((d: string) => d !== dayName);

    try {
      await contextUpdateHabit(habit.id, { days: newDays });
      setModalVisible(false);
    } catch (e) {
      console.error('Failed to remove habit from day', e);
    }
  };

  const handleDeleteFromAllDays = () => {
    if (!longPressedHabit) return;
    Alert.alert(
      "Delete Completely",
      "Are you sure you want to delete this habit from ALL days?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await contextDeleteHabit(longPressedHabit.id);
              setModalVisible(false);
            } catch (e) {
              console.error('Failed to delete habit', e);
            }
          }
        }
      ]
    );
  };

  const toggleHabit = async (id: string) => {
    if (isGlobalEditMode) return;
    if (isFutureDate) {
      Alert.alert("Not yet!", "You cannot complete habits in the future.");
      return;
    }

    const dayHabits = habits[selectedDateStr] || [];
    const habit = dayHabits.find(h => h.id === id);
    if (habit) {
      if (!habit.isDone) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    }

    try {
      await contextToggleHabit(id, selectedDateStr);
    } catch (e) {
      console.error('Failed to toggle habit', e);
    }
  };

  const adjustNumericHabit = async (id: string, amount: number) => {
    if (isGlobalEditMode) return;
    if (isFutureDate) {
      Alert.alert("Not yet!", "You cannot update habits in the future.");
      return;
    }

    const dayHabits = habits[selectedDateStr] || [];
    const habit = dayHabits.find(h => h.id === id);
    if (!habit || !habit.isNumeric) return;

    const nextVal = Math.max(0, (habit.currentValue || 0) + amount);
    const target = habit.targetValue || 1;
    const isNowDone = nextVal >= target;

    if (amount > 0) {
      Haptics.impactAsync(isNowDone ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Medium);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    try {
      await contextAdjustHabitProgressAmount(id, selectedDateStr, amount);
    } catch (e) {
      console.error('Failed to update habit progress', e);
    }
  };

  const onCalendarDayPress = useCallback((dateStr: string) => {
    setSelectedDateStr(dateStr);
  }, []);

  const renderCalendarDay = useCallback(({ item: date, index: idx }: { item: Date, index: number }) => {
    const dateStr = getFormatDateStr(date);
    const progress = dailyProgressMap[dateStr] || 0;
    const hasLeftConnection = progress === 1 && idx > 0 && dailyProgressMap[getFormatDateStr(calendarDates[idx - 1])] === 1;
    const hasRightConnection = progress === 1 && idx < calendarDates.length - 1 && dailyProgressMap[getFormatDateStr(calendarDates[idx + 1])] === 1;
    const habitCount = (habits[dateStr]?.length || 0);

    return (
      <CalendarDay
        date={date}
        dateStr={dateStr}
        isSelected={dateStr === selectedDateStr}
        isToday={dateStr === todayStr}
        progress={progress}
        habitCount={habitCount}
        hasLeftConnection={hasLeftConnection}
        hasRightConnection={hasRightConnection}
        onPress={onCalendarDayPress}
      />
    );
  }, [dailyProgressMap, calendarDates, selectedDateStr, todayStr, habits, onCalendarDayPress]);

  const renderHabitItem = ({ item, drag, isActive }: RenderItemParams<ListItem>) => {
    if ('type' in item && item.type === 'section-divider') {
      return (
        <View style={styles.sectionDivider}>
          <Text style={styles.sectionDividerText}>{item.label}</Text>
        </View>
      );
    }

    const habit = item as Habit;
    const streak = habitStreaks[habit.id] || 0;

    if (isGlobalEditMode) {
      return (
        <ScaleDecorator>
          <TouchableOpacity
            activeOpacity={0.9}
            onLongPress={drag}
            delayLongPress={200}
            style={[
              styles.habitCardRow,
              styles.habitCardEditMode,
              isActive && { backgroundColor: '#333', borderColor: '#4DA8DA', elevation: 5, zIndex: 100 }
            ]}
          >
            <TouchableOpacity style={styles.habitCardEditLeft} onPress={() => openEditModal(habit)}>
              <Ionicons name="pencil" size={20} color="#4DA8DA" style={{ marginRight: 12 }} />
              <Text style={styles.habitText}>{habit.name}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPressIn={drag}
              style={styles.dragHandleBtn}
            >
              <Ionicons name="menu" size={24} color="#888" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.moveHabitBtn}
              onPress={() => moveHabitToNextDay(habit.id)}
            >
              <Ionicons name="calendar-outline" size={20} color="#888" />
            </TouchableOpacity>
          </TouchableOpacity>
        </ScaleDecorator>
      );
    }

    return (
      <View
        style={[styles.habitCardRow, habit.isDone && styles.habitCardDone, isFutureDate && { opacity: 0.6 }]}
      >
        <TouchableOpacity
          style={styles.habitCardNormalLeft}
          onPress={() => {
            if (habit.isNumeric) {
              if (habit.isDone) {
                adjustNumericHabit(habit.id, -1);
              } else {
                adjustNumericHabit(habit.id, 1);
              }
            } else {
              toggleHabit(habit.id);
            }
          }}
          onLongPress={() => {
            triggerHaptic('heavy');
            setLongPressedHabit(habit);
            setIsContextMenuVisible(true);
          }}
          delayLongPress={350}
          activeOpacity={isFutureDate ? 1 : 0.7}
        >
          <View style={{ flex: 1 }}>
            <Text style={[styles.habitText, habit.isDone && styles.habitTextDone, isFutureDate && { color: '#888' }]}>
              {habit.name}
            </Text>
          </View>

          {streak >= 3 && (
            <View style={[styles.streakBadge, !habit.isDone && { opacity: 0.6 }]}>
              <Ionicons name="flame" size={16} color={habit.isDone ? "#FF7A00" : "#666"} />
              <Text style={[styles.streakText, !habit.isDone && { color: '#666' }]}>{streak}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.6}
          onPress={() => {
            if (habit.isNumeric) {
              if (habit.isDone) adjustNumericHabit(habit.id, -1);
              else adjustNumericHabit(habit.id, 1);
            } else {
              toggleHabit(habit.id);
            }
          }}
          onLongPress={() => {
            if (habit.isNumeric) {
              adjustNumericHabit(habit.id, -1);
            } else {
              triggerHaptic('heavy');
              setLongPressedHabit(habit);
              setIsContextMenuVisible(true);
            }
          }}
          delayLongPress={300}
          style={[
            styles.checkbox,
            habit.isDone && styles.checkboxDone,
            isFutureDate && { borderColor: '#444', backgroundColor: 'transparent' }
          ]}
        >
          {habit.isNumeric && !habit.isDone ? (
            <>
              <Svg height="34" width="34" viewBox="0 0 34 34" style={{ position: 'absolute' }}>
                <Circle
                  cx="17" cy="17" r="15"
                  stroke="#2C2C2C" strokeWidth="2" fill="transparent"
                />
                <Circle
                  cx="17" cy="17" r="15"
                  stroke="#4DA8DA" strokeWidth="2" fill="transparent"
                  strokeDasharray={2 * Math.PI * 15}
                  strokeDashoffset={(2 * Math.PI * 15) - (((habit.currentValue || 0) / (habit.targetValue || 1)) * (2 * Math.PI * 15))}
                  strokeLinecap="round"
                  transform="rotate(-90 17 17)"
                />
              </Svg>
              <Text style={styles.numericValueOverlay}>
                {habit.currentValue || 0}
              </Text>
            </>
          ) : habit.isDone ? (
            <Svg height="20" width="20" viewBox="0 0 24 24">
              <Path
                d="M5 12l5 5L19 7"
                fill="none"
                stroke="#121212"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          ) : (
            null
          )}
        </TouchableOpacity>
      </View>
    );
  };

  if (!isLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Stride</Text>
            {masterStreakInfo.count >= 2 && (
              <View style={[styles.headerStreakBadge, masterStreakInfo.isPending && styles.headerStreakBadgePending]}>
                <Ionicons name="flame" size={18} color={masterStreakInfo.isPending ? "#888" : "#FF7A00"} />
                <Text style={[styles.headerStreakText, masterStreakInfo.isPending && styles.headerStreakTextPending]}>
                  {masterStreakInfo.count}
                </Text>
              </View>
            )}
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={[styles.headerBtn, isGlobalEditMode ? styles.headerBtnActive : styles.headerBtnDark]}
              onPress={() => {
                triggerHaptic('light');
                setIsGlobalEditMode(!isGlobalEditMode);
              }}
            >
              <Ionicons name={isGlobalEditMode ? "checkmark" : "list"} size={22} color="#FFF" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerBtnAdd}
              onPress={() => {
                triggerHaptic('medium');
                openAddModal();
              }}
            >
              <Svg height="22" width="22" viewBox="0 0 24 24">
                <Path
                  d="M12 5v14M5 12h14"
                  fill="none"
                  stroke="#FFF"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.calendarContainer}>
          <FlatList
            ref={flatListRef}
            data={calendarDates}
            renderItem={renderCalendarDay}
            keyExtractor={(item) => item.toISOString()}
            horizontal
            showsHorizontalScrollIndicator={false}
            getItemLayout={(_data, index) => ({ length: CALENDAR_ITEM_WIDTH, offset: CALENDAR_ITEM_WIDTH * index, index })}
            contentContainerStyle={styles.calendarContent}
            initialNumToRender={14}
            onScrollToIndexFailed={() => { }}
          />
        </View>

        {/* Context Menu Modal */}
        <Modal
          visible={isContextMenuVisible}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setIsContextMenuVisible(false)}
        >
          <TouchableOpacity
            style={styles.contextMenuOverlay}
            activeOpacity={1}
            onPress={() => setIsContextMenuVisible(false)}
          >
            <View style={styles.contextMenuCard} onStartShouldSetResponder={() => true}>
              <Text style={styles.contextMenuTitle} numberOfLines={1}>{longPressedHabit?.name}</Text>

              <TouchableOpacity
                style={styles.contextOption}
                onPress={() => {
                  setIsContextMenuVisible(false);
                  if (longPressedHabit) openEditModal(longPressedHabit);
                }}
              >
                <Ionicons name="pencil-outline" size={22} color="#4DA8DA" />
                <Text style={styles.contextOptionText}>Edit Habit</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.contextOption}
                onPress={() => {
                  setIsContextMenuVisible(false);
                  if (longPressedHabit) moveHabitToNextDay(longPressedHabit.id);
                }}
              >
                <Ionicons name="calendar-outline" size={22} color="#FFF" />
                <Text style={styles.contextOptionText}>Move to Tomorrow</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.contextOption, { borderBottomWidth: 0 }]}
                onPress={() => {
                  if (longPressedHabit) {
                    Alert.alert(
                      'Delete Habit',
                      'Are you sure you want to delete this habit?',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Delete',
                          style: 'destructive',
                          onPress: async () => {
                            try {
                              await contextDeleteHabit(longPressedHabit.id);
                            } catch (e) {
                              console.error('Failed to delete habit', e);
                            }
                            setIsContextMenuVisible(false);
                          }
                        }
                      ]
                    );
                  }
                }}
              >
                <Ionicons name="trash-outline" size={22} color="#FF4444" />
                <Text style={[styles.contextOptionText, { color: '#FF4444' }]}>Delete</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        <View style={styles.listContainer}>
          <Text style={styles.listSectionTitle}>
            {todayStr === selectedDateStr ? 'Today\'s Habits' : 'Habits'}
          </Text>

          {currentDayHabits.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No habits for this day.</Text>
              <Text style={styles.emptyStateSubtext}>Tap the + button to add one</Text>
            </View>
          ) : isGlobalEditMode ? (
            <DraggableFlatList
              key={`list-drag-${selectedDateStr}`}
              data={listData}
              onDragEnd={({ data }) => {
                const newDayOrderIds = data
                  .filter((h): h is Habit => !('type' in h))
                  .map(h => h.id);

                setGlobalHabitOrder(prevOrder => {
                  const mergedOrder = [...prevOrder];
                  const affectedIndices = newDayOrderIds
                    .map(id => mergedOrder.indexOf(id))
                    .filter(idx => idx !== -1)
                    .sort((a, b) => a - b);

                  if (affectedIndices.length === newDayOrderIds.length) {
                    affectedIndices.forEach((posIndex, i) => {
                      mergedOrder[posIndex] = newDayOrderIds[i];
                    });
                    return mergedOrder;
                  }

                  return Array.from(new Set([...newDayOrderIds, ...prevOrder]));
                });
              }}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.flatListContent}
              showsVerticalScrollIndicator={true}
              renderItem={renderHabitItem}
            />
          ) : (
            <FlatList
              key={`list-std-${selectedDateStr}`}
              data={listData}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.flatListContent}
              showsVerticalScrollIndicator={true}
              renderItem={renderHabitItem}
            />
          )}
        </View>

        <Modal
          visible={isModalVisible}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setModalVisible(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalOverlay}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {modalMode === 'add' ? 'New Habit' : 'Edit Habit'}
                </Text>
                <TouchableOpacity onPress={() => setModalVisible(false)}>
                  <Ionicons name="close" size={24} color="#FFF" />
                </TouchableOpacity>
              </View>

              <TextInput
                style={styles.input}
                placeholder="What do you want to build?"
                placeholderTextColor="#666"
                value={newHabitName}
                onChangeText={setNewHabitName}
                autoFocus
                returnKeyType="done"
              />

              <View style={styles.typeSelectorContainer}>
                <Text style={styles.sectionLabel}>Habit Type</Text>
                <View style={styles.typeRow}>
                  <TouchableOpacity
                    style={[styles.typeBtn, !isNumeric && styles.typeBtnSelected]}
                    onPress={() => {
                      triggerHaptic('light');
                      setIsNumeric(false);
                    }}
                  >
                    <View style={[styles.typeIconBg, !isNumeric && styles.typeIconBgSelected]}>
                      <Ionicons name="checkmark-circle" size={24} color={!isNumeric ? "#FFF" : "#888"} />
                    </View>
                    <Text style={[styles.typeBtnText, !isNumeric && styles.typeBtnTextSelected]}>Check</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.typeBtn, isNumeric && styles.typeBtnSelected]}
                    onPress={() => {
                      triggerHaptic('light');
                      setIsNumeric(true);
                    }}
                  >
                    <View style={[styles.typeIconBg, isNumeric && styles.typeIconBgSelected]}>
                      <Ionicons name="stats-chart" size={22} color={isNumeric ? "#FFF" : "#888"} />
                    </View>
                    <Text style={[styles.typeBtnText, isNumeric && styles.typeBtnTextSelected]}>Counter</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {isNumeric && (
                <View style={styles.targetContainer}>
                  <Text style={styles.sectionLabel}>Daily Goal target</Text>
                  <View style={styles.stepperContainer}>
                    <TouchableOpacity
                      activeOpacity={0.7}
                      style={styles.stepperBtn}
                      onPress={() => {
                        const val = parseInt(targetGoal, 10) || 1;
                        if (val > 1) {
                          setTargetGoal((val - 1).toString());
                          triggerHaptic('light');
                        }
                      }}
                    >
                      <Ionicons name="remove" size={24} color="#FFF" />
                    </TouchableOpacity>

                    <View style={styles.stepperValueContainer}>
                      <Text style={styles.stepperValue}>{targetGoal}</Text>
                      <Text style={styles.stepperSubtext}>times</Text>
                    </View>

                    <TouchableOpacity
                      activeOpacity={0.7}
                      style={styles.stepperBtn}
                      onPress={() => {
                        const val = parseInt(targetGoal, 10) || 1;
                        setTargetGoal((val + 1).toString());
                        triggerHaptic('medium');
                      }}
                    >
                      <Ionicons name="add" size={24} color="#FFF" />
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              <View style={styles.daysSelectorContainer}>
                <Text style={styles.sectionLabel}>Repeat on</Text>
                <View style={styles.daysRow}>
                  {[1, 2, 3, 4, 5, 6, 0].map((dayIndex) => {
                    const dayLabel = DAYS_OF_WEEK_SHORT[dayIndex];
                    const isSelected = selectedDaysOfWeek.includes(dayIndex);
                    return (
                      <TouchableOpacity
                        key={dayIndex}
                        style={[styles.dayToggleBtn, isSelected && styles.dayToggleBtnSelected]}
                        onPress={() => {
                          triggerHaptic('light');
                          if (isSelected) {
                            setSelectedDaysOfWeek(prev => prev.filter(d => d !== dayIndex));
                          } else {
                            setSelectedDaysOfWeek(prev => [...prev, dayIndex]);
                          }
                        }}
                      >
                        <Text style={[styles.dayToggleText, isSelected && styles.dayToggleTextSelected]}>
                          {dayLabel}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {modalMode === 'edit' && (
                <View style={styles.deleteButtonGroup}>
                  <TouchableOpacity style={styles.deleteSpecificBtn} onPress={handleDeleteFromThisDay}>
                    <Ionicons name="calendar-clear-outline" size={18} color="#FF6A6A" />
                    <Text style={styles.deleteSpecificText}>Remove from this day</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.deleteAllBtn} onPress={handleDeleteFromAllDays}>
                    <Ionicons name="trash-outline" size={18} color="#FF6A6A" />
                    <Text style={styles.deleteAllText}>Delete totally</Text>
                  </TouchableOpacity>
                </View>
              )}

              <TouchableOpacity
                style={[styles.saveButton, selectedDaysOfWeek.length === 0 && styles.saveButtonDisabled]}
                onPress={handleAddOrEditHabit}
                disabled={selectedDaysOfWeek.length === 0}
              >
                <Text style={styles.saveButtonText}>
                  {modalMode === 'add' ? 'Add Habit' : 'Save Changes'}
                </Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 15 },
  headerTitleContainer: { flexDirection: 'row', alignItems: 'center' },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#FFF', letterSpacing: 0.5 },
  headerStreakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 14,
    backgroundColor: '#252525',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#3A3A3A',
    shadowColor: '#FF7A00',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 3
  },
  headerStreakBadgePending: {
    borderColor: '#2C2C2C',
    shadowOpacity: 0,
    opacity: 0.8
  },
  headerStreakText: { color: '#FFF', fontSize: 17, fontWeight: '900', marginLeft: 6, letterSpacing: 0.5 },
  headerStreakTextPending: { color: '#888' },
  headerRight: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  headerBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  headerBtnDark: { backgroundColor: '#2C2C2C' },
  headerBtnActive: { backgroundColor: '#4DA8DA' },
  headerBtnAdd: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#333', justifyContent: 'center', alignItems: 'center' },
  calendarContainer: { paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#2C2C2C' },
  calendarContent: { paddingHorizontal: 15 },
  calendarLine: { position: 'absolute', top: 21, height: 4, backgroundColor: '#4DA8DA', zIndex: -1 },
  calendarLineLeft: { left: -10, width: 22 },
  calendarLineRight: { right: -10, width: 22 },
  dayButton: { width: CALENDAR_ITEM_WIDTH, alignItems: 'center', paddingVertical: 12, borderRadius: 16, position: 'relative' },
  dayButtonSelected: { backgroundColor: '#1A1A1A' },
  dayName: { color: '#666', fontSize: 13, marginBottom: 8, fontWeight: '600' },
  dayIndicatorContainer: { position: 'relative' },
  dayRingContainer: { width: 46, height: 46, justifyContent: 'center', alignItems: 'center' },
  dateCircle: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1E1E1E' },
  dateCircleToday: { borderColor: '#4DA8DA', borderWidth: 1.5, backgroundColor: '#1E1E1E' },
  dateCircleSelected: { backgroundColor: '#4DA8DA', borderWidth: 0 },
  dateNumber: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  textSelected: { color: '#FFF' },
  textToday: { color: '#4DA8DA' },
  listContainer: { flex: 1, paddingHorizontal: 20, paddingTop: 20 },
  listSectionTitle: { color: '#FFF', fontSize: 20, fontWeight: 'bold', marginBottom: 15 },
  flatListContent: { paddingBottom: 120 },

  habitCardRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E1E1E', borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: '#2C2C2C', overflow: 'hidden' },
  habitCardDone: { opacity: 0.6 },
  habitCardEditMode: { borderColor: '#4DA8DA', borderStyle: 'dashed' },
  habitCardNormalLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', padding: 16 },
  habitCardEditLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', padding: 16 },
  dragHandleBtn: { padding: 12, justifyContent: 'center', alignItems: 'center', borderLeftWidth: 1, borderLeftColor: '#2C2C2C', backgroundColor: '#1A1A1A' },
  moveHabitBtn: { padding: 12, justifyContent: 'center', alignItems: 'center', borderLeftWidth: 1, borderLeftColor: '#2C2C2C', backgroundColor: '#1A1A1A' },

  checkbox: { width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, borderColor: '#3A3A3A', marginLeft: 16, justifyContent: 'center', alignItems: 'center', backgroundColor: '#161616' },
  checkboxDone: { backgroundColor: '#4DA8DA', borderColor: '#4DA8DA' },
  habitText: { color: '#FFF', fontSize: 16, fontWeight: '500' },
  habitTextDone: { textDecorationLine: 'line-through', color: '#888' },
  numericSubtext: { color: '#888', fontSize: 12, marginTop: 4 },
  numericValueOverlay: { color: '#FFF', fontSize: 12, fontWeight: '800' },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: '#252525',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333'
  },
  streakText: { fontSize: 13, color: '#FFF', fontWeight: '800', marginLeft: 4 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 40 },
  emptyStateText: { color: '#FFF', fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  emptyStateSubtext: { color: '#888', fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.7)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#1E1E1E', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { color: '#FFF', fontSize: 22, fontWeight: 'bold' },
  input: { backgroundColor: '#2C2C2C', color: '#FFF', borderRadius: 12, padding: 16, fontSize: 16, marginBottom: 20 },
  typeSelectorContainer: { marginBottom: 20 },
  typeRow: { flexDirection: 'row', gap: 12 },
  typeBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#252525', paddingVertical: 20, borderRadius: 20, borderWidth: 1.5, borderColor: '#333' },
  typeBtnSelected: { backgroundColor: '#1A1A1A', borderColor: '#4DA8DA' },
  typeIconBg: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#333', justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  typeIconBgSelected: { backgroundColor: '#4DA8DA' },
  typeBtnText: { color: '#888', fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  typeBtnTextSelected: { color: '#FFF' },
  targetContainer: { marginBottom: 24 },
  stepperContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#252525', borderRadius: 20, padding: 8, borderWidth: 1, borderColor: '#333' },
  stepperBtn: { width: 56, height: 56, backgroundColor: '#333', borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  stepperValueContainer: { alignItems: 'center', flex: 1 },
  stepperValue: { color: '#FFF', fontSize: 32, fontWeight: '900' },
  stepperSubtext: { color: '#888', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', marginTop: -2 },
  daysSelectorContainer: { marginBottom: 24 },
  sectionLabel: { color: '#888', fontSize: 12, fontWeight: '700', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  daysRow: { flexDirection: 'row', justifyContent: 'space-between' },
  dayToggleBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#2C2C2C', justifyContent: 'center', alignItems: 'center' },
  dayToggleBtnSelected: { backgroundColor: '#4DA8DA' },
  dayToggleText: { color: '#AAA', fontSize: 15, fontWeight: '600' },
  dayToggleTextSelected: { color: '#121212', fontWeight: 'bold' },

  deleteButtonGroup: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24, gap: 12 },
  deleteSpecificBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#331B1B', padding: 12, borderRadius: 12, gap: 6 },
  deleteSpecificText: { color: '#FF6A6A', fontSize: 13, fontWeight: '600' },
  deleteAllBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#331B1B', padding: 12, borderRadius: 12, gap: 6 },
  deleteAllText: { color: '#FF6A6A', fontSize: 13, fontWeight: '600' },

  saveButton: { backgroundColor: '#4DA8DA', borderRadius: 12, padding: 16, alignItems: 'center' },
  saveButtonDisabled: { backgroundColor: '#2C2C2C', opacity: 0.7 },
  saveButtonText: { color: '#121212', fontSize: 16, fontWeight: 'bold' },

  contextMenuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  contextMenuCard: { backgroundColor: '#1E1E1E', width: '100%', maxWidth: 280, borderRadius: 28, padding: 8, borderWidth: 1, borderColor: '#333', shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 20, elevation: 10 },
  contextMenuTitle: { color: '#888', fontSize: 12, fontWeight: '800', letterSpacing: 1.2, padding: 20, borderBottomWidth: 1, borderBottomColor: '#2C2C2C', textAlign: 'center', textTransform: 'uppercase' },
  contextOption: { flexDirection: 'row', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#2C2C2C' },
  contextOptionText: { color: '#FFF', fontSize: 16, fontWeight: '600', marginLeft: 16 },

  sectionDivider: { paddingTop: 16, paddingBottom: 8, paddingHorizontal: 4 },
  sectionDividerText: { color: '#555', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.2 },
});

// Memoized Calendar Day component for maximum performance
const CalendarDay = React.memo(({
  date, dateStr, isSelected, isToday, progress, habitCount, hasLeftConnection, hasRightConnection, onPress
}: {
  date: Date,
  dateStr: string,
  isSelected: boolean,
  isToday: boolean,
  progress: number,
  habitCount: number,
  hasLeftConnection: boolean,
  hasRightConnection: boolean,
  onPress: (d: string) => void
}) => {
  const radius = 18;
  const strokeWidth = 3.5;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = habitCount === 0 ? circumference : circumference - (progress * circumference);
  const showRing = habitCount > 0;
  const ringColor = '#4DA8DA';

  return (
    <TouchableOpacity
      style={[styles.dayButton, isSelected && styles.dayButtonSelected]}
      onPress={() => onPress(dateStr)}
      activeOpacity={0.7}
    >
      <Text style={[styles.dayName, isSelected && styles.textSelected, isToday && !isSelected && styles.textToday]}>
        {DAYS_OF_WEEK[date.getDay()]}
      </Text>

      <View style={styles.dayIndicatorContainer}>
        {hasLeftConnection && <View style={[styles.calendarLine, styles.calendarLineLeft]} />}
        {hasRightConnection && <View style={[styles.calendarLine, styles.calendarLineRight]} />}

        <View style={styles.dayRingContainer}>
          <Svg height="46" width="46" viewBox="0 0 46 46" style={{ position: 'absolute' }}>
            <Circle
              cx="23" cy="23" r={radius}
              stroke={habitCount > 0 ? "#2C2C2C" : "transparent"}
              strokeWidth={strokeWidth}
              fill="transparent"
            />
            {showRing && (
              <Circle
                cx="23" cy="23" r={radius}
                stroke={ringColor} strokeWidth={strokeWidth} fill="transparent"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                transform="rotate(-90 23 23)"
              />
            )}
          </Svg>
          <View style={[styles.dateCircle, isToday && styles.dateCircleToday, isSelected && styles.dateCircleSelected]}>
            <Text style={[styles.dateNumber, isSelected && styles.textSelected]}>
              {date.getDate()}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
});
CalendarDay.displayName = 'CalendarDay';
