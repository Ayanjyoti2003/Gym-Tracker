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
      const parsedItems = items.map(([key, value]) => ({
        id: key.replace(`@gym_tracker_${collectionName}_`, ''),
        ...(value ? JSON.parse(value) : {})
      }));

      // 30-day cleanup for workouts
      if (collectionName === 'workouts') {
        const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
        const keysToRemove: string[] = [];
        const validItems = parsedItems.filter(item => {
          if (item.timestamp && item.timestamp < thirtyDaysAgo) {
            keysToRemove.push(`@gym_tracker_workouts_${item.id}`);
            return false;
          }
          return true;
        });

        if (keysToRemove.length > 0) {
          await AsyncStorage.multiRemove(keysToRemove);
          console.log(`[Storage] Cleaned up ${keysToRemove.length} older than 30 days.`);
        }
        return validItems;
      }

      return parsedItems;
    } catch (e) {
      console.error(`[Storage] Failed to getAllLocal for ${collectionName}:`, e);
      return [];
    }
  },

  /**
   * Soft deletes a workout by dropping it locally and flagging it in Firebase.
   */
  async softDeleteWorkout(id: string, userId: string) {
    try {
      const localKey = `@gym_tracker_workouts_${id}`;
      await AsyncStorage.removeItem(localKey);
      
      if (userId) {
        const docRef = doc(db, 'users', userId, 'workouts', id);
        await setDoc(docRef, { deletedAt: new Date().toISOString() }, { merge: true });
      }
    } catch (e) {
      console.error(`[Storage] Failed to soft delete workout ${id}:`, e);
    }
  },

  /**
   * Queries Firestore for workouts in a date range (for filtering history).
   */
  async getWorkoutsByDateRange(userId: string, startDate: string, endDate: string) {
    if (!userId) return [];
    try {
      const colRef = collection(db, 'users', userId, 'workouts');
      const q = query(
        colRef, 
        where('date', '>=', startDate),
        where('date', '<=', endDate)
      );
      const snapshot = await getDocs(q);
      const remoteData: any[] = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        if (!data.deletedAt) {
          remoteData.push({ id: doc.id, ...data });
        }
      });
      return remoteData;
    } catch (e) {
      console.error(`[Storage] Failed to fetch workouts by date range:`, e);
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
