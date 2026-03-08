import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Dimensions, SafeAreaView } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { dualStorage } from '@/lib/storage';
import { LineChart } from 'react-native-chart-kit';
import { useFocusEffect } from 'expo-router';

const screenWidth = Dimensions.get('window').width;

interface WorkoutLog {
  id: string;
  exerciseId: string;
  exerciseName: string;
  sets: number;
  reps: number;
  weight: number;
  durationMins: number;
  date: string;
  timestamp: number;
}

export default function HistoryScreen() {
  const { user } = useAuth();
  const { colors, accentColor } = useTheme();
  
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  
  // Use useFocusEffect instead of useEffect to reload data every time the tab is visited
  useFocusEffect(
    useCallback(() => {
      fetchHistory();
    }, [user])
  );

  const fetchHistory = async () => {
    if (!user) return;
    setLoading(true);
    
    // Fetch from dualStorage
    const allWorkouts = await dualStorage.getAllLocal('workouts');
    
    // Sort descending by timestamp (newest first)
    allWorkouts.sort((a, b) => b.timestamp - a.timestamp);
    setLogs(allWorkouts as WorkoutLog[]);
    setLoading(false);
  };

  const renderLogItem = ({ item }: { item: WorkoutLog }) => (
    <View style={[styles.logCard, { backgroundColor: colors.card, borderLeftColor: accentColor }]}>
      <View style={styles.logHeader}>
        <Text style={[styles.logTitle, { color: colors.text }]}>{item.exerciseName}</Text>
        <Text style={[styles.logDate, { color: colors.textMuted }]}>{item.date}</Text>
      </View>
      <View style={styles.logStats}>
        <View style={[styles.statBox, { backgroundColor: colors.cardElevated }]}>
          <Text style={styles.statLabel}>SETS</Text>
          <Text style={[styles.statValue, { color: colors.text }]}>{item.sets}</Text>
        </View>
        <View style={[styles.statBox, { backgroundColor: colors.cardElevated }]}>
          <Text style={styles.statLabel}>REPS</Text>
          <Text style={[styles.statValue, { color: colors.text }]}>{item.reps}</Text>
        </View>
        <View style={[styles.statBox, { backgroundColor: colors.cardElevated }]}>
          <Text style={styles.statLabel}>WEIGHT</Text>
          <Text style={[styles.statValue, { color: colors.text }]}>{item.weight} <Text style={{fontSize: 12}}>lbs</Text></Text>
        </View>
      </View>
    </View>
  );

  // Prepare Chart Data based on total volume (sets * reps * weight) per day over the last 7 active days
  const prepareChartData = () => {
    if (logs.length === 0) return null;

    // Group logs by date and calculate total volume
    const volumeByDate: { [key: string]: number } = {};
    
    // Sort oldest to newest for the chart progression
    const sortedLogs = [...logs].sort((a, b) => a.timestamp - b.timestamp);

    sortedLogs.forEach(log => {
      const vol = log.sets * log.reps * log.weight;
      volumeByDate[log.date] = (volumeByDate[log.date] || 0) + vol;
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
      legend: ["Total Volume (lbs)"]
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
            <Text style={styles.emptySub}>Head to the Library to start recording!</Text>
          </View>
        }
        ListHeaderComponent={
          chartData ? (
            <View style={styles.chartContainer}>
              <Text style={[styles.chartTitle, { color: colors.text }]}>Performance Growth</Text>
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
              <Text style={[styles.headerTitle, { color: colors.text }]}>History</Text>
              <Text style={[styles.headerSub, { color: colors.textMuted }]}>Log more workouts to see your growth chart!</Text>
            </View>
          )
        }
      />
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
  }
});
