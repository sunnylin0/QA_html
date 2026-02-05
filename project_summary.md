# 專案實作功能與細節文件 (Project Implementation details)

## 1. 專案概述 (Overview)
本系統為一個 **QA 問題回報與修正追蹤系統**，旨在協助測試人員與開發人員有效管理軟體缺陷。系統採用前後端分離架構，前端 HTML5/JS (SPA)，後端使用 Google Apps Script (GAS) 搭配 Google Sheets 作為資料庫。

## 2. 技術架構 (Tech Stack)
*   **Frontend**: HTML5, CSS3, Vanilla JavaScript (SPA Architecture)
    *   **Files**: `index.html` (Entry), `style.css` (Styles), `src/app.js` (Logic)
*   **Backend**: Google Apps Script (Web App)
    *   **File**: `Code.gs`
*   **Database**: Google Sheets
*   **Deployment**:
    *   **Frontend**: GitHub Pages
    *   **Backend**: Google Apps Script Web App

## 3. 已實作功能 (Implemented Features)

### 3.1 使用者驗證 (Simple Auth)
*   **免密碼登入**: 系統僅要求輸入「姓名」即可使用。
*   **狀態記憶**: 使用 `localStorage` 記住使用者姓名。
*   **個人化顯示**: Header 顯示當前使用者，點擊可修改。

### 3.2 問題回報 (Issue Reporting)
*   **回報表單**:
    *   支援欄位：Status (NEW/Fixed/Closed), Module, Function, Code, URL, Description。
    *   **狀態選擇**: 新增時可直接指定狀態 (預設 New)。
*   **最近回報列表 (Recent Reports)**:
    *   **Top 10**: 僅顯示最近 10 筆回報。
    *   **即時搜尋**: 列表上方提供搜尋框，可快速篩選。
    *   **操作按鈕**:
        *   **連結**: 若有 URL，顯示開啟按鈕。
        *   **修改**: 點擊後將資料帶回上方表單進入「編輯模式」。
        *   **刪除**: 直接刪除該筆資料。

### 3.3 修正列表與管理 (Fix List & Management)
*   **清單模式 (Table View)**: 資料以表格方式呈現，清晰易讀。
*   **進階搜尋與篩選**:
    *   **搜尋**: 支援 ID, Module, Description 全文檢索。
    *   **狀態篩選**: New / Fixed / Closed / All。
*   **分頁功能 (Pagination)**:
    *   支援每頁顯示筆數切換 (10/20/50/100)。
    *   上一頁/下一頁切換。
*   **修正視窗 (Fix Modal)**:
    *   **唯讀資訊**: 顯示 Module, Function, Code 以供參考。
    *   **狀態更新**: 修改 Status, Fixer, FixNote。
    *   **連結**: 若有 URL，顯示開啟按鈕。

## 4. 資料庫架構 (Google Sheets Schema)
後端 `Code.gs` 採用動態欄位對應 (Dynamic Column Mapping)，根據 Sheet 第一列標題自動判斷寫入位置。

| Column (Suggested) | Field Name | Description | Note |
| :--- | :--- | :--- | :--- |
| **A** | `ID` | 唯一識別碼 | 自動生成 |
| **B** | `Status` | 狀態 | |
| **C** | `Module` | 模組 | |
| **D** | `Function`| 功能名稱 | |
| **E** | `Code` | 功能代號 | |
| **F** | `Url` | 連結 | |
| **G** | `Reporter`| 通報人 | |
| **H** | `Description` | 問題描述 | |
| **I** | `TimeStamp` | 建立時間 | |
| **J** | `Fixer` | 修正人 | |
| **K** | `FixNote` | 修正說明 | |
| **L** | `FixTime` | 修正時間 | |

## 5. 後端邏輯 (Code.gs)
*   **ID Generation**: 讀取目前最後一列的 ID 並 +1 (或是掃描最大值)，確保 ID 唯一性。
*   **Column Mapping**: 支援中英文標題混用 (例如 "Status" 或 "狀態")。
