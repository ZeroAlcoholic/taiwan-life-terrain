# 縣市界線圖資來源 (counties.geojson / county-centroids.json)

## 來源

- **資料集**:政府資料開放平臺 dataset 7442「直轄市、縣(市)界線(TWD97經緯度)」
  - 平臺頁面:https://data.gov.tw/dataset/7442
  - 原始提供機關:內政部國土測繪中心(NLSC)
  - 授權:政府資料開放授權條款(Open Government Data License, Taiwan)
- **實際下載檔案**(SHP 格式,經 TGOS 平臺發布):
  - `https://www.tgos.tw/tgos/VirtualDir/Product/1cd4f4c9-6b01-4cf9-bf6c-23a73aa17d24/%E7%9B%B4%E8%BD%84%E5%B8%82%E3%80%81%E7%B8%A3%28%E5%B8%82%29%E7%95%8C%E7%B7%9A1140318.zip`
    (檔名:直轄市、縣(市)界線1140318.zip,內含 `COUNTY_MOI_1140318.shp`,UTF-8)
  - 同資料集另有 GML 版:`https://www.tgos.tw/tgos/VirtualDir/Product/85bc9c19-a076-4d83-8955-eeecf2ebdae8/COUNTY_MOI_1140318_.zip`
- **圖資版本**:1140318(民國 114 年 3 月 18 日 / 2025-03-18 版)
- **取得日期**:2026-06-11
- **原始座標系統**:TWD97 經緯度(GCS_TWD97,GRS80)。TWD97 與 WGS84 在此精度下視為等同,輸出標為 EPSG:4326 / CRS84。

## 處理流程(`convert.py`,Python 3.14 + pyshp 3.0.12 + shapely 2.1.2)

1. 讀取 SHP 的 22 個縣市 MultiPolygon 與屬性(COUNTYNAME / COUNTYENG / COUNTYCODE)。
2. **離島裁切**:僅保留多邊形質心落在 bbox(經度 117.8–122.3、緯度 21.5–26.6)內者,
   排除釣魚臺列嶼(約 123.5°E,宜蘭縣)與南海諸島(東沙、南沙,高雄市);
   保留金門、馬祖(連江)、澎湖、蘭嶼、綠島、小琉球、龜山島、彭佳嶼等。
3. **小島嶼過濾**:面積 < 1.4e-4 平方度(約 1.5 km²)的零碎小島刪除(各縣市最大多邊形必留)。
4. **幾何簡化**:`shapely.coverage_simplify(tolerance=0.0005)`(約 50 公尺,
   Visvalingam/Douglas-Peucker 式之 coverage 簡化)——以「面覆蓋」方式簡化,
   **相鄰縣市共用邊界保持一致**,3D 擠出後縣市之間不會出現縫隙或重疊。
5. 座標以 `set_precision` 對齊 1e-4 度網格後四捨五入至 4 位小數(約 11 公尺),`make_valid` 修復。
6. **質心**:取各縣市最大多邊形之幾何質心;若質心落在多邊形外(細長/凹形,如新北市環繞臺北市),
   改用 `representative_point()` 保證點在多邊形內。

## 輸出與驗證(2026-06-11)

- `data/counties.geojson`:FeatureCollection,22 個 feature,約 487 KB(< 1.5 MB)。
  properties:`name`(官方中文,「臺」字寫法)、`nameEn`、`code`(縣市代碼,如 63000)。
- `data/county-centroids.json`:22 縣市 `{name: [lon, lat]}`,所有點皆驗證落在該縣市多邊形內。
- 驗證:`json.load` 通過;22 縣市齊全;所有幾何 `is_valid`;縣市兩兩相交面積為 0(無重疊);
  整體範圍 lon 118.21–122.01、lat 21.90–26.38。
