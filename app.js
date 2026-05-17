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

    // ===== CANVAS & UI ELEMENTS =====
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

    // ===== RESTORE STATE ON PAGE RELOAD =====
    const urlParams = new URLSearchParams(window.location.search);
    const gameUnlocked = localStorage.getItem('gameUnlocked') === 'true';
    const selectedGame = localStorage.getItem('selectedGame'); // 'scratch' | 'ttt' | null

    if (urlParams.has('paid')) {
        // Returning from payment — clear block states
        localStorage.removeItem('tttNeedsPay');
        localStorage.setItem('gameUnlocked', 'true');
        const paidGame = localStorage.getItem('selectedGame');

        if (paidGame === 'scratch') {
            // Go directly back to a fresh scratchcard
            viewQuiz.classList.remove('active');
            viewQuiz.style.display = 'none';
            setTimeout(() => {
                viewScratch.style.display = 'block';
                void viewScratch.offsetWidth;
                viewScratch.classList.add('active');
                if (typeof lucide !== 'undefined') lucide.createIcons();
                initScratchCard();
                fetchScratchResult();
            }, 50);
        } else if (paidGame === 'ttt') {
            // Go directly back to a fresh TTT game
            viewQuiz.classList.remove('active');
            viewQuiz.style.display = 'none';
            const _vTTT = document.getElementById('step-ttt');
            setTimeout(() => {
                _vTTT.style.display = 'block';
                void _vTTT.offsetWidth;
                _vTTT.classList.add('active');
                if (typeof lucide !== 'undefined') lucide.createIcons();
                initTTT();
            }, 50);
        } else {
            // No game chosen yet — go to game select via transition
            setTimeout(() => startTransition(), 50);
        }
    } else if (gameUnlocked && selectedGame === 'scratch') {
        // User had already chosen Raspadinha — restore directly
        viewQuiz.classList.remove('active');
        viewQuiz.style.display = 'none';
        setTimeout(() => {
            viewScratch.style.display = 'block';
            void viewScratch.offsetWidth;
            viewScratch.classList.add('active');
            if (typeof lucide !== 'undefined') lucide.createIcons();
            initScratchCard();
            fetchScratchResult();
        }, 50);
    } else if (gameUnlocked && selectedGame === 'ttt') {
        // User had already chosen Jogo da Velha — restore directly
        viewQuiz.classList.remove('active');
        viewQuiz.style.display = 'none';
        const _vTTT = document.getElementById('step-ttt');
        setTimeout(() => {
            _vTTT.style.display = 'block';
            void _vTTT.offsetWidth;
            _vTTT.classList.add('active');
            if (typeof lucide !== 'undefined') lucide.createIcons();
            initTTT();
        }, 50);
    } else if (gameUnlocked) {
        // Game unlocked but no specific game chosen — go to selection
        viewQuiz.classList.remove('active');
        viewQuiz.style.display = 'none';
        setTimeout(() => showGameSelect(), 50);
    } else if (localStorage.getItem('questionnaireCompleted') === 'true') {
        // Quiz done but game not yet unlocked — show CPF step
        currentStep = slides.length;
        if (stepCurrent) stepCurrent.textContent = currentStep;
        if (progressBar) progressBar.style.width = '100%';
        slides.forEach(slide => slide.classList.remove('active'));
        const lastSlide = document.querySelector(`.question-slide[data-step="${currentStep}"]`);
        if (lastSlide) lastSlide.classList.add('active');
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
                    if (currentStep === slides.length) {
                        localStorage.setItem('questionnaireCompleted', 'true');
                    }
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

                        // Keep button in loading/blocked state during redirect
                        btnValidateCpf.innerHTML = `<i data-lucide="loader-2" class="spin-icon" style="width:20px;height:20px"></i><span>Redirecionando...</span>`;
                        if (typeof lucide !== 'undefined') lucide.createIcons();
                        btnValidateCpf.classList.add('loading');

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
                                } else {
                                    throw new Error('no url');
                                }
                            } catch {
                                cpfError.innerHTML = "Erro ao redirecionar. Tente novamente.";
                                cpfError.style.color = '#f87171';
                                resetCpfBtn();
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

            // Move to game selection
            setTimeout(() => {
                viewTransition.classList.remove('active');
                setTimeout(() => {
                    viewTransition.style.display = 'none';
                    showGameSelect();
                }, 500);
            }, 4000);
        }, 500);
    }

    // ===== GAME SELECTION =====
    const viewGameSelect = document.getElementById('step-game-select');
    const viewTTT = document.getElementById('step-ttt');

    function showGameSelect() {
        localStorage.setItem('gameUnlocked', 'true');
        localStorage.removeItem('selectedGame'); // not yet chosen
        viewGameSelect.style.display = 'block';
        void viewGameSelect.offsetWidth;
        viewGameSelect.classList.add('active');
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    function hideGameSelect(cb) {
        viewGameSelect.classList.remove('active');
        setTimeout(() => {
            viewGameSelect.style.display = 'none';
            cb();
        }, 500);
    }

    const btnChooseScratch = document.getElementById('btn-choose-scratch');
    const btnChooseTTT = document.getElementById('btn-choose-ttt');

    if (btnChooseScratch) {
        btnChooseScratch.addEventListener('click', () => {
            localStorage.setItem('selectedGame', 'scratch');
            hideGameSelect(() => {
                viewScratch.style.display = 'block';
                void viewScratch.offsetWidth;
                viewScratch.classList.add('active');
                if (typeof lucide !== 'undefined') lucide.createIcons();
                initScratchCard();
                fetchScratchResult();
            });
        });
    }

    if (btnChooseTTT) {
        btnChooseTTT.addEventListener('click', () => {
            localStorage.setItem('selectedGame', 'ttt');
            hideGameSelect(() => {
                viewTTT.style.display = 'block';
                void viewTTT.offsetWidth;
                viewTTT.classList.add('active');
                if (typeof lucide !== 'undefined') lucide.createIcons();
                initTTT();
            });
        });
    }

    const btnBackScratch = document.getElementById('btn-back-scratch');
    const btnBackTTT = document.getElementById('btn-back-ttt');

    if (btnBackScratch) {
        btnBackScratch.addEventListener('click', () => {
            localStorage.removeItem('selectedGame');
            viewScratch.classList.remove('active');
            setTimeout(() => {
                viewScratch.style.display = 'none';
                showGameSelect();
            }, 500);
        });
    }

    if (btnBackTTT) {
        btnBackTTT.addEventListener('click', () => {
            localStorage.removeItem('selectedGame');
            viewTTT.classList.remove('active');
            setTimeout(() => {
                viewTTT.style.display = 'none';
                showGameSelect();
            }, 500);
        });
    }

    // ===== MINIMAX TIC-TAC-TOE ENGINE =====
    function initTTT() {
        const PLAYER = 'X';
        const AI = 'O';
        let board = Array(9).fill(null);
        let gameOver = false;
        let scorePlayer = 0;
        let scoreAI = 0;

        const statusEl = document.getElementById('ttt-status');
        const cells = document.querySelectorAll('.ttt-cell');
        const boardEl = document.getElementById('ttt-board');
        const overlay = document.getElementById('ttt-result-overlay');
        const resultIcon = document.getElementById('ttt-result-icon');
        const resultTitle = document.getElementById('ttt-result-title');
        const resultMsg = document.getElementById('ttt-result-msg');
        const playAgainBtn = document.getElementById('ttt-play-again');
        const scorePlayerEl = document.getElementById('ttt-score-player');
        const scoreAIEl = document.getElementById('ttt-score-ai');
        const tttActionFooter = document.getElementById('ttt-action-footer');
        const tttActionMsg = document.getElementById('ttt-action-msg');
        const tttBtnRetry = document.getElementById('ttt-btn-retry');

        const WIN_LINES = [
            [0,1,2],[3,4,5],[6,7,8],
            [0,3,6],[1,4,7],[2,5,8],
            [0,4,8],[2,4,6]
        ];

        function checkWinner(b) {
            for (const [a,c,d] of WIN_LINES) {
                if (b[a] && b[a] === b[c] && b[a] === b[d]) return { winner: b[a], line: [a,c,d] };
            }
            if (b.every(cell => cell)) return { winner: 'draw', line: [] };
            return null;
        }

        function minimax(b, isMaximizing, depth, alpha, beta) {
            const result = checkWinner(b);
            if (result) {
                if (result.winner === AI) return 10 - depth;
                if (result.winner === PLAYER) return depth - 10;
                return 0;
            }
            if (isMaximizing) {
                let best = -Infinity;
                for (let i = 0; i < 9; i++) {
                    if (!b[i]) {
                        b[i] = AI;
                        best = Math.max(best, minimax(b, false, depth + 1, alpha, beta));
                        b[i] = null;
                        alpha = Math.max(alpha, best);
                        if (beta <= alpha) break;
                    }
                }
                return best;
            } else {
                let best = Infinity;
                for (let i = 0; i < 9; i++) {
                    if (!b[i]) {
                        b[i] = PLAYER;
                        best = Math.min(best, minimax(b, true, depth + 1, alpha, beta));
                        b[i] = null;
                        beta = Math.min(beta, best);
                        if (beta <= alpha) break;
                    }
                }
                return best;
            }
        }

        function getBestMove(b) {
            let bestVal = -Infinity;
            let bestMove = -1;
            for (let i = 0; i < 9; i++) {
                if (!b[i]) {
                    b[i] = AI;
                    const val = minimax(b, false, 0, -Infinity, Infinity);
                    b[i] = null;
                    if (val > bestVal) { bestVal = val; bestMove = i; }
                }
            }
            return bestMove;
        }

        function updateCells() {
            cells.forEach((cell, i) => {
                cell.textContent = '';
                cell.className = 'ttt-cell';
                if (board[i] === PLAYER) {
                    cell.textContent = 'X';
                    cell.classList.add('x-mark', 'taken');
                } else if (board[i] === AI) {
                    cell.textContent = 'O';
                    cell.classList.add('o-mark', 'taken');
                }
            });
        }

        function highlightWinCells(line) {
            line.forEach(i => {
                cells[i].classList.add('win-cell');
            });
        }

        function setStatus(text, cls) {
            statusEl.className = 'ttt-status-pill';
            if (cls) statusEl.classList.add(cls);
            statusEl.innerHTML = text;
        }

        function showThinking() {
            setStatus(`<span class="ttt-thinking"><span class="ttt-thinking-dot"></span><span class="ttt-thinking-dot"></span><span class="ttt-thinking-dot"></span></span>&nbsp;IA pensando...`, 'ai-turn');
        }

        function showLoseOverlay() {
            overlay.classList.remove('hidden');
            resultIcon.textContent = '🤖';
            resultTitle.textContent = 'IA Venceu!';
            resultTitle.style.color = '#f87171';
            resultMsg.textContent = 'Que pena! Compre mais um ticket para jogar novamente.';
            // Swap play-again btn for payment btn
            playAgainBtn.style.display = 'none';
            document.getElementById('ttt-overlay-pay-btn').style.display = 'inline-flex';
            const payNote = document.getElementById('ttt-pay-note');
            if (payNote) payNote.style.display = 'block';
        }


        function showWinOverlay() {
            overlay.classList.remove('hidden');
            resultIcon.textContent = '🏆';
            resultTitle.textContent = 'Você Venceu!';
            resultTitle.style.color = '#4ade80';
            resultMsg.textContent = 'Parabéns! Você conseguiu vencer!';
            playAgainBtn.style.display = 'inline-flex';
            document.getElementById('ttt-overlay-pay-btn').style.display = 'none';
            fireEpicConfetti();
        }

        function endGame(result) {
            gameOver = true;
            boardEl.classList.add('blocked');

            if (result.winner === AI) {
                scoreAI++;
                scoreAIEl.textContent = scoreAI;
                highlightWinCells(result.line);
                setStatus('IA venceu! 🤖', 'ai-won');
                localStorage.setItem('tttNeedsPay', 'true');
                // Lose → payment required
                setTimeout(() => showLoseOverlay(), 900);
            } else if (result.winner === 'draw') {
                // Draw → free continue, auto-reset
                setStatus('Empate! Continue jogando 🤝', 'draw');
                setTimeout(() => resetBoard(), 1800);
            } else {
                scorePlayer++;
                scorePlayerEl.textContent = scorePlayer;
                highlightWinCells(result.line);
                setStatus('Você venceu! 🏆', 'player-won');
                setTimeout(() => showWinOverlay(), 900);
            }
        }

        function aiMove() {
            boardEl.classList.add('blocked');
            showThinking();
            setTimeout(() => {
                const move = getBestMove(board);
                if (move === -1) return;
                board[move] = AI;
                updateCells();
                const result = checkWinner(board);
                if (result) {
                    endGame(result);
                } else {
                    boardEl.classList.remove('blocked');
                    setStatus('Sua vez — jogue com X');
                }
            }, 500 + Math.random() * 300);
        }

        function resetBoard() {
            board = Array(9).fill(null);
            gameOver = false;
            boardEl.classList.remove('blocked');
            updateCells();
            setStatus('Sua vez — jogue com X');
        }

        // Cell clicks
        cells.forEach((cell, i) => {
            cell.addEventListener('click', () => {
                if (gameOver || board[i] || boardEl.classList.contains('blocked')) return;
                board[i] = PLAYER;
                updateCells();
                const result = checkWinner(board);
                if (result) {
                    endGame(result);
                } else {
                    aiMove();
                }
            });
        });

        // Play Again (only shown on player win)
        if (playAgainBtn) {
            playAgainBtn.addEventListener('click', () => {
                overlay.classList.add('hidden');
                resetBoard();
            });
        }

        // Pay to play again (shown on lose)
        const overlayPayBtn = document.getElementById('ttt-overlay-pay-btn');
        if (overlayPayBtn) {
            overlayPayBtn.addEventListener('click', async () => {
                overlayPayBtn.textContent = 'Processando...';
                overlayPayBtn.style.opacity = '0.7';
                overlayPayBtn.style.pointerEvents = 'none';
                try {
                    const res = await fetch('/api/checkout', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ price: 3.00, description: 'Jogo da Velha Premiado (R$ 3,00)' })
                    });
                    const data = await res.json();
                    if (data.url) {
                        window.location.href = data.url;
                    } else throw new Error();
                } catch {
                    alert('Erro ao conectar com pagamento. Tente novamente.');
                    overlayPayBtn.textContent = 'Comprar Ticket — R$ 3,00';
                    overlayPayBtn.style.opacity = '1';
                    overlayPayBtn.style.pointerEvents = 'auto';
                }
            });
        }

        // Checkout button
        if (tttBtnRetry) {
            tttBtnRetry.addEventListener('click', async () => {
                tttBtnRetry.innerHTML = `<i data-lucide="loader-2" class="spin-icon" style="width:20px;height:20px"></i><span>Processando...</span>`;
                if (typeof lucide !== 'undefined') lucide.createIcons();
                tttBtnRetry.classList.add('loading');
                try {
                    const res = await fetch('/api/checkout', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ price: 3.00, description: 'Jogo da Velha Premiado (R$ 3,00)' })
                    });
                    const data = await res.json();
                    if (data.url) {
                        window.location.href = data.url;
                    } else throw new Error();
                } catch {
                    alert('Erro ao conectar com pagamento. Tente novamente.');
                    tttBtnRetry.innerHTML = `<i data-lucide="refresh-cw" style="width:20px;height:20px"></i><span>Tentar Novamente — R$ 3,00</span><i data-lucide="arrow-right"></i>`;
                    if (typeof lucide !== 'undefined') lucide.createIcons();
                    tttBtnRetry.classList.remove('loading');
                }
            });
        }

        // Start!
        resetBoard();

        if (localStorage.getItem('tttNeedsPay') === 'true') {
            boardEl.classList.add('blocked');
            gameOver = true;
            setTimeout(() => showLoseOverlay(), 100);
        }
    }


    // ===== FETCH RESULT =====
    async function fetchScratchResult() {
        try {
            const res = await fetch('/api/play');
            scratchResult = await res.json();
        } catch {
            scratchResult = { win: false, prize: null, tier: null };
        }
        // Apply tier visuals once we know the tier
        const tier = (scratchResult && scratchResult.tier) || 'silver';
        applyTierTheme(tier);
        // Redraw canvas with tier colors now that we have the result
        redrawScratchLayer(tier);
    }

    // ===== TIER THEME =====
    function applyTierTheme(tier) {
        const badgeEl = document.getElementById('scratch-tier-badge');
        const ticketEl = document.querySelector('.ticket');
        const glowEl = document.querySelector('.ticket-border-glow');
        const headerTitleEl = document.querySelector('.scratch-header h2');

        const themes = {
            bronze: {
                label: '🥉 TICKET BRONZE',
                badgeClass: 'tier-badge-bronze',
                ticketClass: 'ticket-tier-bronze',
                title: 'Ticket Bronze',
            },
            silver: {
                label: '🥈 TICKET PRATA',
                badgeClass: 'tier-badge-silver',
                ticketClass: 'ticket-tier-silver',
                title: 'Ticket Prata',
            },
            gold: {
                label: '🥇 TICKET OURO',
                badgeClass: 'tier-badge-gold',
                ticketClass: 'ticket-tier-gold',
                title: 'Ticket Ouro',
            },
        };

        const t = themes[tier] || themes.silver;

        if (badgeEl) {
            badgeEl.textContent = t.label;
            badgeEl.className = 'scratch-badge ' + t.badgeClass;
        }
        if (ticketEl) {
            ticketEl.classList.remove('ticket-tier-bronze', 'ticket-tier-silver', 'ticket-tier-gold');
            ticketEl.classList.add(t.ticketClass);
        }
        if (glowEl) {
            glowEl.classList.remove('glow-bronze', 'glow-silver', 'glow-gold');
            glowEl.classList.add('glow-' + tier);
        }
        if (headerTitleEl) {
            headerTitleEl.textContent = t.title;
        }
    }

    // ===== REDRAW CANVAS WITH TIER COLORS =====
    let _lastTierW = 0, _lastTierH = 0, _lastTierDpr = 1;
    function redrawScratchLayer(tier) {
        if (!canvas || !ctx) return;
        // Only redraw if scratch hasn't started yet
        if (scratchPercent > 0 || scratchCompleted) return;

        const w = _lastTierW;
        const h = _lastTierH;
        if (!w || !h) return;

        // Save composite op, draw base, restore
        const prevOp = ctx.globalCompositeOperation;
        ctx.globalCompositeOperation = 'source-over';

        ctx.fillStyle = '#1a1f2e';
        ctx.fillRect(0, 0, w, h);

        const tierGrads = {
            bronze: [
                [0,   '#5a3a1a'],
                [0.2, '#a0673a'],
                [0.4, '#7a4a25'],
                [0.5, '#cd8b3a'],
                [0.6, '#8b5e2a'],
                [0.8, '#a0673a'],
                [1,   '#5a3a1a'],
            ],
            silver: [
                [0,   '#7a8599'],
                [0.2, '#b0bec5'],
                [0.4, '#8a9bae'],
                [0.5, '#cfd8dc'],
                [0.6, '#90a4ae'],
                [0.8, '#b0bec5'],
                [1,   '#78909c'],
            ],
            gold: [
                [0,   '#7a5a00'],
                [0.2, '#d4a817'],
                [0.4, '#b8860b'],
                [0.5, '#ffd700'],
                [0.6, '#c9a800'],
                [0.8, '#d4a817'],
                [1,   '#7a5a00'],
            ],
        };

        const stops = tierGrads[tier] || tierGrads.silver;
        const metalGrad = ctx.createLinearGradient(0, 0, w, h);
        stops.forEach(([pos, color]) => metalGrad.addColorStop(pos, color));
        ctx.fillStyle = metalGrad;
        ctx.fillRect(0, 0, w, h);

        // Brushed lines
        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        ctx.lineWidth = 1;
        for (let y = 0; y < h; y += 2) {
            ctx.beginPath();
            ctx.moveTo(0, y + Math.random() * 1);
            ctx.lineTo(w, y + Math.random() * 1);
            ctx.stroke();
        }

        // Noise
        ctx.fillStyle = 'rgba(0,0,0,0.02)';
        for (let i = 0; i < w; i += 3) {
            for (let j = 0; j < h; j += 3) {
                if (Math.random() > 0.5) ctx.fillRect(i, j, 2, 2);
            }
        }

        // Holographic stripe overlay
        const holoColors = {
            bronze: ['rgba(139,69,19,0.1)', 'rgba(205,133,63,0.08)', 'rgba(255,255,255,0.12)', 'rgba(160,82,45,0.08)', 'rgba(101,67,33,0.1)'],
            silver: ['rgba(139,92,246,0.08)', 'rgba(245,158,11,0.06)', 'rgba(255,255,255,0.1)', 'rgba(217,70,239,0.06)', 'rgba(59,130,246,0.08)'],
            gold: ['rgba(255,200,0,0.1)', 'rgba(255,165,0,0.08)', 'rgba(255,255,255,0.15)', 'rgba(255,140,0,0.08)', 'rgba(218,165,32,0.1)'],
        };
        const hc = holoColors[tier] || holoColors.silver;
        const holoGrad = ctx.createLinearGradient(0, h * 0.3, w, h * 0.7);
        holoGrad.addColorStop(0, hc[0]);
        holoGrad.addColorStop(0.3, hc[1]);
        holoGrad.addColorStop(0.5, hc[2]);
        holoGrad.addColorStop(0.7, hc[3]);
        holoGrad.addColorStop(1, hc[4]);
        ctx.fillStyle = holoGrad;
        ctx.fillRect(0, 0, w, h);

        // Center text
        const textColors = { bronze: 'rgba(255,220,150,0.85)', silver: 'rgba(255,255,255,0.7)', gold: 'rgba(255,240,100,0.9)' };
        const subColors = { bronze: 'rgba(255,200,120,0.5)', silver: 'rgba(255,255,255,0.4)', gold: 'rgba(255,230,80,0.6)' };
        ctx.fillStyle = textColors[tier] || textColors.silver;
        ctx.font = '800 22px Outfit';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0,0,0,0.4)';
        ctx.shadowBlur = 6;
        ctx.fillText('✦ RASPE AQUI ✦', w / 2, h / 2 - 10);
        ctx.font = '400 13px Outfit';
        ctx.fillStyle = subColors[tier] || subColors.silver;
        ctx.shadowBlur = 0;
        ctx.fillText('Deslize para revelar seu prêmio', w / 2, h / 2 + 18);

        ctx.globalCompositeOperation = 'destination-out';
    }

    // ===== SCRATCH CARD ENGINE =====
    function initScratchCard() {
        if (!canvas || !ctx) return;

        scratchCompleted = false;
        scratchPercent = 0;
        isScratching = false;
        canvas.style.opacity = '1';
        canvas.style.display = 'block';
        if (scratchProgressBar) scratchProgressBar.classList.remove('visible');
        if (scratchProgressFill) scratchProgressFill.style.width = '0%';
        actionFooter.classList.add('hidden');
        resultTexts.classList.add('hidden');
        ticketResult.classList.remove('win', 'lose');
        const loadingIcon = document.getElementById('loading-icon');
        if (loadingIcon) loadingIcon.classList.remove('hidden');

        // Reset tier visuals to neutral while result is loading
        applyTierTheme('silver');

        const rect = canvas.parentElement.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        const w = rect.width;
        const h = rect.height;

        // Store dimensions for redraw after tier arrives
        _lastTierW = w;
        _lastTierH = h;
        _lastTierDpr = dpr;

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

        // Draw default silver surface (will be redrawn once tier arrives)
        redrawScratchLayer('silver');

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

        // Tier-colored burst particles
        const tier = (scratchResult && scratchResult.tier) || 'silver';
        const tierBurstColors = {
            bronze: ['#cd8b3a', '#e8a87c'],
            silver: ['#cfd8dc', '#b0bec5'],
            gold: ['#ffd700', '#ff8c00'],
        };
        const burstColors = tierBurstColors[tier] || ['#ffd700', '#b0bec5'];
        const cx = w / 2, cy = h / 2;
        for (let i = 0; i < 30; i++) {
            dustParticles.push({
                x: cx + (Math.random() - 0.5) * w * 0.6,
                y: cy + (Math.random() - 0.5) * h * 0.6,
                vx: (Math.random() - 0.5) * 12,
                vy: (Math.random() - 0.5) * 12 - 3,
                life: 1 + Math.random(),
                size: Math.random() * 5 + 2,
                color: burstColors[Math.floor(Math.random() * burstColors.length)],
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

        const tier = (scratchResult && scratchResult.tier) || null;

        const tierMeta = {
            bronze: {
                icon: '🥉',
                iconColor: '#e8a87c',
                label: 'Prêmio Bronze',
                msg: 'Parabéns! Você ganhou o prêmio Bronze!',
                msgColor: '#e8a87c',
                confettiColors: ['#cd8b3a', '#a0673a', '#e8a87c', '#ffffff', '#ffd700'],
            },
            silver: {
                icon: '🥈',
                iconColor: '#cfd8dc',
                label: 'Prêmio Prata',
                msg: 'Incrível! Você ganhou o prêmio Prata!',
                msgColor: '#cfd8dc',
                confettiColors: ['#cfd8dc', '#90a4ae', '#ffffff', '#8b5cf6', '#b0bec5'],
            },
            gold: {
                icon: '🥇',
                iconColor: '#ffd700',
                label: 'Prêmio Ouro',
                msg: '🔥 JACKPOT! Você ganhou o prêmio OURO!',
                msgColor: '#ffd700',
                confettiColors: ['#ffd700', '#ff8c00', '#fbbf24', '#ffffff', '#f43f5e'],
            },
        };

        if (scratchResult && scratchResult.win && tier) {
            const meta = tierMeta[tier] || tierMeta.silver;
            ticketResult.classList.add('win');
            prizeStatus.innerText = `${meta.icon} VENCEDOR!`;
            prizeAmount.innerText = scratchResult.prize;
            if (prizeLabel) prizeLabel.innerText = meta.label;
            if (prizeIconContainer) {
                prizeIconContainer.innerHTML = `<i data-lucide="trophy" class="prize-main-icon" style="width:48px;height:48px;color:${meta.iconColor}"></i>`;
            }
            actionMsg.innerText = meta.msg;
            actionMsg.style.color = meta.msgColor;
            fireEpicConfetti(meta.confettiColors);
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
    function fireEpicConfetti(colors) {
        if (typeof confetti === 'undefined') return;
        const end = Date.now() + 4000;
        const c = colors || ['#fbbf24', '#d946ef', '#8b5cf6', '#10b981', '#ffffff', '#f43f5e'];

        (function frame() {
            confetti({ particleCount: 3, angle: 60, spread: 60, origin: { x: 0, y: 0.7 }, colors: c });
            confetti({ particleCount: 3, angle: 120, spread: 60, origin: { x: 1, y: 0.7 }, colors: c });
            confetti({ particleCount: 2, angle: 90, spread: 100, origin: { x: 0.5, y: 0.3 }, colors: c, gravity: 1.2 });
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
