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
	init() {
		this.updateUserDisplay();
		this.bindEvents();
		this.fetchData();
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
	async fetchData() {
		this.showLoading(true);
		try {
			const res = await fetch(this.API_URL);
			const data = await res.json();
			this.state.data = data.reverse(); // Newest first

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
			timestamp: new Date().toLocaleString('sv'),
			reporter: this.state.currentUser
		};

		const res = await this.postData(payload);
		if (res.status === 'success') {
			alert(isUpdate ? "修改成功！" : `回報成功！ID: ${res.id}`);
			this.cancelReportEdit(); // Reset form
			this.fetchData();
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
				? `<button class="btn btn-sm btn-secondary" onclick="window.open('${map.url}', '_blank')">連結</button>`
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
                    <button class="btn btn-sm btn-info" onclick="App.copyReport('${map.id}')">複製</button>
                    <button class="btn btn-sm btn-secondary" onclick="App.editReport('${map.id}')">修改</button>
                    <button class="btn btn-sm btn-danger" onclick="App.deleteData('${map.id}')">刪除</button>
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

	refreshData() { this.fetchData(); },

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
				? `<button class="btn btn-sm btn-secondary" onclick="window.open('${map.url}', '_blank')">開啟</button>`
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
                    <button class="btn btn-sm btn-secondary" onclick="App.openModalById('${map.id}')">編輯</button>
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
			fixTime: new Date().toLocaleString()
		};

		const res = await this.postData(payload);
		if (res.status === 'success') {
			alert("更新成功！");
			this.closeModal();
			this.fetchData();
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
			this.fetchData();
		} else {
			alert("刪除失敗: " + res.message);
		}
	}
};

document.addEventListener('DOMContentLoaded', () => {
	App.init();
});
