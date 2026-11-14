import { ref } from "vue";
import { createClock, createEngine } from "../features/clock";
import { createFields } from "../features/fields";
import { createWarehouse } from "../features/warehouse";
import { createWorkshop } from "../features/workshop";
import { createOrders, salePrice } from "../features/orders";
import { createIrrigation } from "../features/irrigation";
import { items } from "../shared/catalog";
import { saveFarm, loadFarm } from "./persistence";
export function createWorkspace() {
  const notices = ref<string[]>(["欢迎回到青禾农场。先备一份胡萝卜订单吧。"]);
  const notice = (message: string) => {
    notices.value = [message, ...notices.value].slice(0, 12);
  };
  const clock = createClock();
  const warehouse = createWarehouse(() => clock.state.hour, notice);
  const orders = createOrders(warehouse, notice, clock.state.hour);
  const irrigation = createIrrigation(orders.spend, notice);
  const fields = createFields(orders.spend, warehouse.add, notice);
  const workshop = createWorkshop(
    { ...warehouse, spend: orders.spend },
    notice,
  );
  const engine = createEngine(
    () => clock.state.hour,
    clock.setHour,
    (t) => {
      warehouse.tick(t.to);
      // 有限水量先按渠网与优先级逐小时分配，再按实得水结算作物生长
      const flow = irrigation.tick(
        t,
        (plotId) => !!fields.state.plots[plotId]?.crop,
      );
      fields.tick(t, flow.distribution);
      workshop.tick(t.to);
      orders.tick(t.to);
    },
  );
  const snapshot = () => ({
    clock: clock.snapshot(),
    warehouse: warehouse.snapshot(),
    fields: fields.snapshot(),
    workshop: workshop.snapshot(),
    orders: orders.snapshot(),
    irrigation: irrigation.snapshot(),
  });
  return {
    clock,
    warehouse,
    fields,
    workshop,
    orders,
    irrigation,
    engine,
    notices,
    sell(id: string) {
      const item = warehouse.sell(id, 1);
      if (item) {
        orders.earn(salePrice(items[item].value));
        notice(`出售${items[item].name} 1 份`);
      }
    },
    save() {
      try {
        saveFarm(snapshot());
        notice("已保存到本机：渠网、剩余水量与已安装水泵一并存档");
      } catch {
        notice("保存失败，本机空间不足");
      }
    },
    load() {
      try {
        const data = loadFarm<ReturnType<typeof snapshot>>();
        if (!data) {
          notice("还没有本机存档");
          return;
        }
        clock.restore(data.clock);
        warehouse.restore(data.warehouse);
        fields.restore(data.fields);
        workshop.restore(data.workshop);
        orders.restore(data.orders);
        if (data.irrigation) irrigation.restore(data.irrigation);
        notice("已恢复保存时刻，渠网与蓄水状态原样回来");
      } catch {
        notice("存档损坏，无法恢复");
      }
    },
  };
}
