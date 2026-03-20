import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { dualStorage } from '@/lib/storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { MASTER_EXERCISES } from '@/constants/exercises';

export default function LogWorkoutModal() {
  const { exerciseId, exerciseName } = useLocalSearchParams();
  const { user } = useAuth();
  const { colors, accentColor } = useTheme();
  const router = useRouter();

  // Find the exact exercise definition to know its type
  const exerciseDef = MASTER_EXERCISES.find(e => e.id === exerciseId);
  const isCardio = exerciseDef?.type === 'cardio';
  const isBodyweight = exerciseDef?.type === 'bodyweight';
  const isBattleRopes = exerciseId === 'battle_ropes';

  // Common State
  const [duration, setDuration] = useState('15');
  const [saving, setSaving] = useState(false);

  // Weight / Bodyweight State
  const [sets, setSets] = useState('3');
  const [reps, setReps] = useState('10');
  const [weight, setWeight] = useState('');

  // New: Separate Set Data State
  const [isSeparateSets, setIsSeparateSets] = useState(false);
  const [setsData, setSetsData] = useState<{ reps: string, weight: string }[]>(
    Array.from({ length: 3 }).map(() => ({ reps: '10', weight: '' }))
  );

  // Technique State (for Battle Ropes)
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);

  const toggleOption = (option: string) => {
    setSelectedOptions(prev =>
      prev.includes(option) ? prev.filter(o => o !== option) : [...prev, option]
    );
  };

  // Update sets array when 'sets' count changes
  const handleSetsChange = (val: string) => {
    setSets(val);
    const numSets = parseInt(val) || 0;
    if (numSets > 0 && numSets <= 20) {
      setSetsData(prev => {
        const newData = [...prev];
        if (numSets > newData.length) {
          // Add new sets
          for (let i = newData.length; i < numSets; i++) {
            newData.push({ reps: reps, weight: weight });
          }
        } else if (numSets < newData.length) {
          // Remove sets
          newData.splice(numSets);
        }
        return newData;
      });
    }
  };

  const updateSetData = (index: number, field: 'reps' | 'weight', value: string) => {
    setSetsData(prev => {
      const newData = [...prev];
      newData[index] = { ...newData[index], [field]: value };
      return newData;
    });
  };

  // Cardio Specific State
  const [speedVal, setSpeedVal] = useState('');
  const [inclineVal, setInclineVal] = useState('');

  const handleSave = async () => {
    if (!user) return;

    // Validation
    if (!isCardio && !isBodyweight && !isSeparateSets && !weight) {
      Alert.alert('Missing Info', 'Please enter the weight used.');
      return;
    }
    if (isCardio && !duration) {
      Alert.alert('Missing Info', 'Please enter your duration.');
      return;
    }

    setSaving(true);
    try {
      const workoutId = `log_${Date.now()}`;

      const payload: any = {
        exerciseId,
        exerciseName,
        type: exerciseDef?.type || 'weight',
        durationMins: Number(duration),
        date: new Date().toISOString().split('T')[0],
        timestamp: Date.now()
      };

      if (selectedOptions.length > 0) {
        payload.selectedOptions = selectedOptions;
      }

      if (isCardio) {
        payload.speed = speedVal; // Kept as string to allow "3-5"
        payload.incline = inclineVal; // Kept as string to allow "0-9"

        if (isBattleRopes) {
          payload.sets = Number(sets);
          payload.reps = Number(reps);
        }
      } else {
        payload.sets = Number(sets);
        if (isSeparateSets) {
          payload.setsData = setsData.map(s => ({
            reps: Number(s.reps) || 0,
            weight: isBodyweight ? 0 : (Number(s.weight) || 0)
          }));
          // Also set average/max for backwards compatibility charting
          payload.reps = Math.round(payload.setsData.reduce((acc: number, curr: any) => acc + curr.reps, 0) / payload.sets);
          payload.weight = isBodyweight ? 0 : Math.max(...payload.setsData.map((s: any) => s.weight));
        } else {
          payload.reps = Number(reps);
          payload.weight = isBodyweight ? 0 : Number(weight);
          payload.setsData = Array.from({ length: Number(sets) }).map(() => ({
            reps: Number(reps),
            weight: isBodyweight ? 0 : Number(weight)
          }));
        }
      }

      await dualStorage.setItem('workouts', workoutId, payload, user.uid);

      router.back();
    } catch (e) {
      Alert.alert('Error', 'Failed to log workout.');
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">

        <View style={styles.header}>
          <View style={[styles.iconCircle, { backgroundColor: accentColor, shadowColor: accentColor }]}>
            <MaterialCommunityIcons name="check-all" size={32} color="#ffffff" />
          </View>
          <Text style={[styles.title, { color: colors.text }]}>Log {exerciseName}</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>Record your stats for today.</Text>
        </View>

        {isCardio && !isBattleRopes ? (
          <>
            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Speed Range (mph/kmh)</Text>
              <Text style={[styles.helperText, { color: colors.textMuted }]}>Example: "3" or "3-5.5"</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: accentColor }]}
                placeholder="e.g. 3-5.5"
                placeholderTextColor={colors.textMuted}
                value={speedVal}
                onChangeText={setSpeedVal}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Incline / Resistance</Text>
              <Text style={[styles.helperText, { color: colors.textMuted }]}>Example: "0" or "5-9"</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: accentColor }]}
                placeholder="e.g. 5-9"
                placeholderTextColor={colors.textMuted}
                value={inclineVal}
                onChangeText={setInclineVal}
              />
            </View>
          </>
        ) : (
          <>
            {exerciseDef?.options && (
              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.text }]}>Technique</Text>
                <View style={styles.optionsGrid}>
                  {exerciseDef.options.map((option) => (
                    <TouchableOpacity
                      key={option}
                      style={[
                        styles.optionChip,
                        { borderColor: colors.border },
                        selectedOptions.includes(option) && { backgroundColor: accentColor, borderColor: accentColor }
                      ]}
                      onPress={() => toggleOption(option)}
                    >
                      <MaterialCommunityIcons
                        name={selectedOptions.includes(option) ? "checkbox-marked" : "checkbox-blank-outline"}
                        size={20}
                        color={selectedOptions.includes(option) ? "#fff" : colors.textMuted}
                      />
                      <Text style={[styles.optionText, { color: selectedOptions.includes(option) ? "#fff" : colors.text }]}>
                        {option}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Total Sets</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: accentColor }]}
                keyboardType="numeric"
                value={sets}
                onChangeText={handleSetsChange}
              />
            </View>

            {!isBattleRopes && (
              <View style={styles.toggleRow}>
                <Text style={[styles.toggleLabel, { color: colors.text }]}>Input data for each set separately?</Text>
                <Switch
                  value={isSeparateSets}
                  onValueChange={setIsSeparateSets}
                  trackColor={{ false: '#dcdde1', true: accentColor }}
                  thumbColor={'#ffffff'}
                />
              </View>
            )}

            {!isSeparateSets ? (
              <View style={styles.row}>
                <View style={[styles.formGroup, { flex: 1, marginRight: 10 }]}>
                  <Text style={[styles.label, { color: colors.text }]}>Reps per set</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: accentColor }]}
                    keyboardType="numeric"
                    value={reps}
                    onChangeText={setReps}
                  />
                </View>
                {!isBodyweight && !isBattleRopes && (
                  <View style={[styles.formGroup, { flex: 1, marginLeft: 10 }]}>
                    <Text style={[styles.label, { color: colors.text }]}>Weight</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: accentColor }]}
                      placeholder="e.g. 100"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="numeric"
                      value={weight}
                      onChangeText={setWeight}
                    />
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.separateSetsContainer}>
                {setsData.map((setData, index) => (
                  <View key={index} style={[styles.setRow, { backgroundColor: colors.cardElevated, borderColor: colors.border }]}>
                    <Text style={[styles.setNumber, { color: colors.text, backgroundColor: colors.card }]}>Set {index + 1}</Text>
                    <View style={styles.row}>
                      <View style={[styles.formGroup, { flex: 1, marginRight: 10, marginBottom: 0 }]}>
                        <Text style={[styles.label, { color: colors.textMuted, fontSize: 12 }]}>Reps</Text>
                        <TextInput
                          style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: accentColor, padding: 12, fontSize: 16 }]}
                          keyboardType="numeric"
                          value={setData.reps}
                          onChangeText={(v) => updateSetData(index, 'reps', v)}
                        />
                      </View>
                      {!isBodyweight && !isBattleRopes && (
                        <View style={[styles.formGroup, { flex: 1, marginLeft: 10, marginBottom: 0 }]}>
                          <Text style={[styles.label, { color: colors.textMuted, fontSize: 12 }]}>Weight</Text>
                          <TextInput
                            style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: accentColor, padding: 12, fontSize: 16 }]}
                            placeholderTextColor={colors.textMuted}
                            keyboardType="numeric"
                            value={setData.weight}
                            onChangeText={(v) => updateSetData(index, 'weight', v)}
                          />
                        </View>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: colors.text }]}>Execution Time (minutes)</Text>
          <Text style={[styles.helperText, { color: colors.textMuted }]}>Used by AI to estimate calories burned.</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: accentColor }]}
            placeholder="e.g. 15"
            placeholderTextColor={colors.textMuted}
            keyboardType="numeric"
            value={duration}
            onChangeText={setDuration}
          />
        </View>

        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: accentColor, shadowColor: accentColor }, saving && { opacity: 0.7 }]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.saveButtonText}>Save Workout</Text>
          )}
        </TouchableOpacity>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  scrollContent: {
    padding: 24,
    paddingTop: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#ff4757',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    elevation: 8,
    shadowColor: '#ff4757',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: '#aaaaaa',
    marginTop: 6,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    color: '#dddddd',
    marginBottom: 8,
    fontSize: 16,
    fontWeight: '600',
  },
  helperText: {
    color: '#888888',
    fontSize: 12,
    marginBottom: 8,
    marginTop: -4,
  },
  input: {
    backgroundColor: '#151515',
    color: '#ffffff',
    padding: 18,
    borderRadius: 16,
    fontSize: 20,
    fontWeight: 'bold',
    borderWidth: 1,
    borderColor: '#ff475750',
    textAlign: 'center',
  },
  saveButton: {
    backgroundColor: '#ff4757',
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 30,
    elevation: 6,
    shadowColor: '#ff4757',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    padding: 12,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  toggleBtn: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    marginLeft: 10,
  },
  separateSetsContainer: {
    marginBottom: 20,
  },
  setRow: {
    padding: 16,
    borderWidth: 1,
    borderRadius: 16,
    marginBottom: 16,
    position: 'relative',
    marginTop: 10,
  },
  setNumber: {
    position: 'absolute',
    top: -12,
    left: 16,
    paddingHorizontal: 8,
    fontSize: 12,
    fontWeight: 'bold',
    borderWidth: 1,
    borderColor: 'transparent', // Match border radius tricks
    borderRadius: 8,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  optionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginRight: 10,
    marginBottom: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  optionText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  }
});
