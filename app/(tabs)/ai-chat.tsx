import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { chatWithAI } from '@/lib/genai';
import { dualStorage } from '@/lib/storage';
import { db } from '../../firebaseConfig';
import { collection, query, orderBy, getDocs, setDoc, doc, deleteDoc } from 'firebase/firestore';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Animated, Dimensions, FlatList, Keyboard, KeyboardAvoidingView,
  Platform, StyleSheet, Text, TextInput, TouchableOpacity,
  TouchableWithoutFeedback, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Markdown from 'react-native-markdown-display';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SIDEBAR_WIDTH = SCREEN_WIDTH * 0.78;

// ─── Types ───────────────────────────────────────────────────
type Message = {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: number;
};

type ChatSession = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
};

// ─── Component ───────────────────────────────────────────────
export default function AiChatScreen() {
  const { user } = useAuth();
  const { colors, accentColor } = useTheme();

  // Session state
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Message state
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  // Context state (for Gemini)
  const [userProfile, setUserProfile] = useState<any>({});
  const [recentWorkouts, setRecentWorkouts] = useState<any[]>([]);
  const [analyticsSummary, setAnalyticsSummary] = useState<any>({});
  const [gymConfig, setGymConfig] = useState<string[]>([]);
  const [weightUnit, setWeightUnit] = useState<string>('kg');

  const flatListRef = useRef<FlatList>(null);
  const sidebarAnim = useRef(new Animated.Value(-SIDEBAR_WIDTH)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  // ─── Boot: load context + sessions, then create a new chat ──
  useEffect(() => {
    if (user) {
      bootUp();
    }
  }, [user]);

  const bootUp = async () => {
    setInitialLoading(true);
    await loadContext();
    const loadedSessions = await loadSessions();
    // Always start a fresh chat on cold open
    await createNewChat(loadedSessions);
    setInitialLoading(false);
  };

  // ─── Load Gemini context ───────────────────────────────────
  const loadContext = async () => {
    if (!user) return;

    const profile = await dualStorage.getItem('data', 'profile', user.uid);
    if (profile) setUserProfile(profile);

    const config = await dualStorage.getItem('data', 'gym_config', user.uid);
    if (config?.exercises) setGymConfig(config.exercises);

    const prefs = await dualStorage.getItem('data', 'preferences', user.uid);
    if (prefs?.weightUnit) setWeightUnit(prefs.weightUnit);

    const allWorkouts = await dualStorage.getAllLocal('workouts');
    allWorkouts.sort((a: any, b: any) => b.timestamp - a.timestamp);
    setRecentWorkouts(allWorkouts.slice(0, 10));

    let totalVol = 0;
    let totalMins = 0;
    const prs: Record<string, number> = {};
    allWorkouts.forEach((log: any) => {
      totalMins += log.durationMins || 0;
      if (log.type !== 'cardio') {
        const maxW = log.setsData && log.setsData.length > 0
          ? Math.max(...log.setsData.map((s: any) => s.weight || 0))
          : (log.weight || 0);
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
      personalRecords: prs,
    });
  };

  // ─── Load session list from Firestore ──────────────────────
  const loadSessions = async (): Promise<ChatSession[]> => {
    if (!user) return [];
    try {
      const q = query(
        collection(db, 'users', user.uid, 'chat_sessions'),
        orderBy('updatedAt', 'desc')
      );
      const snapshot = await getDocs(q);
      const loaded: ChatSession[] = [];
      snapshot.forEach(docSnap => loaded.push(docSnap.data() as ChatSession));
      setSessions(loaded);
      return loaded;
    } catch (e) {
      console.log('Failed to load chat sessions', e);
      return [];
    }
  };

  // ─── Load messages for a specific session ──────────────────
  const loadMessages = async (sessionId: string) => {
    if (!user) return;
    try {
      const q = query(
        collection(db, 'users', user.uid, 'chat_sessions', sessionId, 'messages'),
        orderBy('timestamp', 'asc')
      );
      const snapshot = await getDocs(q);
      const loaded: Message[] = [];
      snapshot.forEach(docSnap => loaded.push(docSnap.data() as Message));

      if (loaded.length > 0) {
        setMessages(loaded);
      } else {
        setMessages([getWelcomeMessage()]);
      }
    } catch (e) {
      console.log('Failed to load messages for session', e);
      setMessages([getWelcomeMessage()]);
    }
  };

  // ─── Welcome message helper ────────────────────────────────
  const getWelcomeMessage = (): Message => ({
    id: 'welcome_msg',
    text: "Hey! I'm Gym Tracker AI ✨ I can see your workout history and the equipment in your gym. What are we focusing on today?",
    sender: 'ai',
    timestamp: Date.now(),
  });

  // ─── Create a new chat session ─────────────────────────────
  const createNewChat = async (currentSessions?: ChatSession[]) => {
    if (!user) return;

    const newId = Date.now().toString();
    const newSession: ChatSession = {
      id: newId,
      title: 'New Chat',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // Save to Firestore
    await setDoc(
      doc(db, 'users', user.uid, 'chat_sessions', newId),
      newSession
    ).catch(console.error);

    const base = currentSessions ?? sessions;
    setSessions([newSession, ...base]);
    setActiveChatId(newId);
    setMessages([getWelcomeMessage()]);
    closeSidebar();
  };

  // ─── Switch to an existing session ─────────────────────────
  const switchToSession = async (session: ChatSession) => {
    setActiveChatId(session.id);
    await loadMessages(session.id);
    closeSidebar();
  };

  // ─── Delete a chat session ─────────────────────────────────
  const deleteSession = async (sessionId: string) => {
    if (!user) return;

    try {
      // Delete all messages in the session
      const msgQuery = query(
        collection(db, 'users', user.uid, 'chat_sessions', sessionId, 'messages')
      );
      const msgSnapshot = await getDocs(msgQuery);
      const deletePromises: Promise<void>[] = [];
      msgSnapshot.forEach(docSnap => {
        deletePromises.push(deleteDoc(doc(db, 'users', user.uid, 'chat_sessions', sessionId, 'messages', docSnap.id)));
      });
      await Promise.all(deletePromises);

      // Delete the session doc itself
      await deleteDoc(doc(db, 'users', user.uid, 'chat_sessions', sessionId));

      const updatedSessions = sessions.filter(s => s.id !== sessionId);
      setSessions(updatedSessions);

      // If we deleted the active chat, create a new one
      if (activeChatId === sessionId) {
        if (updatedSessions.length > 0) {
          await switchToSession(updatedSessions[0]);
        } else {
          await createNewChat([]);
        }
      }
    } catch (e) {
      console.log('Failed to delete session', e);
    }
  };

  // ─── Send message ──────────────────────────────────────────
  const sendMessage = async () => {
    if (!inputText.trim() || !user || loading || !activeChatId) return;

    const userMessageText = inputText.trim();
    setInputText('');

    const userMessage: Message = {
      id: Date.now().toString(),
      text: userMessageText,
      sender: 'user',
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMessage]);
    setLoading(true);

    // Save user message to Firestore
    setDoc(
      doc(db, 'users', user.uid, 'chat_sessions', activeChatId, 'messages', userMessage.id),
      userMessage
    ).catch(console.error);

    // Update session title from first real message + updatedAt
    const currentSession = sessions.find(s => s.id === activeChatId);
    if (currentSession && currentSession.title === 'New Chat') {
      const newTitle = userMessageText.length > 30
        ? userMessageText.substring(0, 30) + '...'
        : userMessageText;
      const updatedSession = { ...currentSession, title: newTitle, updatedAt: Date.now() };
      setDoc(
        doc(db, 'users', user.uid, 'chat_sessions', activeChatId),
        updatedSession
      ).catch(console.error);
      setSessions(prev => prev.map(s => s.id === activeChatId ? updatedSession : s));
    } else {
      // Just update the timestamp
      const updatedSession = { ...currentSession!, updatedAt: Date.now() };
      setDoc(
        doc(db, 'users', user.uid, 'chat_sessions', activeChatId),
        updatedSession
      ).catch(console.error);
      setSessions(prev =>
        [updatedSession, ...prev.filter(s => s.id !== activeChatId)]
      );
    }

    // Format history for Gemini
    const historyForGemini = messages
      .filter(m => m.id !== 'welcome_msg')
      .map(m => ({
        role: m.sender === 'user' ? 'user' : 'model',
        parts: [{ text: m.text }] as [{ text: string }],
      }));

    // API Call
    const aiResponseText = await chatWithAI(
      userMessageText,
      { profile: userProfile, recentLogs: recentWorkouts, analytics: analyticsSummary, equipment: gymConfig, weightUnit },
      historyForGemini
    );

    const aiMessage: Message = {
      id: (Date.now() + 1).toString(),
      text: aiResponseText || "Sorry, I couldn't formulate a response.",
      sender: 'ai',
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, aiMessage]);
    setLoading(false);

    // Save AI response
    setDoc(
      doc(db, 'users', user.uid, 'chat_sessions', activeChatId, 'messages', aiMessage.id),
      aiMessage
    ).catch(console.error);
  };

  // ─── Sidebar animation ────────────────────────────────────
  const openSidebar = () => {
    setSidebarOpen(true);
    Animated.parallel([
      Animated.timing(sidebarAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(backdropAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const closeSidebar = () => {
    Animated.parallel([
      Animated.timing(sidebarAnim, {
        toValue: -SIDEBAR_WIDTH,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(backdropAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => setSidebarOpen(false));
  };

  // ─── Relative time helper ─────────────────────────────────
  const getRelativeTime = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  // ─── Render message ───────────────────────────────────────
  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.sender === 'user';
    return (
      <View style={styles.messageRow}>
        <View style={[styles.avatar, isUser
          ? { backgroundColor: colors.border }
          : { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }
        ]}>
          {isUser ? (
            <MaterialCommunityIcons name="account" size={20} color={colors.text} />
          ) : (
            <MaterialCommunityIcons name="robot-outline" size={20} color={accentColor} />
          )}
        </View>
        <View style={styles.messageContent}>
          <Text style={[styles.senderName, { color: colors.text }]}>
            {isUser ? 'You' : 'Gym Tracker AI'}
          </Text>
          {isUser ? (
            <Text style={[styles.messageText, { color: colors.text }]}>
              {item.text}
            </Text>
          ) : (
            <Markdown style={{
              body: { color: colors.textMuted, fontSize: 16, lineHeight: 26 },
              strong: { color: colors.text, fontWeight: 'bold' as const },
              bullet_list: { marginVertical: 4 },
              ordered_list: { marginVertical: 4 },
              list_item: { marginVertical: 2 },
              paragraph: { marginTop: 0, marginBottom: 8 },
              heading1: { color: colors.text, fontSize: 20, fontWeight: 'bold' as const },
              heading2: { color: colors.text, fontSize: 18, fontWeight: 'bold' as const },
              heading3: { color: colors.text, fontSize: 16, fontWeight: 'bold' as const },
              code_inline: { backgroundColor: colors.card, color: accentColor, borderRadius: 4, paddingHorizontal: 4 },
            }}>
              {item.text}
            </Markdown>
          )}
        </View>
      </View>
    );
  };

  // ─── Render sidebar session item ──────────────────────────
  const renderSessionItem = ({ item }: { item: ChatSession }) => {
    const isActive = item.id === activeChatId;
    return (
      <TouchableOpacity
        style={[
          styles.sessionItem,
          { backgroundColor: isActive ? accentColor + '20' : 'transparent', borderColor: isActive ? accentColor + '40' : 'transparent' },
        ]}
        onPress={() => switchToSession(item)}
        activeOpacity={0.7}
      >
        <View style={styles.sessionItemContent}>
          <MaterialCommunityIcons
            name="chat-outline"
            size={18}
            color={isActive ? accentColor : colors.textMuted}
            style={{ marginRight: 12 }}
          />
          <View style={{ flex: 1 }}>
            <Text
              style={[styles.sessionTitle, { color: isActive ? accentColor : colors.text }]}
              numberOfLines={1}
            >
              {item.title}
            </Text>
            <Text style={[styles.sessionTime, { color: colors.textMuted }]}>
              {getRelativeTime(item.updatedAt)}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={() => deleteSession(item.id)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.deleteBtn}
        >
          <MaterialCommunityIcons name="trash-can-outline" size={16} color={colors.textMuted} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  // ─── Loading state ─────────────────────────────────────────
  if (initialLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={accentColor} />
        <Text style={{ color: colors.textMuted, marginTop: 12, fontSize: 14 }}>Loading AI Coach...</Text>
      </SafeAreaView>
    );
  }

  // ─── Main render ───────────────────────────────────────────
  return (
    <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: colors.background }]}>
      {/* ── Header ── */}
      <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={openSidebar} style={styles.headerBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <MaterialCommunityIcons name="menu" size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>AI Coach</Text>
        <TouchableOpacity onPress={() => createNewChat()} style={styles.headerBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <MaterialCommunityIcons name="plus-circle-outline" size={26} color={accentColor} />
        </TouchableOpacity>
      </View>

      {/* ── Chat area ── */}
      {Platform.OS === 'ios' ? (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior="padding"
          keyboardVerticalOffset={90}
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

          {/* ── Input bar ── */}
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
      ) : (
        <View style={{ flex: 1 }}>
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={item => item.id}
            renderItem={renderMessage}
            contentContainerStyle={styles.chatContainer}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
          />

          {/* ── Input bar ── */}
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
        </View>
      )}

      {/* ── Sidebar Overlay ── */}
      {sidebarOpen && (
        <>
          {/* Backdrop */}
          <TouchableWithoutFeedback onPress={closeSidebar}>
            <Animated.View
              style={[
                styles.backdrop,
                { opacity: backdropAnim },
              ]}
            />
          </TouchableWithoutFeedback>

          {/* Sidebar drawer */}
          <Animated.View
            style={[
              styles.sidebar,
              {
                width: SIDEBAR_WIDTH,
                backgroundColor: colors.card,
                borderRightColor: colors.border,
                transform: [{ translateX: sidebarAnim }],
              },
            ]}
          >
            {/* Sidebar header */}
            <View style={[styles.sidebarHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.sidebarTitle, { color: colors.text }]}>Chats</Text>
              <TouchableOpacity onPress={closeSidebar}>
                <MaterialCommunityIcons name="close" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* New chat button */}
            <TouchableOpacity
              style={[styles.newChatBtn, { borderColor: accentColor }]}
              onPress={() => createNewChat()}
            >
              <MaterialCommunityIcons name="plus" size={20} color={accentColor} />
              <Text style={[styles.newChatText, { color: accentColor }]}>New Chat</Text>
            </TouchableOpacity>

            {/* Session list */}
            <FlatList
              data={sessions}
              keyExtractor={item => item.id}
              renderItem={renderSessionItem}
              contentContainerStyle={{ paddingBottom: 30 }}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <Text style={{ color: colors.textMuted, textAlign: 'center', marginTop: 30, fontSize: 14 }}>
                  No chat history yet
                </Text>
              }
            />
          </Animated.View>
        </>
      )}
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 8 : 40,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  // Chat
  chatContainer: {
    padding: 20,
    paddingTop: 16,
    paddingBottom: 10,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 28,
    width: '100%',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    marginTop: 2,
  },
  messageContent: {
    flex: 1,
  },
  senderName: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 26,
  },
  // Input
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    paddingBottom: Platform.OS === 'ios' ? 24 : 8,
    borderTopWidth: 1,
    alignItems: 'flex-end',
  },
  textInput: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 15,
    borderWidth: 1,
    maxHeight: 120,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
    marginBottom: 2,
  },
  // Sidebar overlay
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    zIndex: 10,
  },
  sidebar: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    zIndex: 20,
    borderRightWidth: 1,
    elevation: 16,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
  },
  sidebarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 50,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  sidebarTitle: {
    fontSize: 22,
    fontWeight: '800',
  },
  newChatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    marginVertical: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  newChatText: {
    fontWeight: 'bold',
    fontSize: 15,
    marginLeft: 8,
  },
  // Session item
  sessionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 2,
  },
  sessionItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  sessionTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  sessionTime: {
    fontSize: 11,
    marginTop: 2,
  },
  deleteBtn: {
    padding: 6,
    marginLeft: 8,
  },
});
