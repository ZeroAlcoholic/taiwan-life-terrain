# 臺灣壽險市場地形劇場
**Life Insurance Terrain Theater · Taiwan** — 以官方公開資料推演人口、家庭、所得結構如何重塑壽險市場的 3D 戰情劇場式資料敘事網頁。

靈感:[関ヶ原山水図屏風](https://sekigahara.tenz.net/) 的 3D 戰情推演風格。

## 快速開始
純前端靜態網站,任一靜態伺服器即可:

```powershell
python -m http.server 8123
# 瀏覽 http://localhost:8123/
```

> 需以 http(s) 開啟(ES Modules + fetch),直接雙擊 index.html 無法執行。
> Three.js 已 vendor 在本地;字型(Noto Serif TC / LXGW WenKai TC / IBM Plex Mono)由 CDN 載入,離線時自動退回系統字型。

## 操作
| 操作 | 說明 |
|---|---|
| 空白鍵 / ⏸ | 播放、暫停 |
| 1× 按鈕 | 播放倍速 1× / 1.5× / 2× |
| ← → | 前後跳 5 秒 |
| 拖曳時間軸、點章節 | 跳轉 |
| 滑鼠拖曳/滾輪 | 自由旋轉縮放(自動運鏡會暫讓,閒置 4.5 秒後接手) |
| 🎥 | 自動運鏡開關 |
| 滑鼠懸停縣市 | 即時情報面板 |

## 七幕結構(全長 90 秒)
序章 開戰前夜 → 第一章 人口之峰(1990–2025 總人口、2019 峰頂、2020 死亡交叉)→ 第二章 高齡前線(65+ 比率擴散、「最老的竟是首都」)→ 第三章 家的縮影(戶量 4.19→2.78 人、單人戶 15.6%)→ 第四章 財富山脈(每戶可支配所得、投保率 262% vs 平均保額 91 萬)→ 第五章 未來推演 2070(國發會中推估 + 縣市情境模擬)→ 終章 三大戰場(高齡鄉縣/財富高峰/青壯新城)。

## 資料層級(差異化顯示)
- **實際資料**(金色實線徽章):戶政司、主計總處、壽險公會/保發中心公布數
- **官方推估**(青磁虛線徽章):國發會人口推估(中/高/低)
- **情境推演**(緋紅閃爍徽章):本專案以縣市近十年老化速度線性外推、向全國中推估收斂之模擬,僅供策略討論

來源清單與清理方式詳見 `data/sources/*.md`,頁面右下「資料來源」亦可查看。

## 專案結構
```
index.html              入口
assets/css/main.css     戰情室視覺系統
assets/js/
  app.js                開機、資料載入、控制綁定、主迴圈
  scene.js              Three.js 舞台(縣市擠出地形、光影、特效、拾取)
  geo.js                經緯度投影、GeoJSON → Shape
  director.js           播放引擎(章節、cue、自動運鏡)
  script.js             七幕劇本(敘事、運鏡軌、資料綁定)
  hud.js                DOM 介面(字卡、戰報、時間軸、迷你圖)
data/*.json             清理後的官方資料
data/sources/*.md       逐系列來源紀錄
data/raw/, raw/         原始官方檔案留存(部署時可排除)
vendor/                 three.module.js / OrbitControls.js(本地)
test-map.html           3D 地圖獨立測試頁(部署時可排除)
```

## 部署到 GitHub Pages
已附 `.nojekyll` 與 `.gitignore`(自動排除 `raw/`、`work/`、`data/raw/` 等大型原始檔;`data/*.json` 與 `data/sources/` 會一併上傳,總量 < 1 MB)。

```powershell
cd D:\Python\taiwan-life-terrain
git init && git add . && git commit -m "Taiwan life insurance terrain theater"
git branch -M main
git remote add origin https://github.com/<帳號>/<repo>.git
git push -u origin main
```
然後到 repo **Settings → Pages → Source: Deploy from a branch → main / (root)**,
數分鐘後即可在 `https://<帳號>.github.io/<repo>/` 觀看。全站皆相對路徑,放子路徑也能跑。

其他靜態主機(Netlify / Vercel / 公司內網)同樣直接丟資料夾即可。
