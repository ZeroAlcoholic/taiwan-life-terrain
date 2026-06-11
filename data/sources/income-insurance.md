# 資料來源說明 — income.json / insurance.json

取得日期:2026-06-11。所有數字皆來自下列官方檔案,無任何推估值(標註「推算」者為由官方原始數字直接相除,公式已註明)。
原始下載檔保存於 `data/raw/`。

---

## A. income.json — 主計總處 家庭收支調查

入口頁:
- 家庭收支調查專區 https://www.stat.gov.tw/cl.aspx?n=2693
- 統計表 https://www.stat.gov.tw/cl.aspx?n=3910
- 113年調查報告統計表 https://www.stat.gov.tw/News_Content.aspx?n=3908&s=235198
- 歷年收支資料-按區域別分 https://www.stat.gov.tw/cp.aspx?n=3984

| 區塊 | 表名 | 檔案 URL | 本地檔 |
|---|---|---|---|
| counties (113年/2024) | 第2表 平均每戶家庭收支按區域別分 | https://ws.dgbas.gov.tw/001/Upload/463/relfile/11530/235198/49.xls | fies113_county_49.xls |
| nationalTrend.dispIncomeHH / savingRate | 歷年第10表 可支配所得、消費支出及儲蓄 | https://ws.dgbas.gov.tw/001/Upload/463/relfile/11530/235198/Year10.xls | fies_year10_income_saving.xls |
| nationalTrend.personsPerHH | 歷年第26表 年中戶數與平均每戶人數、就業人數 | https://ws.dgbas.gov.tw/001/Upload/463/relfile/11530/235198/Year26.xls | fies_year26_hhsize.xls |
| nationalTrend.singlePersonHHpct | 歷年第28表 家庭戶數按戶內人口規模別之分配 | https://ws.dgbas.gov.tw/001/Upload/463/relfile/11530/235198/Year28.xls | fies_year28_hhdist.xls |
| incomeGap | 歷年第4表 戶數五等分位組之所得分配比與所得差距 | https://ws.dgbas.gov.tw/001/Upload/463/relfile/11530/235198/Year04.xls | fies_year04_gap.xls |

### 清理方式
- 縣市表(49.xls):欄位橫向分三區塊(六都/縣/縣市),取「平均每戶人數」(列10)、「可支配所得(平均數)」(列74)、「儲蓄」(列77)。
  - `dispIncomePC` = 可支配所得 ÷ 平均每戶人數(與主計總處「平均每人可支配所得」同法;全國 419,139 元與官方公布 41.9 萬一致)。
  - `savingRate` = 儲蓄 ÷ 可支配所得 × 100。`savingHH` = 平均每戶儲蓄(元)。
- 歷年表:以西元年欄對齊,nationalTrend 取 1990(民79)–2024(民113);incomeGap 收錄全部年份 1964–2024(早年非逐年調查,以 years 陣列明示)。
- 金額皆為新臺幣「元」,未換算。

### 覆蓋範圍與缺漏
- **僅 20 縣市**:主計總處家庭收支調查涵蓋「臺灣地區」(本島+澎湖)20 縣市;**金門縣、連江縣**由縣府自辦調查、不在主計總處統計表內,網路上查無 113 年官方數字可直接驗證,依「絕不編造」原則從缺(meta.notes 已註明)。
- 交叉驗證:113年全國每戶可支配所得 1,165,206 元、每人 41.9 萬、新竹市 150.3 萬居冠、臺北市 148.5 萬次之、五等分位差距倍數 6.14 — 均與主計總處/媒體報導之官方數字一致。

---

## B. insurance.json — 壽險市場指標

| 區塊 | 來源 | URL | 本地檔 |
|---|---|---|---|
| coverageRate / penetration / density (2002–2024/2025) | 保發中心「保險密度、滲透度及人壽保險投保率表」(政府資料開放平臺 dataset 13514) | https://openapi.tii.org.tw/TIIOPENDATA/API/CSV_EXPORT?TableID=I03 / https://data.gov.tw/dataset/13514 | tii_I03_density_penetration.csv |
| coverageRate 2000–2001 補點 | 壽險公會「人壽保險業歷年人壽保險及年金保險投保率與普及率」(民52–113年) | https://www.lia-roc.org.tw/storage/uploads/68dca16d1ff7c.pdf | lia_coverage_history.pdf |
| newPremiumMix (2025、2024) | 壽險公會「114年1~12月壽險業績統計」新聞稿 | https://www.lia-roc.org.tw/storage/uploads/6969f36bda5f0.pdf | lia_114_full_year_stats.pdf |
| facts 平均保額(推算) | 壽險公會「民國113年與112年人壽保險業業績比較表」 | https://www.lia-roc.org.tw/storage/uploads/68dca11913d0b.pdf | lia_business_compare.pdf |

壽險公會統計頁入口:https://www.lia-roc.org.tw/?catg_id=10 (壽險統計資料)、業績統計 https://www.lia-roc.org.tw/list_article?article_content=36

### 清理方式
- **coverageRate**(人壽保險及年金保險投保率,%):2000–2001 取自壽險公會歷年表(民89=121.41、民90=135.40),2002 起取保發中心 CSV;重疊年份兩來源完全一致。2025 年保發中心尚未公布投保率,序列止於 2024(262.68%)。
- **penetration**(人身保險滲透度=人身保險業保費收入/GDP,%)、**density**(人身保險密度=每人平均保費支出,元):取保發中心 CSV「人身保險」欄,2002–2025(2025:9.14%、112,620 元)。
- **newPremiumMix**:壽險公會新聞稿之「各險別初年度保費收入統計表」(保費收入口徑,不含 IFRS4 歸類為負債之投資合約收入);百萬元 × 1,000,000 換算為元。2025 總額 7,755.88 億;壽險占 88.5%(傳統 5,192.19 億+投資型 1,671.49 億)、健康險 5.6%、年金險 3.9%、傷害險 2.0%。並附 2024(113年)對照。
- **平均保額推算**:壽險公會業績比較表保額單位經交叉驗證為「萬元」(個人+團體壽險 53.2 兆+年金 2.64 兆=55.84 兆,與歷年投保率表 113 年保額 55,835,769 百萬元完全吻合)。
  - 個人壽險新契約平均保額 = 2兆2,195.48億 ÷ 1,664,795 件 ≈ 1,333,226 元。
  - 個人壽險有效契約平均保額 = 48兆5,036.4億 ÷ 53,392,105 件 ≈ 908,442 元。

### 缺漏(查證未過,依指示略過)
- **國人平均死亡給付**(常被引用「平均身故給付僅約 5、60 萬元」):僅見於媒體(現代保險雜誌等)轉述「壽險公會統計」,壽險公會/保發中心/金管會公開檔案中查無可直接驗證的一手死亡給付件數與金額統計表(保發中心開放資料 I01–I30 亦無),故未收錄。
- 投保率 2025 年值:保發中心尚未公布。

### 其他查核過的入口(未直接取數)
- 金管會保險局統計資料 https://www.ib.gov.tw/ch/home.jsp?id=48&parentpath=0,4
- 保發中心保險財務業務統計 https://www.tii.org.tw/tii/information/information1/000001.html (HTTPS 憑證問題無法直接抓取,改用其開放資料 API)
- 人身保險業保費收入月報(總保費,非初年度) https://data.gov.tw/dataset/104113 (TableID=I10)
