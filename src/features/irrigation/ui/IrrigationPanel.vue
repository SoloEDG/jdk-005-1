<script setup lang="ts">
import { computed } from "vue";
import type {
  IrrigationFlow,
  IrrigationMode,
  IrrigationNode,
  Plot,
} from "../../../shared/contracts";
import { items } from "../../../shared/catalog";
import {
  CHANNEL_COST,
  GRAVITY_FLOW,
  TANK_CAPACITY,
  TANK_COST,
  PUMP_FLOW,
} from "../lib/catalog";
import { connectedPlots, downstreamAfterRemoval } from "../lib/network";
import {
  PUMP_MATERIALS,
  PUMP_COST,
  PUMP_DURATION,
  MATERIAL_PACK,
  MATERIAL_PACK_COST,
} from "../model/store";
import { queueProgress } from "../../workshop/lib/schedule";

const props = defineProps<{
  nodes: readonly Readonly<IrrigationNode>[];
  materials: number;
  water: number;
  capacity: number;
  flowCapacity: number;
  storedPumps: number;
  pumpJobs: readonly {
    id: string;
    finish: number;
    status: "queued" | "ready" | "claimed";
  }[];
  priority: readonly number[];
  plots: readonly Readonly<Plot>[];
  mode: IrrigationMode;
  buildType: "channel" | "tank";
  selected: string | null;
  lastFlow: Readonly<IrrigationFlow> | null;
  hour: number;
  coins: number;
}>();
const emit = defineEmits<{
  "set-mode": [mode: IrrigationMode];
  "set-build": [type: "channel" | "tank"];
  cell: [r: number, c: number];
  buy: [];
  "enqueue-pump": [];
  "claim-pump": [id: string];
  "install-pump": [id: string];
  "uninstall-pump": [id: string];
  "move-priority": [plotId: number, dir: -1 | 1];
}>();

const selectedNode = computed(() =>
  props.nodes.find((n) => n.id === props.selected) ?? null,
);
const connected = computed(() => connectedPlots(props.nodes));
const cutList = computed(() =>
  props.mode === "remove" && props.selected
    ? downstreamAfterRemoval(props.nodes, props.selected)
    : [],
);
const waterPct = computed(() =>
  props.capacity ? Math.round((props.water / props.capacity) * 100) : 0,
);
const totalPumps = computed(() =>
  props.nodes.reduce((n, node) => n + node.pumps, 0),
);
const activeJobs = computed(() =>
  props.pumpJobs.filter((j) => j.status !== "claimed"),
);
</script>

<template>
  <section class="panel irrigation-panel">
    <div class="panel-heading">
      <h2>引水灌溉</h2>
      <span>渠网连通蓄水池 · 有限水量自动分配</span>
    </div>

    <div class="irr-stats">
      <div>
        <small>蓄水池水量</small>
        <strong>{{ water }} / {{ capacity }} 份</strong>
        <progress :value="waterPct" max="100"></progress>
      </div>
      <div>
        <small>建材库存</small><strong>🧱 {{ materials }}</strong>
      </div>
      <div>
        <small>已装水泵</small><strong>⚙ {{ totalPumps }}</strong
        ><small
          >每小时输水 {{ flowCapacity }} 份（重力 {{ GRAVITY_FLOW }} +
          水泵 {{ totalPumps * PUMP_FLOW }}）</small
        >
      </div>
      <div>
        <small>通水田块</small><strong>{{ connected.length }} 块</strong>
      </div>
    </div>

    <div class="irr-modes">
      <button
        :class="{ active: mode === 'build' && buildType === 'channel' }"
        @click="emit('set-build', 'channel')"
      >
        铺渠 −{{ CHANNEL_COST }} 材
      </button>
      <button
        :class="{ active: mode === 'build' && buildType === 'tank' }"
        @click="emit('set-build', 'tank')"
      >
        蓄水池 −{{ TANK_COST }} 材
      </button>
      <button
        :class="{ active: mode === 'remove' }"
        @click="emit('set-mode', 'remove')"
      >
        拆除返还
      </button>
      <button
        :class="{ active: mode === 'inspect' }"
        @click="emit('set-mode', 'inspect')"
      >
        查看
      </button>
    </div>
    <p class="hint">
      编辑模式下点击场景中的田格铺设或拆除；渠道必须与蓄水池四向连通才会通水，拆除返还尚未安装的建材。
    </p>

    <div v-if="mode === 'remove' && selected" class="cut-preview-box">
      <strong>拆除影响范围</strong>
      <p v-if="cutList.length">
        下游 {{ cutList.length }} 块地将立即断水：
        {{ cutList.map((p) => `#${p + 1}`).join("、") }}
      </p>
      <p v-else class="hint">该设施不在供水路径上，拆除不会中断其他田块。</p>
    </div>

    <div v-if="selectedNode" class="node-card">
      <strong>
        {{ selectedNode.type === "tank" ? "▰ 蓄水池" : "≈ 引水渠" }}
        <small
          >{{ selectedNode.id }} · 田块
          #{{ selectedNode.r * 4 + selectedNode.c + 1 }}</small
        >
      </strong>
      <template v-if="selectedNode.type === 'tank'">
        <small
          >库容 {{ TANK_CAPACITY }} 份 · 已装水泵
          {{ selectedNode.pumps }} 台</small
        >
        <div class="node-actions">
          <button @click="emit('install-pump', selectedNode.id)">
            安装水泵（库存 {{ storedPumps }}）
          </button>
          <button
            :disabled="!selectedNode.pumps"
            @click="emit('uninstall-pump', selectedNode.id)"
          >
            拆回水泵
          </button>
        </div>
      </template>
      <small v-else>渠道只负责输水，水泵需安装在蓄水池上。</small>
    </div>

    <div class="pump-shop">
      <div class="pump-shop-head">
        <strong>⚙ 水泵加工</strong>
        <button @click="emit('enqueue-pump')">
          投料加工（{{ PUMP_MATERIALS }} 材 + ¥{{ PUMP_COST }} ·
          {{ PUMP_DURATION }}h）
        </button>
      </div>
      <p class="hint">
        完工后的水泵先入库存（{{ storedPumps }}
        台），安装到蓄水池才提高每小时供水能力。
      </p>
      <div v-for="job in activeJobs" :key="job.id" class="job-row">
        <span>水泵 <small>{{ job.id }}</small></span>
        <template v-if="job.status === 'queued'">
          <progress
            :value="queueProgress(job.finish, hour, PUMP_DURATION)"
            max="100"
          ></progress>
          <small>还需 {{ job.finish - hour }}h</small>
        </template>
        <button v-else class="primary" @click="emit('claim-pump', job.id)">
          领取水泵
        </button>
      </div>
      <div class="buy-row">
        <button
          :disabled="coins < MATERIAL_PACK_COST"
          @click="emit('buy')"
        >
          采购 {{ MATERIAL_PACK }} 份建材（¥{{ MATERIAL_PACK_COST
          }}，出售收获物所得）
        </button>
      </div>
    </div>

    <div v-if="lastFlow" class="flow-report">
      <strong>上一小时供水</strong>
      <small>
        需求 {{ lastFlow.demand }} 份 · 实供 {{ lastFlow.supplied }} 份
        <template v-if="lastFlow.rainGained">
          · 雨水回蓄 {{ lastFlow.rainGained }} 份</template
        ><template v-if="lastFlow.shortfall">
          · 缺口 {{ lastFlow.shortfall }} 份（按优先级分配）</template
        >
      </small>
    </div>

    <div class="priority-box">
      <div class="panel-heading">
        <h2>田块供水优先级</h2>
        <span>缺水时排在前面的先得水</span>
      </div>
      <div
        v-for="(plotId, i) in priority"
        :key="plotId"
        class="priority-row"
        :class="{ thirsty: plots[plotId]?.crop }"
      >
        <b>{{ i + 1 }}</b>
        <span class="prio-name">
          田块 #{{ plotId + 1 }}
          <template v-if="plots[plotId]?.crop">
            {{ items[plots[plotId]!.crop!.item].icon }}
            水分 {{ Math.round(plots[plotId]!.crop!.water) }}%
          </template>
          <small v-else>空田</small>
        </span>
        <span v-if="connected.includes(plotId)" class="prio-tag online"
          >通水</span
        >
        <span v-else class="prio-tag">未连通</span>
        <span class="prio-btns">
          <button
            :disabled="i === 0"
            @click="emit('move-priority', plotId, -1)"
          >
            ↑
          </button>
          <button
            :disabled="i === priority.length - 1"
            @click="emit('move-priority', plotId, 1)"
            >↓</button
          >
        </span>
      </div>
    </div>
  </section>
</template>
