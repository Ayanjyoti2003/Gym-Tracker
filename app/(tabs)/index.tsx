import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, SafeAreaView } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { dualStorage } from '@/lib/storage';
import { getWorkoutInsights } from '@/lib/genai';
import { useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function DashboardScreen() {
  const { user, signOut } = useAuth();
  const { colors, accentColor } = useTheme();
  
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [insightText, setInsightText] = useState('');
  const [canGenerate, setCanGenerate] = useState(false);

  useFocusEffect(
    useCallback(() => {
      checkDataAvailability();
    }, [user])
  );

  const checkDataAvailability = async () => {
    if (!user) return;
    const allWorkouts = await dualStorage.getAllLocal('workouts');
    // Enable generation button if they have at least 1 workout
    if (allWorkouts.length > 0) {
      setCanGenerate(true);
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

    const generatedText = await getWorkoutInsights(profileData, recentLogs);
    setInsightText(generatedText || 'No insights could be generated.');
    setLoadingInsights(false);
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
        
        {insightText ? (
          <Text style={[styles.aiText, { color: colors.text }]}>{insightText}</Text>
        ) : (
          <Text style={[styles.aiText, { color: colors.textMuted }]}>
            {canGenerate 
              ? "You've logged workouts! Tap below to analyze them and estimate your calories burned."
              : "Log a workout in the Library to get personalized AI suggestions and calorie estimates!"}
          </Text>
        )}

        {canGenerate && !insightText && (
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
  }
});
