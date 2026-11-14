import type { IrrigationNode } from "../../../shared/contracts";

/** 灌溉网格与农场 4×3 田块一一对齐 */
export const GRID_ROWS = 3;
export const GRID_COLS = 4;
export const PLOT_COUNT = GRID_ROWS * GRID_COLS;
export const plotAt = (r: number, c: number) => r * GRID_COLS + c;

export const TANK_CAPACITY = 200;
export const CHANNEL_COST = 4;
export const TANK_COST = 18;
/** 无水泵时渠网依靠重力自流的每小时基础输水能力（份水） */
export const GRAVITY_FLOW = 24;
/** 每台水泵每小时额外输水能力（单位：份水） */
export const PUMP_FLOW = 12;
/** 每小时每块作物地的基础需水量 */
export const PLOT_DEMAND = 8;
/** 雨天每个接入渠网的田块汇入蓄水池的积水 */
export const RAIN_PER_PLOT = 6;
/** 晴天每小时自然蒸发（在自动供水之外结算） */
export const DRY_LOSS = 8;
export const RAIN_GAIN = 15;

export const nodeId = (r: number, c: number) => `${r}-${c}`;
export const isTank = (n: IrrigationNode) => n.type === "tank";

export const GRID_LABELS: Record<string, string> = {
  tank: "蓄水池",
  channel: "引水渠",
};
