# 🏋️ Gym Tracker

**Gym Tracker** is an AI-powered mobile fitness application built with **React Native and Expo**.
It allows users to log workouts, track training progress, and receive personalized fitness recommendations through built-in analytics and an AI fitness coach.

Designed with a modern dark UI, Gym Tracker helps users stay consistent with their training while gaining meaningful insights into their performance.

---

## 📸 Screenshots

<p align="center">
  <img src="https://github.com/user-attachments/assets/bcd26af1-2ed2-4792-99ed-333236d9fc17" width="220"/>
  <img src="https://github.com/user-attachments/assets/368084b6-411b-413d-831e-7d7d7e1c6e15" width="220"/>
  <img src="https://github.com/user-attachments/assets/a4960c49-7e14-45b4-bfea-bada64ad5a43" width="220"/>
</p>

<p align="center">
  <img src="https://github.com/user-attachments/assets/b5d9cfc4-aa51-4749-b2c9-3ca3f99fc110" width="220"/>
  <img src="https://github.com/user-attachments/assets/b74ad73f-c253-4c58-943f-baa2fb653439" width="220"/>
  <img src="https://github.com/user-attachments/assets/c0479cd8-102d-464a-b087-61827a3990e6" width="220"/>
</p>

---

# ✨ Features

### 🏋️ Workout Tracking

* Log strength workouts with sets, reps, and weights
* Track cardio sessions with time, speed, and incline
* Maintain a full workout history

### 📊 Progress Analytics

* Visualize workout frequency and consistency
* Track strength progression over time
* Analyze training volume by muscle group
* Monitor personal records and performance trends

### 🤖 AI Fitness Coach

* Built-in chatbot for workout guidance
* Personalized workout recommendations
* AI-generated insights based on training history

### 👤 User Profiles

* Track personal fitness metrics (height, weight, goals)
* Personalized training insights

### 🔐 Authentication

* Secure Google Sign-In with Firebase Authentication

### 📶 Offline-First Data

* AsyncStorage caching for offline use
* Firebase Firestore sync for cross-device data access

---

# 🛠 Tech Stack

### Frontend

* React Native
* Expo
* TypeScript
* NativeWind (Tailwind for React Native)

### Backend & Services

* Firebase Authentication
* Firebase Firestore

### AI Integration

* Groq API – Primary LLM provider powering the AI chatbot with ultra-fast inference.
* OpenRouter API – Fallback provider ensuring uninterrupted responses if the primary API reaches rate limits.

### Analytics

* Expo Insights
* Vexo Analytics

### UI & Tools

* Expo Router
* React Native Reanimated
* Expo Vector Icons

---

# 🚀 Getting Started

## Prerequisites

Make sure you have the following installed:

* Node.js
* Expo CLI
* Firebase project configured
* Google Cloud Console setup (Google Sign-In & Gemini API)

---

## Installation

### Clone the repository

```bash
git clone https://github.com/Ayanjyoti2003/Gym-Tracker.git
cd Gym-Tracker
```

### Install dependencies

```bash
npm install
```

### Configure environment variables

Create a `.env` file in the root directory:

```env
EXPO_PUBLIC_FIREBASE_API_KEY=your_api_key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
EXPO_PUBLIC_FIREBASE_APP_ID=your_app_id
EXPO_PUBLIC_GEMINI_API_KEY=your_gemini_api_key
EXPO_PUBLIC_VEXO_API_KEY=your_vexo_api_key
```

### Start the development server

```bash
npx expo start
```

---

# 📦 Download

You can download the latest APK from the **Releases** section of this repository.

---

# 📄 License

This project is licensed under the **MIT License**.
