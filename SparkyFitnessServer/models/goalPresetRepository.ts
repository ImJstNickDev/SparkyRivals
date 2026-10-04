import type { GoalPresetsInitializer } from '@workspace/shared';
import { getClient } from '../db/poolManager.js';
import { log } from '../config/logging.js';
async function createGoalPreset(presetData: GoalPresetsInitializer) {
  const client = await getClient(presetData.user_id); // User-specific operation
  try {
    log('debug', 'createGoalPreset: Received presetData:', {
      protein: presetData.protein,
      carbs: presetData.carbs,
      fat: presetData.fat,
      protein_percentage: presetData.protein_percentage,
      carbs_percentage: presetData.carbs_percentage,
      fat_percentage: presetData.fat_percentage,
    });
    const result = await client.query(
      `INSERT INTO goal_presets (
        user_id, preset_name, calories, protein, carbs, fat, water_goal,
        saturated_fat, polyunsaturated_fat, monounsaturated_fat, trans_fat,
        cholesterol, sodium, potassium, dietary_fiber, sugars,
        vitamin_a, vitamin_c, calcium, iron,
        target_exercise_calories_burned, target_exercise_duration_minutes,
        protein_percentage, carbs_percentage, fat_percentage,
        breakfast_percentage, lunch_percentage, dinner_percentage, snacks_percentage,
        custom_nutrients, custom_meal_percentages,
        caffeine_mg, alcohol_g, steps_goal, distance_goal_meters, active_calories_goal
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36)
      RETURNING *`,
      [
        presetData.user_id,
        presetData.preset_name,
        presetData.calories,
        presetData.protein,
        presetData.carbs,
        presetData.fat,
        presetData.water_goal,
        presetData.saturated_fat,
        presetData.polyunsaturated_fat,
        presetData.monounsaturated_fat,
        presetData.trans_fat,
        presetData.cholesterol,
        presetData.sodium,
        presetData.potassium,
        presetData.dietary_fiber,
        presetData.sugars,
        presetData.vitamin_a,
        presetData.vitamin_c,
        presetData.calcium,
        presetData.iron,
        presetData.target_exercise_calories_burned,
        presetData.target_exercise_duration_minutes,
        presetData.protein_percentage,
        presetData.carbs_percentage,
        presetData.fat_percentage,
        presetData.breakfast_percentage,
        presetData.lunch_percentage,
        presetData.dinner_percentage,
        presetData.snacks_percentage,
        presetData.custom_nutrients || {},
        presetData.custom_meal_percentages || {},
        presetData.caffeine_mg,
        presetData.alcohol_g,
        presetData.steps_goal,
        presetData.distance_goal_meters,
        presetData.active_calories_goal,
      ]
    );
    return result.rows[0];
  } finally {
    client.release();
  }
}
async function getGoalPresetsByUserId(userId: string) {
  const client = await getClient(userId); // User-specific operation
  try {
    const result = await client.query(
      'SELECT * FROM goal_presets WHERE user_id = $1 ORDER BY preset_name',
      [userId]
    );
    return result.rows;
  } finally {
    client.release();
  }
}
async function getGoalPresetById(presetId: string, userId: string) {
  const client = await getClient(userId); // User-specific operation
  try {
    const result = await client.query(
      'SELECT * FROM goal_presets WHERE id = $1 AND user_id = $2',
      [presetId, userId]
    );
    return result.rows[0];
  } finally {
    client.release();
  }
}
async function updateGoalPreset(
  presetId: string,
  presetData: GoalPresetsInitializer
) {
  const client = await getClient(presetData.user_id); // User-specific operation
  try {
    log('debug', 'updateGoalPreset: Received presetData:', {
      protein: presetData.protein,
      carbs: presetData.carbs,
      fat: presetData.fat,
      protein_percentage: presetData.protein_percentage,
      carbs_percentage: presetData.carbs_percentage,
      fat_percentage: presetData.fat_percentage,
    });
    const result = await client.query(
      `UPDATE goal_presets SET
        preset_name = $1, calories = $2, protein = $3, carbs = $4, fat = $5, water_goal = $6,
        saturated_fat = $7, polyunsaturated_fat = $8, monounsaturated_fat = $9, trans_fat = $10,
        cholesterol = $11, sodium = $12, potassium = $13, dietary_fiber = $14, sugars = $15,
        vitamin_a = $16, vitamin_c = $17, calcium = $18, iron = $19,
        target_exercise_calories_burned = $20, target_exercise_duration_minutes = $21,
        protein_percentage = $22, carbs_percentage = $23, fat_percentage = $24,
        breakfast_percentage = $25, lunch_percentage = $26, dinner_percentage = $27, snacks_percentage = $28,
        custom_nutrients = $29, custom_meal_percentages = $30,
        caffeine_mg = $31, alcohol_g = $32,
        steps_goal = CASE WHEN $35 THEN $36 ELSE steps_goal END,
        distance_goal_meters = CASE WHEN $37 THEN $38 ELSE distance_goal_meters END,
        active_calories_goal = CASE WHEN $39 THEN $40 ELSE active_calories_goal END,
        updated_at = now()
      WHERE id = $33 AND user_id = $34
      RETURNING *`,
      [
        presetData.preset_name,
        presetData.calories,
        presetData.protein,
        presetData.carbs,
        presetData.fat,
        presetData.water_goal,
        presetData.saturated_fat,
        presetData.polyunsaturated_fat,
        presetData.monounsaturated_fat,
        presetData.trans_fat,
        presetData.cholesterol,
        presetData.sodium,
        presetData.potassium,
        presetData.dietary_fiber,
        presetData.sugars,
        presetData.vitamin_a,
        presetData.vitamin_c,
        presetData.calcium,
        presetData.iron,
        presetData.target_exercise_calories_burned,
        presetData.target_exercise_duration_minutes,
        presetData.protein_percentage,
        presetData.carbs_percentage,
        presetData.fat_percentage,
        presetData.breakfast_percentage,
        presetData.lunch_percentage,
        presetData.dinner_percentage,
        presetData.snacks_percentage,
        presetData.custom_nutrients || {},
        presetData.custom_meal_percentages || {},
        presetData.caffeine_mg,
        presetData.alcohol_g,
        presetId,
        presetData.user_id,
        presetData.steps_goal !== undefined,
        presetData.steps_goal,
        presetData.distance_goal_meters !== undefined,
        presetData.distance_goal_meters,
        presetData.active_calories_goal !== undefined,
        presetData.active_calories_goal,
      ]
    );
    return result.rows[0];
  } finally {
    client.release();
  }
}
async function deleteGoalPreset(presetId: string, userId: string) {
  const client = await getClient(userId); // User-specific operation
  try {
    const result = await client.query(
      'DELETE FROM goal_presets WHERE id = $1 AND user_id = $2 RETURNING *',
      [presetId, userId]
    );
    return result.rows[0];
  } finally {
    client.release();
  }
}
export { createGoalPreset };
export { getGoalPresetsByUserId };
export { getGoalPresetById };
export { updateGoalPreset };
export { deleteGoalPreset };
export default {
  createGoalPreset,
  getGoalPresetsByUserId,
  getGoalPresetById,
  updateGoalPreset,
  deleteGoalPreset,
};
