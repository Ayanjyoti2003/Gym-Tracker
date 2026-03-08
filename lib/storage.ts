import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '../firebaseConfig';
import { doc, setDoc, getDoc, collection, getDocs, query, where, writeBatch } from 'firebase/firestore';

/**
 * dualStorage System
 * Implements the architecture described in the implementation plan:
 * 1. Read/Write instantly to AsyncStorage (Offline first, max speed)
 * 2. Background sync data to Firebase Firestore for cloud backup
 */

export const dualStorage = {
  /**
   * Saves an item to local storage and queues a sync to Firestore.
   * @param collectionName e.g., 'workouts', 'profile'
   * @param id The unique document ID (e.g., date-based string or UUID)
   * @param data The JSON object to store
   * @param userId The UID of the authenticated user to namespace Firestore collections
   */
  async setItem(collectionName: string, id: string, data: any, userId: string | null = null) {
    try {
      // 1. Immediately save to Local AsyncStorage for instant UI feedback
      const localKey = `@gym_tracker_${collectionName}_${id}`;
      const payload = { ...data, _updatedAt: new Date().toISOString() };
      await AsyncStorage.setItem(localKey, JSON.stringify(payload));

      console.log(`[Storage] Saved locally: ${localKey}`);

      // 2. Background Sync to Firestore (if user is logged in)
      if (userId) {
        // Fire and forget (it handles its own offline caching automatically thanks to initialized persistentLocalCache)
        const docRef = doc(db, 'users', userId, collectionName, id);
        setDoc(docRef, payload, { merge: true }).catch(err => {
          console.error(`[Storage] Failed background sync to Firestore for ${collectionName}/${id}:`, err);
        });
      }
    } catch (e) {
      console.error(`[Storage] Failed to set item ${collectionName}/${id}:`, e);
      throw e;
    }
  },

  /**
   * Instantly fetches an item from local storage.
   * Optionally falls back to fetching from Firestore if missing locally.
   */
  async getItem(collectionName: string, id: string, userId: string | null = null) {
    try {
      const localKey = `@gym_tracker_${collectionName}_${id}`;
      const localValue = await AsyncStorage.getItem(localKey);
      
      if (localValue) {
        return JSON.parse(localValue);
      }

      // Fallback to Firestore if local data doesn't exist (e.g., deleted app and reinstalled)
      if (userId) {
        console.log(`[Storage] Not found locally, fetching from Firestore for ${collectionName}/${id}`);
        const docRef = doc(db, 'users', userId, collectionName, id);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const remoteData = docSnap.data();
          // Write back to local cache so next fetch is instant
          await AsyncStorage.setItem(localKey, JSON.stringify(remoteData));
          return remoteData;
        }
      }
      return null;
    } catch (e) {
      console.error(`[Storage] Failed to get item ${collectionName}/${id}:`, e);
      return null;
    }
  },

  /**
   * Retrieves all items from a collection stored in AsyncStorage.
   * Optionally performs a full sync from Firestore (used during login).
   */
  async getAllLocal(collectionName: string) {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const collectionKeys = allKeys.filter(key => key.startsWith(`@gym_tracker_${collectionName}_`));
      
      const items = await AsyncStorage.multiGet(collectionKeys);
      return items.map(([key, value]) => ({
        id: key.replace(`@gym_tracker_${collectionName}_`, ''),
        ...(value ? JSON.parse(value) : {})
      }));
    } catch (e) {
      console.error(`[Storage] Failed to getAllLocal for ${collectionName}:`, e);
      return [];
    }
  },

  /**
   * Pulls all data from Firestore for a specific collection and writes to AsyncStorage.
   * Useful when signing in on a new device.
   */
  async restoreFromCloud(collectionName: string, userId: string) {
    if (!userId) return;

    try {
      console.log(`[Storage] Restoring ${collectionName} from cloud for user ${userId}`);
      const colRef = collection(db, 'users', userId, collectionName);
      const snapshot = await getDocs(colRef);
      
      const batchEntries: [string, string][] = [];
      const remoteData: any[] = [];

      snapshot.forEach(doc => {
        const data = doc.data();
        remoteData.push({ id: doc.id, ...data });
        batchEntries.push([`@gym_tracker_${collectionName}_${doc.id}`, JSON.stringify(data)]);
      });

      if (batchEntries.length > 0) {
        await AsyncStorage.multiSet(batchEntries);
        console.log(`[Storage] Restored ${batchEntries.length} items to local storage.`);
      }

      return remoteData;
    } catch (e) {
      console.error(`[Storage] Failed to restore collection ${collectionName}:`, e);
      throw e;
    }
  }
};
