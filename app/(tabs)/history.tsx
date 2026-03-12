import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { dualStorage } from '@/lib/storage';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Dimensions, FlatList, SafeAreaView, StyleSheet, Text, View, Modal, TextInput, TouchableOpacity, Platform } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { Swipeable } from 'react-native-gesture-handler';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const screenWidth = Dimensions.get('window').width;

interface WorkoutLog {
  id: string;
  exerciseId: string;
  exerciseName: string;
  type?: 'weight' | 'cardio' | 'bodyweight';
  sets: number;
  reps: number;
  weight: number;
  speed?: string;
  incline?: string;
  durationMins: number;
  date: string;
  timestamp: number;
  setsData?: { reps: number; weight: number }[];
  selectedOptions?: string[];
}

export default function HistoryScreen() {
  const { user } = useAuth();
  const { colors, accentColor } = useTheme();

  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lbs'>('kg');

  const [pendingDeletes, setPendingDeletes] = useState<{ id: string, timeoutId: ReturnType<typeof setTimeout> }[]>([]);

  const [isFilterModalVisible, setFilterModalVisible] = useState(false);
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [isFiltering, setIsFiltering] = useState(false);
  
  const [isInfoModalVisible, setInfoModalVisible] = useState(false);

  // Use useFocusEffect instead of useEffect to reload data every time the tab is visited
  useFocusEffect(
    useCallback(() => {
      fetchHistory();
    }, [user, isFiltering, filterStartDate, filterEndDate])
  );

  const fetchHistory = async () => {
    if (!user) return;
    setLoading(true);

    // Load weight unit pref
    const prefs = await dualStorage.getItem('data', 'preferences', user.uid);
    if (prefs?.weightUnit) setWeightUnit(prefs.weightUnit);

    if (isFiltering && filterStartDate && filterEndDate) {
      const remoteWorkouts = await dualStorage.getWorkoutsByDateRange(user.uid, filterStartDate, filterEndDate);
      remoteWorkouts.sort((a: any, b: any) => b.timestamp - a.timestamp);
      setLogs(remoteWorkouts as WorkoutLog[]);
    } else {
      const allWorkouts = await dualStorage.getAllLocal('workouts');
      allWorkouts.sort((a: any, b: any) => b.timestamp - a.timestamp);
      setLogs(allWorkouts as WorkoutLog[]);
    }
    setLoading(false);
  };

  const handleDeleteTrigger = (id: string) => {
    const timeoutId = setTimeout(() => {
      commitDelete(id);
    }, 20000);
    setPendingDeletes(prev => [...prev, { id, timeoutId }]);
  };

  const undoDelete = (id: string, timeoutId: ReturnType<typeof setTimeout>) => {
    clearTimeout(timeoutId);
    setPendingDeletes(prev => prev.filter(d => d.id !== id));
  };

  const commitDelete = async (id: string) => {
    setPendingDeletes(prev => prev.filter(d => d.id !== id));
    setLogs(prev => prev.filter(l => l.id !== id));
    if (user) {
      await dualStorage.softDeleteWorkout(id, user.uid);
    }
  };

  const renderLeftActions = () => {
    return (
      <View style={{ backgroundColor: '#ff4757', justifyContent: 'center', alignItems: 'center', width: 80, borderRadius: 12, marginBottom: 16 }}>
        <MaterialCommunityIcons name="delete" size={32} color="#fff" />
      </View>
    );
  };

  const clearFilter = () => {
    setIsFiltering(false);
    setFilterStartDate('');
    setFilterEndDate('');
  };

  const applyFilter = () => {
    setIsFiltering(true);
    setFilterModalVisible(false);
    fetchHistory();
  };

  const renderLogItem = ({ item }: { item: WorkoutLog }) => {
    if (pendingDeletes.find(d => d.id === item.id)) return null;

    return (
      <Swipeable
        renderLeftActions={renderLeftActions}
        onSwipeableOpen={(direction) => {
           if (direction === 'left') handleDeleteTrigger(item.id);
        }}
      >
        <View style={[styles.logCard, { backgroundColor: colors.card, borderLeftColor: accentColor }]}>
          <View style={styles.logHeader}>
            <Text style={[styles.logTitle, { color: colors.text }]}>{item.exerciseName}</Text>
            <Text style={[styles.logDate, { color: colors.textMuted }]}>{item.date}</Text>
          </View>
          <View style={styles.logStats}>
            {item.type === 'cardio' && item.exerciseId !== 'battle_ropes' ? (
              <>
                <View style={[styles.statBox, { backgroundColor: colors.cardElevated }]}>
                  <Text style={styles.statLabel}>TIME</Text>
                  <Text style={[styles.statValue, { color: colors.text }]}>{item.durationMins} <Text style={{ fontSize: 12 }}>min</Text></Text>
                </View>
                <View style={[styles.statBox, { backgroundColor: colors.cardElevated }]}>
                  <Text style={styles.statLabel}>SPEED</Text>
                  <Text style={[styles.statValue, { color: colors.text }]}>{item.speed || '-'}</Text>
                </View>
                <View style={[styles.statBox, { backgroundColor: colors.cardElevated }]}>
                  <Text style={styles.statLabel}>INCLINE</Text>
                  <Text style={[styles.statValue, { color: colors.text }]}>{item.incline || '-'}</Text>
                </View>
              </>
            ) : (
              <>
                <View style={[styles.statBox, { backgroundColor: colors.cardElevated }]}>
                  <Text style={styles.statLabel}>SETS</Text>
                  <Text style={[styles.statValue, { color: colors.text }]}>{item.sets}</Text>
                </View>
                <View style={[styles.statBox, { backgroundColor: colors.cardElevated }]}>
                  <Text style={styles.statLabel}>REPS</Text>
                  <Text style={[styles.statValue, { color: colors.text }]}>{item.reps || '-'}</Text>
                </View>
                {item.type !== 'bodyweight' && item.exerciseId !== 'battle_ropes' && (
                  <View style={[styles.statBox, { backgroundColor: colors.cardElevated }]}>
                    <Text style={styles.statLabel}>WEIGHT</Text>
                    <Text style={[styles.statValue, { color: colors.text }]}>{item.weight} <Text style={{ fontSize: 12 }}>{item.weight > 0 ? weightUnit : ''}</Text></Text>
                  </View>
                )}
              </>
            )}
          </View>

          {item.selectedOptions && item.selectedOptions.length > 0 && (
            <View style={styles.optionsContainer}>
              <Text style={[styles.optionsLabel, { color: colors.textMuted }]}>Techniques: </Text>
              <Text style={[styles.optionsText, { color: colors.text }]}>{item.selectedOptions.join(', ')}</Text>
            </View>
          )}

          {item.setsData && item.setsData.length > 0 && (
            <View style={styles.setsDataContainer}>
              {item.setsData.map((s, idx) => (
                <View key={idx} style={styles.setsDataRow}>
                  <Text style={[styles.setsDataLabel, { color: colors.textMuted }]}>Set {idx + 1}</Text>
                  <Text style={[styles.setsDataValue, { color: colors.textMuted }]}>{s.reps} reps {s.weight > 0 ? `× ${s.weight} ${weightUnit}` : ''}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </Swipeable>
    );
  };

  // Prepare Chart Data based on total volume (sets * reps * weight) per day over the last 7 active days
  const prepareChartData = () => {
    if (logs.length === 0) return null;

    // Group logs by date and calculate total volume
    const volumeByDate: { [key: string]: number } = {};

    // Sort oldest to newest for the chart progression
    const sortedLogs = [...logs].sort((a, b) => a.timestamp - b.timestamp);

    sortedLogs.forEach(log => {
      let vol = 0;
      if (log.type !== 'cardio') {
        if (log.setsData && log.setsData.length > 0) {
          vol = log.setsData.reduce((acc, curr) => acc + ((curr.reps || 0) * (curr.weight || 1)), 0);
        } else {
          vol = (log.sets || 0) * (log.reps || 0) * (log.weight || 1); // fallback to 1 for bodyweight so it graphs something
        }
      }
      if (!isNaN(vol)) {
        volumeByDate[log.date] = (volumeByDate[log.date] || 0) + vol;
      }
    });

    const dates = Object.keys(volumeByDate);
    // Grab the last 5 active dates max
    const recentDates = dates.slice(Math.max(dates.length - 5, 0));
    const dataPoints = recentDates.map(date => volumeByDate[date]);

    if (recentDates.length < 2) return null; // Need at least 2 points to draw a line graph

    return {
      labels: recentDates.map(d => d.slice(-5)), // Show only MM-DD
      datasets: [
        {
          data: dataPoints,
          color: (opacity = 1) => accentColor + Math.round(opacity * 255).toString(16).padStart(2, '0'),
          strokeWidth: 3
        }
      ],
      legend: [`Total Volume (${weightUnit})`]
    };
  };

  const chartData = prepareChartData();

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={accentColor} />
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={logs}
        keyExtractor={(item) => item.id}
        renderItem={renderLogItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No workouts logged yet.</Text>
            <Text style={styles.emptySub}>Head to the Gym to start recording!</Text>
          </View>
        }
        ListHeaderComponent={
          <>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: chartData ? 10 : 20 }}>
               <Text style={[styles.headerTitle, { color: colors.text }]}>History</Text>
               <TouchableOpacity onPress={() => setFilterModalVisible(true)}>
                 <MaterialCommunityIcons name="calendar-search" size={28} color={accentColor} />
               </TouchableOpacity>
            </View>

            {isFiltering && (
               <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, backgroundColor: colors.cardElevated, padding: 10, borderRadius: 8 }}>
                 <Text style={{ color: colors.text }}>Filtered: {filterStartDate} to {filterEndDate}</Text>
                 <TouchableOpacity onPress={clearFilter}>
                   <MaterialCommunityIcons name="close-circle" size={20} color={colors.textMuted} />
                 </TouchableOpacity>
               </View>
            )}

            {chartData ? (
              <View style={styles.chartContainer}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                  <Text style={[styles.chartTitle, { color: colors.text, marginBottom: 0, marginRight: 8 }]}>Performance Growth</Text>
                  <TouchableOpacity onPress={() => setInfoModalVisible(true)}>
                    <MaterialCommunityIcons name="information-outline" size={20} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>

              <LineChart
                data={chartData}
                width={screenWidth - 40}
                height={220}
                chartConfig={{
                  backgroundColor: colors.chartBackground,
                  backgroundGradientFrom: colors.chartBackgroundGradient,
                  backgroundGradientTo: colors.chartBackground,
                  decimalPlaces: 0,
                  color: (opacity = 1) => `${colors.text}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`,
                  labelColor: (opacity = 1) => `${colors.text}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`,
                  style: { borderRadius: 16 },
                  propsForDots: {
                    r: "5",
                    strokeWidth: "2",
                    stroke: accentColor
                  }
                }}
                bezier
                style={{
                  marginVertical: 8,
                  borderRadius: 16,
                  elevation: 5,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.25,
                  shadowRadius: 5,
                }}
              />
            </View>
          ) : (
            <View style={{ marginBottom: 20 }}>
              <Text style={[styles.headerSub, { color: colors.textMuted }]}>Log more workouts to see your growth chart!</Text>
            </View>
          )}
          </>
        }
      />
      
      {pendingDeletes.length > 0 && (
        <View style={styles.undoContainer}>
          <Text style={styles.undoText}>Workout deleted.</Text>
          <TouchableOpacity onPress={() => undoDelete(pendingDeletes[0].id, pendingDeletes[0].timeoutId)}>
            <Text style={styles.undoButton}>UNDO</Text>
          </TouchableOpacity>
        </View>
      )}

      <Modal visible={isFilterModalVisible} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
           <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Filter by Date Range</Text>
              
              <Text style={[styles.modalLabel, { color: colors.textMuted }]}>Start Date</Text>
              <TextInput style={[styles.modalInput, { color: colors.text, borderColor: colors.border }]} placeholderTextColor={colors.textMuted} placeholder="YYYY-MM-DD" value={filterStartDate} onChangeText={setFilterStartDate} />

              <Text style={[styles.modalLabel, { color: colors.textMuted }]}>End Date</Text>
              <TextInput style={[styles.modalInput, { color: colors.text, borderColor: colors.border }]} placeholderTextColor={colors.textMuted} placeholder="YYYY-MM-DD" value={filterEndDate} onChangeText={setFilterEndDate} />
              
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10 }}>
                 <TouchableOpacity onPress={() => setFilterModalVisible(false)} style={{ marginRight: 20 }}>
                    <Text style={{ color: colors.textMuted, fontSize: 16 }}>Cancel</Text>
                 </TouchableOpacity>
                 <TouchableOpacity onPress={applyFilter}>
                    <Text style={{ color: accentColor, fontSize: 16, fontWeight: 'bold' }}>Apply Filter</Text>
                 </TouchableOpacity>
              </View>
           </View>
        </View>
      </Modal>

      {/* Information Modal */}
      <Modal visible={isInfoModalVisible} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
           <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Workout Volume</Text>
              <View style={{ height: 1, backgroundColor: colors.border, marginBottom: 16, marginTop: 10 }} />
              
              <Text style={{ color: colors.text, fontSize: 16, lineHeight: 24, marginBottom: 16 }}>
                <Text style={{ fontWeight: 'bold' }}>Total volume</Text> = sets × reps × weight.
              </Text>
              
              <Text style={{ color: colors.textMuted, fontSize: 15, marginBottom: 8 }}>Example:</Text>
              <View style={{ backgroundColor: colors.cardElevated, padding: 12, borderRadius: 8, marginBottom: 20 }}>
                <Text style={{ color: colors.text, fontSize: 15, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }}>
                  3 sets × 10 reps × 50 {weightUnit} = 1500 {weightUnit}
                </Text>
              </View>

              <TouchableOpacity onPress={() => setInfoModalVisible(false)} style={{ alignSelf: 'flex-end', padding: 8 }}>
                <Text style={{ color: accentColor, fontSize: 16, fontWeight: 'bold' }}>Got it</Text>
              </TouchableOpacity>
           </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  listContent: {
    padding: 20,
    paddingTop: 40,
    paddingBottom: 40,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  headerSub: {
    fontSize: 16,
    color: '#aaaaaa',
    marginTop: 4,
  },
  chartContainer: {
    marginBottom: 30,
  },
  chartTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 10,
  },
  logCard: {
    backgroundColor: '#1e1e1e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#ff4757',
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  logTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  logDate: {
    fontSize: 14,
    color: '#aaaaaa',
  },
  logStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statBox: {
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    minWidth: 80,
  },
  statLabel: {
    fontSize: 10,
    color: '#888888',
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    color: '#ffffff',
    fontWeight: 'bold',
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 60,
  },
  emptyText: {
    fontSize: 20,
    color: '#ffffff',
    fontWeight: 'bold',
  },
  emptySub: {
    fontSize: 15,
    color: '#aaaaaa',
    marginTop: 8,
  },
  setsDataContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#333333',
  },
  setsDataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  setsDataLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  setsDataValue: {
    fontSize: 13,
  },
  optionsContainer: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  optionsLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  optionsText: {
    fontSize: 13,
  },
  undoContainer: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: '#333',
    padding: 16,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  undoText: {
    color: '#fff',
    fontSize: 16,
  },
  undoButton: {
    color: '#ff4757',
    fontWeight: 'bold',
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1, 
    justifyContent: 'center', 
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 20
  },
  modalContent: {
    padding: 24, 
    borderRadius: 16,
  },
  modalTitle: {
    fontSize: 20, 
    fontWeight: 'bold', 
    marginBottom: 20
  },
  modalLabel: {
    fontSize: 14, 
    marginBottom: 8
  },
  modalInput: {
    borderWidth: 1, 
    borderRadius: 8, 
    padding: 12, 
    marginBottom: 16, 
    fontSize: 16
  }
});
