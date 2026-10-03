import { describe, expect, it } from "vitest";
import { foods } from "../supabase/data/foods.mjs";
import {
  classifiedFoodKeys,
  defaultStorage,
  duplicateFoodKeys,
  hasRipeness,
  predictExpiry,
  profileIdOf,
  shelfLifeDays,
  storageNote,
  storageOptions,
  RIPENESSES,
  type ShelfFood,
} from "../src/lib/shelf-life";

// La tabla .mjs no tiene tipos: se declaran aquí.
type FoodTuple = [key: string, es: string, en: string, category: string, emoji: string, img: string | null, days: number, unit: string, aliases: string[]];
const foodList = foods as unknown as FoodTuple[];
const shelfFood = ([key, es, en, category]: FoodTuple): ShelfFood => ({ key, category, name_es: es, name_en: en });

const today = "2026-10-03";

describe("vida útil del catálogo", () => {
  it("cada alimento tiene su perfil y no sobra ninguno", () => {
    const keys = new Set(foodList.map((f) => f[0]));
    expect(duplicateFoodKeys()).toEqual([]);
    expect(foodList.filter((f) => !classifiedFoodKeys().includes(f[0])).map((f) => f[0])).toEqual([]);
    expect(classifiedFoodKeys().filter((k) => !keys.has(k))).toEqual([]);
    for (const f of foodList) expect(profileIdOf(shelfFood(f)), f[0]).not.toMatch(/^category:/);
  });

  it("foods.mjs guarda los días del lugar por defecto (la fuente de verdad es shelf-life.ts)", () => {
    const wrong = foodList
      .filter((f) => shelfLifeDays(shelfFood(f)) !== f[6])
      .map((f) => `${f[0]}: foods.mjs=${f[6]}, shelf-life.ts=${shelfLifeDays(shelfFood(f))}`);
    expect(wrong).toEqual([]);
  });

  it("todos tienen lugares, uno recomendado, y una fecha para cada lugar y madurez", () => {
    for (const f of foodList) {
      const food = shelfFood(f);
      const options = storageOptions(food);
      expect(options.length, f[0]).toBeGreaterThan(0);
      expect(options, f[0]).toContain(defaultStorage(food));
      const states = hasRipeness(food) ? RIPENESSES : [null];
      for (const storage of options) {
        for (const ripeness of states) {
          const p = predictExpiry({ food, storage, ripeness, from: today });
          expect(p.expiresOn, `${f[0]} ${storage} ${ripeness}`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
          expect(p.estimated).toBe(true);
          expect(p.storage).toBe(storage);
          expect(p.days, `${f[0]} ${storage} ${ripeness}`).toBeGreaterThan(0);
          expect(p.expiresOn! > today, `${f[0]} ${storage} ${ripeness}`).toBe(true);
        }
      }
    }
  });

  it("nunca ofrece un lugar inseguro: carnes, pescados, lácteos y congelados jamás van al ambiente", () => {
    for (const f of foodList) {
      if (["meat", "seafood", "dairy", "frozen"].includes(f[3])) expect(storageOptions(shelfFood(f)), f[0]).not.toContain("pantry");
    }
  });

  it("lo crudo dura poco en el refrigerador y lo que está en el ambiente de verdad es estable o lo marca como abierto/cortado", () => {
    for (const f of foodList) {
      const food = shelfFood(f);
      if (["meat", "seafood"].includes(f[3]) && defaultStorage(food) === "fridge") {
        // Crudo o ya cocido: nada que pase de 2 semanas en el refrigerador (el fiambre sellado es lo más largo).
        expect(shelfLifeDays(food, "fridge")!, f[0]).toBeLessThanOrEqual(14);
      }
      if (storageOptions(food).includes("pantry") && storageOptions(food).includes("fridge") && ["pantry"].includes(f[3])) {
        // Despensa + refrigerador: el refrigerador es para lo ya abierto.
        expect(storageNote(food, "fridge"), f[0]).not.toBeNull();
      }
    }
  });

  it("lo que no se congela bien no ofrece el congelador", () => {
    const noFreeze = [
      "lettuce", "salad_mix", "arugula", "watercress", "cucumber", "radish", "artichoke", "caigua", "ricotta", "cream_cheese", "sour_cream",
      "hummus", "mayonnaise", "eggs", "lime", "lemon", "orange", "grapefruit", "tangerine", "potato", "yellow_potato", "sweet_potato",
      "olluco", "kiwi", "bean_sprouts", "rice", "pasta", "huancaina_sauce", "apple", "melon", "watermelon", "plant_milk",
    ];
    for (const key of noFreeze) {
      const f = foodList.find((x) => x[0] === key);
      expect(f, key).toBeDefined();
      expect(storageOptions(shelfFood(f!)), key).not.toContain("freezer");
    }
  });

  it("lo que no va al refrigerador no lo ofrece", () => {
    for (const key of ["bread", "sweet_potato", "olluco", "rice", "salt", "honey", "ice_cream", "french_fries", "hazelnut_spread", "coffee"]) {
      const f = foodList.find((x) => x[0] === key)!;
      expect(storageOptions(shelfFood(f)), key).not.toContain("fridge");
    }
  });

  it("el congelador dura más que el refrigerador (salvo 'descongelado' o 'ya preparado')", () => {
    for (const f of foodList) {
      const food = shelfFood(f);
      const options = storageOptions(food);
      if (!options.includes("fridge") || !options.includes("freezer")) continue;
      if (["thawed", "prepared"].includes(storageNote(food, "fridge") ?? "")) continue;
      for (const ripeness of hasRipeness(food) ? RIPENESSES : [null]) {
        expect(shelfLifeDays(food, "freezer", ripeness)!, `${f[0]} ${ripeness}`).toBeGreaterThanOrEqual(shelfLifeDays(food, "fridge", ripeness)!);
      }
    }
  });

  it("los ejemplos clave del encargo", () => {
    const find = (key: string) => shelfFood(foodList.find((f) => f[0] === key)!);
    expect(storageOptions(find("avocado"))).toEqual(["pantry", "fridge", "freezer"]);
    expect(defaultStorage(find("potato"))).toBe("pantry");
    expect(defaultStorage(find("onion"))).toBe("pantry");
    expect(defaultStorage(find("strawberries"))).toBe("fridge");
    expect(storageOptions(find("rice"))).toEqual(["pantry"]);
    expect(storageOptions(find("tuna_can"))).toEqual(["pantry", "fridge"]);
    expect(storageOptions(find("chicken"))).toEqual(["fridge", "freezer"]);
    expect(storageOptions(find("eggs"))).toEqual(["fridge"]);
    expect(storageOptions(find("bread"))).toEqual(["pantry", "freezer"]);
    expect(shelfLifeDays(find("chicken"), "fridge")).toBeLessThanOrEqual(2);
  });
});
