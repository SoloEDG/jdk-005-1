import type { Item, Weather, Crop } from "../../../shared/contracts";
import { DRY_LOSS, RAIN_GAIN } from "../../irrigation/lib/catalog";
export const crops: Partial<
  Record<
    Item,
    { cost: number; duration: number; yield: number; repeat: number }
  >
> = {
  carrot: { cost: 5, duration: 12, yield: 3, repeat: 0 },
  corn: { cost: 9, duration: 18, yield: 4, repeat: 1 },
  berry: { cost: 12, duration: 24, yield: 3, repeat: 2 },
};
export function grow(crop: Crop, weather: Weather, hours: number) {
  const water = Math.max(
    0,
    Math.min(100, crop.water + (weather === "rain" ? RAIN_GAIN : -DRY_LOSS) * hours),
  );
  const rate = water > 0 ? (weather === "wind" ? 0.6 : 1) : 0.15;
  return {
    ...crop,
    water,
    stress: crop.stress + (water === 0 ? hours : 0),
    growth: crop.growth + hours * rate,
  };
}
/**
 * 接入灌溉后的逐小时结算：
 * 雨天直接喝雨水；晴天/风天按渠网实际送达的水量补水，
 * 水量有限、不会给每块地复制同一份水。作物始终按实际获得的水继续生长。
 */
export function growWithSupply(
  crop: Crop,
  weather: Weather,
  hours: number,
  supply: number,
) {
  let water: number;
  if (weather === "rain") {
    water = Math.min(100, crop.water + RAIN_GAIN * hours);
  } else {
    water = Math.max(
      0,
      Math.min(100, crop.water - DRY_LOSS * hours + supply),
    );
  }
  const rate = water > 0 ? (weather === "wind" ? 0.6 : 1) : 0.15;
  return {
    ...crop,
    water,
    stress: crop.stress + (water === 0 ? hours : 0),
    growth: crop.growth + hours * rate,
  };
}
export function ready(crop: Crop) {
  return crop.growth >= (crops[crop.item]?.duration ?? Infinity);
}
