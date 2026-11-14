# 青禾农场

安装：`npm install`

本地启动：`npm run dev`

Docker 启动：`docker compose -p pinru-jdk005-1113 up --build`，打开 http://localhost:18025 。

## 引水灌溉系统

- 在 4×3 田块网格上铺设**引水渠**与**蓄水池**，渠道与蓄水池四向连通后自动供水；铺设消耗仓库建材，拆除时返还尚未安装的建材。
- 蓄水池水量有限，按**逐小时**结算：同一份水不会复制给每块地。缺水时按玩家在面板中指定的**田块优先级**逐块分配。
- 雨天作物直接喝雨水、不耗蓄水，同时连通地块的积水汇入蓄水池，留到晴天使用。
- 出售收获物所得资金可采购建材；工坊把建材加工成**水泵**，水泵完工领取后安装到蓄水池上，才会提升每小时输水能力（无泵时保留重力自流基础输水）。
- 拆除模式下选中任一设施，立即显示下游断水田块范围；断水后作物仍按实际获得的水分继续生长（零水分时慢速生长并累计胁迫）。
- 保存/恢复时渠网布局、剩余水量、建材与已安装水泵随存档一起回来。

逻辑测试（无头，需先 `npm install`）：

```bash
./node_modules/.bin/esbuild /tmp/irr-test/irrigation.test.ts --bundle --platform=node --format=esm --outfile=/tmp/irr-test/bundle.mjs
node /tmp/irr-test/bundle.mjs
```
