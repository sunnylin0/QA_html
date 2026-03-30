// content.js
//console.log("[QA Tracker] content.js loaded on:", window.location.href);

document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.altKey) && e.key.toLowerCase() === 'q') {
        const isAlt = e.altKey;
        console.log(`[QA Tracker] ${isAlt ? 'Alt' : 'Ctrl'}+Q pressed!`);
        e.preventDefault();

        let pageUrl = "";
        let funName = "";
        let moduleName = "";
        let titleName = "";
        try {
            const topWindow = window.top;
            
            // Capture Title from main frame if possible, else current
            if (topWindow.frames && topWindow.frames['main']) {
                try {
                    titleName = topWindow.frames['main'].document.title;
                } catch(e) {}
            }
            if (!titleName) titleName = document.title;
            
            if (topWindow.frames && topWindow.frames['main']) {
                pageUrl = topWindow.frames['main'].location.href;
            } else {
                pageUrl = window.location.href;
            }

            // Extract funName from topbar
            if (topWindow.frames && topWindow.frames['topbar']) {
                try {
                    const tbDoc = topWindow.frames['topbar'].document;
                    const el = tbDoc.getElementById('tbfunName');
                    if (el) {
                        funName = el.textContent.trim();
                    }
                } catch (e) {
                    console.warn("[QA Tracker] Cannot access topbar document:", e);
                }
            }

            // Extract moduleName from menu TreeView
            if (topWindow.frames && topWindow.frames['menu']) {
                try {
                    const menuDoc = topWindow.frames['menu'].document;
                    moduleName = getTreeViewPath(menuDoc);
                } catch (e) {
                    console.warn("[QA Tracker] Cannot access menu document:", e);
                }
            }
        } catch (err) {
            pageUrl = window.location.href;
        }

        console.log("[QA Tracker] Captured pageUrl:", pageUrl, "funName:", funName, "moduleName:", moduleName, "titleName:", titleName);

        if (window !== window.top) {
            console.log("[QA Tracker] Sending message to top window to open overlay");
            window.top.postMessage({ action: 'qa_tracker_toggle', url: pageUrl, funName: funName, moduleName: moduleName, titleName: titleName, mode: isAlt ? 'alt' : 'ctrl' }, '*');
        } else {
            console.log("[QA Tracker] Opening overlay in current window");
            toggleQAOverlay(pageUrl, funName, moduleName, titleName, isAlt ? 'alt' : 'ctrl');
        }
    }

    // Add Escape key handling here to broadcast close message
    if (e.key === 'Escape') {
        if (window !== window.top) {
            window.top.postMessage({ action: 'qa_tracker_close' }, '*');
        } else {
            closeQAOverlay();
        }
    }
});

// Listen for messages in the top frame
if (window === window.top) {
    window.addEventListener('message', function (event) {
        if (event.data) {
            if (event.data.action === 'qa_tracker_toggle') {
                toggleQAOverlay(event.data.url, event.data.funName, event.data.moduleName, event.data.titleName, event.data.mode);
            } else if (event.data.action === 'qa_tracker_close') {
                closeQAOverlay();
            }
        }
    });

    // Close on Esc key in top frame
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            closeQAOverlay();
        }
    });
}

function getTreeViewPath(menuDoc) {
    try {
        let selectedInput = menuDoc.getElementById('trMenu_SelectedNode');
        let selectedId = selectedInput ? selectedInput.value : '';
        let currentNode = null;
        if (selectedId) {
            currentNode = menuDoc.getElementById(selectedId);
        }

        if (!currentNode) return "";

        let path = [currentNode.textContent.trim()];
        let currentDiv = currentNode.closest('div[id$="Nodes"]');

        while (currentDiv) {
            let match = currentDiv.id.match(/(.+)n(\d+)Nodes$/);
            if (match) {
                let prefix = match[1]; // "trMenu"
                let num = match[2];    // "0"
                let parentLink = menuDoc.getElementById(prefix + 't' + num);
                if (parentLink) {
                    path.unshift(parentLink.textContent.trim());
                    currentDiv = parentLink.closest('div[id$="Nodes"]');
                } else {
                    break;
                }
            } else {
                break;
            }
        }

        return path.join('_');
    } catch (e) {
        console.warn("[QA Tracker] getTreeViewPath error:", e);
        return "";
    }
}

function getTargetDocument() {
    let targetDoc = document;
    // 如果 top frame 是 frameset，則 iframe 無法直接 append 到 body 內顯示
    // 因此我們要改塞到 main frame 的 body
    if (document.body && document.body.tagName && document.body.tagName.toUpperCase() === 'FRAMESET') {
        try {
            if (window.frames['main']) {
                targetDoc = window.frames['main'].document;
            } else if (window.frames.length > 0) {
                targetDoc = window.frames[0].document;
            }
        } catch (e) {
            console.warn("[QA Tracker] Cannot access frame document:", e);
        }
    }
    return targetDoc;
}

function closeQAOverlay() {
    let targetDoc = getTargetDocument();
    let iframe = targetDoc.getElementById('qa-tracker-extension-iframe');
    if (iframe && iframe.style.display !== 'none') {
        iframe.style.display = 'none';
        console.log("[QA Tracker] Overlay closed.");
    }
}

function toggleQAOverlay(pageUrl, funName = "", moduleName = "", titleName = "", mode = "ctrl") {
    let targetDoc = getTargetDocument();
    let iframe = targetDoc.getElementById('qa-tracker-extension-iframe');

    const extensionUrl = chrome.runtime.getURL('index.html') + 
        '?url=' + encodeURIComponent(pageUrl) + 
        '&funName=' + encodeURIComponent(funName) + 
        '&moduleName=' + encodeURIComponent(moduleName) +
        '&titleName=' + encodeURIComponent(titleName) +
        '&mode=' + encodeURIComponent(mode);

    if (!iframe) {
        console.log("[QA Tracker] Creating iframe in", targetDoc.location.href);
        iframe = targetDoc.createElement('iframe');
        iframe.id = 'qa-tracker-extension-iframe';
        // Add URL parameter so app.js knows what to load
        iframe.src = extensionUrl;
        iframe.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 90vw;
            height: 90vh;
            max-width: 1400px;
            z-index: 2147483647;
            border: none;
            border-radius: 12px;
            box-shadow: 0 10px 50px rgba(0,0,0,0.5);
            background: #0f172a;
            display: block;
        `;
        targetDoc.body.appendChild(iframe);
        iframe.focus();
    } else {
        if (iframe.style.display === 'none') {
            iframe.src = extensionUrl;
            iframe.style.display = 'block';
            console.log("[QA Tracker] Overlay shown.");
            iframe.focus();
        } else {
            iframe.style.display = 'none';
            console.log("[QA Tracker] Overlay hidden.");
        }
    }
}

// --- Menu Tree Node Disabler ---
if (window.name === 'menu' || window.location.href.includes('labMenu.aspx') || window.location.href.includes('labMenu.html')) {
    //欄位名稱文字加一橫線
    const disabledNodes =
        ['AA03', 'AA37', 'AA91', 'AA92', 'AA93', 'AA94', 'AA95', 'AA96', 'AA97', 'AF67', 'AF68', 'AF69', 'AF70', 'AG03', 'AG04', 'AG05', 'AG06', 'AG07', 'AG08', 'AG09', 'AG10',
            'CE40', 'CE39', 'CE61', 'CE64', 'CE65', 'CE66', 'CE67', 'CE68', 'CE69', 'CE70', 'CE71', 'CE72', 'CE83', 'CE84', 'CE85', 'CE86',
            'CF01', 'CF02', 'CF03', 'CF04', 'CF05', 'CF06', 'CF07', 'CF08', 'CF09', 'CF10', 'CF11', 'CF12', 'CF13', 'CF14', 'CF15', 'CF16', 'CF17', 'CF18', 'CF19', 'CF20', 'CF21',
            'CG51', 'CG52', 'CG55', 'CG44', 'CG45', 'CG46', 'CG47', 'CG48', 'CG49', 'CM54', 'EA01', 'AP01', 'AP02', 'AP03', 'AP04',
            'PK01', 'PK02', 'PK03', 'PK04', 'PK05', 'PK06', 'PK07', 'PK08', 'PK09', 'PK10'];


    console.log("[QA Tracker] Menu Tree Node Disabler loaded  lin123.");
    const disableMenuNodes = () => {
        const links = document.querySelectorAll('a');
        links.forEach(a => {
            const href = a.getAttribute('href') || '';
            let shouldDisable = false;
            for (let i = 0; i < disabledNodes.length; i++) {
                // Check both literal string and unescaped version
                const p1 = '\\' + disabledNodes[i];
                //const p2 = p1.replace(/\\\\/g, '\\');
                if (href.includes(p1)) {
                    shouldDisable = true;
                    break;
                }
            }
            if (shouldDisable) {
                a.style.textDecoration = 'line-through';
                a.style.color = '#999';
                a.style.pointerEvents = 'none';
                a.onclick = function (e) { e.preventDefault(); e.stopPropagation(); return false; };

                if (a.parentElement) {
                    a.parentElement.onmouseover = null;
                    a.parentElement.onmouseout = null;
                    a.parentElement.style.pointerEvents = 'none';
                }
            }
        });
    };

    // Run initially
    setTimeout(disableMenuNodes, 1000);

    // Observer for dynamically expanded tree nodes
    const observer = new MutationObserver(() => {
        disableMenuNodes();
    });

    const startObserver = () => {
        if (document.body) {
            observer.observe(document.body, { childList: true, subtree: true });
            disableMenuNodes();
        } else {
            document.addEventListener('DOMContentLoaded', () => {
                observer.observe(document.body, { childList: true, subtree: true });
                disableMenuNodes();
            });
        }
    };

    startObserver();
}


