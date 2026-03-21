/* public/script.js - Performance Optimized for Aegis Vault */

const views = {
    auth: document.getElementById('view-auth'),
    enroll: document.getElementById('view-enroll'),
    dashboard: document.getElementById('view-dashboard')
};

const overlay = document.getElementById('freeze-overlay');

let keystrokeBuffer = [];
let lastKeyTime = 0;
let keyPressTimes = {};

// View Navigation
function showView(viewName) {
    Object.values(views).forEach(v => {
        if (v) v.classList.remove('active');
    });
    if (views[viewName]) views[viewName].classList.add('active');
}

// Check Auth on Load
window.addEventListener('DOMContentLoaded', async () => {
    checkSession();
});

async function checkSession() {
    try {
        const res = await fetch('/api/me');
        if (res.ok) {
            const data = await res.json();
            if (data.user.isFlagged) {
                overlay.classList.add('active');
                return;
            }
            if (data.profileExists) {
                const userDisplay = document.getElementById('dashboard-user');
                if (userDisplay) userDisplay.innerText = `Identity Verified: ${data.user.username}`;
                showView('dashboard');
            } else {
                showView('enroll');
            }
        } else {
            showView('auth');
        }
    } catch (e) {
        showView('auth');
    }
}

// Authentication Logic
async function login() {
    const u = document.getElementById('auth-username').value;
    const p = document.getElementById('auth-password').value;
    const errEl = document.getElementById('auth-error');

    const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: u, password: p })
    });

    if (res.ok) {
        if (errEl) errEl.style.display = 'none';
        checkSession();
    } else {
        const data = await res.json();
        if (errEl) {
            errEl.innerText = data.error || "Login Failed";
            errEl.style.display = 'block';
        }
    }
}

async function signup() {
    const u = document.getElementById('auth-username').value;
    const p = document.getElementById('auth-password').value;
    const errEl = document.getElementById('auth-error');

    if (!u || !p) {
        if (errEl) {
            errEl.innerText = "Please provide username and password.";
            errEl.style.display = 'block';
        }
        return;
    }

    const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: u, password: p })
    });

    if (res.ok) {
        if (errEl) errEl.style.display = 'none';
        checkSession();
    } else {
        const data = await res.json();
        if (errEl) {
            errEl.innerText = data.error || "Signup Failed";
            errEl.style.display = 'block';
        }
    }
}

async function logout() {
    await fetch('/api/logout', { method: 'POST' });
    location.reload();
}

// Keystroke Timing Core
const captureKeyDown = (e) => {
    if (!keyPressTimes[e.code]) {
        keyPressTimes[e.code] = performance.now();
    }
};

const captureTiming = (e) => {
    const now = performance.now();
    const pressTime = keyPressTimes[e.code];
    let dwellTime = 0;

    if (pressTime) {
        dwellTime = now - pressTime;
        delete keyPressTimes[e.code];
    }

    if (lastKeyTime > 0) {
        const flightTime = now - lastKeyTime;
        if (flightTime < 5000) keystrokeBuffer.push({ flightTime, dwellTime });
    }
    lastKeyTime = now;
};

// Enrollment
const enrollInput = document.getElementById('enroll-input');
if (enrollInput) {
    enrollInput.addEventListener('keydown', captureKeyDown);
    enrollInput.addEventListener('keyup', captureTiming);
}

async function enrollUser() {
    const res = await fetch('/api/enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pattern: keystrokeBuffer })
    });

    if (res.ok) {
        keystrokeBuffer = [];
        lastKeyTime = 0;
        checkSession();
    } else {
        const data = await res.json();
        alert(data.error);
    }
}

// ==========================================
// HIGH-SPEED KEYBOARD MONITORING
// ==========================================
const testInput = document.getElementById('test-input');
const cBar = document.getElementById('confidence-bar');
const cText = document.getElementById('score-text');
const badge = document.getElementById('status-badge');

if (testInput) {
    testInput.addEventListener('keydown', captureKeyDown);
    testInput.addEventListener('keyup', async (e) => {
        captureTiming(e);

        // REDUCED BATCH: Every 3 keys for instant feedback
        if (keystrokeBuffer.length >= 3) {
            const batch = [...keystrokeBuffer];
            keystrokeBuffer = [];

            const res = await fetch('/api/analyze-behavior', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pattern: batch })
            });
            const result = await res.json();

            if (res.status === 401 || res.status === 403) {
                triggerFreeze();
                return;
            }

            if (result.score !== undefined) {
                if (window.myBiometricChart) {
                    updateChartData(window.myBiometricChart, result.score);
                }
                updateUI(result.score);
            }

            if (result.status === "ANOMALY_DETECTED") {
                triggerFreeze();
            }
        }
    });
}

function updateUI(score) {
    updateRiskUI({ kbScore: score });

    if (cText) cText.innerText = score.toFixed(2);

    let width = 100 - (score * 25);
    if (width < 0) width = 0;

    if (cBar) {
        cBar.style.width = width + "%";
        if (score < 1.0) {
            cBar.style.background = "var(--accent)";
            document.body.style.background = "var(--bg-main)";
        } else if (score < 3.0) {
            cBar.style.background = "#ffa500";
            document.body.style.background = "var(--bg-main)";
        } else {
            cBar.style.background = "var(--red-alert)";
            document.body.style.background = "#1a0505";
        }
    }

    if (badge) {
        if (score < 1.5) {
            badge.className = "status-badge status-secure";
            badge.innerText = "⌨️ Keyboard: OK";
        } else {
            badge.className = "status-badge status-danger";
            badge.innerText = "🚨 High Risk";
        }
    }
}

function triggerFreeze(reason = "Your session has been locked due to behavioral anomalies.") {
    const p = document.getElementById('freeze-reason');
    if (p) p.innerText = reason;
    if (overlay) overlay.classList.add('active');
    if (testInput) {
        testInput.blur();
        testInput.disabled = true;
    }
}

// Bot Simulation
async function simulateAttack() {
    if (!testInput) return;
    testInput.value = "";
    let attackBuffer = [];

    for (let i = 0; i < 15; i++) {
        await new Promise(r => setTimeout(r, 60));
        attackBuffer.push({ flightTime: 60, dwellTime: 50 });
        testInput.value += "x";
    }

    const res = await fetch('/api/analyze-behavior', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pattern: attackBuffer })
    });

    const result = await res.json();
    if (result.score !== undefined) updateUI(result.score);
    if (result.status === "ANOMALY_DETECTED") triggerFreeze("Keystroke Dynamics Compromised.");
}

// ==========================================
// HIGH-SPEED MOUSE MONITORING
// ==========================================
let mouseData = [];
let lastMousePos = { x: 0, y: 0 };
const mouseBadge = document.getElementById('mouse-badge');
const badgeMouseTxt = document.getElementById('badge-mouse');

// REDUCED BATCH SIZE: 20 points instead of 50 for near-instant detection
const MOUSE_BATCH_LIMIT = 20;

window.addEventListener('mousemove', (e) => {
    if (!views.dashboard.classList.contains('active')) return;

    const currentPos = { x: e.clientX, y: e.clientY };
    // Use Math.hypot (optimized by modern browsers) instead of manual Sqrt/Pow
    const distance = Math.hypot(currentPos.x - lastMousePos.x, currentPos.y - lastMousePos.y);

    if (distance > 4) { // Log significant movement
        mouseData.push({ x: currentPos.x, y: currentPos.y, timestamp: Date.now() });
    }
    lastMousePos = currentPos;

    if (mouseData.length >= MOUSE_BATCH_LIMIT) {
        const dataToSend = [...mouseData];
        mouseData = [];
        sendMouseData(dataToSend); // Sends to server every ~0.5 seconds
    }
});

async function sendMouseData(data) {
    try {
        const res = await fetch('/api/analyze-mouse', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ points: data })
        });
        const result = await res.json();

        if (res.status === 401 || res.status === 403) {
            triggerFreeze();
            return;
        }

        const mZScore = document.getElementById('mouse-zscore');
        if (mZScore) mZScore.innerText = result.deviation ? result.deviation.toFixed(2) : "0.00";

        if (result.status === "ANOMALY_DETECTED") {
            if (mouseBadge) mouseBadge.className = "status-badge status-danger";
            if (badgeMouseTxt) badgeMouseTxt.innerText = `🚨 Mouse: Bot`;
            updateRiskUI({ mouseScore: result.deviation });
            triggerFreeze(`Robotic Mouse Trajectory Detected (Linearity: ${result.deviation.toFixed(2)})`);
        } else {
            if (mouseBadge) mouseBadge.className = "status-badge status-secure";
            if (badgeMouseTxt) badgeMouseTxt.innerText = `🖱️ Mouse: OK (${result.deviation.toFixed(1)})`;
            updateRiskUI({ mouseScore: result.deviation });
        }
    } catch (e) {
        console.error("Mouse Biometric Error:", e);
    }
}

async function simulateMouseAttack() {
    const fakePointer = document.getElementById('demo-pointer');
    if (fakePointer) {
        fakePointer.style.display = 'block';
        fakePointer.style.left = '10px';
        fakePointer.style.top = '10px';
    }

    let attackBuffer = [];
    for (let i = 0; i < 60; i++) {
        await new Promise(r => setTimeout(r, 20));
        let newX = 10 + (i * 12);
        let newY = 10 + (i * 12);

        if (fakePointer) {
            fakePointer.style.left = newX + 'px';
            fakePointer.style.top = newY + 'px';
        }
        attackBuffer.push({ x: newX, y: newY, timestamp: Date.now() });
    }
    sendMouseData(attackBuffer);
    if (fakePointer) setTimeout(() => { fakePointer.style.display = 'none'; }, 800);
}

// Demo Reset Logic
async function resetDemo() {
    await fetch('/api/unlock', { method: 'POST' });
    await fetch('/api/logout', { method: 'POST' });
    location.reload();
}

// Risk Dashboard UI Update
function updateRiskUI({ kbScore, mouseScore, pathStatus }) {
    const kbText = document.getElementById('kb-score');
    const mouseText = document.getElementById('mouse-score');
    const pathText = document.getElementById('path-score');
    const riskBar = document.getElementById('risk-bar');
    if (!riskBar) return;

    let totalRisk = 0;

    if (kbScore !== undefined && kbText) {
        if (kbScore < 1.0) { kbText.innerText = "Secure"; kbText.className = "risk-value ok"; totalRisk += 5; }
        else if (kbScore < 5.0) { kbText.innerText = "Erratic"; kbText.className = "risk-value warning"; totalRisk += 30; }
        else { kbText.innerText = "Bot-like"; kbText.className = "risk-value danger"; totalRisk += 80; }
    }

    if (mouseScore !== undefined && mouseText) {
        if (mouseScore >= 2.0) { mouseText.innerText = "Natural"; mouseText.className = "risk-value ok"; totalRisk += 5; }
        else if (mouseScore >= 0.5) { mouseText.innerText = "Suspicious"; mouseText.className = "risk-value warning"; totalRisk += 30; }
        else { mouseText.innerText = "Linear/Robotic"; mouseText.className = "risk-value danger"; totalRisk += 80; }
    }

    // Add this inside updateRiskUI logic
    if (pathStatus && pathText) {
        pathText.innerText = pathStatus.text;
        pathText.className = `risk-value ${pathStatus.class}`;

        // If it's a danger state, animate the risk bar to 100% instantly
        if (pathStatus.class === 'danger') {
            const riskBar = document.getElementById('risk-bar');
            if (riskBar) {
                riskBar.style.width = "100%";
                riskBar.style.background = "var(--red-alert)";
            }
        }
    }

    totalRisk = Math.min(Math.max(totalRisk, 5), 100);
    riskBar.style.width = totalRisk + "%";
    riskBar.style.background = totalRisk < 50 ? "var(--accent)" : totalRisk < 80 ? "#ffa500" : "var(--red-alert)";
}

// Chart Helper - Smooth, Fast Updates
function updateChartData(chart, score) {
    const timeLabel = new Date().toLocaleTimeString().split(' ')[0];
    chart.data.labels.push(timeLabel);
    chart.data.datasets[0].data.push(score);
    if (chart.data.labels.length > 15) {
        chart.data.labels.shift();
        chart.data.datasets[0].data.shift();
    }
    chart.update('none'); // Instant update without lag
}

// Layer 3 Bot Sim
async function simulateDataTheft() {
    const res = await fetch('/api/export-data', { method: 'POST' });
    const result = await res.json();
    if (res.status === 403 && result.status === "ANOMALY_DETECTED") {
        updateRiskUI({ pathStatus: { text: "Impossible Sequence", class: "danger" } });
        triggerFreeze(`Malicious API Scraping Sequence Detected.\nSequence: ${result.reason}`);
    } else {
        alert(result.message);
    }
}