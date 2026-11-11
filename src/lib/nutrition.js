export const quickFoods = [
  { name:'Water', serving:'8 fl oz', calories:0, protein:0, carbs:0, fat:0, hydrationOz:8, icon:'💧' },
  { name:'Black Coffee', serving:'8 fl oz', calories:2, protein:0.3, carbs:0, fat:0, hydrationOz:8, icon:'☕' },
  { name:'Coffee + Cream', serving:'8 fl oz + 2 tbsp half-and-half', calories:42, protein:1, carbs:1.5, fat:3.5, hydrationOz:8, icon:'☕' },
  { name:'Unsweetened Tea', serving:'8 fl oz', calories:2, protein:0, carbs:0.5, fat:0, hydrationOz:8, icon:'🫖' },
  { name:'Milk', serving:'1 cup 2%', calories:122, protein:8, carbs:12, fat:4.8, hydrationOz:8, icon:'🥛' },
  { name:'Orange Juice', serving:'1 cup', calories:112, protein:1.7, carbs:26, fat:0.5, hydrationOz:8, icon:'🍊' },
  { name:'Banana', serving:'1 medium', calories:105, protein:1.3, carbs:27, fat:0.3, icon:'🍌' },
  { name:'Apple', serving:'1 medium', calories:95, protein:0.5, carbs:25, fat:0.3, icon:'🍎' },
  { name:'Orange', serving:'1 medium', calories:62, protein:1.2, carbs:15.4, fat:0.2, icon:'🍊' },
  { name:'Blueberries', serving:'1 cup', calories:84, protein:1.1, carbs:21.5, fat:0.5, icon:'🫐' },
  { name:'Strawberries', serving:'1 cup', calories:49, protein:1, carbs:11.7, fat:0.5, icon:'🍓' },
  { name:'Egg', serving:'1 large', calories:72, protein:6.3, carbs:0.4, fat:4.8, icon:'🥚' },
  { name:'Scrambled Eggs', serving:'2 large', calories:180, protein:13, carbs:2, fat:13, icon:'🍳' },
  { name:'Greek Yogurt', serving:'1 cup plain nonfat', calories:130, protein:23, carbs:9, fat:0, icon:'🥣' },
  { name:'Cottage Cheese', serving:'1 cup 2%', calories:183, protein:24, carbs:10, fat:5, icon:'🥣' },
  { name:'Oatmeal', serving:'1 cup cooked', calories:154, protein:6, carbs:27, fat:3, icon:'🥣' },
  { name:'Whole Wheat Toast', serving:'2 slices', calories:160, protein:8, carbs:28, fat:2, icon:'🍞' },
  { name:'Peanut Butter', serving:'2 tbsp', calories:190, protein:7, carbs:7, fat:16, icon:'🥜' },
  { name:'Chicken Breast', serving:'4 oz cooked', calories:187, protein:35, carbs:0, fat:4, icon:'🍗' },
  { name:'Turkey Breast', serving:'4 oz cooked', calories:153, protein:32, carbs:0, fat:2, icon:'🍗' },
  { name:'Lean Ground Beef', serving:'4 oz cooked', calories:230, protein:29, carbs:0, fat:12, icon:'🥩' },
  { name:'Salmon', serving:'4 oz cooked', calories:233, protein:25, carbs:0, fat:14, icon:'🐟' },
  { name:'Tuna', serving:'1 can in water', calories:120, protein:27, carbs:0, fat:1, icon:'🐟' },
  { name:'White Rice', serving:'1 cup cooked', calories:205, protein:4.3, carbs:45, fat:0.4, icon:'🍚' },
  { name:'Brown Rice', serving:'1 cup cooked', calories:216, protein:5, carbs:45, fat:1.8, icon:'🍚' },
  { name:'Baked Potato', serving:'1 medium', calories:161, protein:4.3, carbs:37, fat:0.2, icon:'🥔' },
  { name:'Sweet Potato', serving:'1 medium baked', calories:103, protein:2.3, carbs:24, fat:0.2, icon:'🍠' },
  { name:'Broccoli', serving:'1 cup cooked', calories:55, protein:3.7, carbs:11, fat:0.6, icon:'🥦' },
  { name:'Mixed Salad', serving:'2 cups vegetables', calories:70, protein:3, carbs:12, fat:1, icon:'🥗' },
  { name:'Avocado', serving:'1/2 fruit', calories:120, protein:1.5, carbs:6.4, fat:11, icon:'🥑' },
  { name:'Almonds', serving:'1 oz', calories:164, protein:6, carbs:6, fat:14, icon:'🌰' },
  { name:'Protein Shake', serving:'1 serving', calories:140, protein:25, carbs:5, fat:2, hydrationOz:12, icon:'🥤' },
  { name:'Protein Bar', serving:'1 bar', calories:210, protein:20, carbs:23, fat:7, icon:'🍫' },
  { name:'Cheeseburger', serving:'1 regular', calories:430, protein:24, carbs:33, fat:23, icon:'🍔' },
  { name:'Pizza', serving:'1 slice cheese', calories:285, protein:12, carbs:36, fat:10, icon:'🍕' }
];

export const findQuickFood = name => quickFoods.find(f => f.name.toLowerCase() === String(name).trim().toLowerCase());

const hasValue = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));

// Use per-serving values when the product has them; otherwise use per-100 g values
// and label the serving to match, so calories are never mislabelled.
function productNutrition(p) {
  const n = p.nutriments || {};
  const perServing = hasValue(n['energy-kcal_serving']);
  const suffix = perServing ? '_serving' : '_100g';
  const pick = key => hasValue(n[`${key}${suffix}`]) ? Number(n[`${key}${suffix}`]) : 0;
  return {
    serving: perServing ? (p.serving_size || '1 serving') : 'per 100 g',
    calories: pick('energy-kcal'),
    protein: pick('proteins'),
    carbs: pick('carbohydrates'),
    fat: pick('fat')
  };
}

export async function searchOpenFoodFacts(term){
  const query = String(term || '').trim();
  if(query.length < 2) return [];
  const url = new URL('https://world.openfoodfacts.org/cgi/search.pl');
  url.searchParams.set('search_terms', query);
  url.searchParams.set('search_simple', '1');
  url.searchParams.set('action', 'process');
  url.searchParams.set('json', '1');
  url.searchParams.set('page_size', '8');
  url.searchParams.set('fields', 'code,product_name,brands,serving_size,nutriments');
  const res = await fetch(url.toString(), {headers:{'Accept':'application/json'}});
  if(!res.ok) throw new Error(`Food database returned ${res.status}`);
  const data = await res.json();
  return (data.products || []).filter(p => p.product_name).map(p => ({
    source:'Open Food Facts',
    code:p.code || '',
    name:p.product_name,
    brand:p.brands || '',
    ...productNutrition(p),
    icon:'🔎'
  }));
}
