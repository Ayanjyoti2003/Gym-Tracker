import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Alert, Switch, ScrollView } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { useTheme, DEFAULT_ACCENT } from '@/context/ThemeContext';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const THEME_COLORS = [
  DEFAULT_ACCENT, // Pink/Red
  '#00d2d3', // Cyan
  '#5f27cd', // Deep Purple
  '#ff9f43', // Orange
  '#20bf6b', // Green
  '#48dbfb', // Sky Blue
];

export default function SettingsScreen() {
  const { user, signOut } = useAuth();
  const { mode, accentColor, colors, setMode, setAccentColor } = useTheme();

  const handleLogout = () => {
    Alert.alert(
      "Log Out",
      "Are you sure you want to log out?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Log Out", style: "destructive", onPress: signOut }
      ]
    );
  };

  const toggleMode = () => {
    setMode(mode === 'dark' ? 'light' : 'dark');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Settings</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* ACCOUNT SECTION */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}>
            <View style={[styles.row, { borderBottomColor: colors.border }]}>
              <View style={[styles.iconContainer, { backgroundColor: colors.cardElevated }]}>
                <MaterialCommunityIcons name="email" size={24} color={colors.textMuted} />
              </View>
              <View style={styles.rowText}>
                <Text style={[styles.rowTitle, { color: colors.text }]}>Email</Text>
                <Text style={[styles.rowSubtitle, { color: colors.textMuted }]}>{user?.email || 'Not provided'}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* APPEARANCE SECTION */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Appearance</Text>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}>
            
            {/* Dark Mode Toggle */}
            <View style={[styles.row, { borderBottomColor: colors.border }]}>
              <View style={[styles.iconContainer, { backgroundColor: colors.cardElevated }]}>
                <MaterialCommunityIcons name="weather-night" size={24} color={colors.textMuted} />
              </View>
              <View style={styles.rowText}>
                <Text style={[styles.rowTitle, { color: colors.text }]}>Dark Mode</Text>
              </View>
              <Switch 
                value={mode === 'dark'}
                onValueChange={toggleMode}
                trackColor={{ false: '#dcdde1', true: accentColor }}
                thumbColor={'#ffffff'}
              />
            </View>

            {/* Accent Color Picker */}
            <View style={[styles.row, { borderBottomWidth: 0, flexDirection: 'column', alignItems: 'flex-start' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                 <View style={[styles.iconContainer, { backgroundColor: colors.cardElevated }]}>
                  <MaterialCommunityIcons name="palette" size={24} color={colors.textMuted} />
                </View>
                <View style={styles.rowText}>
                  <Text style={[styles.rowTitle, { color: colors.text }]}>Accent Color</Text>
                </View>
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.colorScroll}>
                {THEME_COLORS.map(colorHex => (
                  <TouchableOpacity 
                    key={colorHex}
                    style={[
                      styles.colorCircle, 
                      { backgroundColor: colorHex },
                      accentColor === colorHex && { borderWidth: 3, borderColor: colors.text }
                    ]}
                    onPress={() => setAccentColor(colorHex)}
                  />
                ))}
              </ScrollView>
            </View>

          </View>
        </View>

        {/* DANGER ZONE */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Danger Zone</Text>
          <TouchableOpacity 
            style={[styles.logoutButton, { backgroundColor: colors.card, borderColor: '#ff475730' }]} 
            onPress={handleLogout}
          >
            <MaterialCommunityIcons name="logout" size={24} color="#ff4757" />
            <Text style={styles.logoutText}>Log Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  header: {
    marginBottom: 30,
    marginTop: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#777777',
    textTransform: 'uppercase',
    marginBottom: 10,
    marginLeft: 4,
  },
  card: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '500',
  },
  rowSubtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  colorScroll: {
    paddingVertical: 8,
    paddingHorizontal: 4,
    gap: 16,
  },
  colorCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  logoutText: {
    color: '#ff4757',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
  }
});
