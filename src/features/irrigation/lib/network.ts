import type { IrrigationNode, IrrigationFlow } from "../../../shared/contracts";
import {
  GRID_COLS,
  GRID_ROWS,
  GRAVITY_FLOW,
  PLOT_COUNT,
  PUMP_FLOW,
  PLOT_DEMAND,
  RAIN_PER_PLOT,
  nodeId,
  plotAt,
} from "./catalog";

const neighborCoords = (r: number, c: number): [number, number][] =>
  ([
    [r - 1, c],
    [r + 1, c],
    [r, c - 1],
    [r, c + 1],
  ] as [number, number][]).filter(
    ([nr, nc]) => nr >= 0 && nr < GRID_ROWS && nc >= 0 && nc < GRID_COLS,
  );

/** 每个网格节点对应一块田（同坐标），田块通过节点接入渠网 */
export function connectedPlots(nodes: readonly IrrigationNode[]): number[] {
  const map = new Map(nodes.map((n) => [nodeId(n.r, n.c), n]));
  const tanks = nodes.filter((n) => n.type === "tank");
  const seen = new Set<string>();
  const queue: IrrigationNode[] = [];
  for (const t of tanks) {
    seen.add(nodeId(t.r, t.c));
    queue.push(t);
  }
  while (queue.length) {
    const cur = queue.shift()!;
    for (const [nr, nc] of neighborCoords(cur.r, cur.c)) {
      const id = nodeId(nr, nc);
      if (seen.has(id) || !map.has(id)) continue;
      seen.add(id);
      queue.push(map.get(id)!);
    }
  }
  return nodes
    .filter((n) => seen.has(nodeId(n.r, n.c)))
    .map((n) => plotAt(n.r, n.c))
    .filter((id) => id < PLOT_COUNT)
    .sort((a, b) => a - b);
}

/**
 * 假设移除某节点后，哪些原本在网内的田块会立刻断水。
 * 用于拆渠时即时显示断水范围。
 */
export function downstreamAfterRemoval(
  nodes: readonly IrrigationNode[],
  targetId: string,
): number[] {
  const before = new Set(connectedPlots(nodes));
  const remaining = nodes.filter((n) => nodeId(n.r, n.c) !== targetId);
  const after = new Set(connectedPlots(remaining));
  return [...before].filter((p) => !after.has(p));
}

export interface FlowInput {
  nodes: readonly IrrigationNode[];
  /** 玩家指定的田块优先级，下标小者先得水 */
  priority: readonly number[];
  water: number;
  /** 仅对有作物且需要水的田块配水 */
  thirsty: (plotId: number) => boolean;
  weather: string;
}

/**
 * 有限水量逐小时分配：同一份水不会复制给每块地。
 * 先按连通关系确定受水田块，再按玩家优先级逐块扣减蓄水池水量，
 * 每块地最多补到 PLOT_DEMAND；重力自流提供基础输水能力，水泵再行提升。
 * 雨天作物直接喝雨水，不消耗蓄水，同时全部连通地块把积水汇入蓄水池。
 */
export function planFlow(input: FlowInput): IrrigationFlow {
  const { nodes, priority, water, thirsty, weather } = input;
  const connected = connectedPlots(nodes);
  const rainGained =
    weather === "rain" ? connected.length * RAIN_PER_PLOT : 0;
  if (weather === "rain") {
    return {
      distribution: new Map(),
      connected,
      demand: 0,
      supplied: 0,
      rainGained,
      shortfall: 0,
    };
  }
  const demanders = connected.filter(thirsty);
  const pumps = nodes.reduce((n, node) => n + node.pumps, 0);
  const capacity = GRAVITY_FLOW + pumps * PUMP_FLOW;
  const ordered = [
    ...priority.filter((p) => demanders.includes(p)),
    ...demanders.filter((p) => !priority.includes(p)),
  ];
  const distribution = new Map<number, number>();
  let budget = water;
  let pipeLeft = capacity;
  let demand = 0;
  for (const plot of ordered) {
    const want = PLOT_DEMAND;
    demand += want;
    const give = Math.min(want, budget, pipeLeft);
    if (give > 0) {
      distribution.set(plot, give);
      budget -= give;
      pipeLeft -= give;
    }
  }
  const supplied = [...distribution.values()].reduce((n, v) => n + v, 0);
  return {
    distribution,
    connected,
    demand,
    supplied,
    rainGained,
    shortfall: Math.max(0, demand - supplied),
  };
}
