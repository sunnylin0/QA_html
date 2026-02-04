function doGet(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var rows = data.slice(1);
  
  var result = rows.map(function(row) {
    var obj = {};
    headers.forEach(function(header, index) {
      obj[header] = row[index];
    });
    return obj;
  });
  
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  
  try {
    var params = JSON.parse(e.postData.contents);
    var action = params.action;
    
    // 取得標題列並建立映射 (Header Map)
    // 這樣不論欄位順序如何，只要標題名稱對應得到 (不分大小寫)，就能正確寫入
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    var colMap = {};
    headers.forEach(function(h, i) { colMap[h.toString().toLowerCase()] = i; });

    // 輔助函式：根據欄位名稱尋找索引 (支援多種別名)
    function getColIndex(names) {
      if (!Array.isArray(names)) names = [names];
      for (var i = 0; i < names.length; i++) {
        var k = names[i].toString().toLowerCase();
        if (colMap.hasOwnProperty(k)) return colMap[k];
      }
      return -1; // 找不到該欄位
    }

    if (action === 'create') {
      var id = new Date().getTime().toString().slice(-6);
      var timestamp = params.timestamp || new Date().toLocaleString();
      
      // 建立一個與標題列長度相同的空陣列
      var newRow = new Array(headers.length).fill('');
      
      // 根據標題名稱填入資料
      // 支援英文與常見中文標題
      var maps = [
        { key: ['id', 'uuid', '編號'], val: id },
        { key: ['status', '狀態'], val: 'New' },
        { key: ['module', '模組', 'module_name'], val: params.module },
        { key: ['function', 'functionname', '功能', '函式'], val: params.functionName },
        { key: ['code', '代碼', 'error_code'], val: params.code },
        { key: ['url', '連結', 'link'], val: params.url },
        { key: ['reporter', '通報人', 'user'], val: params.reporter },
        { key: ['description', '描述', 'desc', '問題描述'], val: params.description },
        { key: ['timestamp', 'time', '時間', '建立時間'], val: timestamp }
      ];

      maps.forEach(function(m) {
        var idx = getColIndex(m.key);
        if (idx > -1) newRow[idx] = m.val;
      });
      
      sheet.appendRow(newRow);
      return responseJSON({ status: 'success', message: 'Reported successfully' });
    } 
    
    else if (action === 'update' || action === 'delete') {
      var id = params.id;
      var data = sheet.getDataRange().getValues();
      var rowIndex = -1;
      
      // 尋找 ID 所在的欄位
      var idColIdx = getColIndex(['id', 'uuid', '編號']);
      if (idColIdx === -1) idColIdx = 0; // 預設第一欄
      
      // 尋找對應的列 (Row)
      for (var i = 1; i < data.length; i++) {
        if (data[i][idColIdx].toString() === id.toString()) {
          rowIndex = i + 1; // Sheet 列號從 1 開始
          break;
        }
      }
      
      if (rowIndex > 0) {
        if (action === 'delete') {
          sheet.deleteRow(rowIndex);
          return responseJSON({ status: 'success', message: 'Deleted successfully' });
        }
        else if (action === 'update') {
          // 讀取該列目前的所有資料
          var currentRowVals = sheet.getRange(rowIndex, 1, 1, sheet.getLastColumn()).getValues()[0];
          
          // 更新資料的輔助函式
          function updateVal(keys, val) {
            var idx = getColIndex(keys);
            if (idx > -1 && val !== undefined) currentRowVals[idx] = val;
          }

          updateVal(['status', '狀態'], params.status);
          updateVal(['module', '模組'], params.module);
          updateVal(['function', 'functionname', '功能'], params.functionName);
          updateVal(['code', '代碼'], params.code);
          updateVal(['url', '連結'], params.url);
          updateVal(['reporter', '通報人'], params.reporter);
          updateVal(['description', '描述'], params.description);
          
          // 更新修復資訊
          updateVal(['fixer', '處理人'], params.fixer);
          updateVal(['fixnote', 'fix_note', '備註', '處理備註', 'fixnote'], params.fixNote);
          updateVal(['fixtime', 'fix_time', '處理時間'], params.fixTime);

          // 將更新後的整列寫回
          sheet.getRange(rowIndex, 1, 1, sheet.getLastColumn()).setValues([currentRowVals]);
          
          return responseJSON({ status: 'success', message: 'Updated successfully' });
        }
      } else {
        return responseJSON({ status: 'error', message: 'ID not found' });
      }
    }
  } catch (err) {
    return responseJSON({ status: 'error', message: err.toString() });
  }
}

function responseJSON(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
