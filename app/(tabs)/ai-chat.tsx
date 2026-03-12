import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { chatWithGemini } from '@/lib/genai';
import { dualStorage } from '@/lib/storage';
import { db } from '../../firebaseConfig';
import { collection, query, orderBy, getDocs, setDoc, doc } from 'firebase/firestore';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, SafeAreaView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

type Message = {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: number;
};

export default function AiChatScreen() {
  const { user } = useAuth();
  const { colors, accentColor } = useTheme();

  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome_msg',
      text: "Hey! I'm Gym Tracker AI ✨ I can see your workout history and the equipment in your gym. What are we focusing on today?",
      sender: 'ai',
      timestamp: Date.now(),
    }
  ]);
  const [loading, setLoading] = useState(false);

  // Context state
  const [userProfile, setUserProfile] = useState<any>({});
  const [recentWorkouts, setRecentWorkouts] = useState<any[]>([]);
  const [analyticsSummary, setAnalyticsSummary] = useState<any>({});
  const [gymConfig, setGymConfig] = useState<string[]>([]);
  const [weightUnit, setWeightUnit] = useState<string>('kg');

  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    loadContext();
  }, [user]);

  const loadContext = async () => {
    if (!user) return;

    // Load all the context we need to feed to Gemini
    const profile = await dualStorage.getItem('data', 'profile', user.uid);
    if (profile) setUserProfile(profile);

    const config = await dualStorage.getItem('data', 'gym_config', user.uid);
    if (config?.exercises) setGymConfig(config.exercises);

    const prefs = await dualStorage.getItem('data', 'preferences', user.uid);
    if (prefs?.weightUnit) setWeightUnit(prefs.weightUnit);

    const allWorkouts = await dualStorage.getAllLocal('workouts');
    allWorkouts.sort((a, b) => b.timestamp - a.timestamp);
    setRecentWorkouts(allWorkouts.slice(0, 5));

    // Compile quick analytics for the AI
    let totalVol = 0;
    let totalMins = 0;
    const prs: Record<string, number> = {};
    allWorkouts.forEach(log => {
      totalMins += log.durationMins || 0;
      if (log.type !== 'cardio') {
         const maxW = log.setsData && log.setsData.length > 0 ? Math.max(...log.setsData.map((s: any) => s.weight || 0)) : (log.weight || 0);
         if (maxW > 0 && (!prs[log.exerciseName] || maxW > prs[log.exerciseName])) {
           prs[log.exerciseName] = maxW;
         }
         if (log.setsData) {
            log.setsData.forEach((s: any) => totalVol += ((s.reps || 0) * (s.weight > 0 ? s.weight : 1)));
         } else {
            totalVol += ((log.sets || 0) * (log.reps || 0) * (log.weight > 0 ? log.weight : 1));
         }
      }
    });
    setAnalyticsSummary({
      totalWorkoutsLogged: allWorkouts.length,
      totalVolumeLifted: totalVol,
      totalMinutesWorkedOut: totalMins,
      personalRecords: prs
    });

    // Load Chat History from Firestore
    try {
      const q = query(collection(db, 'users', user.uid, 'ai_chats'), orderBy('timestamp', 'asc'));
      const snapshot = await getDocs(q);
      const loadedMessages: Message[] = [];
      snapshot.forEach(docSnap => loadedMessages.push(docSnap.data() as Message));
      if (loadedMessages.length > 0) {
        setMessages(loadedMessages);
      }
    } catch (e) {
      console.log('Failed to fetch AI chat history', e);
    }
  };

  const sendMessage = async () => {
    if (!inputText.trim() || !user || loading) return;

    const userMessageText = inputText.trim();
    setInputText('');

    // 1. Add User Message to UI instantly
    const userMessage: Message = {
      id: Date.now().toString(),
      text: userMessageText,
      sender: 'user',
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMessage]);
    setLoading(true);

    // Save user message to firebase silently
    setDoc(doc(db, 'users', user.uid, 'ai_chats', userMessage.id), userMessage).catch(console.error);

    // 2. Format history for Gemini API
    const historyForGemini = messages
      .filter(m => m.id !== 'welcome_msg') // Skip the generic welcome
      .map(m => ({
        role: m.sender === 'user' ? 'user' : 'model',
        parts: [{ text: m.text }] as [{ text: string }]
      }));

    // 3. Make API Call
    const aiResponseText = await chatWithGemini(
      userMessageText,
      { profile: userProfile, recentLogs: recentWorkouts, analytics: analyticsSummary, equipment: gymConfig, weightUnit },
      historyForGemini
    );

    // 4. Add AI Response to UI
    const aiMessage: Message = {
      id: (Date.now() + 1).toString(),
      text: aiResponseText || "Sorry, I couldn't formulate a response.",
      sender: 'ai',
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, aiMessage]);
    setLoading(false);

    // Save AI response to firebase silently
    setDoc(doc(db, 'users', user.uid, 'ai_chats', aiMessage.id), aiMessage).catch(console.error);
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.sender === 'user';
    return (
      <View style={styles.messageRow}>
        <View style={[styles.avatar, isUser ? { backgroundColor: colors.border } : { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}>
          {isUser ? (
            <MaterialCommunityIcons name="account" size={20} color={colors.text} />
          ) : (
            <MaterialCommunityIcons name="robot-outline" size={20} color={accentColor} />
          )}
        </View>
        <View style={styles.messageContent}>
          <Text style={[styles.senderName, { color: colors.text }]}>{isUser ? 'You' : 'Gym Tracker AI'}</Text>
          <Text style={[styles.messageText, { color: isUser ? colors.text : colors.textMuted }]}>
            {item.text}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior="padding"
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 90}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={item => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.chatContainer}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />

        <View style={[styles.inputContainer, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
          <TextInput
            style={[styles.textInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
            placeholder="Ask for a routine, diet advice, etc..."
            placeholderTextColor={colors.textMuted}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[styles.sendButton, !inputText.trim() ? { backgroundColor: colors.border } : { backgroundColor: accentColor }]}
            onPress={sendMessage}
            disabled={!inputText.trim() || loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <MaterialCommunityIcons name="send" size={20} color={inputText.trim() ? "#ffffff" : colors.textMuted} />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  chatContainer: {
    padding: 20,
    paddingTop: 80,
    paddingBottom: 30,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 32,
    width: '100%',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    marginTop: 2,
  },
  aiAvatar: {
    backgroundColor: '#1e1e1e',
    borderWidth: 1,
    borderColor: '#333333',
  },
  userAvatar: {
    backgroundColor: '#333333',
  },
  messageContent: {
    flex: 1,
  },
  senderName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 6,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 26,
    color: '#e0e0e0',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
    backgroundColor: '#1a1a1a',
    borderTopWidth: 1,
    borderTopColor: '#2a2a2a',
    alignItems: 'flex-end',
  },
  textInput: {
    flex: 1,
    backgroundColor: '#121212',
    color: '#ffffff',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#333333',
    maxHeight: 120, // Allow growing but explicitly cap it
  },
  sendButton: {
    backgroundColor: '#ff4757',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
    marginBottom: 2, // Align with the bottom of the input
  },
  sendButtonDisabled: {
    backgroundColor: '#2a2a2a',
  }
});
