import { reactive, readonly } from "vue";
import type {
  IrrigationFlow,
  IrrigationMode,
  IrrigationNode,
  Notice,
  Tick,
} from "../../../shared/contracts";
import {
  CHANNEL_COST,
  GRID_COLS,
  GRID_ROWS,
  GRAVITY_FLOW,
  PUMP_FLOW,
  TANK_CAPACITY,
  TANK_COST,
  nodeId,
} from "../lib/catalog";
import { planFlow } from "../lib/network";

export interface PumpJob {
  id: string;
  finish: number;
  status: "queued" | "ready" | "claimed";
}
export const PUMP_MATERIALS = 6;
export const PUMP_COST = 12;
export const PUMP_DURATION = 6;
export const MATERIAL_PACK = 8;
export const MATERIAL_PACK_COST = 20;
const START_MATERIALS = 16;
const START_WATER = 60;
const QUEUE_LIMIT = 4;

export function createIrrigation(spend: (n: number) => boolean, notice: Notice) {
  const state = reactive({
    nodes: [] as IrrigationNode[],
    water: START_WATER,
    materials: START_MATERIALS,
    storedPumps: 0,
    pumpJobs: [] as PumpJob[],
    priority: Array.from({ length: GRID_ROWS * GRID_COLS }, (_, i) => i),
    mode: "build" as IrrigationMode,
    buildType: "channel" as "channel" | "tank",
    selected: null as string | null,
    lastFlow: null as IrrigationFlow | null,
    serial: 0,
  });
  const capacity = () =>
    state.nodes.filter((n) => n.type === "tank").length * TANK_CAPACITY;
  const flowCapacity = () =>
    GRAVITY_FLOW +
    state.nodes.reduce((n, node) => n + node.pumps, 0) * PUMP_FLOW;
  const nodeAt = (r: number, c: number) =>
    state.nodes.find((n) => n.r === r && n.c === c);
  return {
    state: readonly(state),
    capacity,
    flowCapacity,
    setMode(mode: IrrigationMode) {
      state.mode = mode;
    },
    setBuildType(type: "channel" | "tank") {
      state.buildType = type;
      state.mode = "build";
    },
    clickCell(r: number, c: number) {
      const existing = nodeAt(r, c);
      if (state.mode === "inspect") {
        state.selected = existing ? nodeId(r, c) : null;
        return;
      }
      if (state.mode === "remove") {
        if (!existing) return;
        if (existing.pumps > 0) {
          notice("该设施上还装着水泵，请先拆卸再拆除");
          return;
        }
        const refund = existing.type === "tank" ? TANK_COST : CHANNEL_COST;
        state.nodes = state.nodes.filter(
          (n) => nodeId(n.r, n.c) !== nodeId(r, c),
        );
        state.materials += refund;
        state.selected = null;
        notice(`已取消铺设，返还 ${refund} 份未安装的建材`);
        return;
      }
      if (existing) {
        notice("这一格已经有设施了，换个位置吧");
        return;
      }
      const cost = state.buildType === "tank" ? TANK_COST : CHANNEL_COST;
      if (state.materials < cost) {
        notice("建材不足，可在下方采购或拆除多余渠道");
        return;
      }
      state.materials -= cost;
      state.nodes.push({
        id: nodeId(r, c),
        type: state.buildType,
        r,
        c,
        pumps: 0,
      });
      notice(
        state.buildType === "tank"
          ? `蓄水池落成，库容 +${TANK_CAPACITY} 份水`
          : "引水渠铺好了，记得与蓄水池连通",
      );
    },
    selectCell(id: string | null) {
      state.selected = id;
    },
    buyMaterials() {
      if (!spend(MATERIAL_PACK_COST)) {
        notice("资金不足，先交付订单或出售收获物");
        return;
      }
      state.materials += MATERIAL_PACK;
      notice(`购入 ${MATERIAL_PACK} 份建材入仓`);
    },
    enqueuePump(hour: number) {
      if (
        state.pumpJobs.filter((j) => j.status === "queued").length >=
        QUEUE_LIMIT
      ) {
        notice("水泵加工队列已满");
        return;
      }
      if (state.materials < PUMP_MATERIALS) {
        notice(`加工水泵需要 ${PUMP_MATERIALS} 份建材`);
        return;
      }
      if (!spend(PUMP_COST)) {
        notice("加工费不足，先挣一笔订单收入");
        return;
      }
      state.materials -= PUMP_MATERIALS;
      const finish =
        Math.max(
          hour,
          ...state.pumpJobs
            .filter((j) => j.status === "queued")
            .map((j) => j.finish),
        ) + PUMP_DURATION;
      state.pumpJobs.push({ id: `p${++state.serial}`, finish, status: "queued" });
      notice("建材已投入工坊，水泵开始加工");
    },
    claimPump(id: string) {
      const job = state.pumpJobs.find((j) => j.id === id);
      if (!job || job.status !== "ready") return;
      job.status = "claimed";
      state.storedPumps += 1;
      notice("水泵完工入库，安装到蓄水池后才会提升供水能力");
    },
    installPump(id: string) {
      const node = state.nodes.find((n) => n.id === id);
      if (!node || node.type !== "tank") {
        notice("水泵只能安装在蓄水池上");
        return;
      }
      if (state.storedPumps <= 0) {
        notice("还没有完工的水泵，先去工坊加工");
        return;
      }
      state.storedPumps -= 1;
      node.pumps += 1;
      notice(`水泵已安装，每小时输水能力提升至 ${GRAVITY_FLOW + node.pumps * PUMP_FLOW} 份`);
    },
    uninstallPump(id: string) {
      const node = state.nodes.find((n) => n.id === id);
      if (!node || node.pumps <= 0) return;
      node.pumps -= 1;
      state.storedPumps += 1;
      notice("水泵已拆卸回库，可改装到其他蓄水池");
    },
    movePriority(plotId: number, dir: -1 | 1) {
      const i = state.priority.indexOf(plotId);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= state.priority.length) return;
      const list = [...state.priority];
      [list[i], list[j]] = [list[j]!, list[i]!];
      state.priority = list;
    },
    /** 逐小时结算：有限水量按优先级分配，雨水汇入蓄水池，返回本小时配水方案 */
    tick(tick: Tick, thirsty: (plotId: number) => boolean): IrrigationFlow {
      const flow = planFlow({
        nodes: state.nodes,
        priority: state.priority,
        water: state.water,
        thirsty,
        weather: tick.weather,
      });
      state.water = Math.max(
        0,
        Math.min(
          capacity(),
          state.water - flow.supplied + flow.rainGained,
        ),
      );
      for (const job of state.pumpJobs)
        if (job.status === "queued" && job.finish <= tick.to)
          job.status = "ready";
      state.lastFlow = flow;
      return flow;
    },
    snapshot: () => {
      const { lastFlow: _omit, ...data } = state;
      return JSON.parse(JSON.stringify(data)) as typeof state;
    },
    restore: (data: typeof state) => {
      Object.assign(state, data, { lastFlow: null, selected: null });
    },
  };
}
