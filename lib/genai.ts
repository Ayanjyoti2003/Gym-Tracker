// ─── AI Configuration ────────────────────────────────────────
const GROQ_API_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY || 'MISSING_KEY';
const OPENROUTER_API_KEY = process.env.EXPO_PUBLIC_OPENROUTER_API_KEY || 'MISSING_KEY';

// Llama 3.1 8B has much higher rate limits (30k TPM) vs 70B models (6k TPM)
const GROQ_MODEL = 'llama-3.1-8b-instant';
const OPENROUTER_MODEL = 'meta-llama/llama-3.1-8b-instruct:free';

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
    setTimeout(() => reject(new Error(`AI Request timed out after ${ms}ms`)), ms)
  );
  return Promise.race([promise, timeout]);
};

/**
 * Robust JSON parsing that handles preamble text or markdown blocks.
 */
const safeParseJSON = (text: string) => {
  if (!text) return null;
  try {
    // Try direct parse first
    return JSON.parse(text);
  } catch (e) {
    try {
      // Find JSON block { ... } using regex
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (innerError) {
      console.error('safeParseJSON failed:', innerError, 'Text was:', text);
    }
    return null;
  }
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
        type: 'mixed',
        exercises: [],
      };
    }

    groupedByDate[dateKey].duration += log.durationMins || 0;

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

  const now = Date.now();
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

  const recentUniqueDates = new Set<string>();
  logs.forEach(l => {
    const dateStr = (l.date || new Date(l.timestamp).toISOString()).split('T')[0];
    const ts = l.timestamp || new Date(dateStr).getTime();
    if (ts >= sevenDaysAgo) {
      recentUniqueDates.add(dateStr);
    }
  });

  const workoutsPerWeek = recentUniqueDates.size;

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
    if (ts >= oneWeekAgo) lastWeekVol += vol;
    else if (ts >= twoWeeksAgo) prevWeekVol += vol;
  });

  let volumeTrendPercent = 0;
  if (prevWeekVol > 0) {
    volumeTrendPercent = Math.round(((lastWeekVol - prevWeekVol) / prevWeekVol) * 100);
  }

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
        if (maxW > 0) liftData.push({ ts, maxWeight: maxW });
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

  const muscleBalance: Record<string, number> = {};
  logs.forEach((log) => {
    const muscle = mapExerciseToMuscle(log.exerciseName || log.name || '');
    muscleBalance[muscle] = (muscleBalance[muscle] || 0) + 1;
  });

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
      throw new Error(`[${model}] API error ${response.status}: ${errorBody}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  };

  // 1. Try Groq (Fast & High TPM for 8B)
  try {
    console.log(`AI Call: Trying Groq (${GROQ_MODEL})...`);
    return await withTimeout(
      makeRequest(
        'https://api.groq.com/openai/v1/chat/completions',
        GROQ_API_KEY,
        GROQ_MODEL
      ),
      TIMEOUT_MS
    );
  } catch (groqError: any) {
    console.warn(`Groq (${GROQ_MODEL}) failed:`, groqError.message || groqError);
    
    // If it's a rate limit error, wait a tiny bit or just fallback
    if (groqError.message?.includes('429')) {
       console.log('Rate limit hit on Groq, failing over...');
    }
  }

  // 2. Fallback: OpenRouter (Higher reliability for free models)
  try {
    console.log(`AI Call: Trying OpenRouter (${OPENROUTER_MODEL})...`);
    return await withTimeout(
      makeRequest(
        'https://openrouter.ai/api/v1/chat/completions',
        OPENROUTER_API_KEY,
        OPENROUTER_MODEL,
        { 'HTTP-Referer': 'https://gym-tracker.app' }
      ),
      TIMEOUT_MS
    );
  } catch (orError: any) {
    console.error(`OpenRouter (${OPENROUTER_MODEL}) fallback failed:`, orError.message || orError);
    throw orError; // Final throw if both fail
  }
};

// ─── AI: Workout Insights (Structured JSON) ──────────────────
export const getWorkoutInsights = async (profileData: any, recentLogs: any[]) => {
  try {
    const sortedLogs = [...(recentLogs || [])]
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
      .slice(0, 40); // Slightly reduced from 50 to save tokens

    const weight = profileData?.weight || 70;
    const summarized = summarizeLogs(sortedLogs);
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
        content: `You are an expert AI fitness coach. Return structured JSON insights.

Rules:
- Be specific with numbers
- Response must be valid JSON
- Mention "json" to ensure proper formatting`
      },
      {
        role: 'user',
        content: `User Profile: Name: ${profileData?.name || 'User'}, Goal: ${profileData?.goals || 'Fitness'}
Workout sessions: ${JSON.stringify(summarized)}
Metrics: ${JSON.stringify(metrics)}

Return ONLY this JSON structure:
{
  "caloriesBurned": ${calories},
  "encouragement": "concise feedback",
  "insight": "specific observation",
  "nextFocus": "suggestion"
}`
      }
    ];

    const text = await callLLM(messages, { jsonMode: true, temperature: 0.3 });
    return safeParseJSON(text);
  } catch (error) {
    console.error('AI Insights Procedure Failed:', error);
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
    // 1. Limit history to save tokens (last 10 messages)
    const limitedHistory = chatHistory.slice(-10);
    
    // 2. Limit logs/summaries to save tokens
    const summarizedLogs = summarizeLogs((context.recentLogs || []).slice(0, 30));

    const systemInstruction = `You are Gym Tracker AI, expert trainer. concise, direct, actionable.
User: ${context.profile?.name || 'User'}, Goal: ${context.profile?.goals || 'Fitness'}.
Equipment: ${context.equipment.join(', ') || 'None'}.
Recent Summary: ${JSON.stringify(summarizedLogs)}.
Rules: No medical advice. Concise answers.`;

    const messages: LLMMessage[] = [
      { role: 'system', content: systemInstruction },
    ];

    limitedHistory.forEach(msg => {
      messages.push({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.parts[0].text,
      });
    });

    messages.push({ role: 'user', content: message });

    return await callLLM(messages, { temperature: 0.6 });
  } catch (error) {
    console.error('AI Chat Procedure Failed:', error);
    return "Whoops! I'm having trouble connecting to my brain right now. Please try again in secondary.";
  }
};

// ─── AI: Generate Custom Routine ─────────────────────────────
export const generateCustomRoutine = async (profileData: any, recentLogs: any[], weightUnit: string = 'kg', focusAreas: string[] = []) => {
  try {
    const summarized = summarizeLogs((recentLogs || []).slice(0, 30));

    const messages: LLMMessage[] = [
      {
        role: 'system',
        content: 'You are an elite AI Trainer. Return valid JSON only. Mention "json" in prompt.'
      },
      {
        role: 'user',
        content: `User: ${profileData?.name}, Goals: ${profileData?.goals}, Focus: ${focusAreas.join(', ') || 'Full Body'}.
History: ${JSON.stringify(summarized)}

Return ONLY this JSON:
{
  "routineName": "string",
  "description": "string",
  "exercises": [
    { "name": "string", "sets": "string", "reps": "string", "weightSuggestion": "string", "reason": "string", "benefit": "string" }
  ]
}`
      }
    ];

    const responseText = await callLLM(messages, { jsonMode: true, temperature: 0.5 });
    return safeParseJSON(responseText);
  } catch (error) {
    console.error('AI Routine Procedure Failed:', error);
    return null;
  }
};
