import { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
  ScrollView, SafeAreaView,
} from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { submitFeedback } from '@/lib/feedback';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

type Category = 'bug' | 'feature' | 'feedback';

const CATEGORIES: { key: Category; label: string; icon: string }[] = [
  { key: 'bug', label: 'Bug Report', icon: 'bug-outline' },
  { key: 'feature', label: 'Feature Request', icon: 'lightbulb-outline' },
  { key: 'feedback', label: 'General Feedback', icon: 'message-text-outline' },
];

export default function FeedbackScreen() {
  const { user } = useAuth();
  const { colors, accentColor } = useTheme();
  const router = useRouter();

  const [category, setCategory] = useState<Category>('feedback');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [ticketId, setTicketId] = useState('');

  const handleSubmit = async () => {
    if (!user) return;
    if (!title.trim()) {
      Alert.alert('Missing Title', 'Please enter a short title for your report.');
      return;
    }
    if (!description.trim()) {
      Alert.alert('Missing Description', 'Please describe the issue or feedback in detail.');
      return;
    }

    setSubmitting(true);
    try {
      const id = await submitFeedback(user.uid, category, title.trim(), description.trim());
      setTicketId(id);
      setSubmitted(true);
    } catch (error) {
      console.error('Feedback submission error:', error);
      Alert.alert('Submission Failed', 'Failed to submit feedback. Please try again later.');
    }
    setSubmitting(false);
  };

  // ─── Success Screen ────────────────────────────────────────
  if (submitted) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.successContainer}>
          <View style={[styles.successIcon, { backgroundColor: accentColor + '20' }]}>
            <MaterialCommunityIcons name="check-circle" size={64} color={accentColor} />
          </View>
          <Text style={[styles.successTitle, { color: colors.text }]}>Feedback Submitted</Text>
          <View style={[styles.ticketBadge, { backgroundColor: colors.card, borderColor: accentColor }]}>
            <Text style={[styles.ticketLabel, { color: colors.textMuted }]}>Ticket ID</Text>
            <Text style={[styles.ticketValue, { color: accentColor }]}>{ticketId}</Text>
          </View>
          <Text style={[styles.successMessage, { color: colors.textMuted }]}>
            Thank you for helping us improve Gym Tracker. We&apos;ll look into this as soon as possible.
          </Text>
          <TouchableOpacity
            style={[styles.closeBtn, { backgroundColor: accentColor }]}
            onPress={() => router.back()}
          >
            <Text style={styles.closeBtnText}>Close</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Form Screen ───────────────────────────────────────────
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={100}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 20 }}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>Feedback & Report Issue</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>
              Help us make Gym Tracker better for everyone.
            </Text>
          </View>

          {/* Category Picker */}
          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: colors.textMuted }]}>Category</Text>
            <View style={styles.categoryRow}>
              {CATEGORIES.map((cat) => {
                const isActive = category === cat.key;
                return (
                  <TouchableOpacity
                    key={cat.key}
                    style={[
                      styles.categoryBtn,
                      {
                        backgroundColor: isActive ? accentColor + '20' : colors.card,
                        borderColor: isActive ? accentColor : colors.border,
                      },
                    ]}
                    onPress={() => setCategory(cat.key)}
                    activeOpacity={0.7}
                  >
                    <MaterialCommunityIcons
                      name={cat.icon as any}
                      size={22}
                      color={isActive ? accentColor : colors.textMuted}
                    />
                    <Text
                      style={[
                        styles.categoryLabel,
                        { color: isActive ? accentColor : colors.textMuted },
                      ]}
                      numberOfLines={1}
                    >
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Title */}
          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: colors.textMuted }]}>Title</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.cardElevated, color: colors.text, borderColor: colors.border }]}
              placeholder="Short issue title"
              placeholderTextColor={colors.textMuted}
              value={title}
              onChangeText={setTitle}
              maxLength={100}
            />
          </View>

          {/* Description */}
          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: colors.textMuted }]}>Description</Text>
            <TextInput
              style={[
                styles.input,
                styles.multilineInput,
                { backgroundColor: colors.cardElevated, color: colors.text, borderColor: colors.border },
              ]}
              placeholder="Describe the issue or feedback in detail..."
              placeholderTextColor={colors.textMuted}
              value={description}
              onChangeText={setDescription}
              multiline
              maxLength={1000}
              textAlignVertical="top"
            />
            <Text style={[styles.charCount, { color: colors.textMuted }]}>
              {description.length}/1000
            </Text>
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitBtn, { backgroundColor: accentColor, shadowColor: accentColor }, submitting && { opacity: 0.7 }]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <>
                <MaterialCommunityIcons name="send" size={20} color="#ffffff" style={{ marginRight: 8 }} />
                <Text style={styles.submitBtnText}>Submit Feedback</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // Header
  header: {
    marginTop: 20,
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
  },
  // Form
  formGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 13,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  categoryRow: {
    flexDirection: 'row',
    gap: 10,
  },
  categoryBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1.5,
    gap: 6,
  },
  categoryLabel: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  input: {
    padding: 16,
    borderRadius: 12,
    fontSize: 16,
    borderWidth: 1,
  },
  multilineInput: {
    height: 140,
    paddingTop: 16,
  },
  charCount: {
    fontSize: 12,
    textAlign: 'right',
    marginTop: 6,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    borderRadius: 14,
    marginTop: 8,
    marginBottom: 40,
    elevation: 4,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  submitBtnText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: 'bold',
  },
  // Success
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  successIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  ticketBadge: {
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 14,
    borderWidth: 1.5,
    marginBottom: 20,
  },
  ticketLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  ticketValue: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 1,
  },
  successMessage: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 30,
    paddingHorizontal: 10,
  },
  closeBtn: {
    paddingVertical: 16,
    paddingHorizontal: 50,
    borderRadius: 14,
  },
  closeBtnText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: 'bold',
  },
});
