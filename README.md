# Gym Tracker

An AI-powered React Native application designed for fitness enthusiasts to log workouts, track progress, and receive personalized exercise recommendations.

## Features

- **Personalized Profile:** Track your height, weight, and fitness goals.
- **Library of Exercises:** Browse through a library of gym exercises categorized by muscle groups.
- **Workout Logging:** Log your daily sets, reps, and weights to see your progress over time.
- **Authentication:** Secure Google Sign-In via Firebase Authentication.
- **Dual Storage:** Offline-first caching with AsyncStorage backed by Firebase Firestore for cross-device sync.
- **AI Integration:** Get personalized workout suggestions and insights powered by Google Gemini AI.
- **Dark Mode UI:** Premium, elegant dark theme designed to look great in the gym.

## Tech Stack

- **Framework:** React Native with Expo Router
- **Language:** TypeScript
- **Backend & Auth:** Firebase (Firestore, Authentication)
- **Local Storage:** AsyncStorage
- **AI Form Analysis & Assistance:** Google Gemini AI API
- **UI Components:** Expo Vector Icons, React Native Reanimated

## Getting Started

### Prerequisites

- Node.js installed
- Expo CLI
- Firebase project setup
- Google Cloud Console setup (for Google Sign-in and Gemini API)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/Ayanjyoti2003/Gym-Tracker.git
   cd Gym-Tracker
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure your Environment Variables:
   Create a `.env` file in the root directory and add your Firebase and Gemini credentials:
   ```env
   EXPO_PUBLIC_FIREBASE_API_KEY=your_api_key
   EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   EXPO_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
   EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
   EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   EXPO_PUBLIC_FIREBASE_APP_ID=your_app_id
   EXPO_PUBLIC_GEMINI_API_KEY=your_gemini_api_key
   ```

4. Start the application:
   ```bash
   npx expo start
   ```

## License

This project is licensed under the MIT License.
