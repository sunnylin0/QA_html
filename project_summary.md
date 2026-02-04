# 專案實作功能與細節文件 (Project Implementation details)

## 1. 專案概述 (Overview)
本系統為一個 **QA 問題回報與修正追蹤系統**，旨在協助測試人員與開發人員有效管理軟體缺陷。系統採用前後端分離架構，前端 Html 5，後端使用 Google Apps Script (GAS) 搭配 Google Sheets 作為資料庫。

## 2. 技術架構 (Tech Stack)
*   **Frontend**: html5
*   **Backend**: Google Apps Script (Web App)
*   **Database**: Google Sheets

## 3. 已實作功能 (Implemented Features)

### 3.1 使用者驗證 (Simple Auth)
*   **免密碼登入**: 系統僅要求輸入「姓名」即可使用。
*   **狀態記憶**: 使用 `localStorage` 記住使用者姓名，重新整理頁面無需再次登入。
*   **個人化顯示**: 
    *   Header 顯示當前使用者姓名。
    *   點擊姓名可隨時修改。
    *   回報問題或修正問題時，自動帶入該姓名。

### 3.2 問題回報 (Issue Reporting)
*   **即時回報表單**: 包含模組、功能名稱、代碼、連結、描述、通報人、時間等欄位。
*   **自動填入**: 
    *   **通報人**: 自動填入當前登入者。
    *   **時間**: 自動帶入當前時間，精確到分。
*   **最近回報列表 (Recent Reports)**:
    *   顯示最後 10 筆回報紀錄。
    *   支援 **複製 (Copy)**: 快速複製舊有問題內容以建立新回報。
    *   支援 **修改 (Edit)**: 直接修改剛剛回報錯誤的內容。
    *   支援 **刪除 (Delete)**: 刪除誤報的項目。

### 3.3 修正列表與管理 (Fix List & Management)
*   **列表檢視**: 支援「卡片模式 (Card View)」與「清單模式 (List View)」切換。
*   **搜尋與篩選**:
    *   **全欄位搜尋**: 可同時搜尋 ID、代碼、模組、描述、修正說明等所有欄位。
    *   **狀態篩選**: 可篩選 `New` (未解決), `Fixed` (已修正), `Closed` (已結案)。
*   **分頁功能 (Pagination)**: 支援設定每頁筆數 (10/20/50/100)，並可切換頁碼。
*   **修正視窗 (Fix Modal)**:
    *   點擊問題可開啟詳細視窗。
    *   若有 **URL 連結**，視窗內會顯示「開啟連結 ↗」按鈕，方便跳轉測試。
    *   **狀態更新**: 可更改狀態 (New -> Fixed)。
    *   **修正資訊**: 填寫修正人員 (自動帶入)、修正說明、修正時間。

## 4. 資料庫架構 (Google Sheets Schema)

系統嚴格定義了 Google Sheet 的欄位對應，確保資料讀寫正確。
**重要**: 後端程式碼 (`Code.gs`) 已設定強制寫入邏輯，請確保 Sheet 標題順序如下：

| Column | Field Name | Description | Note |
| :--- | :--- | :--- | :--- |
| **A** | `ID` | 唯一識別碼 | 取得最後一筆資料的ID，並+1 |
| **B** | `Status` | 狀態 | New, Fixed, Closed |
| **C** | `Module` | 模組 | |
| **D** | `Function`| 功能名稱 | |
| **E** | `Code` | 功能代號 | |
| **F** | `Url` | 連結 | |
| **G** | `Reporter`| 通報人 | |
| **H** | `Description` | 問題描述 | |
| **I** | `TimeStamp` | 建立時間 |
| **J** | `Fixer` | 修正人 |
| **K** | `FixNote` | 修正說明 | 
| **L** | `FixTime` | 修正時間 |


