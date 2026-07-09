import { useHabitsContext } from '@/context/HabitsContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAYS_OF_WEEK_SHORT = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export default function StatisticsScreen() {
   const { habits, isLoaded, globalHabitOrder, rawHabits, user } = useHabitsContext();
   const router = useRouter();
   const [currentMonth, setCurrentMonth] = useState(new Date());

   const displayHabits = useMemo(() => {
      if (!rawHabits) return [];
      const activeRawHabits = rawHabits.filter(h => (h.days && h.days.length > 0) || (h.completedDates && h.completedDates.length > 0));
      const ids = activeRawHabits.map(h => h.id);
      ids.sort((a, b) => {
         const idxA = globalHabitOrder.indexOf(a);
         const idxB = globalHabitOrder.indexOf(b);
         const validA = idxA !== -1 ? idxA : 9999;
         const validB = idxB !== -1 ? idxB : 9999;
         return validA - validB;
      });
      return ids;
   }, [rawHabits, globalHabitOrder]);

   const [currentWeekStart, setCurrentWeekStart] = useState(() => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dayOfWeek = today.getDay();
      const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(today);
      monday.setDate(today.getDate() + diffToMonday);
      return monday;
   });

   const getFormatDateStr = (date: Date) => {
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
   };

   const monthData = useMemo(() => {
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth();

      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const firstDayOfWeek = new Date(year, month, 1).getDay();

      const days = [];
      for (let i = 0; i < firstDayOfWeek; i++) {
         days.push(null);
      }
      for (let i = 1; i <= daysInMonth; i++) {
         days.push(new Date(year, month, i));
      }
      return days;
   }, [currentMonth]);

   const prevMonth = () => {
      setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
   };

   const nextMonth = () => {
      setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
   };

   const prevWeek = () => {
      setCurrentWeekStart(prev => {
         const next = new Date(prev);
         next.setDate(prev.getDate() - 7);
         return next;
      });
   };

   const nextWeek = () => {
      setCurrentWeekStart(prev => {
         const next = new Date(prev);
         next.setDate(prev.getDate() + 7);
         return next;
      });
   };

   const currentWeekDates = useMemo(() => {
      const week = [];
      for (let i = 0; i < 7; i++) {
         const date = new Date(currentWeekStart);
         date.setDate(currentWeekStart.getDate() + i);
         week.push(date);
      }
      return week;
   }, [currentWeekStart]);

   const monthlyStats = useMemo(() => {
      let totalAssigned = 0;
      let totalCompleted = 0;

      // Track stats per habit label
      const habitStats: Record<string, { assigned: number; completed: number }> = {};
      displayHabits.forEach(hId => {
         habitStats[hId] = { assigned: 0, completed: 0 };
      });

      monthData.forEach(date => {
         if (!date) return;
         const dateStr = getFormatDateStr(date);
         const dayHabits = habits[dateStr] || [];

         dayHabits.forEach(h => {
            const hId = h.id;
            if (!habitStats[hId]) {
               // Handle orphan habits that were deleted from order but exist in history
               habitStats[hId] = { assigned: 0, completed: 0 };
            }

            habitStats[hId].assigned += 1;
            totalAssigned += 1;

            if (h.isNumeric && h.targetValue) {
               const fraction = Math.min(1, (h.currentValue || 0) / h.targetValue);
               habitStats[hId].completed += fraction;
               totalCompleted += fraction;
            } else if (h.isDone) {
               habitStats[hId].completed += 1;
               totalCompleted += 1;
            }
         });
      });

      const overallProgress = totalAssigned === 0 ? 0 : (totalCompleted / totalAssigned) * 100;

      return {
         overallProgress,
         habitStats,
         totalAssigned,
         totalCompleted
      };
   }, [monthData, habits, displayHabits]);

   const streaksData = useMemo(() => {
      const data: Record<string, { current: number; longest: number }> = {};

      displayHabits.forEach(hId => {
         data[hId] = { current: 0, longest: 0 };
         const completedDates = Object.keys(habits).filter(dateStr => {
            const h = habits[dateStr]?.find(hab => hab.id === hId);
            if (!h) return false;
            if (h.isNumeric && h.targetValue) return (h.currentValue || 0) >= h.targetValue;
            return h.isDone;
         }).sort();

         let longestStreak = 0;
         let tempStreak = 0;
         let lastDate: Date | null = null;

         for (const dateStr of completedDates) {
            const parts = dateStr.split('-');
            const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
            if (!lastDate) {
               tempStreak = 1;
            } else {
               const diffTime = date.getTime() - lastDate.getTime();
               const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
               if (diffDays === 1) {
                  tempStreak++;
               } else if (diffDays > 1) {
                  tempStreak = 1;
               }
            }
            if (tempStreak > longestStreak) {
               longestStreak = tempStreak;
            }
            lastDate = date;
         }

         let cStreak = 0;
         const todayDateStr = getFormatDateStr(new Date());
         const partsT = todayDateStr.split('-');
         let checkDate = new Date(parseInt(partsT[0]), parseInt(partsT[1]) - 1, parseInt(partsT[2]));

         let active = true;
         let isFirstCheck = true;
         while (active) {
            const dStr = getFormatDateStr(checkDate);
            if (completedDates.includes(dStr)) {
               cStreak++;
               checkDate.setDate(checkDate.getDate() - 1);
               isFirstCheck = false;
            } else {
               if (isFirstCheck) {
                  checkDate.setDate(checkDate.getDate() - 1);
                  isFirstCheck = false;
               } else {
                  active = false;
               }
            }
         }
         data[hId] = { current: cStreak, longest: longestStreak };
      });
      return data;
   }, [habits, displayHabits]);

   const progressChartData = useMemo(() => {
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const result = [];
      for (let d = 1; d <= daysInMonth; d++) {
         const date = new Date(year, month, d);
         const dateStr = getFormatDateStr(date);
         const dayHabits = habits[dateStr] || [];
         const total = dayHabits.length;
         let completed = 0;
         dayHabits.forEach(h => {
            if (h.isNumeric && h.targetValue) {
               completed += Math.min(1, (h.currentValue || 0) / h.targetValue);
            } else if (h.isDone) {
               completed++;
            }
         });
         const pct = total === 0 ? 0 : Math.round((completed / total) * 100);
         result.push({ day: d, pct });
      }
      return result;
   }, [currentMonth, habits]);

   const heatmapWeeks = 12;
   const heatmapData = useMemo(() => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const data: number[][] = [];

      const startDate = new Date(today);
      startDate.setDate(startDate.getDate() - (heatmapWeeks - 1) * 7 - startDate.getDay());

      for (let w = 0; w < heatmapWeeks; w++) {
         const weekCol: number[] = [];
         for (let d = 0; d < 7; d++) {
            const currentD = new Date(startDate);
            currentD.setDate(startDate.getDate() + (w * 7) + d);
            if (currentD > today) {
               weekCol.push(-1);
            } else {
               const dateStr = getFormatDateStr(currentD);
               const dayHabits = habits[dateStr] || [];
               let completedCount = 0;
               dayHabits.forEach(h => {
                  if (h.isNumeric && h.targetValue) {
                     if ((h.currentValue || 0) >= h.targetValue) completedCount++;
                  } else if (h.isDone) {
                     completedCount++;
                  }
               });

               const total = dayHabits.length;
               let level = 0;
               if (total > 0) {
                  const pct = completedCount / total;
                  if (pct > 0 && pct <= 0.25) level = 1;
                  else if (pct > 0.25 && pct <= 0.5) level = 2;
                  else if (pct > 0.5 && pct <= 0.75) level = 3;
                  else if (pct > 0.75) level = 4;
               }
               weekCol.push(level);
            }
         }
         data.push(weekCol);
      }
      return data;
   }, [habits]);


   if (!isLoaded) return null;

   const todayStr = getFormatDateStr(new Date());

   return (
      <SafeAreaView style={styles.container} edges={['top']}>
         <View style={styles.header}>
            <Text style={styles.headerTitle}>Statistics</Text>
         </View>

         <View style={{ flex: 1 }}>
            <ScrollView
               style={styles.content}
               contentContainerStyle={{ paddingBottom: 120 }}
               showsVerticalScrollIndicator={false}
            >
               {/* Monthly Progress Summary */}
               <View style={styles.summaryCard}>
                  <View style={styles.summaryHeader}>
                     <Text style={styles.summaryTitle}>Monthly Performance</Text>
                     <Text style={[styles.summaryPercent, monthlyStats.overallProgress === 100 && { color: '#4CAF50' }]}>
                        {Math.round(monthlyStats.overallProgress)}%
                     </Text>
                  </View>

                  <View style={styles.masterProgressBarBg}>
                     <View
                        style={[
                           styles.masterProgressBarFill,
                           { width: `${monthlyStats.overallProgress}%`, backgroundColor: monthlyStats.overallProgress === 100 ? '#4CAF50' : '#4DA8DA' }
                        ]}
                     />
                  </View>
                  <Text style={styles.summarySubtext}>
                     {monthlyStats.totalCompleted} of {monthlyStats.totalAssigned} habits completed
                  </Text>

                  {/* Individual Habit Progress */}
                  {displayHabits.length > 0 && (
                     <View style={styles.habitProgressList}>
                        {displayHabits.map(habitId => {
                           const stat = monthlyStats.habitStats[habitId];
                           if (!stat || stat.assigned === 0) return null;

                           const progress = (stat.completed / stat.assigned) * 100;
                           let displayName = 'Unknown Habit';
                           const hInfo = rawHabits?.find(h => h.id === habitId);
                           if (hInfo && hInfo.name) {
                              displayName = hInfo.name;
                           }

                           const barColor = '#4DA8DA';

                           return (
                              <View key={habitId} style={styles.habitProgressItemMinimal}>
                                 <View style={styles.habitProgressTextRow}>
                                    <Text style={styles.habitProgressNameMinimal} numberOfLines={1}>
                                       {displayName}
                                    </Text>
                                    <Text style={styles.habitProgressPercentMinimal}>{Math.round(progress)}%</Text>
                                 </View>
                                 <View style={styles.habitProgressBarBgMinimal}>
                                    <View
                                       style={[
                                          styles.habitProgressBarFillMinimal,
                                          { width: `${progress}%`, backgroundColor: barColor }
                                       ]}
                                    />
                                 </View>
                              </View>
                           );
                        })}
                     </View>
                  )}
               </View>

               <View style={styles.calendarCard}>
                  <View style={styles.monthHeader}>
                     <TouchableOpacity onPress={prevMonth} style={styles.navBtnMinimal}>
                        <Ionicons name="chevron-back" size={22} color="#888" />
                     </TouchableOpacity>
                     <Text style={styles.monthTitle}>
                        {currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
                     </Text>
                     <TouchableOpacity onPress={nextMonth} style={styles.navBtnMinimal}>
                        <Ionicons name="chevron-forward" size={22} color="#888" />
                     </TouchableOpacity>
                  </View>

                  <View style={styles.weekDaysRow}>
                     {DAYS_OF_WEEK.map(day => (
                        <Text key={day} style={styles.weekDayText}>{day.substring(0, 1)}</Text>
                     ))}
                  </View>

                  <View style={styles.daysGrid}>
                     {monthData.map((date, index) => {
                        if (!date) {
                           return <View key={`empty-${index}`} style={styles.dayCellContainer} />;
                        }

                        const dateStr = getFormatDateStr(date);
                        const isToday = dateStr === todayStr;
                        const dayHabits = habits[dateStr] || [];
                        const total = dayHabits.length;
                        const completed = dayHabits.reduce((acc, h) => {
                           if (h.isNumeric && h.targetValue) {
                              return acc + Math.min(1, (h.currentValue || 0) / h.targetValue);
                           }
                           return acc + (h.isDone ? 1 : 0);
                        }, 0);
                        const progress = total === 0 ? 0 : completed / total;

                        const radius = 18;
                        const strokeWidth = 3.5;
                        const circumference = 2 * Math.PI * radius;
                        const strokeDashoffset = total === 0 ? circumference : circumference - (progress * circumference);

                        const showRing = total > 0;
                        const ringColor = '#4DA8DA';

                        return (
                           <View key={dateStr} style={styles.dayCellContainer}>
                              <View style={styles.dayCell}>
                                 <Svg height="46" width="46" viewBox="0 0 46 46" style={{ position: 'absolute' }}>
                                    <Circle
                                       cx="23" cy="23" r={radius}
                                       stroke={total > 0 ? "#2C2C2C" : "#1A1A1A"}
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
                                 <Text style={[styles.dateText, isToday && styles.dateTextToday]}>
                                    {date.getDate()}
                                 </Text>
                              </View>
                           </View>
                        );
                     })}
                  </View>
               </View>

               <View style={styles.legendContainer}>
                  <View style={styles.legendItem}>
                     <View style={[styles.legendDot, { backgroundColor: '#4DA8DA' }]} />
                     <Text style={styles.legendText}>All completed</Text>
                  </View>
                  <View style={styles.legendItem}>
                     <View style={[styles.legendDot, { backgroundColor: '#4DA8DA' }]} />
                     <Text style={styles.legendText}>In progress</Text>
                  </View>
                  <View style={styles.legendItem}>
                     <View style={[styles.legendDot, { backgroundColor: '#2C2C2C' }]} />
                     <Text style={styles.legendText}>None completed</Text>
                  </View>
               </View>

               {/* Weekly Matrix Overview */}
               <View style={styles.weeklyCard}>
                  <View style={styles.weeklyHeader}>
                     <TouchableOpacity onPress={prevWeek} style={styles.navBtnMinimal}>
                        <Ionicons name="chevron-back" size={22} color="#888" />
                     </TouchableOpacity>

                     <View style={styles.weeklyTitleContainer}>
                        <Text style={styles.weeklyTitle}>Weekly Overview</Text>
                        <Text style={styles.weekDateRangeMinimal}>
                           {currentWeekDates[0].toLocaleDateString('default', { month: 'short', day: 'numeric' })} - {currentWeekDates[6].toLocaleDateString('default', { month: 'short', day: 'numeric' })}
                        </Text>
                     </View>

                     <TouchableOpacity onPress={nextWeek} style={styles.navBtnMinimal}>
                        <Ionicons name="chevron-forward" size={22} color="#888" />
                     </TouchableOpacity>
                  </View>

                  <View style={styles.matrixContainer}>
                     <View style={styles.matrixHeaderRow}>
                        <View style={styles.matrixHabitNameColumn} />
                        {currentWeekDates.map(date => (
                           <View key={date.toISOString()} style={styles.matrixDayColumn}>
                              <Text style={styles.matrixDayText}>
                                 {DAYS_OF_WEEK_SHORT[date.getDay()]}
                              </Text>
                           </View>
                        ))}
                     </View>

                     {displayHabits.length === 0 ? (
                        <View style={styles.emptyMatrixState}>
                           <Text style={styles.emptyStateText}>No habits found.</Text>
                        </View>
                     ) : (
                        displayHabits.map((habitId) => {
                           let displayName = 'Unknown Habit';
                           const hInfo = rawHabits?.find(h => h.id === habitId);
                           if (hInfo && hInfo.name) {
                              displayName = hInfo.name;
                           }

                           return (
                              <View key={habitId} style={styles.matrixRow}>
                                 <View style={styles.matrixHabitNameColumn}>
                                    <Text style={styles.matrixHabitNameText} numberOfLines={1}>
                                       {displayName}
                                    </Text>
                                 </View>
                                 {currentWeekDates.map(date => {
                                    const dateStr = getFormatDateStr(date);
                                    const dayHabits = habits[dateStr] || [];
                                    const habitInstance = dayHabits.find(h => h.id === habitId);

                                    const isCompleted = habitInstance?.isDone;
                                    const existsOnDay = !!habitInstance;

                                    return (
                                       <View key={dateStr} style={styles.matrixCellColumn}>
                                          {isCompleted ? (
                                             <View style={styles.matrixCellCompleted}>
                                                <Svg height="14" width="14" viewBox="0 0 24 24">
                                                   <Path
                                                      d="M5 12l5 5L19 7"
                                                      fill="none"
                                                      stroke="#121212"
                                                      strokeWidth="4.2"
                                                      strokeLinecap="round"
                                                      strokeLinejoin="round"
                                                   />
                                                </Svg>
                                             </View>
                                          ) : existsOnDay ? (
                                             <View style={styles.matrixCellPending} />
                                          ) : (
                                             <View style={styles.matrixEmpty} />
                                          )}
                                       </View>
                                    );
                                 })}
                              </View>
                           );
                        })
                     )}
                  </View>
               </View>

               {/* Monthly Progress Line Chart */}
               <View style={styles.chartCard}>
                  <Text style={styles.chartTitle}>Monthly Progress</Text>
                  <Text style={styles.chartSubtitle}>
                     {currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
                  </Text>
                  <View style={styles.lineChartWrapper}>
                     {/* Y-axis labels */}
                     <View style={styles.yAxisLabels}>
                        <Text style={styles.yAxisText}>100%</Text>
                        <Text style={styles.yAxisText}>50%</Text>
                        <Text style={styles.yAxisText}>0%</Text>
                     </View>
                     <View style={styles.lineChartArea}>
                        {/* Grid lines */}
                        <View style={[styles.gridLine, { top: '0%' }]} />
                        <View style={[styles.gridLine, { top: '50%' }]} />
                        <View style={[styles.gridLine, { top: '100%' }]} />
                        <Svg width="100%" height="100%" viewBox={`0 0 ${progressChartData.length * 10} 100`} preserveAspectRatio="none">
                           {/* Area fill */}
                           <Path
                              d={`M0,${100 - (progressChartData[0]?.pct || 0)} ${progressChartData.map((p, i) => `L${i * 10},${100 - p.pct}`).join(' ')} L${(progressChartData.length - 1) * 10},100 L0,100 Z`}
                              fill="rgba(77, 168, 218, 0.15)"
                           />
                           {/* Line */}
                           <Path
                              d={`M0,${100 - (progressChartData[0]?.pct || 0)} ${progressChartData.map((p, i) => `L${i * 10},${100 - p.pct}`).join(' ')}`}
                              fill="none"
                              stroke="#4DA8DA"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                           />
                        </Svg>
                     </View>
                  </View>
                  {/* X-axis labels */}
                  <View style={styles.xAxisLabels}>
                     <Text style={styles.xAxisText}>1</Text>
                     <Text style={styles.xAxisText}>{Math.round(progressChartData.length / 4)}</Text>
                     <Text style={styles.xAxisText}>{Math.round(progressChartData.length / 2)}</Text>
                     <Text style={styles.xAxisText}>{Math.round(progressChartData.length * 3 / 4)}</Text>
                     <Text style={styles.xAxisText}>{progressChartData.length}</Text>
                  </View>
               </View>

               {/* Contribution Heatmap */}
               <View style={styles.heatmapCard}>
                  <Text style={styles.chartTitle}>Activity Heatmap</Text>
                  <Text style={styles.heatmapSubtitle}>Last {heatmapWeeks} weeks</Text>
                  <View style={styles.heatmapScrollContainer}>
                     <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <View style={styles.heatmapGrid}>
                           {/* Days labels */}
                           <View style={styles.heatmapDaysLabels}>
                              {['S', '', 'T', '', 'T', '', 'S'].map((lbl, i) => (
                                 <Text key={i} style={styles.heatmapDayLbl}>{lbl}</Text>
                              ))}
                           </View>

                           {/* Heatmap Columns */}
                           {heatmapData.map((week, wIdx) => (
                              <View key={wIdx} style={styles.heatmapCol}>
                                 {week.map((level, dIdx) => {
                                    let bg = '#1E1E1E';
                                    let border = '#2C2C2C';
                                    if (level === -1) {
                                       bg = 'transparent';
                                       border = 'transparent';
                                    } else if (level === 0) {
                                       bg = '#1A1A1A';
                                       border = '#2C2C2C';
                                    } else if (level === 1) {
                                       bg = '#1C4A66';
                                       border = '#1C4A66';
                                    } else if (level === 2) {
                                       bg = '#2A729E';
                                       border = '#2A729E';
                                    } else if (level === 3) {
                                       bg = '#3B8EB8';
                                       border = '#3B8EB8';
                                    } else if (level === 4) {
                                       bg = '#4DA8DA';
                                       border = '#4DA8DA';
                                    }
                                    return (
                                       <View
                                          key={dIdx}
                                          style={[styles.heatmapCell, { backgroundColor: bg, borderColor: border }]}
                                       />
                                    );
                                 })}
                              </View>
                           ))}
                        </View>
                     </ScrollView>
                  </View>
                  <View style={styles.heatmapLegend}>
                     <Text style={styles.heatmapLegendText}>Less</Text>
                     <View style={[styles.heatmapCellLegend, { backgroundColor: '#1A1A1A' }]} />
                     <View style={[styles.heatmapCellLegend, { backgroundColor: '#1C4A66' }]} />
                     <View style={[styles.heatmapCellLegend, { backgroundColor: '#2A729E' }]} />
                     <View style={[styles.heatmapCellLegend, { backgroundColor: '#3B8EB8' }]} />
                     <View style={[styles.heatmapCellLegend, { backgroundColor: '#4DA8DA' }]} />
                     <Text style={styles.heatmapLegendText}>More</Text>
                  </View>
               </View>
            </ScrollView>


         </View>
      </SafeAreaView>
   );
}

const styles = StyleSheet.create({
   container: { flex: 1, backgroundColor: '#121212' },
   header: { paddingHorizontal: 20, paddingVertical: 15, marginBottom: 10 },
   headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#FFF', letterSpacing: 0.5 },
   content: { paddingHorizontal: 20 },

   summaryCard: { backgroundColor: '#1E1E1E', borderRadius: 24, padding: 20, borderWidth: 1, borderColor: '#2C2C2C', marginBottom: 24 },
   summaryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 },
   summaryTitle: { fontSize: 18, fontWeight: 'bold', color: '#FFF', letterSpacing: 0.5 },
   summaryPercent: { fontSize: 24, fontWeight: '900', color: '#4DA8DA' },
   masterProgressBarBg: { height: 12, backgroundColor: '#2C2C2C', borderRadius: 6, overflow: 'hidden' },
   masterProgressBarFill: { height: '100%', borderRadius: 6 },
   summarySubtext: { color: '#888', fontSize: 13, marginTop: 8, textAlign: 'right' },

   habitProgressList: { marginTop: 20, paddingTop: 20, borderTopWidth: 1, borderTopColor: '#2C2C2C' },
   habitProgressItemMinimal: { marginBottom: 20 },
   habitProgressTextRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
   habitProgressNameMinimal: { color: '#FFF', fontSize: 15, fontWeight: '600' },
   habitProgressPercentMinimal: { color: '#888', fontSize: 15, fontWeight: 'bold' },
   habitProgressBarBgMinimal: { height: 12, backgroundColor: '#2C2C2C', borderRadius: 6, overflow: 'hidden' },
   habitProgressBarFillMinimal: { height: '100%', borderRadius: 6 },

   calendarCard: { backgroundColor: '#1E1E1E', borderRadius: 24, padding: 20, borderWidth: 1, borderColor: '#2C2C2C' },
   monthHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
   navBtnMinimal: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
   monthTitle: { fontSize: 18, fontWeight: 'bold', color: '#FFF', letterSpacing: 0.5 },
   weekDaysRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
   weekDayText: { color: '#888', fontSize: 13, fontWeight: '600', width: `${100 / 7}%`, textAlign: 'center' },
   daysGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start' },
   dayCellContainer: { width: `${100 / 7}%`, alignItems: 'center', marginBottom: 4 },
   dayCell: { width: 46, height: 46, justifyContent: 'center', alignItems: 'center' },
   dateText: { color: '#FFF', fontSize: 15, fontWeight: '500' },
   dateTextToday: { color: '#4DA8DA', fontWeight: 'bold' },
   legendContainer: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 16, marginTop: 24 },
   legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
   legendDot: { width: 10, height: 10, borderRadius: 5 },
   legendText: { color: '#888', fontSize: 13, fontWeight: '500' },

   weeklyCard: { backgroundColor: '#1E1E1E', borderRadius: 24, padding: 20, borderWidth: 1, borderColor: '#2C2C2C', marginTop: 24 },
   weeklyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
   weeklyTitleContainer: { alignItems: 'center' },
   weeklyTitle: { fontSize: 18, fontWeight: 'bold', color: '#FFF', letterSpacing: 0.5 },
   weekDateRangeMinimal: { color: '#888', fontSize: 12, fontWeight: '500', marginTop: 4 },
   matrixContainer: { flex: 1 },
   matrixHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#2C2C2C' },
   matrixHabitNameColumn: { flex: 1, paddingRight: 8 },
   matrixDayColumn: { width: 30, alignItems: 'center' },
   matrixDayText: { color: '#888', fontSize: 13, fontWeight: '600' },
   matrixRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#252525' },
   matrixHabitNameText: { color: '#FFF', fontSize: 15, fontWeight: '500' },
   matrixCellColumn: { width: 30, alignItems: 'center', justifyContent: 'center' },
   matrixCellCompleted: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#4DA8DA', justifyContent: 'center', alignItems: 'center' },
   matrixCellPending: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: '#3A3A3A', backgroundColor: 'transparent' },
   matrixEmpty: { width: 22, height: 22 },
   emptyMatrixState: { paddingVertical: 20 },
   emptyStateText: { color: '#888', textAlign: 'center', fontSize: 14 },

   habitStreakRow: { flexDirection: 'row', gap: 12, marginTop: 10 },
   streakBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#252525', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
   streakEmoji: { fontSize: 12, marginRight: 4 },
   streakText: { color: '#888', fontSize: 12, fontWeight: '500' },
   streakValue: { color: '#FFF', fontWeight: 'bold' },

   chartCard: { backgroundColor: '#1E1E1E', borderRadius: 24, padding: 20, borderWidth: 1, borderColor: '#2C2C2C', marginTop: 24 },
   chartTitle: { fontSize: 18, fontWeight: 'bold', color: '#FFF', letterSpacing: 0.5, marginBottom: 4 },
   chartSubtitle: { color: '#888', fontSize: 13, fontWeight: '500', marginBottom: 16 },
   lineChartWrapper: { flexDirection: 'row', height: 160 },
   yAxisLabels: { width: 40, justifyContent: 'space-between', paddingVertical: 0, marginRight: 8 },
   yAxisText: { color: '#555', fontSize: 11, fontWeight: '600', textAlign: 'right' },
   lineChartArea: { flex: 1, position: 'relative' },
   gridLine: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: '#2C2C2C' },
   xAxisLabels: { flexDirection: 'row', justifyContent: 'space-between', marginLeft: 48, marginTop: 8 },
   xAxisText: { color: '#555', fontSize: 11, fontWeight: '600' },
   heatmapCard: { backgroundColor: '#1E1E1E', borderRadius: 24, padding: 20, borderWidth: 1, borderColor: '#2C2C2C', marginTop: 24 },
   heatmapSubtitle: { color: '#888', fontSize: 13, fontWeight: '500', marginBottom: 16 },
   heatmapScrollContainer: { marginHorizontal: -10, paddingHorizontal: 10 },
   heatmapGrid: { flexDirection: 'row', alignItems: 'flex-start' },
   heatmapDaysLabels: { justifyContent: 'space-between', marginRight: 8, paddingVertical: 2, height: 105 },
   heatmapDayLbl: { color: '#555', fontSize: 10, fontWeight: '600', height: 12, lineHeight: 12 },
   heatmapCol: { justifyContent: 'space-between', marginRight: 4, height: 105 },
   heatmapCell: { width: 12, height: 12, borderRadius: 3, borderWidth: 1 },
   heatmapLegend: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 16, gap: 4 },
   heatmapLegendText: { color: '#888', fontSize: 11, marginHorizontal: 4 },
   heatmapCellLegend: { width: 10, height: 10, borderRadius: 2 },

   lockOverlay: {
      position: 'absolute',
      top: '15%',
      left: 20,
      right: 20,
      backgroundColor: 'rgba(25, 25, 25, 0.96)',
      borderRadius: 24,
      padding: 30,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.1)',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 20 },
      shadowOpacity: 0.6,
      shadowRadius: 40,
   },
   lockIconContainer: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: '#1A2933',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 20,
   },
   lockTitle: {
      color: '#FFF',
      fontSize: 22,
      fontWeight: 'bold',
      marginBottom: 12,
      textAlign: 'center',
   },
   lockText: {
      color: '#AAA',
      fontSize: 15,
      textAlign: 'center',
      lineHeight: 22,
      marginBottom: 24,
   },
   lockButton: {
      backgroundColor: '#4DA8DA',
      paddingHorizontal: 32,
      paddingVertical: 14,
      borderRadius: 12,
   },
   lockButtonText: {
      color: '#FFF',
      fontSize: 16,
      fontWeight: 'bold',
   },
});

