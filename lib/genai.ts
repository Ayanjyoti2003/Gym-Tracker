import { GoogleGenAI } from '@google/genai';

// Initialize the SDK. In a real app, ensure EXPO_PUBLIC_GEMINI_API_KEY is in your .env file
const ai = new GoogleGenAI({ apiKey: process.env.EXPO_PUBLIC_GEMINI_API_KEY || 'MISSING_API_KEY' });

export const getWorkoutInsights = async (profileData: any, recentLogs: any[]) => {
  try {
    const prompt = `
      You are an expert, encouraging AI personal trainer. Analyze the following user data to provide highly personalized insights.

      User Profile:
      Name: ${profileData?.name || 'Unknown'}
      Height: ${profileData?.height || 'Unknown'} cm
      Weight: ${profileData?.weight || 'Unknown'} kg
      Goals: ${profileData?.goals || 'General fitness'}

      Recent Workout Logs (last 5 sessions):
      ${JSON.stringify(recentLogs, null, 2)}
      (Note: "type: 'cardio'" exercises will have 'speed' and 'incline' string ranges instead of sets/reps/weight)

      Based on this data, please provide:
      1. An estimated total calorie burn for the most recent session using standard MET values for the exercises based on the user's weight and the execution time (durationMins). Take into account the speed and incline values if present.
      2. 1-2 sentences of encouraging feedback.
      3. A specific suggestion for what they should focus on next time to avoid plateaus.
      
      Format the response cleanly without markdown headers, just natural readable text using bullet points for separation.
    `;

    // Call the Gemini model
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text;
  } catch (error) {
    console.error('Gen AI Error:', error);
    return "I couldn't generate insights right now. Double-check your API key configuration in the .env file and ensure you have an active network connection!";
  }
};
export const chatWithGemini = async (message: string, context: { profile: any, recentLogs: any[], equipment: string[] }, chatHistory: {role: string, parts: [{text: string}]}[] = []) => {
  try {
    const systemInstruction = `
      You are Gym Tracker AI, an expert, incredibly encouraging personal trainer and nutritionist built right into the user's mobile app.
      Be concise, enthusiastic, and direct. Use emojis!
      
      USER CONTEXT:
      Name: ${context.profile?.name || 'Unknown'}
      Height: ${context.profile?.height || 'Unknown'} cm
      Weight: ${context.profile?.weight || 'Unknown'} kg
      Goals: ${context.profile?.goals || 'General fitness'}
      Available Equipment IDs: ${context.equipment.join(', ') || 'Unknown'}
      
      Recent Workouts (Last 5):
      ${JSON.stringify(context.recentLogs, null, 2)}
      (Note: "type: 'cardio'" exercises use 'speed' and 'incline' string ranges instead of sets/reps/weight)
      
      Always tailor your advice specifically to their goals, their recent performance, and the equipment they actually have available in their gym.
    `;

    // We format the history for the 'contents' array as required by the new @google/genai SDK
    const contents = [
      { role: 'user', parts: [{ text: systemInstruction }] },
      { role: 'model', parts: [{ text: 'Understood. I am ready to be your personal AI trainer!' }] },
      ...chatHistory,
      { role: 'user', parts: [{ text: message }] }
    ];

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: contents,
    });

    return response.text;
  } catch (error) {
    console.error('Gen AI Chat Error:', error);
    return "Whoops! I'm having trouble connecting to my servers right now. Are you offline or is your API key missing?";
  }
};
