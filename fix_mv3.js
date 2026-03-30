const fs = require('fs');

// Patch index.html
let html = fs.readFileSync('index.html', 'utf8');
// Fix single argument func: onclick="App.switchTab('report')" -> data-cmd="switchTab" data-arg="report"
html = html.replace(/onclick="App\.([a-zA-Z0-9_]+)\((['"])([^'"]+)\2\)"/g, 'data-cmd="$1" data-arg="$3"');
// Fix zero argument func: onclick="App.editUser()" -> data-cmd="editUser"
html = html.replace(/onclick="App\.([a-zA-Z0-9_]+)\(\)"/g, 'data-cmd="$1"');
// Fix oninput: oninput="App.handleSearch(this.value)"
html = html.replace(/oninput="App\.([a-zA-Z0-9_]+)\(this\.value\)"/g, 'data-input-cmd="$1"');
// Fix onchange simple: onchange="App.handleFilter()"
html = html.replace(/onchange="App\.([a-zA-Z0-9_]+)\(\)"/g, 'data-change-cmd="$1"');
// Fix onchange value: onchange="App.changePageSize(this.value)"
html = html.replace(/onchange="App\.([a-zA-Z0-9_]+)\(this\.value\)"/g, 'data-change-cmd="$1"');
// Fix onchange this: onchange="App.checkStatusColor(this)"
html = html.replace(/onchange="App\.([a-zA-Z0-9_]+)\(this\)"/g, 'data-change-cmd="$1"');
fs.writeFileSync('index.html', html);

// Patch src/app.js
let js = fs.readFileSync('src/app.js', 'utf8');
// Fix window.open
js = js.replace(/onclick="window\.open\('([^']+)',\s*'_blank'\)"/g, 'data-cmd="openLink" data-arg="$1"');
// Fix template literal strings: onclick="App.copyReport('${map.id}')"
js = js.replace(/onclick="App\.([a-zA-Z0-9_]+)\('(\$\{map\.[a-zA-Z0-9_]+\})'\)"/g, 'data-cmd="$1" data-arg="$2"');
// Fix bindEvents addition
if (!js.includes('data-cmd')) {
    const bindEventsCode = `
		document.addEventListener('click', (e) => {
			const target = e.target.closest('[data-cmd]');
			if (target) {
				const cmd = target.getAttribute('data-cmd');
				const arg = target.getAttribute('data-arg');
				if (cmd === 'openLink') window.open(arg, '_blank');
				else if (typeof this[cmd] === 'function') this[cmd](arg);
			}
		});

		document.addEventListener('input', (e) => {
			const target = e.target.closest('[data-input-cmd]');
			if (target && typeof this[target.getAttribute('data-input-cmd')] === 'function') {
				this[target.getAttribute('data-input-cmd')](target.value);
			}
		});

		document.addEventListener('change', (e) => {
			const target = e.target.closest('[data-change-cmd]');
			if (target) {
				const cmd = target.getAttribute('data-change-cmd');
				if (cmd === 'checkStatusColor') this.checkStatusColor(target);
				else if (typeof this[cmd] === 'function') this[cmd](target.value);
			}
		});
`;

    js = js.replace(/bindEvents\(\)\s*\{/, 'bindEvents() {\n' + bindEventsCode);
}
fs.writeFileSync('src/app.js', js);

console.log('Script patched perfectly!');
