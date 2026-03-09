import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { GoogleAuthProvider, User, onAuthStateChanged, signInWithCredential } from 'firebase/auth';
import { createContext, useContext, useEffect, useState } from 'react';
import { auth } from '../firebaseConfig';

// Configure Google Sign-In
GoogleSignin.configure({
  // webClientId is required for Firebase (find it in Firebase Console -> Authentication -> Sign-in method -> Google)
  webClientId: '283664965101-3c40kbvh2d6ntukovhtgu8rceo1g4g27.apps.googleusercontent.com',
  offlineAccess: true,
});

type AuthContextType = {
  user: User | null;
  loading: boolean;
  isNewSignIn: boolean;
  clearNewSignIn: () => void;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isNewSignIn, setIsNewSignIn] = useState(false);

  const clearNewSignIn = () => setIsNewSignIn(false);

  useEffect(() => {
    // Listen for Firebase Auth state changes
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const signInWithGoogle = async () => {
    try {
      // Check if device has Play Services
      await GoogleSignin.hasPlayServices();
      // Get the users ID token
      const signInResult = await GoogleSignin.signIn();
      // Try resolving the data differently depending on the version of the Google SignIn library
      const token = signInResult.data?.idToken || (signInResult as any).idToken;

      if (!token) throw new Error('No ID token found');

      // Create a Google credential with the token
      const googleCredential = GoogleAuthProvider.credential(token);
      // Sign-in the user with the credential
      await signInWithCredential(auth, googleCredential);
      
      // Mark as a new explicit sign in
      setIsNewSignIn(true);
    } catch (error) {
      console.error('Google Sign-In Error:', error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      await auth.signOut();
      await GoogleSignin.signOut();
    } catch (error) {
      console.error('Sign Out Error:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, isNewSignIn, clearNewSignIn, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
