function doGet(e) {
	var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
	var data = sheet.getDataRange().getValues();
	var headers = data[0];
	var rows = data.slice(1);

	var result = rows.map(function (row) {
		var obj = {};
		headers.forEach(function (header, index) {
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
		var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
		var colMap = {};
		headers.forEach(function (h, i) { colMap[h.toString().toLowerCase()] = i; });

		// 輔助函式
		function getColIndex(names) {
			if (!Array.isArray(names)) names = [names];
			for (var i = 0; i < names.length; i++) {
				var k = names[i].toString().toLowerCase();
				if (colMap.hasOwnProperty(k)) return colMap[k];
			}
			return -1;
		}

		if (action === 'create') {
			// ID Generation: 可以改回比較嚴謹的 Max(ID)+1 掃描，
			// 但為了保留 User 可能修改過的 getNextId 邏輯，這裡直接呼叫 getNextId()
			// 若 User 想要更強壯的鎖定機制，建議改回 LockService 版本
			var id = getNextId();
			var timestamp = params.timestamp || new Date().toLocaleString();

			// 建立一個與標題列長度相同的空陣列
			var newRow = new Array(headers.length).fill('');

			// 根據標題名稱填入資料
			// 支援英文與常見中文標題
			var maps = [
				{ key: ['id', 'uuid', '編號'], val: id },
				{ key: ['status', '狀態'], val: params.status || 'New' }, // Updated: Support Status param
				{ key: ['module', '模組', 'module_name'], val: params.module },
				{ key: ['function', 'functionname', '功能', '函式'], val: params.functionName },
				{ key: ['code', '代碼', 'error_code'], val: params.code },
				{ key: ['url', '連結', 'link'], val: params.url },
				{ key: ['reporter', '通報人', 'user'], val: params.reporter },
				{ key: ['description', '描述', 'desc', '問題描述'], val: params.description },
				{ key: ['timestamp', 'time', '時間', '建立時間'], val: timestamp }
			];

			maps.forEach(function (m) {
				var idx = getColIndex(m.key);
				if (idx > -1) newRow[idx] = m.val;
			});

			// 補 0 (Optionally keep user's logic if they added it)
			for (let i = 1; i < newRow.length; i++) {
				if (newRow[i] === undefined) newRow[i] = ""; // Changed 0 to "" for cleaner empty cells
			}

			sheet.appendRow(newRow);
			return responseJSON({
				status: 'success', message: 'Reported successfully', id: id
			});
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
					return responseJSON({ status: 'success', message: 'Deleted successfully', id: id });
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
					return responseJSON({ status: 'success', message: 'Updated successfully', id: id });
				}
			} else {
				return responseJSON({ status: 'error', message: 'ID not found', id: id });
			}
		}
	} catch (err) {
		//return responseJSON({ status: 'error', message: err.toString() });
		// 從 stack 中尋找類似 ":15" 的數字
		const lineMatch = err.stack.match(/:(\d+):/);
		const lineNumber = lineMatch ? lineMatch[1] : "unknown";

		return responseJSON({
			status: 'error',
			message: `${err.toString()} id:${id} (第 ${lineNumber} 行)`,
			id: id
		});
	}
}

function responseJSON(data) {
	return ContentService.createTextOutput(JSON.stringify(data))
		.setMimeType(ContentService.MimeType.JSON);
}

function getNextId() {
	const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
	const lastRow = sheet.getLastRow();

	if (lastRow < 2) return 1;
	const currentMaxId = sheet.getRange(lastRow, 1).getValue();
	return Number(currentMaxId) + 1;
}
