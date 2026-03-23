/**
 * QA System Application Logic
 */
const App = {
	// === Config ===
	// 請確保此 URL 是您最新部署 (Versioned or Dev) 的網址
	API_URL: "https://script.google.com/macros/s/AKfycbwjrflOu7-styIQTlkKM_Fk--bxJrDZT8w61GTA8ei2uvnL4tZQsm2cfhLx2ycqwHNcgA/exec",
	// === State ===
	state: {
		currentUser: localStorage.getItem('qa_user') || 'Guest',
		data: [],
		filteredData: [],
		itemsPerPage: 20,
		currentPage: 1,
		filterStatus: 'All',
		searchQuery: '',

		// Report Tab State
		reportSearchQuery: '',
		isEditingReport: false
	},

	// === Initialization ===
	async init() {
		this.updateUserDisplay();
		this.bindEvents();
		await this.fetchData();
		this.checkAutoOpen();

		// 每 5 分鐘背景自動更新一次 (300,000 毫秒)
		setInterval(() => {
			this.backgroundFetchData();
		}, 5 * 60 * 1000);
	},

	checkAutoOpen() {
		const urlParams = new URLSearchParams(window.location.search);
		const autoUrl = urlParams.get('url');
		const funName = urlParams.get('funName');
		const moduleName = urlParams.get('moduleName');

		if (autoUrl) {
			// Extract filename without extension (e.g. AA3101)
			let code_fileName = autoUrl;
			let fileName = autoUrl;
			try {
				let pathStr = autoUrl;
				// If it's a full URL, get just the pathname
				if (autoUrl.startsWith('http')) {
					const urlObj = new URL(autoUrl);
					pathStr = urlObj.pathname;
				}
				const pathParts = pathStr.split('/');
				const lastPart = pathParts[pathParts.length - 1]; // "AA3101.aspx"
				fileName = lastPart.split('.')[0] || lastPart; // "AA3101"
				const code = funName.substring(0, 4); //AC30 各月收入統計表(AA31) -> "AC30"
				code_fileName = code + "_" + fileName; // "AC30_AA3101"
			} catch (e) {
				console.warn('URL Parse error', e);
			}

			const item = this.state.data.find(d => {
				const map = this.getItemMap(d);
				return map.code === code_fileName;
			});

			if (item) {
				this.switchTab('list');
				this.openModal(item);
			} else {
				this.switchTab('report');
				document.getElementById('r_code').value = code_fileName;
				document.getElementById('r_url').value = autoUrl;
				if (funName) {
					document.getElementById('r_function').value = funName;
				}
				if (moduleName) {
					document.getElementById('r_module').value = moduleName;
				}
			}
		}
	},

	closeExtension() {
		// Send message to top window to close the iframe
		window.top.postMessage({ action: 'qa_tracker_close' }, '*');
	},

	bindEvents() {
		document.getElementById('reportForm').addEventListener('submit', (e) => {
			e.preventDefault();
			this.handleReportSubmit();
		});

		document.getElementById('fixForm').addEventListener('submit', (e) => {
			e.preventDefault();
			this.handleFixSubmit();
		});

		document.getElementById('fixModal').addEventListener('click', (e) => {
			if (e.target.id === 'fixModal') this.closeModal();
		});

		document.addEventListener('keydown', (e) => {
			if (e.key === 'Escape') {
				// Only close extension if fixModal is NOT active, or fallback
				const modal = document.getElementById('fixModal');
				if (modal.classList.contains('active')) {
					this.closeModal();
				} else {
					this.closeExtension();
				}
			}
		});

		// Global Event Delegation for MV3 `data-cmd`
		document.addEventListener('click', (e) => {
			const target = e.target.closest('[data-cmd]');
			if (target) {
				const cmd = target.getAttribute('data-cmd');
				const arg = target.getAttribute('data-arg');
				console.log("[QA Tracker] Clicked cmd:", cmd, "arg:", arg);
				if (cmd === 'openLink') window.open(arg, '_blank');
				else if (typeof App[cmd] === 'function') App[cmd](arg);
			}
		});

		document.addEventListener('input', (e) => {
			const target = e.target.closest('[data-input-cmd]');
			if (target && typeof App[target.getAttribute('data-input-cmd')] === 'function') {
				console.log("[QA Tracker] Input cmd:", target.getAttribute('data-input-cmd'));
				App[target.getAttribute('data-input-cmd')](target.value);
			}
		});

		document.addEventListener('change', (e) => {
			const target = e.target.closest('[data-change-cmd]');
			if (target) {
				const cmd = target.getAttribute('data-change-cmd');
				console.log("[QA Tracker] Change cmd:", cmd);
				if (cmd === 'checkStatusColor') App.checkStatusColor(target);
				else if (typeof App[cmd] === 'function') App[cmd](target.value);
			}
		});
	},

	// === Navigation ===
	switchTab(tabName) {
		document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
		document.querySelectorAll('.nav-links button').forEach(el => el.classList.remove('active'));

		document.getElementById(`tab-${tabName}`).classList.add('active');
		const btnIndex = tabName === 'report' ? 0 : 1;
		document.querySelectorAll('.nav-links button')[btnIndex].classList.add('active');
	},

	// === User Auth ===
	updateUserDisplay() {
		document.getElementById('userNameDisplay').textContent = this.state.currentUser;
	},

	editUser() {
		const newName = prompt("請輸入您的姓名：", this.state.currentUser);
		if (newName && newName.trim()) {
			this.state.currentUser = newName.trim();
			localStorage.setItem('qa_user', this.state.currentUser);
			this.updateUserDisplay();
		}
	},

	// === Data Fetching ===
	async backgroundFetchData() {
		try {
			console.log("[QA Tracker] Background fetching fresh data...");
			const res = await fetch(this.API_URL);
			const data = await res.json();
			const newData = data.reverse();
			
			const cacheKey = 'qa_data_cache';
			const cacheTimeKey = 'qa_data_cache_time';
			
			// 背景自動下載寫入 session
			sessionStorage.setItem(cacheKey, JSON.stringify(newData));
			sessionStorage.setItem(cacheTimeKey, new Date().getTime().toString());
			
			// 如果使用者當下沒有在編輯，順便幫他更新 UI
			if (!this.state.isEditingReport) {
				const modal = document.getElementById('fixModal');
				if (modal && !modal.classList.contains('active')) {
					this.state.data = newData;
					this.applyFilter();
					this.renderRecentReports();
				}
			}
		} catch (err) {
			console.warn("[QA Tracker] Background fetch failed:", err);
		}
	},

	async fetchData(forceRefresh = false) {
		this.showLoading(true);
		try {
			const cacheKey = 'qa_data_cache';
			const cacheTimeKey = 'qa_data_cache_time';
			const cacheExpiry = 5 * 60 * 1000; // 5 minutes

			if (!forceRefresh) {
				const cachedData = sessionStorage.getItem(cacheKey);
				const cachedTime = sessionStorage.getItem(cacheTimeKey);

				if (cachedData && cachedTime) {
					const now = new Date().getTime();
					if (now - parseInt(cachedTime, 10) < cacheExpiry) {
						console.log("[QA Tracker] Using cached data from sessionStorage.");
						this.state.data = JSON.parse(cachedData);
						this.applyFilter();
						this.renderRecentReports();
						return;
					}
				}
			}

			console.log("[QA Tracker] Fetching fresh data from API_URL.");
			const res = await fetch(this.API_URL);
			const data = await res.json();
			this.state.data = data.reverse(); // Newest first

			sessionStorage.setItem(cacheKey, JSON.stringify(this.state.data));
			sessionStorage.setItem(cacheTimeKey, new Date().getTime().toString());

			this.applyFilter();
			this.renderRecentReports();
		} catch (err) {
			console.error(err);
			alert("讀取資料失敗，請檢查網路或是 GAS URL");
		} finally {
			this.showLoading(false);
		}
	},

	async postData(payload) {
		this.showLoading(true);
		try {
			const res = await fetch(this.API_URL, {
				method: "POST",
				body: JSON.stringify(payload)
			});
			return await res.json();
		} finally {
			this.showLoading(false);
		}
	},

	showLoading(show) {
		const el = document.getElementById('globalLoading');
		if (show) el.classList.add('loading');
		else el.classList.remove('loading');
	},

	getItemMap(item) {
		return {
			id: item.ID || item.id || item['編號'],
			mod: item.Module || item.module || item['模組'],
			func: item.Function || item.function || item['功能'],
			code: item.Code || item.code || item['代碼'],
			url: item.Url || item.url || item['連結'],
			desc: item.Description || item.description || item['描述'],
			time: item.Timestamp || item.timestamp || item['時間'],
			status: item.Status || item.status || 'New',
			reporter: item.Reporter || item.reporter || 'Unknown',
			fixer: item.Fixer || item.fixer || '',
			fixNote: item.FixNote || item.fixNote || ''
		};
	},

	// === Report Logic ===

	// Switch Report Form to Edit Mode
	editReport(id) {
		const item = this.state.data.find(d => {
			const map = this.getItemMap(d);
			return map.id.toString() === id.toString();
		});

		if (!item) return;
		const map = this.getItemMap(item);

		// Fill form
		document.getElementById('r_id').value = map.id;
		document.getElementById('r_status').value = map.status || 'New';
		document.getElementById('r_module').value = map.mod || '';
		document.getElementById('r_function').value = map.func || '';
		document.getElementById('r_code').value = map.code || '';
		document.getElementById('r_url').value = map.url || '';
		document.getElementById('r_description').value = map.desc || '';

		// UI State
		this.state.isEditingReport = true;
		document.getElementById('reportFormTitle').textContent = `修改回報 #${map.id}`;
		document.getElementById('r_submitBtn').textContent = "儲存修改";
		document.getElementById('r_cancelBtn').style.display = 'inline-flex';

		// Scroll to top
		document.getElementById('tab-report').scrollIntoView({ behavior: 'smooth' });
	},

	cancelReportEdit() {
		document.getElementById('reportForm').reset();
		document.getElementById('r_id').value = '';
		document.getElementById('r_status').value = 'New';

		this.state.isEditingReport = false;
		document.getElementById('reportFormTitle').textContent = "新增回報";
		document.getElementById('r_submitBtn').textContent = "提交回報";
		document.getElementById('r_cancelBtn').style.display = 'none';
	},

	async handleReportSubmit() {
		const id = document.getElementById('r_id').value;
		const isUpdate = !!id; // If ID exists, it's an update

		const payload = {
			action: isUpdate ? 'update' : 'create',
			id: id, // ignore if create
			status: document.getElementById('r_status').value, // Add status
			module: document.getElementById('r_module').value,
			functionName: document.getElementById('r_function').value,
			code: document.getElementById('r_code').value,
			url: document.getElementById('r_url').value,
			description: document.getElementById('r_description').value,
			timestamp: new Date().toLocaleDateString('zh-TW'),
			reporter: this.state.currentUser
		};

		const res = await this.postData(payload);
		if (res.status === 'success') {
			alert(isUpdate ? "修改成功！" : `回報成功！ID: ${res.id}`);
			this.cancelReportEdit(); // Reset form
			this.fetchData(true);
		} else {
			alert("操作失敗: " + res.message);
		}
	},

	handleReportSearch(val) {
		this.state.reportSearchQuery = val.toLowerCase();
		this.renderRecentReports();
	},

	renderRecentReports() {
		const tbody = document.getElementById('recentReportBody');
		tbody.innerHTML = '';

		let list = this.state.data;
		if (this.state.reportSearchQuery) {
			list = list.filter(item => Object.values(item).join(' ').toLowerCase().includes(this.state.reportSearchQuery));
		}

		// Limit to 10
		const recent = list.slice(0, 10);

		if (recent.length === 0) {
			tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:1rem;">尚無資料</td></tr>';
			return;
		}

		recent.forEach(item => {
			const tr = document.createElement('tr');
			const map = this.getItemMap(item);

			const shortDesc = (map.desc && map.desc.length > 30) ? map.desc.substring(0, 30) + '...' : map.desc;
			const shortTime = map.time ? map.time.split(' ')[0] : '-';
			const linkBtn = map.url && map.url.startsWith('http')
				? `<button class="btn btn-sm btn-secondary" data-cmd="openLink" data-arg="${map.url}">連結</button>`
				: '';

			// Edit uses editReport now
			tr.innerHTML = `
                <td>#${map.id}</td>
                <td><span class="badge status-${map.status}">${map.status}</span></td>
                <td>${map.mod || ''}</td>
                <td>${map.func || ''}</td>
                <td title="${map.desc}">${shortDesc}</td>
                <td style="font-size:0.8rem; color:#94a3b8;">${shortTime}</td>
                <td style="text-align:right;">
                    ${linkBtn}
                    <button class="btn btn-sm btn-info" data-cmd="copyReport" data-arg="${map.id}">複製</button>
                    <button class="btn btn-sm btn-secondary" data-cmd="editReport" data-arg="${map.id}">修改</button>
                    <button class="btn btn-sm btn-danger" data-cmd="deleteData" data-arg="${map.id}">刪除</button>
                </td>
            `;
			tbody.appendChild(tr);
		});
	},

	// Copy Report to Form (New Record)
	copyReport(id) {
		const item = this.state.data.find(d => {
			const map = this.getItemMap(d);
			return map.id.toString() === id.toString();
		});

		if (!item) return;
		const map = this.getItemMap(item);

		// Fill form, but keep ID empty for new record
		document.getElementById('r_id').value = '';
		document.getElementById('r_status').value = 'New';
		document.getElementById('r_module').value = map.mod || '';
		document.getElementById('r_function').value = map.func || '';
		document.getElementById('r_code').value = map.code || '';
		document.getElementById('r_url').value = map.url || '';
		document.getElementById('r_description').value = map.desc || '';

		// UI State - Ensure it looks like "New Report"
		this.state.isEditingReport = false;
		document.getElementById('reportFormTitle').textContent = "新增回報 (已帶入資料)";
		document.getElementById('r_submitBtn').textContent = "提交回報";
		document.getElementById('r_cancelBtn').style.display = 'inline-flex';
		document.getElementById('r_cancelBtn').textContent = "清除重填"; // Change text contextually? Or just keep "Cancel Edit" behavior which clears form.
		// Actually App.cancelReportEdit() clears everything. Let's keep it simple.

		// Scroll to top
		document.getElementById('tab-report').scrollIntoView({ behavior: 'smooth' });
	},

	// === Fix List Logic ===

	handleSearch(val) {
		this.state.searchQuery = val.toLowerCase();
		this.state.currentPage = 1;
		this.applyFilter();
	},

	handleFilter() {
		this.state.filterStatus = document.getElementById('statusFilter').value;
		this.state.currentPage = 1;
		this.applyFilter();
	},

	changePageSize(size) {
		this.state.itemsPerPage = parseInt(size);
		this.state.currentPage = 1;
		this.applyFilter();
	},

	prevPage() {
		if (this.state.currentPage > 1) {
			this.state.currentPage--;
			this.renderList();
			this.updatePagination();
		}
	},

	nextPage() {
		const totalPages = Math.ceil(this.state.filteredData.length / this.state.itemsPerPage);
		if (this.state.currentPage < totalPages) {
			this.state.currentPage++;
			this.renderList();
			this.updatePagination();
		}
	},

	refreshData() { this.fetchData(true); },

	applyFilter() {
		const { data, searchQuery, filterStatus } = this.state;

		this.state.filteredData = data.filter(item => {
			const map = this.getItemMap(item);
			if (filterStatus !== 'All' && map.status !== filterStatus) return false;
			if (!searchQuery) return true;
			return Object.values(item).join(' ').toLowerCase().includes(searchQuery);
		});

		this.updatePagination();
		this.renderList();

		const start = (this.state.currentPage - 1) * this.state.itemsPerPage + 1;
		const end = Math.min(this.state.currentPage * this.state.itemsPerPage, this.state.filteredData.length);
		const total = this.state.filteredData.length;

		document.getElementById('recordCount').textContent = total > 0 ? `顯示 ${start} - ${end} 筆 (共 ${total} 筆)` : '無資料';
	},

	renderList() {
		const tbody = document.getElementById('fixListBody');
		tbody.innerHTML = '';

		const start = (this.state.currentPage - 1) * this.state.itemsPerPage;
		const end = start + this.state.itemsPerPage;
		const pageData = this.state.filteredData.slice(start, end);

		if (pageData.length === 0) {
			tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:2rem;">沒有符合的資料</td></tr>';
			return;
		}

		pageData.forEach(item => {
			const map = this.getItemMap(item);
			const tr = document.createElement('tr');

			const linkBtn = map.url && map.url.startsWith('http')
				? `<button class="btn btn-sm btn-secondary" data-cmd="openLink" data-arg="${map.url}">開啟</button>`
				: '<span style="color:#64748b; font-size:0.8rem;">無連結</span>';

			tr.innerHTML = `
                <td>#${map.id}</td>
                <td><span class="badge status-${map.status}">${map.status}</span></td>
                <td>${map.mod}</td>
                <td>${map.func}</td>
                <td>${map.desc}</td>
                <td>${map.reporter}</td>
                <td style="text-align:right;">
                    ${linkBtn}
                    <button class="btn btn-sm btn-secondary" data-cmd="openModalById" data-arg="${map.id}">編輯</button>
                </td>
            `;
			tbody.appendChild(tr);
		});
	},

	updatePagination() {
		const totalPages = Math.ceil(this.state.filteredData.length / this.state.itemsPerPage);
		document.getElementById('pageInfo').textContent = `Page ${this.state.currentPage} / ${totalPages || 1}`;
	},

	// === Modal & Actions ===

	openModalById(id) {
		const item = this.state.data.find(d => {
			const map = this.getItemMap(d);
			return map.id.toString() === id.toString();
		});
		if (item) this.openModal(item);
	},

	openModal(item) {
		const modal = document.getElementById('fixModal');
		const map = this.getItemMap(item);

		document.getElementById('edit_id').value = map.id;
		document.getElementById('edit_status').value = map.status;

		// Populate additional info
		document.getElementById('edit_module').value = map.mod || ''; // Readonly field
		document.getElementById('edit_function').value = map.func || ''; // Readonly field
		document.getElementById('edit_code').value = map.code || ''; // Readonly field
		document.getElementById('edit_url').value = map.url || ''; // Readonly field

		document.getElementById('edit_fixer').value = map.fixer || this.state.currentUser;
		document.getElementById('edit_fixNote').value = map.fixNote;

		document.getElementById('edit_desc_display').textContent = map.desc;

		const linkContainer = document.getElementById('linkContainer');
		if (map.url && map.url.startsWith('http')) {
			linkContainer.style.display = 'block';
			document.getElementById('edit_link').href = map.url;
		} else {
			linkContainer.style.display = 'none';
		}

		modal.classList.add('active');
	},

	closeModal() {
		document.getElementById('fixModal').classList.remove('active');
	},

	async handleFixSubmit() {
		const payload = {
			action: 'update',
			id: document.getElementById('edit_id').value,
			status: document.getElementById('edit_status').value,
			fixer: localStorage.getItem('qa_user') || 'Guest',
			fixNote: document.getElementById('edit_fixNote').value,
			fixTime:  new Date().toLocaleDateString('zh-TW')
		};

		const res = await this.postData(payload);
		if (res.status === 'success') {
			alert("更新成功！");
			this.closeModal();
			this.fetchData(true);
		} else {
			alert("更新失敗: " + res.message);
		}
	},

	async deleteData(id) {
		if (!confirm(`確定要刪除紀錄 #${id} 嗎？此動作無法復原。`)) return;

		const res = await this.postData({
			action: 'delete',
			id: id
		});

		if (res.status === 'success') {
			alert("刪除成功");
			this.fetchData(true);
		} else {
			alert("刪除失敗: " + res.message);
		}
	}
};

document.addEventListener('DOMContentLoaded', () => {
	console.log("App starting... API_URL:", App.API_URL);
	App.init();
});
