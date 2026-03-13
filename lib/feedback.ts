import { Platform } from 'react-native';
import { db } from '../firebaseConfig';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import Constants from 'expo-constants';
import * as Device from 'expo-device';

// ─── Generate Unique Ticket ID ───────────────────────────────
export const generateTicketId = (): string => {
  return `GT-${Date.now().toString().slice(-6)}`;
};

// ─── Submit Feedback to Firestore ────────────────────────────
export const submitFeedback = async (
  userId: string,
  category: 'bug' | 'feature' | 'feedback',
  title: string,
  description: string
): Promise<string> => {
  const ticketId = generateTicketId();

  const feedbackDoc = {
    ticketId,
    userId,
    category,
    title,
    description,
    status: 'open',
    platform: Platform.OS,
    device: Device.modelName || 'Unknown',
    appVersion: Constants.expoConfig?.version || '1.0.0',
    createdAt: serverTimestamp(),
  };

  await setDoc(doc(db, 'feedback_issues', ticketId), feedbackDoc);

  return ticketId;
};
