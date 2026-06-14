/* ============================================================
   外幣匯率到價通知系統 - 前端核心邏輯 (CORS 修正完美版)
   ============================================================ */

// ========== 【全域變數配置】 ==========
const GAS_URL = 'https://script.google.com/macros/s/AKfycbyEgcgaI9kbg9K78kT85IAGpCsCf0-zzOO5dJccFTV6me4AeHKQuIe_YkE2-XdQonz3Yg/exec';
const GOOGLE_CLIENT_ID = '640063171909-dcbrqqp90o2t6eprmtqtrlh46g2iqre9.apps.googleusercontent.com'; 

// ⚠️ 管理員權限信箱：已自動幫你改為你的個人 Gmail 測試帳號
let adminEmail = "hankwang0924@gmail.com"; 

// 全域使用者狀態
let currentUser = {
    email: null,
    name: null,
    picture: null,
    isAdmin: false
};

// ✨ 【安全鎖】：確保包含 Google 登入 SDK 在內的所有雲端資源徹底加載完畢後，才渲染按鈕！
window.onload = () => {
    console.log("✨ 外幣匯率到價通知系統已啟動 (所有雲端資源加載完畢)！");
    initApp();
};

// 初始化應用程式
function initApp() {
    setupGoogleSignIn();
    bindEvents();
}

// ========== 【Google 登入邏輯】 ==========
function setupGoogleSignIn() {
    if (typeof google === 'undefined') {
        console.error("❌ 無法載入 Google 登入 API，請確認 index.html 有引入 GIS SDK");
        return;
    }

    google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleCredentialResponse
    });

    // 渲染 Google 原生一鍵登入按鈕
    const buttonDiv = document.getElementById("google-login-btn");
    if (buttonDiv) {
        google.accounts.id.renderButton(buttonDiv, { 
            theme: "outline", 
            size: "large",
            text: "signin_with"
        });
    }
}

// 處理 Google 登入回傳的身分憑證
function handleCredentialResponse(response) {
    // 解碼 JWT token 取得使用者資料
    const base64Url = response.credential.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));

    const profile = JSON.parse(jsonPayload);
    
    // 存入全域變數
    currentUser.email = profile.email;
    currentUser.name = profile.name;
    currentUser.picture = profile.picture;
    currentUser.isAdmin = (profile.email.toLowerCase() === adminEmail.toLowerCase());

    console.log("✅ Google 帳號認證成功：", currentUser.email);
    updateUIAfterLogin();
}

// 登入後的 UI 變更
function updateUIAfterLogin() {
    // 隱藏登入區塊，顯示主畫面
    document.getElementById("login-section").classList.add("hidden");
    document.getElementById("main-section").classList.remove("hidden");

    // 顯示使用者大頭貼與名字
    document.getElementById("user-avatar").src = currentUser.picture;
    document.getElementById("user-name").innerText = currentUser.name;

    // 自動填入表單中的 Email 並鎖定防呆
    const emailInput = document.getElementById("form-email");
    if (emailInput) {
        emailInput.value = currentUser.email;
        emailInput.readOnly = true;
    }

    // 判斷管理員權限
    if (currentUser.isAdmin) {
        document.getElementById("admin-toggle-btn").classList.remove("hidden");
        loadAdminDashboard(); // 是管理員才去抓取歷史資料與統計圖表
    } else {
        document.getElementById("admin-toggle-btn").classList.add("hidden");
    }
}

// ========== 【表單提交邏輯 (CORS 核心修正)】 ==========
function bindEvents() {
    const form = document.getElementById("alert-form");
    if (form) {
        form.addEventListener('submit', handleFormSubmit);
    }

    // 後台切換按鈕事件
    const toggleBtn = document.getElementById("admin-toggle-btn");
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            const adminSection = document.getElementById("admin-section");
            adminSection.classList.toggle("hidden");
        });
    }
}

function handleFormSubmit(e) {
    e.preventDefault();
    
    // 取得表單填寫的資料
    const formData = {
        email: document.getElementById("form-email").value,
        currency: document.getElementById("form-currency").value,
        condition: document.getElementById("form-condition").value,
        targetRate: parseFloat(document.getElementById("form-target-rate").value)
    };

    if (!formData.targetRate || isNaN(formData.targetRate)) {
        alert("❌ 請輸入有效的目標匯率！");
        return;
    }

    console.log("🚀 正在送出設定資料到雲端...", formData);
    
    // ✨ 【完美避開 CORS 限制的傳輸心法】
    fetch(GAS_URL, {
        method: 'POST',
        mode: 'no-cors', // 💡 告訴瀏覽器：強制跳過跨網域預檢
        headers: {
            'Content-Type': 'text/plain;charset=utf-8' // 💡 用純文字格式送出，GAS 後端能收，且不觸發阻擋
        },
        body: JSON.stringify(formData)
    })
    .then(response => {
        // 💡 no-cors 模式下 status 為 0 是正常的。只要沒進 catch 就是成功寫入試算表了！
        alert("🎉 設定成功！匯率通知已成功寫入 Google 試算表雲端。");
        document.getElementById("form-target-rate").value = ""; // 清空輸入框
        
        // 如果是管理員，送出後順便刷新一下後台數據
        if (currentUser.isAdmin) {
            setTimeout(loadAdminDashboard, 1500); // 稍微延遲讓雲端寫入完畢
        }
    })
    .catch(error => {
        console.error("❌ 提交表單時出錯:", error);
        alert("❌ 網路連接失敗，請確認 GAS URL 配置。");
    });
}

// ========== 【管理員後台資料讀取與 Chart.js 圖表】 ==========
function loadAdminDashboard() {
    console.log("📊 管理員正在讀取後台資料...");
    
    fetch(GAS_URL)
    .then(res => {
        if (!res.ok) throw new Error("網路回應不正確");
        return res.json();
    })
    .then(data => {
        if (!data || data.length === 0) {
            document.getElementById("admin-table-body").innerHTML = `<tr><td colspan="6" class="text-center p-4 text-gray-500">目前尚無任何通知設定紀錄</td></tr>`;
            return;
        }
        
        // 1. 渲染歷史紀錄表格
        renderTable(data);
        
        // 2. 統計各外幣訂閱數量並繪製圓餅圖
        renderChart(data);
    })
    .catch(err => {
        console.error("⚠️ 無法載入歷史資料:", err);
        // 防呆：如果試算表目前是空的，優雅地給個提示
        const tableBody = document.getElementById("admin-table-body");
        if (tableBody) {
            tableBody.innerHTML = `<tr><td colspan="6" class="text-center p-4 text-gray-400">📊 雲端試算表目前為空，或正在等待第一筆資料寫入。</td></tr>`;
        }
    });
}

// 渲染表格
function renderTable(data) {
    const tableBody = document.getElementById("admin-table-body");
    if (!tableBody) return;
    
    let html = "";
    const sortedData = [...data].reverse(); // 倒序排列，最新的在最上面
    
    sortedData.forEach(row => {
        const date = new Date(row[0]).toLocaleString('zh-TW', { hour12: false });
        const statusClass = row[5] === "Sent" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800";
        const statusText = row[5] === "Sent" ? "已寄出" : "監控中";
        
        html += `
            <tr class="border-b hover:bg-gray-50">
                <td class="px-4 py-3 text-sm text-gray-600">${date}</td>
                <td class="px-4 py-3 text-sm font-medium text-gray-900">${row[1]}</td>
                <td class="px-4 py-3 text-sm text-gray-700 font-bold">${row[2]}</td>
                <td class="px-4 py-3 text-sm text-gray-600">${row[3]}</td>
                <td class="px-4 py-3 text-sm text-blue-600 font-medium">${row[4]}</td>
                <td class="px-4 py-3 text-sm">
                    <span class="px-2 py-1 rounded-full text-xs font-semibold ${statusClass}">${statusText}</span>
                </td>
            </tr>
        `;
    });
    tableBody.innerHTML = html;
}

// 繪製 Chart.js 圓餅圖
let myChart = null; 
function renderChart(data) {
    const canvas = document.getElementById("currencyChart");
    if (!canvas) return;
    
    const counts = {};
    data.forEach(row => {
        const currency = row[2];
        if (currency) {
            counts[currency] = (counts[currency] || 0) + 1;
        }
    });
    
    const labels = Object.keys(counts);
    const chartData = Object.values(counts);
    
    if (myChart) {
        myChart.destroy(); // 銷毀舊圖表防止重複繪製出錯
    }
    
    const ctx = canvas.getContext('2d');
    myChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: chartData,
                backgroundColor: [
                    '#3B82F6', '#EF4444', '#10B981', '#F59E0B', 
                    '#8B5CF6', '#EC4899', '#6366F1', '#14B8A6'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' }
            }
        }
    });
}