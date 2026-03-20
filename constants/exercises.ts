export interface ExerciseDef {
  id: string;
  name: string;
  category: string;
  icon: string; // Used for MaterialCommunityIcons
  type: 'weight' | 'cardio' | 'bodyweight';
  options?: string[]; // New: list of techniques or variations
}

export const MASTER_EXERCISES: ExerciseDef[] = [
  // --- Chest ---
  { id: 'bench_press_barbell', name: 'Barbell Bench Press', category: 'Chest', icon: 'weight-lifter', type: 'weight' },
  { id: 'incline_dumbbell_press', name: 'Incline Dumbbell Press', category: 'Chest', icon: 'dumbbell', type: 'weight' },
  { id: 'decline_bench_press', name: 'Decline Bench Press', category: 'Chest', icon: 'weight-lifter', type: 'weight' },
  { id: 'pec_deck', name: 'Pec Deck Machine', category: 'Chest', icon: 'arm-flex', type: 'weight' },
  { id: 'cable_crossover', name: 'Cable Crossover', category: 'Chest', icon: 'transit-connection-variant', type: 'weight' },
  { id: 'chest_press_machine', name: 'Chest Press Machine', category: 'Chest', icon: 'car-seat-cooler', type: 'weight' },
  { id: 'isolateral_incline_press', name: 'Isolateral Incline Press', category: 'Chest', icon: 'dumbbell', type: 'weight' },
  { id: 'multipress_smith', name: 'Multipress (Smith Machine)', category: 'Chest', icon: 'weight-lifter', type: 'weight' },
  { id: 'pushup', name: 'Push-Up', category: 'Chest', icon: 'human-handsdown', type: 'bodyweight' },

  // --- Back ---
  { id: 'deadlift', name: 'Deadlift', category: 'Back', icon: 'human-handsdown', type: 'weight' },
  { id: 'pullup', name: 'Pull-Up', category: 'Back', icon: 'human-handsup', type: 'bodyweight' },
  { id: 'lat_pulldown', name: 'Lat Pulldown', category: 'Back', icon: 'arrow-down-bold-box-outline', type: 'weight' },
  { id: 'barbell_row', name: 'Barbell Row', category: 'Back', icon: 'weight-lifter', type: 'weight' },
  { id: 'seated_cable_row', name: 'Seated Cable Row', category: 'Back', icon: 'rowing', type: 'weight' },
  { id: 't_bar_row', name: 'T-Bar Row', category: 'Back', icon: 'weight', type: 'weight' },
  { id: 'single_arm_dumbbell_row', name: 'Single Arm Dumbbell Row', category: 'Back', icon: 'dumbbell', type: 'weight' },
  { id: 'incline_t_bar_row', name: 'Incline T-Bar Row', category: 'Back', icon: 'weight', type: 'weight' },
  { id: 'lat_pulldown_row', name: 'Lat Pulldown - Row Machine', category: 'Back', icon: 'rowing', type: 'weight' },
  { id: 'face_pull', name: 'Face Pull', category: 'Back', icon: 'transit-connection-variant', type: 'weight' },
  { id: 'rear_delt_fly', name: 'Rear Delt Fly', category: 'Back', icon: 'arm-flex-outline', type: 'weight' },

  // --- Legs ---
  { id: 'squat_barbell', name: 'Barbell Squat', category: 'Legs', icon: 'human', type: 'weight' },
  { id: 'leg_press', name: 'Leg Press', category: 'Legs', icon: 'car-seat-cooler', type: 'weight' },
  { id: 'bulgarian_split_squat', name: 'Bulgarian Split Squat', category: 'Legs', icon: 'dumbbell', type: 'weight' },
  { id: 'hack_squat', name: 'Hack Squat', category: 'Legs', icon: 'human-wheelchair', type: 'weight' },
  { id: 'leg_extension', name: 'Leg Extension', category: 'Legs', icon: 'human-wheelchair', type: 'weight' },
  { id: 'leg_curl', name: 'Leg Curl', category: 'Legs', icon: 'human-wheelchair', type: 'weight' },
  { id: 'calf_raise_standing', name: 'Standing Calf Raise', category: 'Legs', icon: 'human-male-height', type: 'weight' },
  { id: 'calf_raise_seated', name: 'Seated Calf Raise', category: 'Legs', icon: 'human-wheelchair', type: 'weight' },

  // --- Shoulders ---
  { id: 'overhead_press', name: 'Overhead Press', category: 'Shoulders', icon: 'weight-lifter', type: 'weight' },
  { id: 'arnold_press', name: 'Arnold Press', category: 'Shoulders', icon: 'dumbbell', type: 'weight' },
  { id: 'lateral_raise', name: 'Lateral Raise', category: 'Shoulders', icon: 'arm-flex-outline', type: 'weight', options: ['Dumbbell', 'Cable', 'Machine', 'ISO-Lateral Machine'] },
  { id: 'front_raise', name: 'Front Raise', category: 'Shoulders', icon: 'dumbbell', type: 'weight' },
  { id: 'reverse_pec_deck', name: 'Reverse Pec Deck', category: 'Shoulders', icon: 'arm-flex', type: 'weight' },
  { id: 'shoulder_press_machine', name: 'Shoulder Press Machine', category: 'Shoulders', icon: 'car-seat-cooler', type: 'weight' },

  // --- Biceps ---
  { id: 'bicep_curl_dumbbell', name: 'Dumbbell Bicep Curl', category: 'Biceps', icon: 'arm-flex-outline', type: 'weight' },
  { id: 'bicep_curl_barbell', name: 'Barbell Bicep Curl', category: 'Biceps', icon: 'weight-lifter', type: 'weight' },
  { id: 'hammer_curl', name: 'Hammer Curl', category: 'Biceps', icon: 'dumbbell', type: 'weight' },
  { id: 'preacher_curl', name: 'Preacher Curl', category: 'Biceps', icon: 'arm-flex', type: 'weight' },
  { id: 'bicep_curl_machine', name: 'Bicep Curl Machine', category: 'Biceps', icon: 'arm-flex', type: 'weight' },

  // --- Triceps ---
  { id: 'tricep_pushdown', name: 'Tricep Pushdown', category: 'Triceps', icon: 'transit-connection-variant', type: 'weight' },
  { id: 'overhead_tricep_extension', name: 'Overhead Tricep Ex', category: 'Triceps', icon: 'dumbbell', type: 'weight' },
  { id: 'skull_crusher', name: 'Skull Crusher', category: 'Triceps', icon: 'weight-lifter', type: 'weight' },

  // --- Core ---
  { id: 'crunch', name: 'Ab Crunches', category: 'Core', icon: 'human-handsdown', type: 'bodyweight' },
  { id: 'plank', name: 'Plank', category: 'Core', icon: 'human-handsdown', type: 'bodyweight' },
  { id: 'leg_raise_hanging', name: 'Hanging Leg Raise', category: 'Core', icon: 'human-handsup', type: 'bodyweight' },
  { id: 'cable_crunch', name: 'Cable Crunch', category: 'Core', icon: 'transit-connection-variant', type: 'weight' },
  { id: 'vertical_knee_raise_dip', name: 'Vertical Knee Raise Dip', category: 'Core', icon: 'human-handsup', type: 'bodyweight' },
  { id: 'russian_twist', name: 'Russian Twist', category: 'Core', icon: 'rotate-3d-variant', type: 'bodyweight' },

  // --- Cardio ---
  { id: 'treadmill', name: 'Treadmill', category: 'Cardio', icon: 'run-fast', type: 'cardio' },
  { id: 'cycling', name: 'Stationary Bike', category: 'Cardio', icon: 'bike', type: 'cardio' },
  { id: 'stair_master', name: 'Stair Master', category: 'Cardio', icon: 'stairs', type: 'cardio' },
  { id: 'rowing_machine', name: 'Rowing Machine', category: 'Cardio', icon: 'rowing', type: 'cardio' },
  { id: 'elliptical', name: 'Elliptical', category: 'Cardio', icon: 'run', type: 'cardio' },
  { id: 'jump_rope', name: 'Jump Rope', category: 'Cardio', icon: 'jump-rope', type: 'cardio' },
  { id: 'battle_ropes', name: 'Battle Ropes', category: 'Cardio', icon: 'run', type: 'cardio', options: ['Alternating Waves', 'Slams', 'Side Waves', 'Circles'] }
];
