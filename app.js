// ==========================================
// ERRAND BOY APPLICATION CONTROLLER
// State, Booking, Tracking, Canvas Map,
// Chat Drawer, Wallet & Utilities.
// ==========================================

// ——— Global Application State ———
let state = {
    walletBalance: 185500.00,
    activeErrandsCount: 0,
    completedErrandsCount: 14,
    currentLocation: 'banana-island',
    activeErrand: null,
    trackingInterval: null,
    mapAnimFrame: null,
    chatOpen: false
};

// Cost Configuration for Services
const servicesCost = {
    'Market Run': 8500,
    'Chauffeur Hire': 15000,
    'Dispatch Rider': 4000,
    'Luxury Laundry': 6500
};

// ——— Initialize Application ———
document.addEventListener('DOMContentLoaded', () => {
    updateWalletUI();
    updateStatsUI();
    initMapCanvas();
});

// ——— UI Update Helpers ———
function updateWalletUI() {
    const formatted = formatNaira(state.walletBalance);
    const el = document.getElementById('wallet-balance');
    if (el) el.innerText = formatted;
    const modal = document.getElementById('wallet-balance-modal');
    if (modal) modal.innerText = formatted;
}

function updateStatsUI() {
    const active = document.getElementById('stat-active');
    const completed = document.getElementById('stat-completed');
    if (active) active.innerText = state.activeErrandsCount;
    if (completed) completed.innerText = state.completedErrandsCount;
}

function formatNaira(amount) {
    return '₦' + amount.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ——— Location Change ———
function changeLocation() {
    const sel = document.getElementById('location-select');
    state.currentLocation = sel.value;
    showToast('VIP Location updated: ' + sel.options[sel.selectedIndex].text);
}

// ——— Toast Notification System ———
function showToast(message) {
    const toast = document.getElementById('toast-notify');
    const msg = document.getElementById('toast-message');
    if (!toast || !msg) return;
    msg.innerText = message;
    toast.classList.add('show-toast');
    setTimeout(() => toast.classList.remove('show-toast'), 4000);
}

// ——— Modal Management: Booking ———
function openBookingModal(serviceType) {
    const overlay = document.getElementById('booking-modal');
    overlay.style.display = 'flex';
    document.querySelectorAll('.modal-sub-content').forEach(el => el.classList.remove('active-sub'));
    const target = document.getElementById('modal-content-' + serviceType);
    if (target) target.classList.add('active-sub');
}

function closeBookingModal() {
    document.getElementById('booking-modal').style.display = 'none';
}

// ——— Modal Management: Wallet ———
function openWalletModal() {
    document.getElementById('wallet-modal').style.display = 'flex';
}

function closeWalletModal() {
    document.getElementById('wallet-modal').style.display = 'none';
}

// ——— Switch Utility Tabs ———
function switchUtilTab(tabName) {
    document.querySelectorAll('.util-tab').forEach(btn => btn.classList.remove('active'));
    const active = Array.from(document.querySelectorAll('.util-tab')).find(b => b.innerText.toLowerCase().includes(tabName));
    if (active) active.classList.add('active');
    document.querySelectorAll('.util-form').forEach(f => f.classList.remove('active-form'));
    const form = document.getElementById('form-' + tabName);
    if (form) form.classList.add('active-form');
}

// ——— Wallet Top-Up ———
function handleTopUp(event) {
    event.preventDefault();
    const input = document.getElementById('topup-amount');
    const val = parseFloat(input.value);
    if (val && val > 0) {
        state.walletBalance += val;
        updateWalletUI();
        closeWalletModal();
        addTransaction('⚡', 'refund', 'Wallet Funded', '+' + formatNaira(val), true);
        showToast('Successful: Account funded with ' + formatNaira(val));
        input.value = '';
    }
}

// ——— Utility Payments ———
function handleUtilitySubmit(event, type) {
    event.preventDefault();
    let cost = 0;
    let desc = '';

    if (type === 'airtime') {
        cost = parseFloat(document.getElementById('airtime-amount').value);
        const phone = document.getElementById('airtime-phone').value;
        desc = 'Airtime recharge for ' + phone;
    } else if (type === 'power') {
        cost = parseFloat(document.getElementById('power-amount').value);
        const meter = document.getElementById('power-meter').value;
        desc = 'Electricity token for Meter ' + meter;
    } else if (type === 'cable') {
        const plan = document.getElementById('cable-plan');
        const iuc = document.getElementById('cable-iuc').value;
        if (plan.value.includes('premium')) cost = 29500;
        else if (plan.value.includes('compact')) cost = 19800;
        else if (plan.value.includes('confam')) cost = 9300;
        else cost = 4850;
        desc = 'Cable TV (' + plan.options[plan.selectedIndex].text + ') for IUC ' + iuc;
    }

    if (state.walletBalance < cost) {
        showToast('Error: Insufficient balance. Please fund your wallet.');
        return;
    }

    state.walletBalance -= cost;
    updateWalletUI();
    addTransaction('📱', 'charge', desc, '-' + formatNaira(cost), false);
    showToast('Payment Approved: ' + desc);
    event.target.reset();
}

// ——— Transaction History Helper ———
function addTransaction(icon, iconClass, title, amount, isPositive) {
    const list = document.getElementById('transaction-list');
    if (!list) return;
    const now = new Date();
    const dateStr = 'Today, ' + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const item = document.createElement('div');
    item.className = 'transaction-item';
    item.style.animation = 'slideInLog 0.4s ease forwards';
    item.innerHTML = '<span class="tx-icon ' + iconClass + '">' + icon + '</span>' +
        '<div class="tx-details"><span class="tx-title">' + title + '</span><span class="tx-date">' + dateStr + '</span></div>' +
        '<span class="tx-amount ' + (isPositive ? 'positive' : 'negative') + '">' + amount + '</span>';
    list.prepend(item);
}

// ——— Errand Booking Handler ———
function submitErrand(event, errandType) {
    event.preventDefault();

    let cost = servicesCost[errandType] || 5000;

    if (errandType === 'Market Run') {
        const urgency = document.getElementById('market-urgency').value;
        if (urgency === 'express') cost = 14000;
    } else if (errandType === 'Chauffeur Hire') {
        const cat = document.getElementById('chauffeur-type').value;
        const dur = parseInt(document.getElementById('chauffeur-duration').value);
        let rate = 15000;
        if (cat === 'vip') rate = 30000;
        else if (cat === 'escort') rate = 55000;
        cost = rate * dur;
    } else if (errandType === 'Dispatch Rider') {
        if (document.getElementById('delivery-class').value === 'bullet') cost = 7500;
    } else if (errandType === 'Luxury Laundry') {
        const bags = parseInt(document.getElementById('laundry-bags').value);
        const lType = document.getElementById('laundry-type').value;
        let base = 6500;
        if (bags === 2) base = 6250;
        else if (bags === 4) base = 6000;
        cost = base * bags;
        if (lType === 'dry-clean') cost += 5000;
    }

    if (state.walletBalance < cost) {
        showToast('Error: Insufficient wallet balance to hire Errand Boy.');
        return;
    }

    if (state.activeErrand) {
        showToast('You already have an active errand running. Track it on your dashboard.');
        closeBookingModal();
        return;
    }

    state.walletBalance -= cost;
    state.activeErrandsCount = 1;
    updateWalletUI();
    updateStatsUI();
    closeBookingModal();

    const errandId = 'EB-' + Math.floor(1000 + Math.random() * 9000);
    state.activeErrand = {
        id: errandId,
        type: errandType,
        step: 0,
        cost: cost,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    addTransaction('🏃', 'charge', errandType + ' (' + errandId + ')', '-' + formatNaira(cost), false);
    showToast('Concierge booked: ' + errandType + ' is now active.');
    startSimulatedTracking();
    event.target.reset();
}

// ==========================================
// LIVE TRACKING SIMULATION ENGINE
// ==========================================

function startSimulatedTracking() {
    const errand = state.activeErrand;
    if (!errand) return;

    document.getElementById('no-errands-state').style.display = 'none';
    document.getElementById('active-tracker-layout').style.display = 'block';

    document.getElementById('track-title').innerText = errand.type;
    document.getElementById('track-id').innerText = 'ID: ' + errand.id;

    const stages = getTrackingStages(errand.type);
    const logContainer = document.getElementById('track-logs');
    logContainer.innerHTML = '';

    // Start canvas animation
    startMapAnimation(stages);

    // Start chat simulation
    startChatSimulation(errand.type);

    const executeTick = () => {
        if (errand.step >= stages.length) {
            clearInterval(state.trackingInterval);
            state.activeErrandsCount = 0;
            state.completedErrandsCount += 1;
            updateStatsUI();

            showToast('Completed: Errand ' + errand.id + ' has been delivered successfully.');

            document.getElementById('track-status').innerText = 'Delivered ✓';
            document.getElementById('track-progress').style.width = '100%';
            document.getElementById('track-eta').innerText = 'Completed';

            setTimeout(() => {
                state.activeErrand = null;
                if (state.mapAnimFrame) cancelAnimationFrame(state.mapAnimFrame);
                document.getElementById('no-errands-state').style.display = 'flex';
                document.getElementById('active-tracker-layout').style.display = 'none';
                drawIdleMap();
            }, 10000);
            return;
        }

        const stage = stages[errand.step];
        document.getElementById('track-status').innerText = stage.status;
        document.getElementById('track-progress').style.width = stage.progress + '%';
        document.getElementById('track-eta').innerText = stage.eta;

        const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const logItem = document.createElement('div');
        logItem.className = 'log-item active';
        logItem.innerHTML = '<span class="log-bullet"></span><div class="log-details"><p class="log-text">' + stage.log + '</p><span class="log-time">' + timeNow + '</span></div>';

        document.querySelectorAll('.timeline-logs .log-item').forEach(el => el.classList.remove('active'));
        logContainer.prepend(logItem);

        errand.step += 1;
    };

    executeTick();
    state.trackingInterval = setInterval(executeTick, 7000);
}

function getTrackingStages(errandType) {
    const base = [
        { progress: 15, status: 'Assigning', eta: '45 mins', log: 'Finding nearest vetted Errand Boy...' },
        { progress: 30, status: 'En Route', eta: '35 mins', log: 'Errand Boy accepted. Heading to location.' }
    ];

    let mid = [];
    if (errandType === 'Market Run') {
        mid = [
            { progress: 55, status: 'Purchasing', eta: '25 mins', log: 'Errand Boy shopping for items at Spar / Market.' },
            { progress: 75, status: 'Transit', eta: '12 mins', log: 'Checkout completed. Dispatch courier en route.' }
        ];
    } else if (errandType === 'Chauffeur Hire') {
        mid = [
            { progress: 55, status: 'Arrived', eta: 'Full day', log: 'Chauffeur arrived at client pick-up address.' },
            { progress: 80, status: 'Active Duty', eta: 'Full day', log: 'Chauffeur active. Navigating V.I. and Ikoyi corridor.' }
        ];
    } else if (errandType === 'Dispatch Rider') {
        mid = [
            { progress: 50, status: 'Picked Up', eta: '20 mins', log: 'Parcel successfully secured from sender.' },
            { progress: 80, status: 'Transit', eta: '8 mins', log: 'Rider crossing Lekki Phase 1 / Toll gate.' }
        ];
    } else {
        mid = [
            { progress: 50, status: 'Collecting', eta: '3 hrs', log: 'Courier picking up VIP laundry bag.' },
            { progress: 75, status: 'Processing', eta: '1 hr', log: 'Garments processing at premium dry-clean facility.' }
        ];
    }

    const end = [
        { progress: 92, status: 'Arriving', eta: '2 mins', log: 'Courier checking in at Banana Island / Residence Security Gate.' },
        { progress: 100, status: 'Delivered', eta: 'Done', log: 'Errand completed. Handed over to client.' }
    ];

    return [...base, ...mid, ...end];
}

// ==========================================
// CANVAS MAP — Schematic Lagos Corridor
// ==========================================

const mapLocations = {
    'Banana Island': { x: 0.15, y: 0.3 },
    'Ikoyi': { x: 0.3, y: 0.2 },
    'V.I.': { x: 0.45, y: 0.45 },
    'Lekki Phase 1': { x: 0.65, y: 0.55 },
    'Toll Gate': { x: 0.78, y: 0.65 },
    'Jakande': { x: 0.88, y: 0.7 }
};

const mapRoute = ['Jakande', 'Toll Gate', 'Lekki Phase 1', 'V.I.', 'Ikoyi', 'Banana Island'];

const realGpsCoords = {
    'Banana Island': { lat: 6.46780, lng: 3.44740 },
    'Ikoyi': { lat: 6.45490, lng: 3.42460 },
    'V.I.': { lat: 6.42810, lng: 3.42190 },
    'Lekki Phase 1': { lat: 6.43730, lng: 3.44280 },
    'Toll Gate': { lat: 6.43800, lng: 3.44100 },
    'Jakande': { lat: 6.43580, lng: 3.50420 }
};

let mapCanvas, mapCtx;

function initMapCanvas() {
    mapCanvas = document.getElementById('map-canvas');
    if (!mapCanvas) return;
    mapCtx = mapCanvas.getContext('2d');
    resizeCanvas();
    window.addEventListener('resize', () => { resizeCanvas(); drawIdleMap(); });
    drawIdleMap();
}

function resizeCanvas() {
    if (!mapCanvas) return;
    const wrapper = mapCanvas.parentElement;
    mapCanvas.width = wrapper.clientWidth;
    mapCanvas.height = wrapper.clientHeight;
}

function drawIdleMap() {
    if (!mapCtx) return;
    const w = mapCanvas.width;
    const h = mapCanvas.height;
    mapCtx.clearRect(0, 0, w, h);

    // Draw road network
    mapCtx.strokeStyle = 'rgba(255, 85, 0, 0.08)';
    mapCtx.lineWidth = 2;
    mapCtx.setLineDash([6, 4]);
    mapCtx.beginPath();
    mapRoute.forEach((name, i) => {
        const loc = mapLocations[name];
        if (i === 0) mapCtx.moveTo(loc.x * w, loc.y * h);
        else mapCtx.lineTo(loc.x * w, loc.y * h);
    });
    mapCtx.stroke();
    mapCtx.setLineDash([]);

    // Draw location dots
    Object.entries(mapLocations).forEach(([name, pos]) => {
        const x = pos.x * w;
        const y = pos.y * h;

        // Glow
        const glow = mapCtx.createRadialGradient(x, y, 0, x, y, 12);
        glow.addColorStop(0, 'rgba(255, 85, 0, 0.25)');
        glow.addColorStop(1, 'rgba(255, 85, 0, 0)');
        mapCtx.fillStyle = glow;
        mapCtx.beginPath();
        mapCtx.arc(x, y, 12, 0, Math.PI * 2);
        mapCtx.fill();

        // Dot
        mapCtx.fillStyle = 'rgba(255, 85, 0, 0.7)';
        mapCtx.beginPath();
        mapCtx.arc(x, y, 4, 0, Math.PI * 2);
        mapCtx.fill();

        // Label
        mapCtx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        mapCtx.font = '10px Outfit, sans-serif';
        mapCtx.fillText(name, x + 8, y - 8);
    });
}

function startMapAnimation(stages) {
    if (!mapCtx) return;

    const w = mapCanvas.width;
    const h = mapCanvas.height;
    const routePoints = mapRoute.map(name => ({
        x: mapLocations[name].x * w,
        y: mapLocations[name].y * h
    }));
    const gpsRoutePoints = mapRoute.map(name => realGpsCoords[name]);

    let progress = 0;
    const totalDuration = stages.length * 7000; // total ms for all stages
    const startTime = Date.now();

    function animate() {
        const elapsed = Date.now() - startTime;
        progress = Math.min(elapsed / totalDuration, 1);

        drawIdleMap();

        // Draw traced path
        const totalLen = getRouteLength(routePoints);
        const tracedLen = progress * totalLen;
        let accumulated = 0;

        mapCtx.strokeStyle = 'rgba(255, 85, 0, 0.6)';
        mapCtx.lineWidth = 3;
        mapCtx.shadowColor = 'rgba(255, 85, 0, 0.4)';
        mapCtx.shadowBlur = 8;
        mapCtx.beginPath();
        mapCtx.moveTo(routePoints[0].x, routePoints[0].y);

        let bikePos = { x: routePoints[0].x, y: routePoints[0].y };
        let gpsPos = { lat: gpsRoutePoints[0].lat, lng: gpsRoutePoints[0].lng };

        for (let i = 1; i < routePoints.length; i++) {
            const segLen = dist(routePoints[i - 1], routePoints[i]);
            if (accumulated + segLen <= tracedLen) {
                mapCtx.lineTo(routePoints[i].x, routePoints[i].y);
                accumulated += segLen;
                bikePos = { x: routePoints[i].x, y: routePoints[i].y };
                gpsPos = { lat: gpsRoutePoints[i].lat, lng: gpsRoutePoints[i].lng };
            } else {
                const remain = tracedLen - accumulated;
                const t = remain / segLen;
                const px = routePoints[i - 1].x + t * (routePoints[i].x - routePoints[i - 1].x);
                const py = routePoints[i - 1].y + t * (routePoints[i].y - routePoints[i - 1].y);
                mapCtx.lineTo(px, py);
                bikePos = { x: px, y: py };

                // Interpolate GPS coordinates
                const pLat = gpsRoutePoints[i - 1].lat + t * (gpsRoutePoints[i].lat - gpsRoutePoints[i - 1].lat);
                const pLng = gpsRoutePoints[i - 1].lng + t * (gpsRoutePoints[i].lng - gpsRoutePoints[i - 1].lng);
                gpsPos = { lat: pLat, lng: pLng };
                break;
            }
        }

        mapCtx.stroke();
        mapCtx.shadowBlur = 0;

        // Draw bike icon
        drawBikeMarker(bikePos.x, bikePos.y);

        // Update live GPS coordinates in UI
        const gpsEl = document.getElementById('track-gps');
        if (gpsEl) {
            gpsEl.innerText = `${gpsPos.lat.toFixed(5)}° N, ${gpsPos.lng.toFixed(5)}° E`;
        }

        if (progress < 1 && state.activeErrand) {
            state.mapAnimFrame = requestAnimationFrame(animate);
        }
    }

    animate();
}

function drawBikeMarker(x, y) {
    // Outer glow
    const glow = mapCtx.createRadialGradient(x, y, 0, x, y, 20);
    glow.addColorStop(0, 'rgba(255, 85, 0, 0.4)');
    glow.addColorStop(1, 'rgba(255, 85, 0, 0)');
    mapCtx.fillStyle = glow;
    mapCtx.beginPath();
    mapCtx.arc(x, y, 20, 0, Math.PI * 2);
    mapCtx.fill();

    // Inner circle
    mapCtx.fillStyle = '#ff5500';
    mapCtx.beginPath();
    mapCtx.arc(x, y, 8, 0, Math.PI * 2);
    mapCtx.fill();

    // Emoji bike
    mapCtx.font = '14px sans-serif';
    mapCtx.fillText('🚴', x - 7, y + 5);
}

function getRouteLength(points) {
    let len = 0;
    for (let i = 1; i < points.length; i++) len += dist(points[i - 1], points[i]);
    return len;
}

function dist(a, b) {
    return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

// ==========================================
// CHAT DRAWER SYSTEM
// ==========================================


function toggleChatDrawer() {
    const drawer = document.getElementById('chat-drawer-container');
    state.chatOpen = !state.chatOpen;
    if (state.chatOpen) {
        drawer.classList.add('open');
        const badge = document.getElementById('chat-badge');
        if (badge) badge.style.display = 'none';
        checkApiKeyAndRenderBanner();
    } else {
        drawer.classList.remove('open');
    }
}

function sendClientChatMessage(event) {
    event.preventDefault();
    const input = document.getElementById('chat-input-field');
    const text = input.value.trim();
    if (!text) return;
    appendChatBubble(text, 'client');
    input.value = '';

    const apiKey = localStorage.getItem('gemini_api_key');
    if (apiKey && state.activeErrand) {
        showTypingIndicator();
        callGeminiAPI(text)
            .then(reply => {
                removeTypingIndicator();
                appendChatBubble(reply, 'runner');
            })
            .catch(err => {
                removeTypingIndicator();
                console.error(err);
                showToast('Gemini Error: ' + err.message);
                fallbackSimulatedReply();
            });
    } else {
        fallbackSimulatedReply();
    }
}

function fallbackSimulatedReply() {
    showTypingIndicator();
    setTimeout(() => {
        removeTypingIndicator();
        const replies = [
            "Noted boss! I'll handle it right away.",
            "No wahala, I'm on it!",
            "Copy that, sir. Almost done here.",
            "Thank you for the update. Will do!",
            "Yes sir, I'm close to the location now.",
            "I understand, I will make sure to get the best quality."
        ];
        const reply = replies[Math.floor(Math.random() * replies.length)];
        appendChatBubble(reply, 'runner');
    }, 1000 + Math.random() * 1000);
}

function showTypingIndicator() {
    const box = document.getElementById('chat-messages-box');
    if (!box) return;
    removeTypingIndicator();
    const indicator = document.createElement('div');
    indicator.className = 'typing-indicator';
    indicator.id = 'chat-typing-indicator';
    indicator.innerHTML = `
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
    `;
    box.appendChild(indicator);
    box.scrollTop = box.scrollHeight;
}

function removeTypingIndicator() {
    const indicator = document.getElementById('chat-typing-indicator');
    if (indicator) indicator.remove();
}

function appendChatBubble(text, sender) {
    const box = document.getElementById('chat-messages-box');
    if (!box) return;
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble ' + sender;
    bubble.innerHTML = text + '<span class="chat-time">' + time + '</span>';
    box.appendChild(bubble);
    box.scrollTop = box.scrollHeight;

    if (sender === 'runner' && !state.chatOpen) {
        const badge = document.getElementById('chat-badge');
        if (badge) badge.style.display = 'inline-flex';
    }
}

function startChatSimulation(errandType) {
    const box = document.getElementById('chat-messages-box');
    if (box) box.innerHTML = '';

    const runnerNames = ['Tunde', 'Chidi', 'Emeka', 'Segun', 'Yinka'];
    const name = runnerNames[Math.floor(Math.random() * runnerNames.length)];
    const nameEl = document.getElementById('chat-runner-name');
    if (nameEl) nameEl.innerText = 'Runner ' + name;

    const greetings = {
        'Market Run': "Good day sir! I'm " + name + ", your market runner. I'm heading to the shopping location now. I'll update you as I go. 🛒",
        'Chauffeur Hire': "Good day sir! I'm " + name + ", your assigned chauffeur for today. I'm on my way to the pick-up address. 🚗",
        'Dispatch Rider': "Hello! I'm " + name + " and I'll be handling your dispatch. Heading to pickup now. 📦",
        'Luxury Laundry': "Good day! I'm " + name + ". I'm coming to collect your laundry bags shortly. 🧺"
    };

    setTimeout(() => {
        const greeting = greetings[errandType] || "Hello! I'm your Errand Boy for today.";
        appendChatBubble(greeting, 'runner');
        
        if (state.activeErrand) {
            state.activeErrand.chatHistory = [
                {
                    role: 'model',
                    parts: [{ text: greeting }]
                }
            ];
        }
    }, 3000);

    const followUps = [
        { delay: 14000, msg: "Update: I've arrived at the location. Starting now." },
        { delay: 28000, msg: "Making good progress sir. Almost done here." },
        { delay: 42000, msg: "Wrapping up! I'll be heading to your address shortly." }
    ];

    followUps.forEach(fu => {
        setTimeout(() => {
            if (state.activeErrand) {
                appendChatBubble(fu.msg, 'runner');
                if (state.activeErrand.chatHistory) {
                    state.activeErrand.chatHistory.push({
                        role: 'model',
                        parts: [{ text: fu.msg }]
                    });
                }
            }
        }, fu.delay);
    });
}

// ——— Gemini API & Modal Utilities ———
function openApiKeyModal() {
    document.getElementById('api-key-modal').style.display = 'flex';
    const savedKey = localStorage.getItem('gemini_api_key') || '';
    document.getElementById('gemini-api-key').value = savedKey;
}

function closeApiKeyModal() {
    document.getElementById('api-key-modal').style.display = 'none';
}

function saveApiKey(event) {
    event.preventDefault();
    const key = document.getElementById('gemini-api-key').value.trim();
    if (key) {
        localStorage.setItem('gemini_api_key', key);
        showToast('Gemini API Key saved successfully!');
        closeApiKeyModal();
        checkApiKeyAndRenderBanner();
    }
}

function clearApiKey() {
    localStorage.removeItem('gemini_api_key');
    document.getElementById('gemini-api-key').value = '';
    showToast('Gemini API Key cleared.');
    closeApiKeyModal();
    checkApiKeyAndRenderBanner();
}

function checkApiKeyAndRenderBanner() {
    const box = document.getElementById('chat-messages-box');
    if (!box) return;
    
    const existing = document.getElementById('gemini-warning-banner');
    if (existing) existing.remove();
    
    const key = localStorage.getItem('gemini_api_key');
    if (!key) {
        const banner = document.createElement('div');
        banner.className = 'gemini-notice-banner';
        banner.id = 'gemini-warning-banner';
        banner.innerHTML = `
            <p>🤖 <strong>Enable Gemini AI Chat:</strong> The chat runner is currently running in fallback simulation mode. Save your Gemini API Key to enable context-aware AI conversations.</p>
            <button class="gemini-notice-btn" onclick="openApiKeyModal()">Configure Gemini Key</button>
        `;
        box.prepend(banner);
    }
}

async function callGeminiAPI(userMessage) {
    const apiKey = localStorage.getItem('gemini_api_key');
    if (!apiKey) throw new Error('API Key missing');

    const errand = state.activeErrand;
    if (!errand) {
        return "I'm not on an active errand for you right now, boss. Let me know when you book a service!";
    }

    const nameEl = document.getElementById('chat-runner-name');
    const runnerName = nameEl ? nameEl.innerText : 'Runner Tunde';

    const currentLocSelect = document.getElementById('location-select');
    const currentLocText = currentLocSelect ? currentLocSelect.options[currentLocSelect.selectedIndex].text : "Lagos";
    
    let errandDetails = "";
    if (errand.type === 'Market Run') {
        const items = document.getElementById('market-items') ? document.getElementById('market-items').value : "groceries";
        const locSelect = document.getElementById('market-loc');
        const loc = locSelect ? locSelect.value : "local market";
        const urgencySelect = document.getElementById('market-urgency');
        const urgency = urgencySelect ? urgencySelect.value : "standard";
        errandDetails = `Shopping list: ${items}. Shopping store: ${loc}. Urgency: ${urgency}.`;
    } else if (errand.type === 'Chauffeur Hire') {
        const typeSelect = document.getElementById('chauffeur-type');
        const type = typeSelect ? typeSelect.value : "standard";
        const durSelect = document.getElementById('chauffeur-duration');
        const dur = durSelect ? durSelect.value : "1";
        const pickupInput = document.getElementById('chauffeur-pickup');
        const pickup = pickupInput ? pickupInput.value : "Banana Island";
        errandDetails = `Chauffeur Category: ${type}. Duration: ${dur} days. Pickup address: ${pickup}.`;
    } else if (errand.type === 'Dispatch Rider') {
        const pkgInput = document.getElementById('delivery-package');
        const pkg = pkgInput ? pkgInput.value : "parcel";
        const pickupInput = document.getElementById('delivery-pickup');
        const pickup = pickupInput ? pickupInput.value : "Lekki";
        const dropoffInput = document.getElementById('delivery-dropoff');
        const dropoff = dropoffInput ? dropoffInput.value : "Ikoyi";
        const classSelect = document.getElementById('delivery-class');
        const delClass = classSelect ? classSelect.value : "standard";
        errandDetails = `Package: ${pkg}. Pickup: ${pickup}. Dropoff: ${dropoff}. Class: ${delClass}.`;
    } else if (errand.type === 'Luxury Laundry') {
        const bagsSelect = document.getElementById('laundry-bags');
        const bags = bagsSelect ? bagsSelect.value : "1";
        const lTypeSelect = document.getElementById('laundry-type');
        const lType = lTypeSelect ? lTypeSelect.value : "wash-fold";
        const timeInput = document.getElementById('laundry-time');
        const time = timeInput ? timeInput.value : "scheduled";
        errandDetails = `Bags: ${bags}. Care Class: ${lType}. Pickup time: ${time}.`;
    }

    const currentStatus = document.getElementById('track-status') ? document.getElementById('track-status').innerText : 'Active';
    const currentEta = document.getElementById('track-eta') ? document.getElementById('track-eta').innerText : 'Pending';

    const systemInstruction = `You are a professional, vetted personal concierge runner in Lagos, Nigeria working for the luxury concierge app 'Errand Boy'.
Your character details:
- Name: "${runnerName}"
- Role: Errand Boy Concierge/Runner
- Client Profile: Obsidian VIP status resident of "${currentLocText}". Speak to them with premium customer care, respect, and subtle professional Nigerian/Lagos flair (e.g., mix of polished English with warm, polite local concierge expressions like "boss", "sir/ma", "No wahala", "I will get it done right away").
- Current Active Errand: "${errand.type}" (ID: ${errand.id})
- Errand Status: "${currentStatus}" (ETA: ${currentEta})
- Errand Details: ${errandDetails}

Guidelines:
1. Respond to the user's message in character as their runner.
2. Be brief (1-3 sentences) - this is a chat conversation.
3. Be helpful, professional, and reassuring.
4. Keep the context of the active errand stage in mind (e.g. if status is "Delivered", you've completed it; if it is "Purchasing", you are shopping).
5. Always reference specific details of the errand if the user asks.`;

    if (!errand.chatHistory) {
        errand.chatHistory = [];
        const greetingBubble = document.querySelector('.chat-bubble.runner');
        if (greetingBubble) {
            errand.chatHistory.push({
                role: 'model',
                parts: [{ text: greetingBubble.innerText.replace(/[\d:]+(?:[AP]M)?$/, '').trim() }]
            });
        }
    }

    const contents = [...errand.chatHistory];
    contents.push({
        role: 'user',
        parts: [{ text: userMessage }]
    });

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            contents: contents,
            systemInstruction: {
                parts: [{ text: systemInstruction }]
            },
            generationConfig: {
                maxOutputTokens: 150,
                temperature: 0.7
            }
        })
    });

    if (!response.ok) {
        const errorData = await response.json();
        console.error('Gemini API Error:', errorData);
        throw new Error(errorData.error?.message || 'Failed to call Gemini API');
    }

    const data = await response.json();
    const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!replyText) throw new Error('Empty response from Gemini API');

    errand.chatHistory.push({
        role: 'user',
        parts: [{ text: userMessage }]
    });
    errand.chatHistory.push({
        role: 'model',
        parts: [{ text: replyText }]
    });

    return replyText;
}

// ==========================================
// CLOSE MODALS ON OVERLAY CLICK
// ==========================================
document.addEventListener('click', (e) => {
    if (e.target.id === 'booking-modal') closeBookingModal();
    if (e.target.id === 'wallet-modal') closeWalletModal();
    if (e.target.id === 'api-key-modal') closeApiKeyModal();
});
