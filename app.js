document.addEventListener('DOMContentLoaded', () => {
    if (typeof lucide !== 'undefined') lucide.createIcons();

    // ===== STATE =====
    let currentStep = 1;
    let scratchResult = null;
    let isScratching = false;
    let scratchCompleted = false;
    let dustParticles = [];
    let scratchPercent = 0;
    let lastScratchTime = 0;
    let scratchSpeed = 0;

    // ===== ELEMENTS =====
    const slides = document.querySelectorAll('.question-slide');
    const optionCards = document.querySelectorAll('.option-card');
    const progressBar = document.getElementById('quiz-progress');
    const stepCurrent = document.getElementById('step-current');
    const viewQuiz = document.getElementById('step-questionnaire');
    const viewTransition = document.getElementById('step-transition');
    const viewScratch = document.getElementById('step-scratchcard');

    const canvas = document.getElementById('scratch-layer');
    const ctx = canvas ? canvas.getContext('2d', { willReadFrequently: true }) : null;
    const dustCanvas = document.getElementById('dust-layer');
    const dustCtx = dustCanvas ? dustCanvas.getContext('2d') : null;
    const ticketResult = document.getElementById('ticket-result');
    const resultTexts = document.getElementById('result-texts');
    const prizeStatus = document.getElementById('prize-status');
    const prizeAmount = document.getElementById('prize-amount');
    const prizeLabel = document.getElementById('prize-label');
    const prizeIconContainer = document.getElementById('prize-icon-container');

    const actionFooter = document.getElementById('action-footer');
    const actionMsg = document.getElementById('action-msg');
    const btnRetry = document.getElementById('btn-retry');
    const scratchProgressBar = document.getElementById('scratch-progress');
    const scratchProgressFill = document.getElementById('scratch-progress-fill');

    // ===== AMBIENT PARTICLES =====
    initAmbientParticles();

    // ===== PARTICIPANTS COUNTER =====
    animateParticipants();

    // ===== CHECK PAID RETURN =====
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('paid')) {
        setTimeout(() => startTransition(), 50);
    }

    // ===== QUIZ LOGIC =====
    optionCards.forEach(card => {
        card.addEventListener('click', function () {
            // Ripple effect
            this.style.transform = 'scale(0.93)';
            setTimeout(() => { this.style.transform = ''; }, 150);

            const currentSlide = this.closest('.question-slide');
            currentSlide.classList.remove('active');
            currentSlide.classList.add('exit');

            currentStep++;
            if (stepCurrent) stepCurrent.textContent = Math.min(currentStep, slides.length);

            const progress = Math.min((currentStep / slides.length) * 100, 100);
            progressBar.style.width = `${progress}%`;

            setTimeout(() => {
                if (currentStep <= slides.length) {
                    const next = document.querySelector(`.question-slide[data-step="${currentStep}"]`);
                    if (next) next.classList.add('active');
                } else {
                    startTransition();
                }
            }, 350);
        });
    });

    // ===== CPF LOGIC =====
    const cpfInput = document.getElementById('cpf-input');
    const btnValidateCpf = document.getElementById('btn-validate-cpf');
    const cpfError = document.getElementById('cpf-error');

    if (cpfInput) {
        cpfInput.addEventListener('input', function (e) {
            let v = e.target.value.replace(/\D/g, '');
            if (v.length > 11) v = v.slice(0, 11);
            if (v.length > 9) v = v.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, "$1.$2.$3-$4");
            else if (v.length > 6) v = v.replace(/(\d{3})(\d{3})(\d{1,3})/, "$1.$2.$3");
            else if (v.length > 3) v = v.replace(/(\d{3})(\d{1,3})/, "$1.$2");
            e.target.value = v;
        });

        btnValidateCpf.addEventListener('click', async () => {
            const rawCpf = cpfInput.value.replace(/\D/g, '');
            if (rawCpf.length !== 11 || !validateCpfDigits(rawCpf)) {
                cpfError.innerText = "CPF inválido. Verifique os números.";
                cpfError.style.display = 'block';
                cpfInput.style.borderColor = '#ef4444';
                setTimeout(() => { cpfInput.style.borderColor = ''; }, 2000);
                return;
            }

            btnValidateCpf.innerHTML = `<span>Validando...</span><i data-lucide="loader-2" class="spin-icon" style="width:20px;height:20px"></i>`;
            if (typeof lucide !== 'undefined') lucide.createIcons();
            btnValidateCpf.classList.add('loading');
            cpfError.style.display = 'none';

            try {
                const res = await fetch('/api/verify-cpf', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ cpf: rawCpf })
                });
                const data = await res.json();

                if (res.ok && data.success) {
                    if (data.already_used) {
                        // CPF já usado — redireciona para pagamento
                        cpfError.innerHTML = "Você já resgatou sua chance grátis! <br>Redirecionando para jogar novamente por R$ 3,00...";
                        cpfError.style.display = 'block';
                        cpfError.style.color = '#fbbf24';
                        resetCpfBtn();

                        setTimeout(async () => {
                            try {
                                const checkoutRes = await fetch('/api/checkout', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ price: 3.00, description: 'Nova Raspadinha (R$ 3,00)' })
                                });
                                const checkoutData = await checkoutRes.json();
                                if (checkoutData.url) {
                                    window.location.href = checkoutData.url;
                                }
                            } catch {
                                cpfError.innerHTML = "Erro ao redirecionar. Tente novamente.";
                                cpfError.style.color = '#f87171';
                            }
                        }, 2000);
                    } else {
                        startTransition();
                    }
                } else {
                    cpfError.innerText = data.error || "Erro ao validar CPF.";
                    cpfError.style.display = 'block';
                    resetCpfBtn();
                }
            } catch {
                cpfError.innerText = "Erro de conexão. Tente novamente.";
                cpfError.style.display = 'block';
                resetCpfBtn();
            }
        });
    }

    function resetCpfBtn() {
        btnValidateCpf.innerHTML = `<span>Validar & Ganhar</span><i data-lucide="arrow-right"></i>`;
        if (typeof lucide !== 'undefined') lucide.createIcons();
        btnValidateCpf.classList.remove('loading');
    }

    function validateCpfDigits(cpf) {
        if (/^(\d)\1{10}$/.test(cpf)) return false;
        let sum = 0;
        for (let i = 0; i < 9; i++) sum += parseInt(cpf[i]) * (10 - i);
        let d1 = 11 - (sum % 11);
        if (d1 >= 10) d1 = 0;
        if (parseInt(cpf[9]) !== d1) return false;
        sum = 0;
        for (let i = 0; i < 10; i++) sum += parseInt(cpf[i]) * (11 - i);
        let d2 = 11 - (sum % 11);
        if (d2 >= 10) d2 = 0;
        return parseInt(cpf[10]) === d2;
    }

    // ===== TRANSITION SCREEN =====
    function startTransition() {
        viewQuiz.classList.remove('active');
        setTimeout(() => {
            viewQuiz.style.display = 'none';
            viewTransition.style.display = 'block';
            void viewTransition.offsetWidth;
            viewTransition.classList.add('active');
            if (typeof lucide !== 'undefined') lucide.createIcons();

            // Animate steps
            const ts1 = document.getElementById('ts-1');
            const ts2 = document.getElementById('ts-2');
            const ts3 = document.getElementById('ts-3');

            setTimeout(() => { ts1.classList.add('done'); }, 600);
            setTimeout(() => { ts2.classList.add('active'); }, 1200);
            setTimeout(() => { ts2.classList.remove('active'); ts2.classList.add('done'); }, 2200);
            setTimeout(() => { ts3.classList.add('active'); }, 2600);
            setTimeout(() => { ts3.classList.remove('active'); ts3.classList.add('done'); }, 3400);

            // Move to scratchcard
            setTimeout(() => {
                viewTransition.classList.remove('active');
                setTimeout(() => {
                    viewTransition.style.display = 'none';
                    viewScratch.style.display = 'block';
                    void viewScratch.offsetWidth;
                    viewScratch.classList.add('active');
                    if (typeof lucide !== 'undefined') lucide.createIcons();
                    initScratchCard();
                    fetchScratchResult();
                }, 500);
            }, 4000);
        }, 500);
    }

    // ===== FETCH RESULT =====
    async function fetchScratchResult() {
        try {
            const res = await fetch('/api/play');
            scratchResult = await res.json();
        } catch {
            scratchResult = { win: false, prize: null };
        }
    }

    // ===== SCRATCH CARD ENGINE =====
    function initScratchCard() {
        if (!canvas || !ctx) return;

        const rect = canvas.parentElement.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        const w = rect.width;
        const h = rect.height;

        canvas.width = w * dpr;
        canvas.height = h * dpr;
        ctx.scale(dpr, dpr);
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;

        if (dustCanvas && dustCtx) {
            dustCanvas.width = w * dpr;
            dustCanvas.height = h * dpr;
            dustCtx.scale(dpr, dpr);
            dustCanvas.style.width = `${w}px`;
            dustCanvas.style.height = `${h}px`;
        }

        // === Draw Premium Metallic Surface ===
        // Base dark layer
        ctx.fillStyle = '#1a1f2e';
        ctx.fillRect(0, 0, w, h);

        // Metallic silver gradient
        const metalGrad = ctx.createLinearGradient(0, 0, w, h);
        metalGrad.addColorStop(0, '#7a8599');
        metalGrad.addColorStop(0.2, '#b0bec5');
        metalGrad.addColorStop(0.4, '#8a9bae');
        metalGrad.addColorStop(0.5, '#cfd8dc');
        metalGrad.addColorStop(0.6, '#90a4ae');
        metalGrad.addColorStop(0.8, '#b0bec5');
        metalGrad.addColorStop(1, '#78909c');
        ctx.fillStyle = metalGrad;
        ctx.fillRect(0, 0, w, h);

        // Brushed metal texture
        ctx.strokeStyle = 'rgba(255,255,255,0.04)';
        ctx.lineWidth = 1;
        for (let y = 0; y < h; y += 2) {
            ctx.beginPath();
            ctx.moveTo(0, y + Math.random() * 1);
            ctx.lineTo(w, y + Math.random() * 1);
            ctx.stroke();
        }

        // Subtle noise
        ctx.fillStyle = 'rgba(0,0,0,0.02)';
        for (let i = 0; i < w; i += 3) {
            for (let j = 0; j < h; j += 3) {
                if (Math.random() > 0.5) ctx.fillRect(i, j, 2, 2);
            }
        }

        // Holographic stripe
        const holoGrad = ctx.createLinearGradient(0, h * 0.3, w, h * 0.7);
        holoGrad.addColorStop(0, 'rgba(139,92,246,0.08)');
        holoGrad.addColorStop(0.3, 'rgba(245,158,11,0.06)');
        holoGrad.addColorStop(0.5, 'rgba(255,255,255,0.1)');
        holoGrad.addColorStop(0.7, 'rgba(217,70,239,0.06)');
        holoGrad.addColorStop(1, 'rgba(59,130,246,0.08)');
        ctx.fillStyle = holoGrad;
        ctx.fillRect(0, 0, w, h);

        // Center text
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.font = '800 22px Outfit';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0,0,0,0.3)';
        ctx.shadowBlur = 6;
        ctx.fillText('✦ RASPE AQUI ✦', w / 2, h / 2 - 10);

        ctx.font = '400 13px Outfit';
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.shadowBlur = 0;
        ctx.fillText('Deslize para revelar seu prêmio', w / 2, h / 2 + 18);

        // Setup eraser
        ctx.globalCompositeOperation = 'destination-out';

        // ===== SCRATCH EVENTS =====
        let lastPos = null;

        const getPos = (e) => {
            const r = canvas.getBoundingClientRect();
            const cx = e.touches ? e.touches[0].clientX : e.clientX;
            const cy = e.touches ? e.touches[0].clientY : e.clientY;
            return { x: cx - r.left, y: cy - r.top };
        };

        // Dust particle animation loop
        function animateDust() {
            if (!dustCtx) return;
            dustCtx.clearRect(0, 0, w, h);

            for (let i = dustParticles.length - 1; i >= 0; i--) {
                const p = dustParticles[i];
                p.x += p.vx;
                p.y += p.vy;
                p.vy += 0.2;
                p.life -= 0.025;
                p.rotation += p.rotSpeed;

                if (p.life <= 0) {
                    dustParticles.splice(i, 1);
                } else {
                    dustCtx.save();
                    dustCtx.translate(p.x, p.y);
                    dustCtx.rotate(p.rotation);
                    dustCtx.globalAlpha = p.life * 0.8;
                    dustCtx.fillStyle = p.color;

                    if (p.type === 'flake') {
                        dustCtx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
                    } else if (p.type === 'spark') {
                        dustCtx.beginPath();
                        dustCtx.arc(0, 0, p.size * 0.5, 0, Math.PI * 2);
                        dustCtx.fill();
                    } else {
                        dustCtx.beginPath();
                        dustCtx.arc(0, 0, p.size, 0, Math.PI * 2);
                        dustCtx.fill();
                    }
                    dustCtx.restore();
                }
            }
            dustCtx.globalAlpha = 1;
            requestAnimationFrame(animateDust);
        }
        animateDust();

        function emitParticles(pos, count) {
            const speed = Math.min(scratchSpeed * 0.8, 12);
            const colors = ['#b0bec5', '#cfd8dc', '#90a4ae', '#ffd700', '#e0e0e0', 'rgba(139,92,246,0.6)'];
            const types = ['dust', 'flake', 'spark'];

            for (let k = 0; k < count; k++) {
                dustParticles.push({
                    x: pos.x + (Math.random() - 0.5) * 10,
                    y: pos.y + (Math.random() - 0.5) * 10,
                    vx: (Math.random() - 0.5) * (speed + 4),
                    vy: (Math.random() - 0.5) * (speed + 4) - 2,
                    life: 0.6 + Math.random() * 0.6,
                    size: Math.random() * 4 + 1,
                    color: colors[Math.floor(Math.random() * colors.length)],
                    type: types[Math.floor(Math.random() * types.length)],
                    rotation: Math.random() * Math.PI * 2,
                    rotSpeed: (Math.random() - 0.5) * 0.3,
                });
            }
        }

        const scratch = (e) => {
            if (e.cancelable) e.preventDefault();
            if (!isScratching || scratchCompleted || !scratchResult) return;

            const pos = getPos(e);
            const now = Date.now();

            // Track speed
            if (lastPos) {
                const dx = pos.x - lastPos.x;
                const dy = pos.y - lastPos.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const dt = Math.max(now - lastScratchTime, 1);
                scratchSpeed = dist / dt * 10;
            }
            lastScratchTime = now;

            // Draw scratch stroke
            const brushSize = 35 + Math.min(scratchSpeed * 2, 15);

            ctx.beginPath();
            if (lastPos) {
                ctx.moveTo(lastPos.x, lastPos.y);
                ctx.lineTo(pos.x, pos.y);
                ctx.lineWidth = brushSize;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.stroke();

                // Extra random eraser spots for natural feel
                const spots = Math.floor(2 + scratchSpeed * 0.5);
                for (let j = 0; j < spots; j++) {
                    ctx.beginPath();
                    const ox = (Math.random() - 0.5) * brushSize * 0.6;
                    const oy = (Math.random() - 0.5) * brushSize * 0.6;
                    ctx.arc(pos.x + ox, pos.y + oy, Math.random() * 10 + 4, 0, Math.PI * 2);
                    ctx.fill();
                }
            }

            ctx.beginPath();
            ctx.arc(pos.x, pos.y, brushSize / 2, 0, Math.PI * 2);
            ctx.fill();

            // Emit particles based on speed
            const particleCount = Math.floor(3 + scratchSpeed * 0.8);
            emitParticles(pos, Math.min(particleCount, 12));

            lastPos = pos;
            checkScratchPercentage(w, h, dpr);
        };

        const startScratch = (e) => {
            if (e.cancelable) e.preventDefault();
            isScratching = true;
            lastPos = getPos(e);
            lastScratchTime = Date.now();
            if (scratchProgressBar) scratchProgressBar.classList.add('visible');
            scratch(e);
        };

        const stopScratch = () => {
            isScratching = false;
            lastPos = null;
            scratchSpeed = 0;
        };

        canvas.addEventListener('mousedown', startScratch);
        canvas.addEventListener('mousemove', scratch);
        window.addEventListener('mouseup', stopScratch);
        canvas.addEventListener('touchstart', startScratch, { passive: false });
        canvas.addEventListener('touchmove', scratch, { passive: false });
        window.addEventListener('touchend', stopScratch);
    }

    // ===== CHECK SCRATCH % =====
    let checkTimeout = null;
    function checkScratchPercentage(w, h, dpr) {
        if (checkTimeout) return;
        checkTimeout = setTimeout(() => {
            const imgData = ctx.getImageData(0, 0, w * dpr, h * dpr);
            const pixels = imgData.data;
            let cleared = 0;
            const step = 16;
            const total = pixels.length / 4;
            for (let i = 3; i < pixels.length; i += step * 4) {
                if (pixels[i] < 25) cleared++;
            }
            scratchPercent = (cleared / (total / step)) * 100;

            // Update progress bar
            if (scratchProgressFill) {
                scratchProgressFill.style.width = `${Math.min(scratchPercent * 2, 100)}%`;
            }

            if (scratchPercent > 40 && !scratchCompleted) {
                scratchCompleted = true;
                autoReveal(w, h, dpr);
            }
            checkTimeout = null;
        }, 80);
    }

    // ===== AUTO REVEAL with fade =====
    function autoReveal(w, h, dpr) {
        // Smooth auto-clear remaining area
        canvas.style.transition = 'opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1)';
        canvas.style.opacity = '0';

        // Big burst of particles
        const cx = w / 2, cy = h / 2;
        for (let i = 0; i < 30; i++) {
            dustParticles.push({
                x: cx + (Math.random() - 0.5) * w * 0.6,
                y: cy + (Math.random() - 0.5) * h * 0.6,
                vx: (Math.random() - 0.5) * 12,
                vy: (Math.random() - 0.5) * 12 - 3,
                life: 1 + Math.random(),
                size: Math.random() * 5 + 2,
                color: Math.random() > 0.5 ? '#ffd700' : '#b0bec5',
                type: 'spark',
                rotation: 0,
                rotSpeed: (Math.random() - 0.5) * 0.5,
            });
        }

        if (scratchProgressBar) scratchProgressBar.classList.remove('visible');

        setTimeout(() => {
            canvas.style.display = 'none';
            revealPrize();
        }, 800);
    }

    // ===== REVEAL PRIZE =====
    function revealPrize() {
        const loadingIcon = document.getElementById('loading-icon');
        if (loadingIcon) loadingIcon.classList.add('hidden');
        resultTexts.classList.remove('hidden');

        if (scratchResult && scratchResult.win) {
            ticketResult.classList.add('win');
            prizeStatus.innerText = "🎉 VENCEDOR!";
            prizeAmount.innerText = scratchResult.prize;
            if (prizeLabel) prizeLabel.innerText = "Prêmio em dinheiro";
            if (prizeIconContainer) prizeIconContainer.innerHTML = '<i data-lucide="trophy" class="prize-main-icon" style="width:48px;height:48px;color:#fbbf24"></i>';
            actionMsg.innerText = "Parabéns! Você ganhou um prêmio incrível!";
            actionMsg.style.color = "#4ade80";
            fireEpicConfetti();
        } else {
            ticketResult.classList.add('lose');
            prizeStatus.innerText = "QUE PENA";
            prizeAmount.innerText = "R$ 0,00";
            if (prizeLabel) prizeLabel.innerText = "Tente novamente";
            if (prizeIconContainer) prizeIconContainer.innerHTML = '<i data-lucide="frown" class="prize-main-icon" style="width:48px;height:48px;color:#ef4444"></i>';
            actionMsg.innerText = "Não foi dessa vez... Tente novamente!";
            actionMsg.style.color = "#f87171";
        }

        if (typeof lucide !== 'undefined') lucide.createIcons();
        actionFooter.classList.remove('hidden');
    }

    // ===== CONFETTI =====
    function fireEpicConfetti() {
        if (typeof confetti === 'undefined') return;
        const end = Date.now() + 4000;
        const colors = ['#fbbf24', '#d946ef', '#8b5cf6', '#10b981', '#ffffff', '#f43f5e'];

        (function frame() {
            confetti({ particleCount: 3, angle: 60, spread: 60, origin: { x: 0, y: 0.7 }, colors });
            confetti({ particleCount: 3, angle: 120, spread: 60, origin: { x: 1, y: 0.7 }, colors });
            confetti({ particleCount: 2, angle: 90, spread: 100, origin: { x: 0.5, y: 0.3 }, colors, gravity: 1.2 });
            if (Date.now() < end) requestAnimationFrame(frame);
        })();
    }

    // ===== CHECKOUT =====
    if (btnRetry) {
        btnRetry.addEventListener('click', async () => {
            btnRetry.innerHTML = `<i data-lucide="loader-2" class="spin-icon" style="width:20px;height:20px"></i><span>Processando...</span>`;
            if (typeof lucide !== 'undefined') lucide.createIcons();
            btnRetry.classList.add('loading');

            try {
                const res = await fetch('/api/checkout', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ price: 3.00, description: 'Nova Raspadinha (R$ 3,00)' })
                });
                const data = await res.json();
                if (data.url) {
                    window.location.href = data.url;
                } else {
                    throw new Error(data.error || "Erro");
                }
            } catch {
                alert("Erro ao conectar com pagamento. Tente novamente.");
                btnRetry.innerHTML = `<i data-lucide="refresh-cw" style="width:20px;height:20px"></i><span>Tentar Novamente — R$ 3,00</span><i data-lucide="arrow-right"></i>`;
                if (typeof lucide !== 'undefined') lucide.createIcons();
                btnRetry.classList.remove('loading');
            }
        });
    }

    // ===== AMBIENT FLOATING PARTICLES =====
    function initAmbientParticles() {
        const c = document.getElementById('particles-canvas');
        if (!c) return;
        const pCtx = c.getContext('2d');
        let dots = [];

        function resize() {
            c.width = window.innerWidth;
            c.height = window.innerHeight;
        }
        resize();
        window.addEventListener('resize', resize);

        for (let i = 0; i < 40; i++) {
            dots.push({
                x: Math.random() * c.width,
                y: Math.random() * c.height,
                r: Math.random() * 1.5 + 0.5,
                vx: (Math.random() - 0.5) * 0.3,
                vy: (Math.random() - 0.5) * 0.3,
                alpha: Math.random() * 0.4 + 0.1,
            });
        }

        function draw() {
            pCtx.clearRect(0, 0, c.width, c.height);
            dots.forEach(d => {
                d.x += d.vx;
                d.y += d.vy;
                if (d.x < 0) d.x = c.width;
                if (d.x > c.width) d.x = 0;
                if (d.y < 0) d.y = c.height;
                if (d.y > c.height) d.y = 0;

                pCtx.beginPath();
                pCtx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
                pCtx.fillStyle = `rgba(255,255,255,${d.alpha})`;
                pCtx.fill();
            });
            requestAnimationFrame(draw);
        }
        draw();
    }

    // ===== PARTICIPANTS ANIMATION =====
    function animateParticipants() {
        const el = document.getElementById('participants-count');
        if (!el) return;
        const base = 2847;
        setInterval(() => {
            const delta = Math.floor(Math.random() * 5) - 1;
            const current = parseInt(el.textContent.replace(/\./g, '')) + delta;
            el.textContent = current.toLocaleString('pt-BR');
        }, 3000);
    }
});
