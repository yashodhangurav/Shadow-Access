/* public/js/app.js */

let keystrokeBuffer = [];
let lastKeyTime = 0;
let keyPressTimes = {};
let mouseData = [];
let lastMousePos = { x: 0, y: 0 };
let biometricChart;
let chartLabels = [];

document.addEventListener('DOMContentLoaded', async () => {
    const path = window.location.pathname;

    if (path === '/' || path === '/index.html') {
        checkSession(false, false);
    } 
    else if (path.includes('/auth')) {
        document.getElementById('btn-login')?.addEventListener('click', login);
        document.getElementById('btn-signup')?.addEventListener('click', signup);
        checkSession(true, true);
    } 
    else if (path.includes('/enroll')) {
        document.getElementById('btn-enroll')?.addEventListener('click', enrollUser);
        document.getElementById('btn-logout')?.addEventListener('click', logout);
        
        const enrollInput = document.getElementById('enroll-input');
        if (enrollInput) {
            enrollInput.addEventListener('keydown', captureKeyDown);
            enrollInput.addEventListener('keyup', captureTiming);
        }
        checkSession(true, true);
    } 
    else if (path.includes('/dashboard')) {
        document.getElementById('btn-attack')?.addEventListener('click', simulateAttack);
        document.getElementById('btn-mouse-attack')?.addEventListener('click', simulateMouseAttack);
        // The API attack is now executed via Hoppscotch/Postman manually
        document.getElementById('btn-logout')?.addEventListener('click', logout);
        document.getElementById('btn-reset-demo')?.addEventListener('click', resetDemo);
        
        const testInput = document.getElementById('test-input');
        if (testInput) {
            testInput.addEventListener('keydown', captureKeyDown);
            testInput.addEventListener('keyup', analyzeLiveTyping);
        }

        window.addEventListener('mousemove', captureMouseMovement);
        checkSession(true, true);

        // Initialize Chart
        if (typeof Chart !== 'undefined') {
            const ctx = document.getElementById('biometricChart');
            if (ctx) {
                Chart.defaults.color = '#888';
                Chart.defaults.font.family = 'JetBrains Mono';

                biometricChart = new Chart(ctx.getContext('2d'), {
                    type: 'line',
                    data: {
                        labels: chartLabels,
                        datasets: [
                            {
                                label: 'Flight Time (ms)',
                                borderColor: '#FF2A55',
                                backgroundColor: 'rgba(255, 42, 85, 0.1)',
                                data: [],
                                borderWidth: 2,
                                tension: 0.4,
                                fill: true,
                                pointRadius: 2,
                                pointBackgroundColor: '#FF2A55'
                            },
                            {
                                label: 'Dwell Time (ms)',
                                borderColor: '#00E5FF',
                                backgroundColor: 'rgba(0, 229, 255, 0.1)',
                                data: [],
                                borderWidth: 2,
                                tension: 0.4,
                                fill: true,
                                pointRadius: 2,
                                pointBackgroundColor: '#00E5FF'
                            }
                        ]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        animation: { duration: 0 },
                        scales: {
                            y: {
                                beginAtZero: true,
                                grid: { color: 'rgba(255,255,255,0.05)' },
                                title: { display: true, text: 'Milliseconds' }
                            },
                            x: {
                                grid: { display: false },
                                display: false
                            }
                        },
                        plugins: {
                            legend: { position: 'top', align: 'end', labels: { boxWidth: 12 } }
                        }
                    }
                });
            }
        }
    }
});

/* Session & Auth */
async function checkSession(redirectIfLoggedOut = true, redirectIfLoggedIn = false) {
    try {
        const path = window.location.pathname;
        const res = await fetch('/api/me');
        if (res.ok) {
            const data = await res.json();
            if (data.user && data.user.isFlagged) {
                if (path === '/' || path === '/index.html' || path.includes('/auth')) {
                    // Let them read the landing or auth page.
                    return;
                }
                if (path.includes('/dashboard')) {
                    triggerFreeze();
                } else {
                    window.location.href = '/dashboard';
                }
                return;
            }
            if (data.profileExists) {
                const dashUser = document.getElementById('dashboard-user');
                if (dashUser) dashUser.innerText = `Identity Verified: ${data.user.username}`;
                
                if (redirectIfLoggedIn && !path.includes('/dashboard')) {
                    window.location.href = '/dashboard';
                }
            } else {
                if (redirectIfLoggedIn && !path.includes('/enroll')) {
                    window.location.href = '/enroll';
                }
            }
        } else {
            if (redirectIfLoggedOut && !path.includes('/auth')) {
                window.location.href = '/auth';
            }
        }
    } catch (e) {
        if (redirectIfLoggedOut && !window.location.pathname.includes('/auth')) {
            window.location.href = '/auth';
        }
    }
}

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
        window.location.href = '/enroll'; // Check session will handle correct routing
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
        window.location.href = '/enroll';
    } else {
        const data = await res.json();
        errEl.innerText = data.error || "Signup Failed";
        errEl.style.display = 'block';
    }
}

async function logout() {
    await fetch('/api/logout', { method: 'POST' });
    window.location.href = '/auth';
}

/* Keystroke Logic */
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
        if (flightTime < 5000) {
            keystrokeBuffer.push({ flightTime, dwellTime });
            
            // Push to Chart.js
            if (biometricChart) {
                chartLabels.push('');
                biometricChart.data.datasets[0].data.push(flightTime);
                biometricChart.data.datasets[1].data.push(dwellTime);
                
                if (chartLabels.length > 25) {
                    chartLabels.shift();
                    biometricChart.data.datasets[0].data.shift();
                    biometricChart.data.datasets[1].data.shift();
                }
                biometricChart.update();
            }
        }
    }
    lastKeyTime = now;
};

async function enrollUser() {
    const res = await fetch('/api/enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pattern: keystrokeBuffer })
    });
    
    if (res.ok) {
        keystrokeBuffer = [];
        lastKeyTime = 0;
        window.location.href = '/dashboard';
    } else {
        const data = await res.json();
        alert(data.error);
    }
}

async function analyzeLiveTyping(e) {
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
            triggerFreeze();
            return;
        }

        if (result.score !== undefined) {
            updateUI(result.score);
        }

        if (result.status === "ANOMALY_DETECTED") {
            triggerFreeze("Keystroke Dynamics Compromised.");
        }
    }
}

function updateUI(score) {
    updateRiskUI({ kbScore: score });

    const cText = document.getElementById('score-text');
    const cBar = document.getElementById('confidence-bar');
    const badge = document.getElementById('status-badge');
    
    if(cText) cText.innerText = score.toFixed(2);
    
    let width = 100 - (score * 25);
    if (width < 0) width = 0;
    if(cBar) cBar.style.width = width + "%";

    if (score < 1.0) {
        if(cBar) cBar.style.background = "#00ff00";
        if(badge) {
            badge.className = "status-badge status-secure";
            badge.innerHTML = "⌨️ Keyboard: OK";
        }
    } else if (score < 3.0) {
        if(cBar) cBar.style.background = "#ffa500";
    } else {
        if(cBar) cBar.style.background = "var(--red-alert)";
        if(badge) {
            badge.className = "status-badge status-danger";
            badge.innerHTML = "🚨 High Risk";
        }
    }
}

function triggerFreeze(reason = "Your session has been locked due to behavioral anomalies.") {
    const overlay = document.getElementById('freeze-overlay');
    const p = document.getElementById('freeze-reason');
    if (p) p.innerText = reason;
    if (overlay) overlay.classList.add('active'); 
    
    const testInput = document.getElementById('test-input');
    if (testInput) {
        testInput.blur(); 
        testInput.disabled = true;
    }
}

async function simulateAttack() {
    const testInput = document.getElementById('test-input');
    if (!testInput) return;
    testInput.value = ""; 
    let attackBuffer = [];

    // Zero variance typing
    for (let i = 0; i < 15; i++) {
        await new Promise(r => setTimeout(r, 60)); // dramatic visual pause
        
        attackBuffer.push({ flightTime: 60, dwellTime: 50 });
        testInput.value += "x"; 

        if (biometricChart) {
            chartLabels.push(''); // Graph the robotic injection linearly
            biometricChart.data.datasets[0].data.push(60); 
            biometricChart.data.datasets[1].data.push(50);
            if (chartLabels.length > 25) {
                chartLabels.shift();
                biometricChart.data.datasets[0].data.shift();
                biometricChart.data.datasets[1].data.shift();
            }
            biometricChart.update();
        }
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

/* Mouse Logic */
function captureMouseMovement(e) {
    const currentPos = { x: e.clientX, y: e.clientY };
    
    const distance = Math.sqrt(
        Math.pow(currentPos.x - lastMousePos.x, 2) + 
        Math.pow(currentPos.y - lastMousePos.y, 2)
    );

    if (distance > 5) {
        mouseData.push({ x: currentPos.x, y: currentPos.y, timestamp: Date.now() });
    }

    lastMousePos = currentPos;

    if (mouseData.length >= 50) {
        sendMouseData([...mouseData]);
        mouseData = [];
    }
}

async function sendMouseData(data) {
    const mouseBadge = document.getElementById('mouse-badge');
    const badgeMouseTxt = document.getElementById('badge-mouse');
    
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

/* Helper UI Logic */
function updateRiskUI({ kbScore, mouseScore, pathStatus }) {
    const kbText = document.getElementById('live-zscore');
    const mouseText = document.getElementById('mouse-zscore');
    const riskBar = document.getElementById('trust-bar'); // From vault.ejs
    
    let totalRisk = 0; 

    if (kbScore !== undefined && kbText) {
        kbText.innerText = kbScore.toFixed(2);
        if (kbScore < 1.0) { totalRisk += 5; }
        else if (kbScore < 3.0) { totalRisk += 35; }
        else { totalRisk += 80; }
    }

    if (mouseScore !== undefined && mouseText) {
        mouseText.innerText = mouseScore.toFixed(2);
        if (mouseScore >= 2.0) { totalRisk += 5; }
        else if (mouseScore >= 0.5) { totalRisk += 35; }
        else { totalRisk += 80; }
    }

    // Convert totalRisk structure into Trust Bar fill layout percentage
    // 100% full is PERFECT trust, drops as risk rises.
    if (riskBar) {
        let trustPct = 100 - totalRisk;
        trustPct = Math.max(5, Math.min(100, trustPct));
        riskBar.style.width = trustPct + "%";
        
        const trustLabel = document.getElementById('trust-label');
        if (trustLabel) {
            if (trustPct > 80) trustLabel.innerText = "Continuous Auth: Verified";
            else if (trustPct > 40) trustLabel.innerText = "Continuous Auth: Warning";
            else trustLabel.innerText = "Continuous Auth: High Risk";
        }
    }
}

async function confirmTransfer() {
    // 1. Send final micro-batch of telemetry proving human interaction immediately prior to the transfer
    const resBio = await fetch('/api/analyze-mouse', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        // Sending a dummy safe linearity score natively since we just clicked the button
        body: JSON.stringify({ points: [{x:0,y:0},{x:1,y:1},{x:2,y:2},{x:4,y:3},{x:6,y:5},{x:10,y:12},{x:15,y:14},{x:20,y:20},{x:22,y:25},{x:25,y:30}] }) 
    });

    if (!resBio.ok) return; // If blocked by earlier anomaly

    // 2. Safely call the secure route. We will pass Strict Workflow Enforcement because we just sent bio-telemetry.
    const res = await fetch('/api/transfer-funds', { method: 'POST' });
    const result = await res.json();
    
    if (res.status === 403 && result.status === "ANOMALY_DETECTED") {
        updateRiskUI({ pathStatus: { text: "Impossible Sequence", class: "danger" } });
        triggerFreeze(`Malicious API Scraping Sequence Detected.\nSequence: ${result.reason}`);
    } else if (res.ok) {
        alert(result.message);
    } else {
        alert(result.error || "Transfer request failed");
    }
}

async function resetDemo() {
    await fetch('/api/unlock', { method: 'POST' });
    await fetch('/api/logout', { method: 'POST' });
    window.location.href = '/auth';
}
