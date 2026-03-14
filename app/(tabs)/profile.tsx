import { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, Image } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { dualStorage } from '@/lib/storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../../firebaseConfig';

const DEFAULT_AVATARS = [
  'https://api.dicebear.com/7.x/avataaars/png?seed=Felix&backgroundColor=ff4757',
  'https://api.dicebear.com/7.x/avataaars/png?seed=Luna&backgroundColor=1e1e1e',
  'https://api.dicebear.com/7.x/avataaars/png?seed=Alex&backgroundColor=333333',
  'https://api.dicebear.com/7.x/avataaars/png?seed=Max&backgroundColor=aaaaaa',
];

export default function ProfileScreen() {
  const { user } = useAuth();
  const { colors, accentColor } = useTheme();
  
  const { newSignIn } = useLocalSearchParams();
  const isNewUser = newSignIn === 'true';
  const router = useRouter();
  
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [goals, setGoals] = useState('');
  
  const [experienceValue, setExperienceValue] = useState('');
  const [experienceUnit, setExperienceUnit] = useState('months');
  
  const [gapValue, setGapValue] = useState('');
  const [gapUnit, setGapUnit] = useState('none');
  
  const [gender, setGender] = useState('Male');
  
  const [avatar, setAvatar] = useState<string | null>(null);
  const [createdAt, setCreatedAt] = useState<number | null>(null);
  const [allWorkouts, setAllWorkouts] = useState<any[]>([]);

  useEffect(() => {
    loadProfile();
  }, [user]);

  const loadProfile = async () => {
    if (!user) return;
    setLoading(true);
    const profileData = await dualStorage.getItem('data', 'profile', user.uid);
    const workouts = await dualStorage.getAllLocal('workouts');
    setAllWorkouts(workouts || []);

    if (profileData && Object.keys(profileData).length > 0) {
      setName(profileData.name || '');
      setHeight(profileData.height || '');
      setWeight(profileData.weight || '');
      setGoals(profileData.goals || '');
      setExperienceValue(profileData.experienceValue || '');
      setExperienceUnit(profileData.experienceUnit || 'months');
      setGapValue(profileData.gapValue || '');
      setGapUnit(profileData.gapUnit || 'none');
      setGender(profileData.gender || 'Male');
      setAvatar(profileData.avatar || DEFAULT_AVATARS[0]);
      setCreatedAt(profileData.createdAt || Date.now());
    } else {
      setAvatar(DEFAULT_AVATARS[0]);
      setCreatedAt(Date.now());
      setIsEditing(true); // First time, open in edit mode
    }
    setLoading(false);
  };

  // ─── Dynamic Experience Calculation ────────────────────────
  const dynamicExperience = useMemo(() => {
    if (!experienceValue) return 'Newbie';
    
    // 1. Convert baseline to days
    const baseVal = parseInt(experienceValue) || 0;
    let baseDays = 0;
    if (experienceUnit === 'weeks') baseDays = baseVal * 7;
    else if (experienceUnit === 'months') baseDays = baseVal * 30;
    else if (experienceUnit === 'years') baseDays = baseVal * 365;
    else baseDays = baseVal;

    // 2. Count unique workout dates AFTER profile creation
    // This prevents double counting historical data already in baseline
    const uniqueDates = new Set<string>();
    allWorkouts.forEach(w => {
      const ts = w.timestamp || (w.date ? new Date(w.date).getTime() : 0);
      if (createdAt && ts > createdAt) {
        const dateStr = new Date(ts).toISOString().split('T')[0];
        uniqueDates.add(dateStr);
      }
    });

    const totalDays = baseDays + uniqueDates.size;

    // 3. Format back to highest appropriate unit
    if (totalDays >= 365) return `${Math.floor(totalDays / 365)} years`;
    if (totalDays >= 30) return `${Math.floor(totalDays / 30)} months`;
    if (totalDays >= 7) return `${Math.floor(totalDays / 7)} weeks`;
    return `${totalDays} days`;
  }, [experienceValue, experienceUnit, allWorkouts, createdAt]);

  const uploadImageAsync = async (uri: string) => {
    if (!user) return uri;
    try {
      // If it's already a cloud URL or relative path, skip
      if (uri.startsWith('http') || !uri.includes('://')) return uri;

      const response = await fetch(uri);
      const blob = await response.blob();
      const storageRef = ref(storage, `avatars/${user.uid}`);
      
      await uploadBytes(storageRef, blob);
      const downloadURL = await getDownloadURL(storageRef);
      return downloadURL;
    } catch (e) {
      console.error('Upload failed:', e);
      return uri; // Fallback to local
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      let finalAvatar = avatar;
      if (avatar && (avatar.startsWith('file://') || avatar.startsWith('content://'))) {
        finalAvatar = await uploadImageAsync(avatar);
        setAvatar(finalAvatar);
      }

      const profilePayload = {
        name,
        height,
        weight,
        goals,
        experienceValue,
        experienceUnit,
        gapValue,
        gapUnit,
        gender,
        avatar: finalAvatar,
        createdAt: createdAt || Date.now(),
      };

      await dualStorage.setItem('data', 'profile', profilePayload, user.uid);
      setIsEditing(false); // Close edit mode after saving
    } catch (e) {
      Alert.alert('Error', 'Failed to save profile. Please try again.');
    }
    setSaving(false);
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setAvatar(result.assets[0].uri);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={accentColor} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: colors.background }]} 
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={100}
    >
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20 }}>
        
        {isNewUser && (
          <View style={[styles.welcomeBubble, { backgroundColor: colors.cardElevated, borderColor: accentColor }]}>
            <MaterialCommunityIcons name="star-shooting" size={24} color={accentColor} style={styles.welcomeIcon} />
            <Text style={[styles.welcomeText, { color: colors.text }]}>
              Welcome! Please complete your profile details below to get the best personalized workout experience.
            </Text>
          </View>
        )}

        {/* Header with Edit and Settings Toggle */}
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.title, { color: colors.text }]}>Profile</Text>
            {isEditing && <Text style={[styles.subtitle, { color: colors.textMuted }]}>Update your physical details.</Text>}
          </View>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            {!isEditing && (
              <TouchableOpacity onPress={() => setIsEditing(true)} style={[styles.iconBtn, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <MaterialCommunityIcons name="pencil" size={24} color={colors.text} />
              </TouchableOpacity>
            )}
            {!isEditing && (
              <TouchableOpacity onPress={() => router.push('/settings')} style={[styles.iconBtn, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <MaterialCommunityIcons name="cog" size={24} color={colors.text} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Avatar Section */}
        <View style={styles.avatarContainer}>
          <View style={[styles.avatarWrapper, { backgroundColor: colors.card, borderColor: accentColor, shadowColor: accentColor }]}>
             {avatar ? (
              <Image source={{ uri: avatar }} style={styles.avatarImage} />
             ) : (
              <MaterialCommunityIcons name="account" size={60} color={colors.textMuted} />
             )}
          </View>
          
          {isEditing && (
            <View style={styles.avatarOptions}>
              <TouchableOpacity style={[styles.pickImageBtn, { backgroundColor: colors.cardElevated, borderColor: colors.border, borderWidth: 1 }]} onPress={pickImage}>
                <MaterialCommunityIcons name="image-plus" size={20} color={colors.text} />
                <Text style={[styles.pickImageText, { color: colors.text }]}>Upload Image</Text>
              </TouchableOpacity>
              <View style={styles.defaultAvatarsRow}>
                {DEFAULT_AVATARS.map((url, i) => (
                  <TouchableOpacity key={i} onPress={() => setAvatar(url)}>
                    <Image source={{ uri: url }} style={[styles.smallAvatar, { backgroundColor: colors.card }, avatar === url && { borderColor: accentColor }]} />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </View>

        {/* Form View / Edit Mode */}
        {isEditing ? (
          <View style={styles.formSection}>
            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.textMuted }]}>Display Name</Text>
              <TextInput 
                style={[styles.input, { backgroundColor: colors.cardElevated, color: colors.text, borderColor: colors.border }]} 
                placeholder="e.g. John Doe" 
                placeholderTextColor={colors.textMuted} 
                value={name}
                onChangeText={setName}
              />
            </View>

            <View style={styles.row}>
              <View style={[styles.formGroup, { flex: 1, marginRight: 10 }]}>
                <Text style={[styles.label, { color: colors.textMuted }]}>Height (cm)</Text>
                <TextInput 
                  style={[styles.input, { backgroundColor: colors.cardElevated, color: colors.text, borderColor: colors.border }]} 
                  placeholder="e.g. 180" 
                  placeholderTextColor={colors.textMuted} 
                  keyboardType="numeric" 
                  value={height}
                  onChangeText={setHeight}
                />
              </View>
              <View style={[styles.formGroup, { flex: 1, marginLeft: 10 }]}>
                <Text style={[styles.label, { color: colors.textMuted }]}>Weight (kg)</Text>
                <TextInput 
                  style={[styles.input, { backgroundColor: colors.cardElevated, color: colors.text, borderColor: colors.border }]} 
                  placeholder="e.g. 80" 
                  placeholderTextColor={colors.textMuted} 
                  keyboardType="numeric" 
                  value={weight}
                  onChangeText={setWeight}
                />
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.textMuted }]}>Primary Goal</Text>
              <TextInput 
                style={[styles.input, { height: 80, textAlignVertical: 'top', backgroundColor: colors.cardElevated, color: colors.text, borderColor: colors.border }]} 
                placeholder="e.g. Build muscle, lose fat, increase stamina" 
                placeholderTextColor={colors.textMuted} 
                multiline
                value={goals}
                onChangeText={setGoals}
              />
            </View>

            {/* Gender Group */}
            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.textMuted }]}>Gender</Text>
              <View style={[styles.pickerContainer, { borderColor: colors.border, backgroundColor: colors.cardElevated }]}>
                {['Male', 'Female', 'Others'].map(gen => (
                  <TouchableOpacity 
                    key={gen} 
                    style={[styles.pickerBtn, gender === gen && { backgroundColor: accentColor }]}
                    onPress={() => setGender(gen)}
                  >
                    <Text style={[styles.pickerBtnText, { color: gender === gen ? '#fff' : colors.textMuted }]}>{gen}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Experience Group */}
            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.textMuted }]}>Gym Experience Baseline</Text>
              <View style={styles.row}>
                <TextInput 
                  style={[styles.input, { flex: 1, marginRight: 10, backgroundColor: colors.cardElevated, color: colors.text, borderColor: colors.border }]} 
                  placeholder="e.g. 6" 
                  placeholderTextColor={colors.textMuted} 
                  keyboardType="numeric" 
                  value={experienceValue}
                  onChangeText={setExperienceValue}
                />
                <View style={[styles.pickerContainer, { flex: 1, marginLeft: 10, borderColor: colors.border, backgroundColor: colors.cardElevated }]}>
                  {['weeks', 'months', 'years'].map(unit => (
                    <TouchableOpacity 
                      key={unit} 
                      style={[styles.pickerBtn, experienceUnit === unit && { backgroundColor: accentColor }]}
                      onPress={() => setExperienceUnit(unit)}
                    >
                      <Text style={[styles.pickerBtnText, { color: experienceUnit === unit ? '#fff' : colors.textMuted }]}>{unit}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>This is your experience BEFORE using the app. We add your logged days to this baseline automatically.</Text>
            </View>

            {/* Break / Gap Group */}
            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.textMuted }]}>Recent Gym Break / Gap (if any)</Text>
              <View style={styles.row}>
                <TextInput 
                  style={[styles.input, { flex: 1, marginRight: 10, backgroundColor: colors.cardElevated, color: colors.text, borderColor: gapUnit !== 'none' ? colors.border : '#333' }]} 
                  placeholder={gapUnit === 'none' ? "None" : "e.g. 2"} 
                  placeholderTextColor={colors.textMuted} 
                  keyboardType="numeric" 
                  value={gapUnit === 'none' ? '' : gapValue}
                  onChangeText={setGapValue}
                  editable={gapUnit !== 'none'}
                />
                <View style={[styles.pickerContainer, { flex: 1.5, marginLeft: 10, borderColor: colors.border, backgroundColor: colors.cardElevated }]}>
                  {['none', 'weeks', 'months'].map(unit => (
                    <TouchableOpacity 
                      key={unit} 
                      style={[styles.pickerBtn, gapUnit === unit && { backgroundColor: accentColor }]}
                      onPress={() => setGapUnit(unit)}
                    >
                      <Text style={[styles.pickerBtnText, { color: gapUnit === unit ? '#fff' : colors.textMuted }]}>{unit}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            <TouchableOpacity 
              style={[styles.saveButton, { backgroundColor: accentColor, shadowColor: accentColor }, saving && { opacity: 0.7 }]} 
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.saveButtonText}>Save Profile</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.viewSection}>
            <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.infoLabel, { color: colors.textMuted }]}>Display Name</Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>{name || 'Not set'}</Text>
            </View>
            
            <View style={styles.row}>
              <View style={[styles.infoCard, { flex: 1, marginRight: 10, backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.infoLabel, { color: colors.textMuted }]}>Height</Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>{height ? `${height} cm` : '--'}</Text>
              </View>
              <View style={[styles.infoCard, { flex: 1, marginLeft: 10, backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.infoLabel, { color: colors.textMuted }]}>Weight</Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>{weight ? `${weight} kg` : '--'}</Text>
              </View>
            </View>

            <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.infoLabel, { color: colors.textMuted }]}>Primary Goal</Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>{goals || 'Not set'}</Text>
            </View>

            <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.infoLabel, { color: colors.textMuted }]}>Gender</Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>{gender}</Text>
            </View>

            <View style={styles.row}>
              <View style={[styles.infoCard, { flex: 1, marginRight: 10, backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.infoLabel, { color: colors.textMuted }]}>Experience (Dynamic)</Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>{dynamicExperience}</Text>
              </View>
              <View style={[styles.infoCard, { flex: 1, marginLeft: 10, backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.infoLabel, { color: colors.textMuted }]}>Recent Gap</Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>{(gapValue && gapUnit !== 'none') ? `${gapValue} ${gapUnit}` : 'None'}</Text>
              </View>
            </View>

            <TouchableOpacity 
              style={[styles.analyticsBtn, { backgroundColor: colors.card, borderColor: accentColor }]}
              onPress={() => router.push('/analytics' as any)}
            >
              <MaterialCommunityIcons name="chart-box" size={28} color={accentColor} />
              <View style={{ marginLeft: 16, flex: 1 }}>
                <Text style={[styles.analyticsTitle, { color: colors.text }]}>View Analytics</Text>
                <Text style={[styles.analyticsSub, { color: colors.textMuted }]}>See your workout trends and PRs</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={24} color={colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.analyticsBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => router.push('/feedback' as any)}
            >
              <MaterialCommunityIcons name="message-alert-outline" size={28} color={accentColor} />
              <View style={{ marginLeft: 16, flex: 1 }}>
                <Text style={[styles.analyticsTitle, { color: colors.text }]}>Help & Feedback</Text>
                <Text style={[styles.analyticsSub, { color: colors.textMuted }]}>Report a bug or suggest a feature</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={24} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        )}

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  welcomeBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 40,
    marginBottom: -20, // Negative margin to pull header closer
    elevation: 2,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  welcomeIcon: {
    marginRight: 12,
  },
  welcomeText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  subtitle: {
    fontSize: 14,
    color: '#aaaaaa',
    marginTop: 4,
  },
  iconBtn: {
    backgroundColor: '#1e1e1e',
    padding: 12,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: '#333333',
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  avatarWrapper: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#1e1e1e',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#ff4757',
    elevation: 8,
    shadowColor: '#ff4757',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarOptions: {
    alignItems: 'center',
    marginTop: 16,
  },
  pickImageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#333333',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    marginBottom: 16,
  },
  pickImageText: {
    color: '#ffffff',
    fontWeight: 'bold',
    marginLeft: 8,
  },
  defaultAvatarsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  smallAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: '#1e1e1e',
  },
  selectedAvatar: {
    borderColor: '#ff4757',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  formSection: {
    marginTop: 10,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    color: '#dddddd',
    marginBottom: 8,
    fontSize: 14,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: '#1a1a1a',
    color: '#ffffff',
    padding: 16,
    borderRadius: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#333333',
  },
  saveButton: {
    backgroundColor: '#ff4757',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 16,
    elevation: 4,
    shadowColor: '#ff4757',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  viewSection: {
    marginTop: 10,
  },
  infoCard: {
    backgroundColor: '#1e1e1e',
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  infoLabel: {
    color: '#777777',
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  infoValue: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  pickerContainer: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  pickerBtn: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 10,
  },
  pickerBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'capitalize',
  },
  analyticsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 10,
    marginBottom: 16,
    elevation: 3,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  analyticsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  analyticsSub: {
    fontSize: 14,
  }
});
