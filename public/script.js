/* public/script.js */

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
    Object.values(views).forEach(v => v.classList.remove('active'));
    views[viewName].classList.add('active');
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
                document.getElementById('dashboard-user').innerText = `Identity Verified: ${data.user.username}`;
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
        errEl.style.display = 'none';
        checkSession();
    } else {
        const data = await res.json();
        errEl.innerText = data.error || "Login Failed";
        errEl.style.display = 'block';
    }
}

async function signup() {
    const u = document.getElementById('auth-username').value;
    const p = document.getElementById('auth-password').value;
    const errEl = document.getElementById('auth-error');
    
    if (!u || !p) {
        errEl.innerText = "Please provide username and password.";
        errEl.style.display = 'block';
        return;
    }

    const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: u, password: p })
    });
    
    if (res.ok) {
        errEl.style.display = 'none';
        checkSession();
    } else {
        const data = await res.json();
        errEl.innerText = data.error || "Signup Failed";
        errEl.style.display = 'block';
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

// Live Monitoring
const testInput = document.getElementById('test-input');
const cBar = document.getElementById('confidence-bar');
const cText = document.getElementById('score-text');
const badge = document.getElementById('status-badge');

if (testInput) {
    testInput.addEventListener('keydown', captureKeyDown);
    testInput.addEventListener('keyup', async (e) => {
        captureTiming(e);
        
        if (keystrokeBuffer.length >= 5) {
            const batch = [...keystrokeBuffer];
            keystrokeBuffer = []; 

            const res = await fetch('/api/analyze-behavior', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pattern: batch })
            });
            const result = await res.json();

            if (res.status === 401 || res.status === 403) {
                // Session expired or locked out
                overlay.classList.add('active');
                return;
            }

            if (result.score !== undefined) {
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

    cText.innerText = score.toFixed(2);
    let width = 100 - (score * 25);
    if (width < 0) width = 0;
    
    cBar.style.width = width + "%";

    if (score < 1.0) {
        cBar.style.background = "var(--accent)";
        badge.className = "status-badge status-secure";
        badge.innerText = "⌨️ Keyboard: OK";
        document.body.style.background = "var(--bg-main)";
    } else if (score < 2.0) {
        cBar.style.background = "#adff2f";
        document.body.style.background = "var(--bg-main)";
    } else if (score < 3.0) {
        cBar.style.background = "#ffa500";
        document.body.style.background = "var(--bg-main)";
    } else {
        cBar.style.background = "var(--red-alert)";
        badge.className = "status-badge status-danger";
        badge.innerText = "🚨 High Risk";
        document.body.style.background = "#1a0505";
    }
}

function triggerFreeze(reason = "Your session has been locked due to behavioral anomalies.") {
    const p = document.getElementById('freeze-reason');
    if (p) p.innerText = reason;
    overlay.classList.add('active'); // Freeze Screen
    if (testInput) {
        testInput.blur(); // Remove focus
        testInput.disabled = true;
    }
}

// Bot Simulation
async function simulateAttack() {
    if (!testInput) return;
    testInput.value = ""; 
    let attackBuffer = [];

    // Zero variance typing
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

    if (result.status === "ANOMALY_DETECTED") {
        triggerFreeze("Keystroke Dynamics Compromised.");
    }
}

// ==========================================
// Mouse Biometrics (Spatial Tracking)
// ==========================================
let mouseData = [];
let lastMousePos = { x: 0, y: 0 };
const mouseBadge = document.getElementById('mouse-badge');
const badgeMouseTxt = document.getElementById('badge-mouse');

window.addEventListener('mousemove', (e) => {
    // Only track if on dashboard
    if (!views.dashboard.classList.contains('active')) return;

    const currentPos = { x: e.clientX, y: e.clientY };
    
    const distance = Math.sqrt(
        Math.pow(currentPos.x - lastMousePos.x, 2) + 
        Math.pow(currentPos.y - lastMousePos.y, 2) // Fixed typo in standard formula
    );

    if (distance > 5) {
        mouseData.push({ x: currentPos.x, y: currentPos.y, timestamp: Date.now() });
    }

    lastMousePos = currentPos;

    if (mouseData.length >= 50) {
        sendMouseData([...mouseData]);
        mouseData = [];
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

        if (result.status === "ANOMALY_DETECTED") {
            if (mouseBadge) {
                mouseBadge.className = "status-badge status-danger";
                badgeMouseTxt.innerText = `🚨 Mouse: Bot`;
            }
            updateRiskUI({ mouseScore: result.deviation });
            triggerFreeze(`Robotic Mouse Trajectory Detected (Linearity: ${result.deviation.toFixed(2)})`);
        } else {
            if (mouseBadge) {
                mouseBadge.className = "status-badge status-secure";
                badgeMouseTxt.innerText = `🖱️ Mouse: OK (${result.deviation.toFixed(1)})`;
            }
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
    
    // Animate the pointer visually in a perfect straight line
    for(let i=0; i<60; i++) {
        await new Promise(r => setTimeout(r, 20)); // 20ms refresh rate for smooth animation
        let newX = 10 + (i * 12); // Move diagonally right
        let newY = 10 + (i * 12); // Move diagonally down
        
        if (fakePointer) {
            fakePointer.style.left = newX + 'px';
            fakePointer.style.top = newY + 'px';
        }
        
        attackBuffer.push({ x: newX, y: newY, timestamp: Date.now() });
    }
    
    sendMouseData(attackBuffer);

    // Hide the fake pointer after the strike
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
    
    let totalRisk = 0; // 0 to 100

    if (kbScore !== undefined && kbText) {
        if (kbScore < 1.0) { kbText.innerText = "Secure"; kbText.className = "risk-value ok"; totalRisk += 5; }
        else if (kbScore < 3.0) { kbText.innerText = "Erratic"; kbText.className = "risk-value warning"; totalRisk += 30; }
        else { kbText.innerText = "Bot-like"; kbText.className = "risk-value danger"; totalRisk += 80; }
    }

    if (mouseScore !== undefined && mouseText) {
        if (mouseScore >= 2.0) { mouseText.innerText = "Natural"; mouseText.className = "risk-value ok"; totalRisk += 5; }
        else if (mouseScore >= 0.5) { mouseText.innerText = "Suspicious"; mouseText.className = "risk-value warning"; totalRisk += 30; }
        else { mouseText.innerText = "Linear/Robotic"; mouseText.className = "risk-value danger"; totalRisk += 80; }
    }

    if (pathStatus && pathText) {
        pathText.innerText = pathStatus.text;
        pathText.className = `risk-value ${pathStatus.class}`;
        if (pathStatus.class === 'danger') totalRisk += 100;
        else if (pathStatus.class === 'warning') totalRisk += 50;
    }

    totalRisk = Math.min(Math.max(totalRisk, 5), 100);
    riskBar.style.width = totalRisk + "%";
    riskBar.style.background = totalRisk < 50 ? "var(--accent)" : totalRisk < 80 ? "#ffa500" : "var(--red-alert)";
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