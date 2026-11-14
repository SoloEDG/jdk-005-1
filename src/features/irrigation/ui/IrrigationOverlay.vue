<script setup lang="ts">
import { computed } from "vue";
import type {
  IrrigationFlow,
  IrrigationMode,
  IrrigationNode,
} from "../../../shared/contracts";
import { GRID_COLS, GRID_ROWS, nodeId, plotAt } from "../lib/catalog";
import { connectedPlots, downstreamAfterRemoval } from "../lib/network";

const props = defineProps<{
  nodes: readonly Readonly<IrrigationNode>[];
  mode: IrrigationMode;
  selected: string | null;
  lastFlow: Readonly<IrrigationFlow> | null;
  editMode: boolean;
}>();
const emit = defineEmits<{
  cell: [r: number, c: number];
  select: [id: string | null];
}>();

const cells = computed(() => {
  const map = new Map(props.nodes.map((n) => [nodeId(n.r, n.c), n]));
  const connected = new Set(connectedPlots(props.nodes));
  const cutPreview =
    props.mode === "remove" && props.selected
      ? new Set(downstreamAfterRemoval(props.nodes, props.selected))
      : new Set<number>();
  return Array.from({ length: GRID_ROWS * GRID_COLS }, (_, i) => {
    const r = Math.floor(i / GRID_COLS),
      c = i % GRID_COLS,
      id = nodeId(r, c),
      node = map.get(id);
    return {
      r,
      c,
      id,
      node,
      plotId: plotAt(r, c),
      online: connected.has(plotAt(r, c)),
      cut: cutPreview.has(plotAt(r, c)),
      supplied: props.lastFlow?.distribution.get(plotAt(r, c)) ?? 0,
    };
  });
});

function onClick(r: number, c: number, id: string) {
  if (props.editMode) emit("cell", r, c);
  else emit("select", props.selected === id ? null : id);
}
</script>

<template>
  <div class="irrigation-overlay" :class="{ editing: editMode }">
    <button
      v-for="cell in cells"
      :key="cell.id"
      class="irr-cell"
      :class="[
        cell.node?.type ?? 'empty',
        {
          online: cell.online,
          offline: cell.node && !cell.online,
          selected: selected === cell.id,
          'cut-preview': cell.cut,
          flowing: cell.supplied > 0,
        },
      ]"
      :title="
        cell.node
          ? `${cell.node.type === 'tank' ? '蓄水池' : '引水渠'} · ${
              cell.online ? '已通水' : '未连通'
            }${cell.node.pumps ? ` · 水泵×${cell.node.pumps}` : ''}`
          : '空地'
      "
      @click="onClick(cell.r, cell.c, cell.id)"
    >
      <span v-if="cell.node?.type === 'tank'" class="cell-mark">▰</span>
      <span v-else-if="cell.node" class="cell-mark">≈</span>
      <i v-if="cell.node?.pumps" class="pump-badge">⚙{{ cell.node.pumps }}</i>
      <i v-if="cell.cut" class="cut-badge">断</i>
      <i v-else-if="cell.supplied > 0" class="drop-badge">💧</i>
    </button>
  </div>
</template>
