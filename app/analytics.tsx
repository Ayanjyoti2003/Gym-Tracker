import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, ActivityIndicator } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { dualStorage } from '@/lib/storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LineChart, BarChart, PieChart } from 'react-native-chart-kit';

const screenWidth = Dimensions.get('window').width;

type TimeFilter = 'week' | 'month' | 'year' | 'all';

interface WorkoutLog {
  id: string;
  exerciseId: string;
  exerciseName: string;
  type?: 'weight' | 'cardio' | 'bodyweight';
  sets: number;
  reps: number;
  weight: number;
  durationMins: number;
  date: string;
  timestamp: number;
  setsData?: { reps: number; weight: number }[];
}

export default function AnalyticsScreen() {
  const { user } = useAuth();
  const { colors, accentColor } = useTheme();

  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [filter, setFilter] = useState<TimeFilter>('month');

  // Computed data states
  const [stats, setStats] = useState({
    totalWorkouts: 0,
    totalVolume: 0,
    currentStreak: 0,
    avgDuration: 0,
  });

  const [frequencyData, setFrequencyData] = useState<{ labels: string[], datasets: { data: number[] }[] }>({
    labels: [],
    datasets: [{ data: [] }]
  });

  const [strengthData, setStrengthData] = useState<{ [key: string]: { labels: string[], datasets: { data: number[] }[] } }>({});
  
  const [muscleVolumeData, setMuscleVolumeData] = useState<any[]>([]);
  
  const [prs, setPrs] = useState<{ [key: string]: number }>({});
  
  const [topExercises, setTopExercises] = useState<{ name: string, count: number }[]>([]);

  useEffect(() => {
    fetchLogs();
  }, [user]);

  useEffect(() => {
    if (logs.length > 0) {
      calculateAnalytics();
    }
  }, [logs, filter]);

  const fetchLogs = async () => {
    if (!user) return;
    setLoading(true);
    // Fetch all logs to allow fast client-side filtering
    const allWorkouts = await dualStorage.getAllLocal('workouts');
    allWorkouts.sort((a: any, b: any) => a.timestamp - b.timestamp); // Chronological
    setLogs(allWorkouts as WorkoutLog[]);
    setLoading(false);
  };

  const getFilterDate = () => {
    const now = new Date();
    switch (filter) {
      case 'week': return new Date(now.setDate(now.getDate() - 7)).getTime();
      case 'month': return new Date(now.setMonth(now.getMonth() - 1)).getTime();
      case 'year': return new Date(now.setFullYear(now.getFullYear() - 1)).getTime();
      case 'all': default: return 0;
    }
  };

  const mapExerciseIdToMuscle = (id: string) => {
    // Rough mapping of known generic IDs to muscle groups - user uses generic ones as well as 'custom'
    const name = id.toLowerCase();
    if (name.includes('bench') || name.includes('chest') || name.includes('fly')) return 'Chest';
    if (name.includes('squat') || name.includes('leg') || name.includes('calf') || name.includes('lunge')) return 'Legs';
    if (name.includes('deadlift') || name.includes('row') || name.includes('pull') || name.includes('lat')) return 'Back';
    if (name.includes('press') || name.includes('shoulder') || name.includes('delt')) return 'Shoulders';
    if (name.includes('curl') || name.includes('tricep') || name.includes('bicep') || name.includes('extension')) return 'Arms';
    if (name.includes('crunch') || name.includes('plank') || name.includes('core')) return 'Core';
    return 'Other';
  };

  const calculateAnalytics = () => {
    const cutoffDate = getFilterDate();
    const filteredLogs = logs.filter(l => l.timestamp >= cutoffDate);

    // 1. Quick Stats
    const totalWorkouts = new Set(filteredLogs.map(l => l.date)).size; // Unique days worked out
    let totalVolume = 0;
    let totalDuration = 0;

    filteredLogs.forEach(log => {
      totalDuration += log.durationMins || 0;
      if (log.type !== 'cardio') {
        if (log.setsData) {
          log.setsData.forEach(s => totalVolume += ((s.reps || 0) * (s.weight > 0 ? s.weight : 1)));
        } else {
          totalVolume += ((log.sets || 0) * (log.reps || 0) * (log.weight > 0 ? log.weight : 1));
        }
      }
    });

    const avgDuration = totalWorkouts > 0 ? Math.round(totalDuration / totalWorkouts) : 0;

    // Calculate Streak (consecutive days backward from today)
    let currentStreak = 0;
    const sortedDates = Array.from(new Set(logs.map(l => l.date))).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    
    if (sortedDates.length > 0) {
      let checkDate = new Date();
      // Reset time for fair comparison
      checkDate.setHours(0,0,0,0);
      
      const lastWorkoutStr = sortedDates[0];
      const lastWorkoutDate = new Date(lastWorkoutStr);
      lastWorkoutDate.setHours(0,0,0,0);

      // Diff in days
      const diffTime = Math.abs(checkDate.getTime() - lastWorkoutDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 

      if (diffDays <= 1) { // 0 if today, 1 if yesterday
        currentStreak = 1;
        for (let i = 1; i < sortedDates.length; i++) {
          const d1 = new Date(sortedDates[i-1]);
          const d2 = new Date(sortedDates[i]);
          d1.setHours(0,0,0,0); d2.setHours(0,0,0,0);
          const diff = Math.ceil(Math.abs(d1.getTime() - d2.getTime()) / (1000 * 60 * 60 * 24));
          if (diff === 1) {
            currentStreak++;
          } else {
            break;
          }
        }
      }
    }

    setStats({
      totalWorkouts,
      totalVolume,
      currentStreak,
      avgDuration
    });

    // 2. Frequency Chart (Workouts per Week/Month)
    // For simplicity, aggregate by Date (last 7 active days) or Month depending on filter
    const frequencyMap: { [key: string]: number } = {};
    filteredLogs.forEach(l => {
      const d = new Date(l.date);
      let key = '';
      if (filter === 'year' || filter === 'all') {
        key = d.toLocaleString('en-US', { month: 'short' });
      } else {
        key = d.toLocaleString('en-US', { weekday: 'short' });
      }
      frequencyMap[key] = (frequencyMap[key] || 0) + 1;
    });

    const freqKeys = Object.keys(frequencyMap).slice(-7); // max 7 columns
    setFrequencyData({
      labels: freqKeys.length > 0 ? freqKeys : ['No Data'],
      datasets: [{ data: freqKeys.length > 0 ? freqKeys.map(k => frequencyMap[k]) : [0] }]
    });

    // 3. Strength Progress (Track top weight per popular exercise)
    const trackedExercises = ['bench_press', 'squats', 'deadlift', 'overhead_press'];
    const pData: any = {};
    
    trackedExercises.forEach(exId => {
      const exLogs = filteredLogs.filter(l => l.exerciseId === exId).sort((a,b) => a.timestamp - b.timestamp);
      if (exLogs.length > 0) {
        const labels: string[] = [];
        const data: number[] = [];
        exLogs.forEach(l => {
          const maxWeight = l.setsData && l.setsData.length > 0 ? Math.max(...l.setsData.map(s => s.weight || 0)) : (l.weight || 0);
          labels.push(l.date.slice(-5)); // MM-DD
          data.push(maxWeight > 0 ? maxWeight : 0);
        });
        
        // Take last 5 points to prevent overcrowding
        pData[exId] = {
          labels: labels.slice(-5),
          datasets: [{ data: data.slice(-5) }]
        };
      }
    });
    setStrengthData(pData);

    // 4. Volume by Muscle Group
    const muscleVolume: { [key: string]: number } = {};
    filteredLogs.forEach(log => {
      const muscle = mapExerciseIdToMuscle(log.exerciseName || log.exerciseId);
      let vol = 0;
      if (log.type !== 'cardio') {
        if (log.setsData) {
          log.setsData.forEach(s => vol += ((s.reps || 0) * (s.weight > 0 ? s.weight : 1)));
        } else {
          vol += ((log.sets || 0) * (log.reps || 0) * (log.weight > 0 ? log.weight : 1));
        }
      }
      if (!isNaN(vol)) {
        muscleVolume[muscle] = (muscleVolume[muscle] || 0) + vol;
      }
    });

    const definedColors = ['#ff4757', '#ffa502', '#2ed573', '#1e90ff', '#9b59b6', '#aaaaaa'];
    const mVData = Object.keys(muscleVolume).map((key, index) => ({
      name: key,
      population: muscleVolume[key],
      color: definedColors[index % definedColors.length],
      legendFontColor: '#aaaaaa',
      legendFontSize: 12
    }));
    setMuscleVolumeData(mVData);

    // 5. Personal Records
    const records: { [key: string]: number } = {};
    // Calculate PRs out of ALL logs, regardless of filter
    logs.forEach(l => {
      if (l.type === 'cardio') return;
      const maxWeight = l.setsData && l.setsData.length > 0 ? Math.max(...l.setsData.map(s => s.weight || 0)) : (l.weight || 0);
      if (maxWeight > 0) {
        if (!records[l.exerciseName] || maxWeight > records[l.exerciseName]) {
          records[l.exerciseName] = maxWeight;
        }
      }
    });
    setPrs(records);

    // 6. Top Exercises
    const exCounts: { [key: string]: number } = {};
    filteredLogs.forEach(l => {
      exCounts[l.exerciseName] = (exCounts[l.exerciseName] || 0) + 1;
    });
    const top = Object.keys(exCounts).map(k => ({ name: k, count: exCounts[k] })).sort((a,b) => b.count - a.count).slice(0, 5);
    setTopExercises(top);
  };

  const chartConfig = {
    backgroundColor: colors.card,
    backgroundGradientFrom: colors.card,
    backgroundGradientTo: colors.card,
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(255, 71, 87, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(170, 170, 170, ${opacity})`,
    style: { borderRadius: 16 },
    propsForDots: { r: "4", strokeWidth: "2", stroke: accentColor },
    barPercentage: 0.5,
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={accentColor} />
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Time Filters */}
      <View style={styles.filterContainer}>
        {(['week', 'month', 'year', 'all'] as TimeFilter[]).map(f => (
          <TouchableOpacity 
            key={f} 
            style={[styles.filterBtn, filter === f && { backgroundColor: accentColor, borderColor: accentColor }]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterBtnText, { color: filter === f ? '#fff' : colors.textMuted }]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Overview Cards */}
      <View style={styles.overviewContainer}>
        <View style={styles.row}>
          <View style={[styles.statCard, { backgroundColor: colors.cardElevated, borderColor: colors.border }]}>
            <Text style={styles.statLabel}>WORKOUTS</Text>
            <Text style={[styles.statValue, { color: colors.text }]}>{stats.totalWorkouts}</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.cardElevated, borderColor: colors.border }]}>
            <Text style={styles.statLabel}>VOLUME</Text>
            <Text style={[styles.statValue, { color: colors.text }]}>
              {stats.totalVolume > 1000 ? `${(stats.totalVolume/1000).toFixed(1)}k` : stats.totalVolume}
            </Text>
          </View>
        </View>
        <View style={styles.row}>
          <View style={[styles.statCard, { backgroundColor: colors.cardElevated, borderColor: colors.border }]}>
            <Text style={styles.statLabel}>STREAK</Text>
            <Text style={[styles.statValue, { color: colors.text }]}>{stats.currentStreak} <Text style={{fontSize:14}}>days</Text></Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.cardElevated, borderColor: colors.border }]}>
            <Text style={styles.statLabel}>AVG DURATION</Text>
            <Text style={[styles.statValue, { color: colors.text }]}>{stats.avgDuration} <Text style={{fontSize:14}}>min</Text></Text>
          </View>
        </View>
      </View>

      {/* Frequency Chart */}
      <View style={styles.chartSection}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Workout Frequency</Text>
        <View style={styles.chartWrapper}>
          <BarChart
            data={frequencyData}
            width={screenWidth - 40}
            height={220}
            chartConfig={chartConfig}
            style={styles.chartStyle}
            yAxisLabel=""
            yAxisSuffix=""
            fromZero
          />
        </View>
      </View>

      {/* Strength Progress */}
      {Object.keys(strengthData).length > 0 && (
        <View style={styles.chartSection}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Strength Progress</Text>
          {Object.keys(strengthData).map(exId => {
            const exName = exId.replace('_', ' ').toUpperCase();
            return (
              <View key={exId} style={{ marginBottom: 20 }}>
                <Text style={{ color: colors.textMuted, marginBottom: 8, fontWeight: 'bold' }}>{exName}</Text>
                <LineChart
                  data={strengthData[exId]}
                  width={screenWidth - 40}
                  height={180}
                  chartConfig={chartConfig}
                  bezier
                  style={styles.chartStyle}
                />
              </View>
            )
          })}
        </View>
      )}

      {/* Volume by Muscle Group */}
      {muscleVolumeData.length > 0 && (
        <View style={styles.chartSection}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Volume by Muscle</Text>
          <View style={[styles.chartWrapper, { paddingVertical: 10 }]}>
            <PieChart
              data={muscleVolumeData}
              width={screenWidth - 40}
              height={200}
              chartConfig={chartConfig}
              accessor={"population"}
              backgroundColor={"transparent"}
              paddingLeft={"15"}
              absolute={false}
            />
          </View>
        </View>
      )}

      {/* Personal Records */}
      <View style={styles.chartSection}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Personal Records (All Time)</Text>
        <View style={[styles.listCard, { backgroundColor: colors.cardElevated, borderColor: colors.border }]}>
          {Object.keys(prs).length > 0 ? (
            Object.keys(prs).sort((a,b) => prs[b] - prs[a]).slice(0, 8).map((ex, idx) => (
              <View key={idx} style={[styles.listItem, idx > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
                <Text style={[styles.listName, { color: colors.text }]}>{ex}</Text>
                <Text style={[styles.listVal, { color: accentColor }]}>{prs[ex]} lbs</Text>
              </View>
            ))
          ) : (
            <Text style={{ color: colors.textMuted, padding: 10 }}>Log workouts with weights to see records.</Text>
          )}
        </View>
      </View>

      {/* Top Exercises */}
      <View style={[styles.chartSection, { marginBottom: 60 }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Top Exercises</Text>
        <View style={[styles.listCard, { backgroundColor: colors.cardElevated, borderColor: colors.border }]}>
          {topExercises.length > 0 ? (
            topExercises.map((ex, idx) => (
              <View key={idx} style={[styles.listItem, idx > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ color: colors.textMuted, marginRight: 10, fontWeight: 'bold' }}>{idx + 1}.</Text>
                  <Text style={[styles.listName, { color: colors.text }]}>{ex.name}</Text>
                </View>
                <Text style={[styles.listVal, { color: colors.textMuted }]}>{ex.count} logs</Text>
              </View>
            ))
          ) : (
            <Text style={{ color: colors.textMuted, padding: 10 }}>No exercises found for this period.</Text>
          )}
        </View>
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  filterContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 4,
  },
  filterBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  filterBtnText: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  overviewContainer: {
    marginBottom: 24,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    marginHorizontal: 4,
    borderWidth: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statLabel: {
    fontSize: 10,
    color: '#888',
    fontWeight: 'bold',
    marginBottom: 4,
    letterSpacing: 1,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '900',
  },
  chartSection: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  chartWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartStyle: {
    borderRadius: 16,
  },
  listCard: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
  },
  listName: {
    fontWeight: '600',
    fontSize: 16,
  },
  listVal: {
    fontWeight: 'bold',
    fontSize: 16,
  }
});
