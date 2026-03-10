import LoadingScreen from '@/components/LoadingScreen';
import { useAuth } from '@/context/AuthContext';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Redirect } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function LoginScreen() {
  const { user, loading, signInWithGoogle } = useAuth();

  // If already authenticated, redirect to the main app dashboard
  if (user) {
    return <Redirect href="/(tabs)" />;
  }

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Gym Tracker</Text>

      <View style={styles.iconContainer}>
        <MaterialCommunityIcons name="run" size={80} color="#ff4757" />
      </View>

      <Text style={styles.tagline}>Train Smarter. track Progress</Text>
      <Text style={styles.subtitle}>Your AI-powered workout companion</Text>

      <TouchableOpacity style={styles.button} onPress={signInWithGoogle}>
        <Text style={styles.buttonText}>Sign in with Google</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212', // Premium Dark Mode
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 42,
    fontWeight: '900',
    color: '#ffffff',
    marginBottom: 10,
    letterSpacing: -1,
  },
  iconContainer: {
    marginBottom: 20,
    backgroundColor: 'rgba(255, 71, 87, 0.1)',
    padding: 20,
    borderRadius: 60,
  },
  tagline: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 4,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#888888',
    marginBottom: 50,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#ffffff',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 35,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  buttonText: {
    color: '#000000',
    fontSize: 18,
    fontWeight: '700',
  },
});
