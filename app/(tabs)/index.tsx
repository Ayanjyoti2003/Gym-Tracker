import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { generateCustomRoutine, getWorkoutInsights } from '@/lib/genai';
import { dualStorage } from '@/lib/storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
const FOCUS_OPTIONS = ['Full Body', 'Chest', 'Back', 'Legs', 'Shoulders', 'Biceps', 'Triceps', 'Core'];

type WorkoutInsight = {
  caloriesBurned: number;
  encouragement: string;
  insight: string;
  nextFocus: string;
};

export default function DashboardScreen() {
  const { user, signOut } = useAuth();
  const { colors, accentColor } = useTheme();

  const [loadingInsights, setLoadingInsights] = useState(false);
  const [insightData, setInsightData] = useState<WorkoutInsight | null>(null);
  const [canGenerate, setCanGenerate] = useState(false);

  const [generatingRoutine, setGeneratingRoutine] = useState(false);
  const [customRoutine, setCustomRoutine] = useState<any>(null);
  const [selectedFocus, setSelectedFocus] = useState<string[]>([]);

  useFocusEffect(
    useCallback(() => {
      checkDataAvailability();
    }, [user])
  );

  const checkDataAvailability = async () => {
    if (!user) return;
    const allWorkouts = await dualStorage.getAllLocal('workouts');
    // Enable insight generation button if they have at least 1 workout
    if (allWorkouts.length > 0) {
      setCanGenerate(true);
    }

    // Load existing custom routine if available
    const routineData = await dualStorage.getItem('data', 'custom_routine', user.uid);
    if (routineData) {
      setCustomRoutine(routineData);
    }
  };

  const generateAIInsights = async () => {
    if (!user) return;
    setLoadingInsights(true);

    const profileData = await dualStorage.getItem('data', 'profile', user.uid);
    const allWorkouts = await dualStorage.getAllLocal('workouts');

    // Sort descending and get last 5
    allWorkouts.sort((a, b) => b.timestamp - a.timestamp);
    const recentLogs = allWorkouts.slice(0, 5);

    const result = await getWorkoutInsights(profileData, recentLogs);
    if (result) {
      setInsightData(result);
    }
    setLoadingInsights(false);
  };

  const handleGenerateRoutine = async () => {
    if (!user) return;
    setGeneratingRoutine(true);

    const profileData = await dualStorage.getItem('data', 'profile', user.uid);
    const allWorkouts = await dualStorage.getAllLocal('workouts');
    allWorkouts.sort((a: any, b: any) => b.timestamp - a.timestamp);
    const recentLogs = allWorkouts.slice(0, 5);

    const prefs = await dualStorage.getItem('data', 'preferences', user.uid);
    const weightUnit = prefs?.weightUnit || 'kg';

    const generatedRoutine = await generateCustomRoutine(profileData, recentLogs, weightUnit, selectedFocus);
    if (generatedRoutine) {
      setCustomRoutine(generatedRoutine);
      await dualStorage.setItem('data', 'custom_routine', generatedRoutine, user.uid);
    }
    setSelectedFocus([]);
    setGeneratingRoutine(false);
  };

  const handleFocusSelect = (focus: string) => {
    if (focus === 'Full Body') {
      setSelectedFocus((prev) => (prev.includes('Full Body') ? [] : ['Full Body']));
      return;
    }
    setSelectedFocus((prev) => {
      const without = prev.filter((f) => f !== 'Full Body');
      if (without.includes(focus)) {
        return without.filter((f) => f !== focus);
      }
      if (without.length >= 2) {
        Alert.alert('Limit Reached', 'You can select up to 2 focus areas.');
        return without;
      }
      return [...without, focus];
    });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.title, { color: colors.text }]}>Welcome, {user?.displayName ? user.displayName.split(' ')[0] : 'Athlete'}</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>Ready to crush your goals today?</Text>
          </View>
        </View>

        {/* Gen AI Insights */}
        <View style={[styles.aiCard, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: accentColor }]}>
          <View style={styles.aiHeader}>
            <MaterialCommunityIcons name="robot-outline" size={24} color={accentColor} />
            <Text style={[styles.aiTitle, { color: colors.text }]}>AI Insights ✨</Text>
          </View>

          {insightData ? (
            <View>
              <View style={[styles.insightRow, { backgroundColor: colors.cardElevated, borderColor: colors.border }]}>
                <Text style={styles.insightEmoji}>🔥</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.insightLabel, { color: colors.textMuted }]}>Calories Burned</Text>
                  <Text style={[styles.insightValue, { color: colors.text }]}>{insightData.caloriesBurned} kcal</Text>
                </View>
              </View>
              <View style={[styles.insightRow, { backgroundColor: colors.cardElevated, borderColor: colors.border }]}>
                <Text style={styles.insightEmoji}>💪</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.insightLabel, { color: colors.textMuted }]}>Encouragement</Text>
                  <Text style={[styles.insightValue, { color: colors.text }]}>{insightData.encouragement}</Text>
                </View>
              </View>
              <View style={[styles.insightRow, { backgroundColor: colors.cardElevated, borderColor: colors.border }]}>
                <Text style={styles.insightEmoji}>📊</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.insightLabel, { color: colors.textMuted }]}>Insight</Text>
                  <Text style={[styles.insightValue, { color: colors.text }]}>{insightData.insight}</Text>
                </View>
              </View>
              <View style={[styles.insightRow, { backgroundColor: colors.cardElevated, borderColor: colors.border, marginBottom: 0 }]}>
                <Text style={styles.insightEmoji}>🎯</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.insightLabel, { color: colors.textMuted }]}>Next Focus</Text>
                  <Text style={[styles.insightValue, { color: colors.text }]}>{insightData.nextFocus}</Text>
                </View>
              </View>
            </View>
          ) : (
            <Text style={[styles.aiText, { color: colors.textMuted }]}>
              {canGenerate
                ? "You've logged workouts! Tap below to analyze them and estimate your calories burned."
                : "Log a workout in the Gym to get personalized AI suggestions and calorie estimates!"}
            </Text>
          )}

          {canGenerate && !insightData && (
            <TouchableOpacity
              style={[styles.generateBtn, { backgroundColor: accentColor }]}
              onPress={generateAIInsights}
              disabled={loadingInsights}
            >
              {loadingInsights ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={styles.generateBtnText}>Generate Insights</Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Custom Routine Card */}
        <View style={[styles.aiCard, { backgroundColor: colors.card, borderColor: accentColor + '80' }]}>
          <View style={styles.aiHeader}>
            <MaterialCommunityIcons name="lightning-bolt" size={24} color={accentColor} />
            <Text style={[styles.aiTitle, { color: colors.text }]}>Your Custom Routine 🔥</Text>
          </View>
          {/* Focus Selection Chips */}
          <Text style={[styles.focusHeader, { color: colors.textMuted, marginTop: 4 }]}>Workout Focus (choose up to 2)</Text>
          <View style={[styles.chipRow, { marginBottom: 16 }]}>
            {FOCUS_OPTIONS.map((focus) => {
              const isActive = selectedFocus.includes(focus);
              return (
                <TouchableOpacity
                  key={focus}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: isActive ? accentColor + '20' : colors.cardElevated,
                      borderColor: isActive ? accentColor : colors.border,
                    },
                  ]}
                  onPress={() => handleFocusSelect(focus)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.chipText, { color: isActive ? accentColor : colors.textMuted }]}>
                    {focus}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {!customRoutine ? (
            <View>
              <Text style={[styles.aiText, { color: colors.textMuted, marginBottom: 16 }]}>
                Get a highly personalized 1-day workout routine tailored to your goals, experience, and past performance.
              </Text>

              <TouchableOpacity
                style={[styles.generateBtn, { backgroundColor: accentColor }]}
                onPress={handleGenerateRoutine}
                disabled={generatingRoutine}
              >
                {generatingRoutine ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.generateBtnText}>Generate My Routine</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              <Text style={[styles.routineTitle, { color: colors.text }]}>{customRoutine.routineName}</Text>
              <Text style={[styles.routineDesc, { color: colors.textMuted }]}>{customRoutine.description}</Text>

              {customRoutine.exercises?.map((ex: any, idx: number) => (
                <View key={idx} style={[styles.exerciseBlock, { backgroundColor: colors.cardElevated, borderColor: colors.border }]}>
                  <View style={styles.exerciseHeader}>
                    <Text style={[styles.exerciseName, { color: colors.text }]}>{idx + 1}. {ex.name}</Text>
                    <View style={[styles.badge, { backgroundColor: accentColor + '20' }]}>
                      <Text style={[styles.badgeText, { color: accentColor }]}>{ex.sets}x{ex.reps}</Text>
                    </View>
                  </View>
                  <Text style={[styles.exerciseWeight, { color: colors.text }]}>Starting Weight: {ex.weightSuggestion}</Text>

                  <Text style={[styles.exerciseDetail, { color: colors.textMuted, marginTop: 8 }]}><Text style={{ fontWeight: 'bold' }}>Reason:</Text> {ex.reason}</Text>
                  <Text style={[styles.exerciseDetail, { color: colors.textMuted }]}><Text style={{ fontWeight: 'bold' }}>Benefit:</Text> {ex.benefit}</Text>
                </View>
              ))}

              <TouchableOpacity
                style={[styles.regenerateBtn, { borderColor: colors.border }]}
                onPress={handleGenerateRoutine}
                disabled={generatingRoutine}
              >
                {generatingRoutine ? (
                  <ActivityIndicator color={colors.text} size="small" />
                ) : (
                  <Text style={[styles.regenerateBtnText, { color: colors.text }]}>Regenerate Routine</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={[styles.infoBox, { backgroundColor: colors.cardElevated, borderColor: colors.border }]}>
          <MaterialCommunityIcons name="cloud-sync-outline" size={32} color={colors.textMuted} />
          <Text style={[styles.infoTitle, { color: colors.text }]}>Dual Storage Active</Text>
          <Text style={[styles.infoDesc, { color: colors.textMuted }]}>Your workouts are saved instantly to your phone and backed up securely to your Google Account when online.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
    marginTop: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#aaaaaa',
  },
  aiCard: {
    backgroundColor: '#1e1e1e',
    padding: 24,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#333333',
    marginBottom: 30,
    shadowColor: '#ff4757',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
  aiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  aiTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#ffffff',
    marginLeft: 8,
  },
  aiText: {
    fontSize: 15,
    color: '#dddddd',
    lineHeight: 24,
  },
  generateBtn: {
    backgroundColor: '#ff4757',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  generateBtnText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  infoBox: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#151515',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#222222',
    borderStyle: 'dashed',
  },
  infoTitle: {
    color: '#dddddd',
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 6,
    fontSize: 16,
  },
  infoDesc: {
    color: '#777777',
    textAlign: 'center',
    lineHeight: 20,
  },
  routineTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
    marginTop: 8,
  },
  routineDesc: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
  exerciseBlock: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  exerciseName: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginLeft: 10,
  },
  badgeText: {
    fontWeight: 'bold',
    fontSize: 12,
  },
  exerciseWeight: {
    fontSize: 15,
    fontWeight: '600',
  },
  exerciseDetail: {
    fontSize: 13,
    lineHeight: 18,
  },
  regenerateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 16,
  },
  regenerateBtnText: {
    fontWeight: 'bold',
    fontSize: 16,
  },
  insightRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  insightEmoji: {
    fontSize: 22,
    marginRight: 12,
    marginTop: 2,
  },
  insightLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  insightValue: {
    fontSize: 15,
    lineHeight: 22,
  },
  focusHeader: {
    fontSize: 13,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 18,
    marginBottom: 10,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
