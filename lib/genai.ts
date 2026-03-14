// ─── AI Configuration ────────────────────────────────────────
const GROQ_API_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY || 'MISSING_KEY';
const OPENROUTER_API_KEY = process.env.EXPO_PUBLIC_OPENROUTER_API_KEY || 'MISSING_KEY';

const GROQ_MODEL = 'llama-3.3-70b-versatile';
const OPENROUTER_MODEL = 'meta-llama/llama-3.3-70b-instruct:free';

const TIMEOUT_MS = 30000;

// ─── MET Values Table ────────────────────────────────────────
const MET_VALUES: Record<string, number> = {
  strength: 3.5,
  walking: 4,
  running: 9,
  cycling: 7,
  treadmill: 8,
  rowing: 6,
  hiit: 8,
  light_cardio: 5,
  cardio: 6,
};

// ─── Helper: Timeout Wrapper ─────────────────────────────────
const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> => {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`Request timed out after ${ms}ms`)), ms)
  );
  return Promise.race([promise, timeout]);
};

// ─── Helper: Estimate Calories ───────────────────────────────
export const estimateCalories = (
  weightKg: number,
  durationMins: number,
  type: string
): number => {
  const met = MET_VALUES[type?.toLowerCase()] || 3.5;
  const hours = durationMins / 60;
  return Math.round(met * weightKg * hours);
};

// ─── Helper: Map Exercise to Muscle Group ────────────────────
const mapExerciseToMuscle = (name: string): string => {
  const n = name.toLowerCase();
  if (n.includes('bench') || n.includes('chest') || n.includes('fly')) return 'chest';
  if (n.includes('squat') || n.includes('leg') || n.includes('lunge')) return 'legs';
  if (n.includes('deadlift') || n.includes('row') || n.includes('pull') || n.includes('lat')) return 'back';
  if (n.includes('press') || n.includes('shoulder') || n.includes('lateral raise')) return 'shoulders';
  if (n.includes('curl') || n.includes('tricep') || n.includes('bicep')) return 'arms';
  if (n.includes('plank') || n.includes('crunch') || n.includes('core') || n.includes('ab')) return 'core';
  if (n.includes('treadmill') || n.includes('cycling') || n.includes('running') || n.includes('cardio') || n.includes('jump')) return 'cardio';
  return 'other';
};

// ─── Helper: Summarize Logs (Token Reduction) ────────────────
export const summarizeLogs = (logs: any[]) => {
  if (!logs || logs.length === 0) return [];

  // Group flat logs by date to reconstruct "sessions"
  const groupedByDate: Record<string, {
    date: string;
    duration: number;
    type: string;
    exercises: any[];
  }> = {};

  logs.forEach((log) => {
    const dateKey = (log.date || new Date(log.timestamp).toISOString()).split('T')[0];
    
    if (!groupedByDate[dateKey]) {
      groupedByDate[dateKey] = {
        date: dateKey,
        duration: 0,
        type: 'mixed', // or logic to determine predominant type
        exercises: [],
      };
    }

    // Add session duration — sum all exercise durations for the day
    groupedByDate[dateKey].duration += log.durationMins || 0;

    // Map the flat log as an exercise
    groupedByDate[dateKey].exercises.push({
      name: log.exerciseName || log.name || 'Unknown',
      type: log.type || 'strength',
      muscle: log.muscle || log.muscleGroup || undefined,
      sets: log.setsData?.length || log.sets || 0,
      avgWeight:
        log.setsData && log.setsData.length > 0
          ? Math.round(
              log.setsData.reduce((a: number, s: any) => a + (s.weight || 0), 0) /
                log.setsData.length
            )
          : log.weight || 0,
      bestReps:
        log.setsData && log.setsData.length > 0
          ? Math.max(...log.setsData.map((s: any) => s.reps || 0))
          : log.reps || 0,
    });
    
    // Attempt to set a primary session type from the first exercise seen
    if (groupedByDate[dateKey].type === 'mixed' && log.type) {
       groupedByDate[dateKey].type = log.type;
    }
  });

  return Object.values(groupedByDate).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

// ─── Helper: Compute Derived Metrics ─────────────────────────
export const computeDerivedMetrics = (logs: any[]) => {
  const defaults = {
    workoutsPerWeek: 0,
    volumeTrendPercent: 0,
    strengthProgress: {} as Record<string, number>,
    muscleBalance: {} as Record<string, number>,
    cardioRatio: 0,
  };

  if (!logs || logs.length === 0) return defaults;

  // 1. Weekly Workout Frequency (count unique dates in the last 7 days)
  const now = Date.now();
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

  const uniqueDates = new Set<string>();
  const recentUniqueDates = new Set<string>();
  logs.forEach(l => {
    const dateStr = (l.date || new Date(l.timestamp).toISOString()).split('T')[0];
    uniqueDates.add(dateStr);
    const ts = l.timestamp || new Date(dateStr).getTime();
    if (ts >= sevenDaysAgo) {
      recentUniqueDates.add(dateStr);
    }
  });

  const workoutsPerWeek = recentUniqueDates.size;

  // 2. Training Volume Trend (last week vs previous week)
  const oneWeekAgo = sevenDaysAgo;
  const twoWeeksAgo = now - 14 * 24 * 60 * 60 * 1000;

  const getLogVolume = (log: any): number => {
    let vol = 0;
    if (log.setsData && log.setsData.length > 0) {
      log.setsData.forEach((s: any) => {
        vol += (s.reps || 0) * (s.weight > 0 ? s.weight : 1);
      });
    } else {
      vol += (log.sets || 0) * (log.reps || 0) * (log.weight > 0 ? log.weight : 1);
    }
    return vol;
  };

  let lastWeekVol = 0;
  let prevWeekVol = 0;
  logs.forEach((log) => {
    const ts = log.timestamp || (log.date ? new Date(log.date).getTime() : 0);
    const vol = getLogVolume(log);
    if (ts >= oneWeekAgo) {
      lastWeekVol += vol;
    } else if (ts >= twoWeeksAgo) {
      prevWeekVol += vol;
    }
  });

  let volumeTrendPercent = 0;
  if (prevWeekVol > 0) {
    volumeTrendPercent = Math.round(((lastWeekVol - prevWeekVol) / prevWeekVol) * 100);
  }

  // 3. Strength Progress (major lifts only)
  const majorLifts = ['bench press', 'squat', 'deadlift', 'overhead press'];
  const strengthProgress: Record<string, number> = {};

  majorLifts.forEach((liftName) => {
    const liftData: { ts: number; maxWeight: number }[] = [];

    logs.forEach((log) => {
      const ts = log.timestamp || (log.date ? new Date(log.date).getTime() : 0);
      if ((log.exerciseName || log.name || '').toLowerCase().includes(liftName)) {
        let maxW = 0;
        if (log.setsData && log.setsData.length > 0) {
          maxW = Math.max(...log.setsData.map((s: any) => s.weight || 0));
        } else {
          maxW = log.weight || 0;
        }
        if (maxW > 0) {
          liftData.push({ ts, maxWeight: maxW });
        }
      }
    });

    if (liftData.length >= 2) {
      liftData.sort((a, b) => a.ts - b.ts);
      const first = liftData[0].maxWeight;
      const latest = liftData[liftData.length - 1].maxWeight;
      if (first > 0) {
        const key = liftName.replace(/\s+/g, '');
        const camelKey = key.charAt(0).toLowerCase() + key.slice(1);
        strengthProgress[camelKey] = Math.round(((latest - first) / first) * 100);
      }
    }
  });

  // 4. Muscle Group Balance
  const muscleBalance: Record<string, number> = {};
  logs.forEach((log) => {
    const muscle = mapExerciseToMuscle(log.exerciseName || log.name || '');
    muscleBalance[muscle] = (muscleBalance[muscle] || 0) + 1;
  });

  // 5. Cardio Ratio
  let cardioLogs = 0;
  logs.forEach((log) => {
    if (log.type === 'cardio' || (log.exerciseId === 'treadmill' || log.exerciseId === 'cycling')) {
      cardioLogs++;
    }
  });
  const cardioRatio = logs.length > 0 ? Math.round((cardioLogs / logs.length) * 100) : 0;

  return {
    workoutsPerWeek,
    volumeTrendPercent,
    strengthProgress,
    muscleBalance,
    cardioRatio,
  };
};

// ─── Core: Unified LLM Call (Groq → OpenRouter fallback) ─────
type LLMMessage = { role: 'system' | 'user' | 'assistant'; content: string };

const callLLM = async (
  messages: LLMMessage[],
  options: { jsonMode?: boolean; temperature?: number } = {}
): Promise<string> => {
  const { jsonMode = false, temperature = 0.5 } = options;

  const makeRequest = async (
    url: string,
    apiKey: string,
    model: string,
    extraHeaders?: Record<string, string>
  ): Promise<string> => {
    const body: any = {
      model,
      messages,
      temperature,
    };
    if (jsonMode) {
      body.response_format = { type: 'json_object' };
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        ...extraHeaders,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new Error(`API error ${response.status}: ${errorBody}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  };

  // Try Groq first
  try {
    return await withTimeout(
      makeRequest(
        'https://api.groq.com/openai/v1/chat/completions',
        GROQ_API_KEY,
        GROQ_MODEL
      ),
      TIMEOUT_MS
    );
  } catch (groqError) {
    console.warn('Groq failed, falling back to OpenRouter:', groqError);
  }

  // Fallback to OpenRouter
  return await withTimeout(
    makeRequest(
      'https://openrouter.ai/api/v1/chat/completions',
      OPENROUTER_API_KEY,
      OPENROUTER_MODEL,
      { 'HTTP-Referer': 'https://gym-tracker.app' }
    ),
    TIMEOUT_MS
  );
};

// ─── AI: Workout Insights (Structured JSON) ──────────────────
export const getWorkoutInsights = async (profileData: any, recentLogs: any[]) => {
  try {
    // Sort by most recent first and limit to 50 logs
    const sortedLogs = [...(recentLogs || [])]
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
      .slice(0, 50);

    const weight = profileData?.weight || 70;
    
    // Summarize raw logs into sessions
    const summarized = summarizeLogs(sortedLogs);
    
    // The latest grouped session represents the "latest workout"
    const latestSession = summarized[0] || {};
    const calories = estimateCalories(
      weight,
      latestSession?.duration || 30,
      latestSession?.type || 'strength'
    );

    const metrics = computeDerivedMetrics(sortedLogs);

    const messages: LLMMessage[] = [
      {
        role: 'system',
        content: `You are an expert AI fitness coach. Analyze workout data and return structured JSON insights. Be specific with numbers, avoid generic encouragement.

Safety rules:
- Never recommend extreme diets, steroid use, or unsafe training loads
- Always prioritize injury prevention and proper form
- Avoid extreme training advice`
      },
      {
        role: 'user',
        content: `User profile:
Name: ${profileData?.name || 'User'}
Gender: ${profileData?.gender || 'Unknown'}
Height: ${profileData?.height || 'Unknown'} cm
Weight: ${profileData?.weight || 'Unknown'} kg
Goal: ${profileData?.goals || 'General fitness'}

Estimated calories burned in latest workout: ${calories}

Workout summaries (last ${summarized.length} sessions):
${JSON.stringify(summarized)}

Derived Metrics:
${JSON.stringify(metrics)}

Analyze the workout data for patterns:
- Strength progress trends
- Possible plateaus
- Muscle group balance
- Cardio frequency
- Training consistency
- Training volume trends

Use the derived metrics to detect patterns. Prefer concrete observations with numbers whenever possible.

Return ONLY this JSON structure:
{
  "caloriesBurned": ${calories},
  "encouragement": "1–2 sentences of positive feedback referencing specific numbers",
  "insight": "specific observation from their workout data and derived metrics",
  "nextFocus": "clear suggestion for their next workout"
}`
      }
    ];

    const text = await callLLM(messages, { jsonMode: true, temperature: 0.4 });

    try {
      return JSON.parse(text);
    } catch {
      console.error('Insight JSON parse failed:', text);
      return null;
    }
  } catch (error) {
    console.error('AI Insights Error:', error);
    return null;
  }
};

// ─── AI: Chat with AI ────────────────────────────────────────
export const chatWithAI = async (
  message: string,
  context: { profile: any; recentLogs: any[]; analytics: any; equipment: string[]; weightUnit: string },
  chatHistory: { role: string; parts: [{ text: string }] }[] = []
) => {
  try {
    const summarizedLogs = summarizeLogs(context.recentLogs || []);

    const systemInstruction = `You are Gym Tracker AI, an expert personal trainer and nutritionist built into a fitness app.

Style:
- Encouraging and concise
- Use emojis sparingly
- Direct and actionable

User Profile:
Name: ${context.profile?.name || 'Unknown'}
Gender: ${context.profile?.gender || 'Unknown'}
Height: ${context.profile?.height || 'Unknown'} cm
Weight: ${context.profile?.weight || 'Unknown'} ${context.weightUnit}
Goal: ${context.profile?.goals || 'General fitness'}

Available Equipment:
${context.equipment.join(', ') || 'Unknown'}

Preferred Weight Unit: ${context.weightUnit}

Recent Workouts Summary:
${JSON.stringify(summarizedLogs)}

Lifetime Analytics:
${JSON.stringify(context.analytics)}

Rules:
- Tailor advice to their goals, recent performance, and available equipment
- Only recommend exercises possible with available equipment
- Avoid unsafe weight recommendations
- Never recommend extreme diets, steroid use, or unsafe training loads
- Always prioritize injury prevention and proper form
- Focus on sustainable progress

If BMI > 25 AND training history suggests beginner-level activity,
recommend prioritizing light cardio and gradual resistance training for the first few weeks.`;

    // Convert chat history from Gemini format to OpenAI format
    const messages: LLMMessage[] = [
      { role: 'system', content: systemInstruction },
    ];

    // Add chat history
    chatHistory.forEach(msg => {
      messages.push({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.parts[0].text,
      });
    });

    // Add the current message
    messages.push({ role: 'user', content: message });

    return await callLLM(messages, { temperature: 0.7 });
  } catch (error) {
    console.error('AI Chat Error:', error);
    return "Whoops! I'm having trouble connecting right now. Please check your connection and try again.";
  }
};

// ─── AI: Generate Custom Routine ─────────────────────────────
export const generateCustomRoutine = async (profileData: any, recentLogs: any[], weightUnit: string = 'kg', focusAreas: string[] = []) => {
  try {
    // Sort and limit logs
    const sortedLogs = [...(recentLogs || [])]
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
      .slice(0, 50);

    const summarized = summarizeLogs(sortedLogs);

    const messages: LLMMessage[] = [
      {
        role: 'system',
        content: `You are an elite AI Personal Trainer. Create highly personalized workout routines. Always respond with valid JSON only.

Safety rules:
- Never recommend unsafe weight loads
- Prioritize correct form and injury prevention
- Avoid extreme training advice`
      },
      {
        role: 'user',
        content: `Based on the user's profile and their workout history, create a highly personalized 1-day custom workout routine.
      
User Profile:
- Name: ${profileData?.name || 'User'}
- Gender: ${profileData?.gender || 'Unknown'}
- Height: ${profileData?.height || 'Unknown'} cm
- Weight: ${profileData?.weight || 'Unknown'} ${weightUnit}
- Preferred Weight Unit: ${weightUnit}
- Goals: ${profileData?.goals || 'General fitness'}
- Gym Experience: ${profileData?.experienceValue ? profileData.experienceValue + ' ' + (profileData.experienceUnit || 'months') : 'Beginner / Newbie'}
- Recent Break/Gap: ${profileData?.gapValue && profileData?.gapUnit !== 'none' ? profileData.gapValue + ' ' + profileData.gapUnit : 'None'}

Recent Workout Summaries:
${JSON.stringify(summarized)}

Workout Focus Selected: ${focusAreas.length ? focusAreas.join(', ') : 'Full Body'}

The user selected the above muscle groups for today's workout.
Prioritize exercises targeting these muscles while optionally including supporting muscles if appropriate.
Do not include exercises unrelated to the selected focus unless necessary for balance or warm-up.
Adjust the number of exercises based on the workout focus:
- Single muscle: 4–5 exercises
- Two muscles: 5–6 exercises
- Full Body: 6–8 exercises

INSTRUCTIONS:
1. Carefully assess their Gym Experience, Recent Break/Gap, and Gender.
2. If they are a beginner or have a significant recent break, ALWAYS suggest a newbie-friendly, lower-intensity routine to help them (re)start safely.
3. CRITICAL: Calculate their approximate BMI using their height and weight. If they are a beginner/rookie AND their BMI indicates they are overweight or obese, their routine MUST heavily focus on about 30 minutes of daily cardio to let their body adjust for the first 1-2 months before aggressive weightlifting.
4. Explicitly suggest specific starting weights (e.g., "10 kg", "Bodyweight", "Adjust based on feel, maybe 5 kg dumbbells") for EACH exercise. Use their past workout history to inform this if available. Otherwise, use your assessment of their experience and gap to estimate a safe starting point.
5. Briefly explain why this routine was chosen overall, and provide a clear reason and benefit for EACH specific exercise.

You MUST respond ONLY with a valid JSON object matching exactly this schema:
{
  "routineName": "Name of the routine",
  "description": "Why this routine was suggested for them today based on their gaps/experience",
  "exercises": [
    {
      "name": "Exercise Name",
      "sets": "3",
      "reps": "10-12",
      "weightSuggestion": "Suggested weight/resistance",
      "reason": "Why this specific exercise?",
      "benefit": "What does it do?"
    }
  ]
}`
      }
    ];

    const responseText = await callLLM(messages, { jsonMode: true, temperature: 0.5 });

    try {
      return JSON.parse(responseText);
    } catch (parseError) {
      console.error('Failed to parse AI JSON:', responseText);
      return null;
    }
  } catch (error) {
    console.error('AI Routine Generation Error:', error);
    return null;
  }
};
