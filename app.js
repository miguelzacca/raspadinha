document.addEventListener('DOMContentLoaded', () => {
    // Initialize Icons
    if (typeof lucide !== 'undefined') lucide.createIcons();

    // State
    let currentStep = 1;
    let scratchResult = null;
    let isScratching = false;
    let scratchCompleted = false;
    let dustParticles = [];

    // Elements
    const slides = document.querySelectorAll('.question-slide');
    const optionCards = document.querySelectorAll('.option-card');
    const progressBar = document.getElementById('quiz-progress');
    const viewQuiz = document.getElementById('step-questionnaire');
    const viewScratch = document.getElementById('step-scratchcard');
    
    const canvas = document.getElementById('scratch-layer');
    const ctx = canvas ? canvas.getContext('2d', { willReadFrequently: true }) : null;
    const dustCanvas = document.getElementById('dust-layer');
    const dustCtx = dustCanvas ? dustCanvas.getContext('2d') : null;
    const ticketResult = document.getElementById('ticket-result');
    const loadingIcon = document.getElementById('loading-icon');
    const resultTexts = document.getElementById('result-texts');
    const prizeStatus = document.getElementById('prize-status');
    const prizeAmount = document.getElementById('prize-amount');
    
    const actionFooter = document.getElementById('action-footer');
    const actionMsg = document.getElementById('action-msg');
    const btnRetry = document.getElementById('btn-retry');

    // Check if user already paid (Skip Quiz)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('paid')) {
        setTimeout(finishQuiz, 50);
    }

    // Quiz Logic
    optionCards.forEach(card => {
        card.addEventListener('click', function() {
            const currentSlide = this.closest('.question-slide');
            currentSlide.classList.remove('active');
            currentSlide.classList.add('exit');
            
            currentStep++;
            
            // Update Progress
            const progress = Math.min((currentStep / slides.length) * 100, 100);
            progressBar.style.width = `${progress}%`;
            
            setTimeout(() => {
                if (currentStep <= slides.length) {
                    const nextSlide = document.querySelector(`.question-slide[data-step="${currentStep}"]`);
                    if (nextSlide) nextSlide.classList.add('active');
                } else {
                    finishQuiz();
                }
            }, 300); // Wait for exit animation
        });
    });

    function finishQuiz() {
        viewQuiz.classList.remove('active');
        setTimeout(() => {
            viewQuiz.style.display = 'none';
            viewScratch.style.display = 'block';
            
            // Force reflow
            void viewScratch.offsetWidth;
            
            viewScratch.classList.add('active');
            initPremiumScratchCard();
            fetchScratchResult();
        }, 500);
    }

    async function fetchScratchResult() {
        try {
            const res = await fetch('/api/play');
            const data = await res.json();
            scratchResult = data;
        } catch (error) {
            console.error("Erro ao buscar resultado:", error);
            scratchResult = { win: false, prize: null };
        }
    }

    function initPremiumScratchCard() {
        if (!canvas) return;
        
        // Setup Retina Canvas
        const rect = canvas.parentElement.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);
        canvas.style.width = `${rect.width}px`;
        canvas.style.height = `${rect.height}px`;

        const w = rect.width;
        const h = rect.height;

        if (dustCanvas) {
            dustCanvas.width = rect.width * dpr;
            dustCanvas.height = rect.height * dpr;
            dustCtx.scale(dpr, dpr);
            dustCanvas.style.width = `${rect.width}px`;
            dustCanvas.style.height = `${rect.height}px`;
        }

        // Draw Premium Ticket Overlay
        // Background
        const bgGrad = ctx.createLinearGradient(0, 0, w, h);
        bgGrad.addColorStop(0, '#1e293b');
        bgGrad.addColorStop(1, '#0f172a');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, w, h);

        // Pattern / Noise
        ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
        for(let i=0; i<w; i+=4) {
            for(let j=0; j<h; j+=4) {
                if(Math.random() > 0.5) ctx.fillRect(i, j, 2, 2);
            }
        }

        // Gold Foil effect over it
        const goldGrad = ctx.createLinearGradient(0, 0, w, h);
        goldGrad.addColorStop(0, 'rgba(255, 215, 0, 0.2)');
        goldGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.1)');
        goldGrad.addColorStop(1, 'rgba(255, 140, 0, 0.2)');
        ctx.fillStyle = goldGrad;
        ctx.fillRect(0, 0, w, h);

        // Text
        ctx.fillStyle = '#ffffff';
        ctx.font = '800 28px Outfit';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Shadow for text
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 10;
        ctx.fillText('RASPE AQUI', w/2, h/2);
        
        // Reset shadow
        ctx.shadowBlur = 0;

        // Setup scratch mechanism
        ctx.globalCompositeOperation = 'destination-out';

        const getPos = (e) => {
            const r = canvas.getBoundingClientRect();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            return { x: clientX - r.left, y: clientY - r.top };
        };

        let lastPos = null;
        let dustAnimFrame = null;

        function animateDust() {
            if (!dustCtx) return;
            dustCtx.clearRect(0, 0, w, h);
            
            for (let i = dustParticles.length - 1; i >= 0; i--) {
                let p = dustParticles[i];
                p.x += p.vx;
                p.y += p.vy;
                p.vy += 0.25; // gravity
                p.life -= 0.02;
                
                if (p.life <= 0) {
                    dustParticles.splice(i, 1);
                } else {
                    dustCtx.fillStyle = p.color;
                    dustCtx.globalAlpha = p.life;
                    dustCtx.beginPath();
                    dustCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                    dustCtx.fill();
                }
            }
            dustCtx.globalAlpha = 1.0;
            dustAnimFrame = requestAnimationFrame(animateDust);
        }
        
        if (dustCtx) animateDust();

        const scratch = (e) => {
            if (!isScratching || scratchCompleted || !scratchResult) return;
            e.preventDefault();

            const pos = getPos(e);
            
            ctx.beginPath();
            if (lastPos) {
                ctx.moveTo(lastPos.x, lastPos.y);
                ctx.lineTo(pos.x, pos.y);
                ctx.lineWidth = 45;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.stroke();
                
                for(let j=0; j<6; j++) {
                    ctx.beginPath();
                    let ox = (Math.random() - 0.5) * 20;
                    let oy = (Math.random() - 0.5) * 20;
                    ctx.arc(pos.x + ox, pos.y + oy, Math.random() * 12 + 4, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
            
            ctx.arc(pos.x, pos.y, 25, 0, 2 * Math.PI);
            ctx.fill();
            
            for(let k=0; k<4; k++) {
                dustParticles.push({
                    x: pos.x,
                    y: pos.y,
                    vx: (Math.random() - 0.5) * 8,
                    vy: (Math.random() - 0.5) * 8 - 2,
                    life: 1 + Math.random() * 0.5,
                    size: Math.random() * 4 + 1.5,
                    color: Math.random() > 0.5 ? '#ffd700' : '#ffffff'
                });
            }

            lastPos = pos;
            checkScratchPercentage(w, h, dpr);
        };

        const startScratch = (e) => {
            isScratching = true;
            lastPos = getPos(e);
            scratch(e);
        };

        const stopScratch = () => {
            isScratching = false;
            lastPos = null;
        };

        canvas.addEventListener('mousedown', startScratch);
        canvas.addEventListener('mousemove', scratch);
        window.addEventListener('mouseup', stopScratch);

        canvas.addEventListener('touchstart', startScratch, { passive: false });
        canvas.addEventListener('touchmove', scratch, { passive: false });
        window.addEventListener('touchend', stopScratch);
    }

    let checkTimeout = null;
    function checkScratchPercentage(w, h, dpr) {
        if(checkTimeout) return;
        
        // Throttle check for performance
        checkTimeout = setTimeout(() => {
            const imgData = ctx.getImageData(0, 0, w * dpr, h * dpr);
            const pixels = imgData.data;
            let cleared = 0;
            const total = pixels.length / 4;

            // Sample every 4th pixel for speed
            for (let i = 3; i < pixels.length; i += 16) {
                if (pixels[i] === 0) cleared++;
            }

            const percent = (cleared / (total / 4)) * 100;

            if (percent > 45 && !scratchCompleted) {
                scratchCompleted = true;
                revealPrize();
            }
            checkTimeout = null;
        }, 100);
    }

    function revealPrize() {
        // Fade out canvas
        canvas.style.transition = 'opacity 0.5s ease';
        canvas.style.opacity = '0';
        
        setTimeout(() => { canvas.style.display = 'none'; }, 500);

        loadingIcon.classList.add('hidden');
        resultTexts.classList.remove('hidden');

        if (scratchResult && scratchResult.win) {
            ticketResult.classList.add('win');
            prizeStatus.innerText = "VENCEDOR!";
            prizeAmount.innerText = scratchResult.prize;
            actionMsg.innerText = "Parabéns! Você ganhou um prêmio!";
            actionMsg.style.color = "#4ade80";
            
            // Extreme Confetti
            fireEpicConfetti();
        } else {
            ticketResult.classList.add('lose');
            prizeStatus.innerText = "QUE PENA";
            prizeAmount.innerText = "R$ 0,00";
            actionMsg.innerText = "Não foi dessa vez...";
            actionMsg.style.color = "#f87171";
        }

        actionFooter.classList.remove('hidden');
    }

    function fireEpicConfetti() {
        if (typeof confetti === 'undefined') return;
        
        const duration = 3000;
        const end = Date.now() + duration;

        (function frame() {
            confetti({
                particleCount: 5,
                angle: 60,
                spread: 55,
                origin: { x: 0 },
                colors: ['#d946ef', '#fbcfe8', '#fbbf24']
            });
            confetti({
                particleCount: 5,
                angle: 120,
                spread: 55,
                origin: { x: 1 },
                colors: ['#8b5cf6', '#ffffff', '#fbbf24']
            });

            if (Date.now() < end) {
                requestAnimationFrame(frame);
            }
        }());
    }

    // Checkout Logic
    if (btnRetry) {
        btnRetry.addEventListener('click', async () => {
            btnRetry.innerHTML = `<span>Processando...</span><i data-lucide="loader-2" class="spin-icon"></i>`;
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
                    throw new Error(data.error || "Erro desconhecido");
                }
            } catch (err) {
                alert("Erro ao conectar com InfinitePay. Tente novamente.");
                btnRetry.innerHTML = `<span>Tentar Novamente - R$ 3,00</span><i data-lucide="arrow-right"></i>`;
                if (typeof lucide !== 'undefined') lucide.createIcons();
                btnRetry.classList.remove('loading');
            }
        });
    }
});
