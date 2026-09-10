/**
 * ===================================================================
 * KURT KAPANI & α1Q GÜVENLİK SİSTEMİ - JAVASCRIPT
 * ===================================================================
 */

(function () {
    "use strict";

    const STORAGE_KURT_LOCK_KEY = "ata_kurt_kapani_lock_v1";

    let countdownInterval = null;
    let isKurtKapaniActive = false;
    let isCountingDown = false;
    let unlockTapCount = 0;
    let lastUnlockTapTime = 0;

    // Web Audio API
    let audioCtx = null;

    function getAudioContext() {
        if (!audioCtx) {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (AudioContextClass) {
                audioCtx = new AudioContextClass();
            }
        }
        if (audioCtx && audioCtx.state === "suspended") {
            audioCtx.resume();
        }
        return audioCtx;
    }

    /**
     * Synthesize Apple iOS Countdown Tick Sound
     */
    function playCountdownTick() {
        try {
            const ctx = getAudioContext();
            if (!ctx) return;
            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = "sine";
            osc.frequency.setValueAtTime(1050, now);
            osc.frequency.exponentialRampToValueAtTime(750, now + 0.035);

            gain.gain.setValueAtTime(0.01, now);
            gain.gain.linearRampToValueAtTime(0.18, now + 0.006);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now);
            osc.stop(now + 0.055);
        } catch (e) { }
    }

    /**
     * Synthesize Deep Bass Warning Accord for Lockdown
     */
    function playLockdownSound() {
        try {
            const ctx = getAudioContext();
            if (!ctx) return;
            const now = ctx.currentTime;

            const chords = [130.81, 155.56, 196.0]; // C3 minor chord
            chords.forEach((freq, idx) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();

                osc.type = "sawtooth";
                osc.frequency.setValueAtTime(freq, now + idx * 0.08);

                gain.gain.setValueAtTime(0, now + idx * 0.08);
                gain.gain.linearRampToValueAtTime(0.14, now + idx * 0.08 + 0.03);
                gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.65);

                osc.connect(gain);
                gain.connect(ctx.destination);

                osc.start(now + idx * 0.08);
                osc.stop(now + idx * 0.08 + 0.7);
            });
        } catch (e) { }
    }

    /**
     * Synthesize Apple Pay / FaceID Style Uplifting Unlock Chime
     */
    function playUnlockChime() {
        try {
            const ctx = getAudioContext();
            if (!ctx) return;
            const now = ctx.currentTime;

            const freqs = [1046.5, 1567.98]; // C6 -> G6
            freqs.forEach((freq, idx) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();

                osc.type = "sine";
                osc.frequency.setValueAtTime(freq, now + idx * 0.1);

                gain.gain.setValueAtTime(0, now + idx * 0.1);
                gain.gain.linearRampToValueAtTime(0.24, now + idx * 0.1 + 0.02);
                gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + 0.5);

                osc.connect(gain);
                gain.connect(ctx.destination);

                osc.start(now + idx * 0.1);
                osc.stop(now + idx * 0.1 + 0.52);
            });
        } catch (e) { }
    }

    // DOM Elements
    const countdownOverlay = document.getElementById("countdownOverlay");
    const countdownNumber = document.getElementById("countdownNumber");
    const countdownProgressBar = document.getElementById("countdownProgressBar");
    const kurtKapaniOverlay = document.getElementById("kurtKapaniOverlay");
    const secretUnlockTrigger = document.getElementById("secretUnlockTrigger");
    const slideUnlockWrapper = document.getElementById("slideUnlockWrapper");
    const slideUnlockTrack = document.getElementById("slideUnlockTrack");
    const slideUnlockThumb = document.getElementById("slideUnlockThumb");
    const slideUnlockText = document.getElementById("slideUnlockText");
    const unlockedScreen = document.getElementById("unlockedScreen");
    const restartBtn = document.getElementById("restartBtn");

    // =========================================================================
    // 1. 10-SECOND iOS SECURITY COUNTDOWN
    // =========================================================================
    function startCountdown() {
        if (isKurtKapaniActive) return;
        if (isCountingDown && countdownInterval) return;

        isCountingDown = true;

        if (unlockedScreen) {
            unlockedScreen.style.display = "none";
        }

        if (countdownInterval) {
            clearInterval(countdownInterval);
            countdownInterval = null;
        }

        let secondsLeft = 5;
        if (countdownNumber) {
            countdownNumber.textContent = secondsLeft;
            countdownNumber.classList.remove("tick-pop");
        }
        if (countdownProgressBar) {
            countdownProgressBar.style.transition = "none";
            countdownProgressBar.style.width = "100%";
            void countdownProgressBar.offsetWidth; // Force layout
            countdownProgressBar.style.transition = "width 1s linear";
        }

        if (countdownOverlay) {
            countdownOverlay.classList.add("active");
            countdownOverlay.setAttribute("aria-hidden", "false");
        }
        playCountdownTick();

        countdownInterval = setInterval(() => {
            secondsLeft--;

            if (countdownNumber) {
                countdownNumber.textContent = secondsLeft;
                countdownNumber.classList.add("tick-pop");
                setTimeout(() => {
                    if (countdownNumber) countdownNumber.classList.remove("tick-pop");
                }, 180);
            }

            if (countdownProgressBar) {
                countdownProgressBar.style.width = Math.max(0, secondsLeft * 20) + "%";
            }

            playCountdownTick();

            if (secondsLeft <= 0) {
                clearInterval(countdownInterval);
                countdownInterval = null;
                isCountingDown = false;

                setTimeout(() => {
                    if (countdownOverlay) {
                        countdownOverlay.classList.remove("active");
                        countdownOverlay.setAttribute("aria-hidden", "true");
                    }
                    enterKurtKapaniMode();
                }, 350);
            }
        }, 1000);
    }

    // =========================================================================
    // 2. α1Q v2.0 (Fullscreen Security Lockout)
    // =========================================================================
    function enterKurtKapaniMode(playSound = true) {
        isKurtKapaniActive = true;
        isCountingDown = false;
        unlockTapCount = 0;

        // Persist lockdown state in localStorage so closing/reopening the app keeps it locked
        try {
            localStorage.setItem(STORAGE_KURT_LOCK_KEY, "locked");
        } catch (e) { }
        document.documentElement.classList.add("kurt-locked-boot");

        if (countdownInterval) {
            clearInterval(countdownInterval);
            countdownInterval = null;
        }

        if (countdownOverlay) {
            countdownOverlay.classList.remove("active");
            countdownOverlay.setAttribute("aria-hidden", "true");
        }

        if (unlockedScreen) {
            unlockedScreen.style.display = "none";
        }

        // Reset slide unlock track state
        if (slideUnlockWrapper) {
            slideUnlockWrapper.classList.remove("revealed");
        }
        if (slideUnlockThumb) {
            slideUnlockThumb.style.transform = "translateX(0px)";
        }
        if (slideUnlockText) {
            slideUnlockText.style.opacity = "1";
        }

        if (kurtKapaniOverlay) {
            kurtKapaniOverlay.classList.add("active");
            kurtKapaniOverlay.setAttribute("aria-hidden", "false");
        }

        if (playSound) {
            playLockdownSound();
        }
    }

    /**
     * Exit Kurt Kapanı Mode (Unlocked via Secret Double-Tap + Slide Right)
     */
    function exitKurtKapaniMode() {
        if (!isKurtKapaniActive) return;
        isKurtKapaniActive = false;
        isCountingDown = false;
        unlockTapCount = 0;

        // Remove persistent lockdown state from localStorage
        try {
            localStorage.removeItem(STORAGE_KURT_LOCK_KEY);
        } catch (e) { }
        document.documentElement.classList.remove("kurt-locked-boot");

        if (countdownInterval) {
            clearInterval(countdownInterval);
            countdownInterval = null;
        }

        if (slideUnlockWrapper) {
            slideUnlockWrapper.classList.remove("revealed");
        }
        if (slideUnlockThumb) {
            slideUnlockThumb.style.transform = "translateX(0px)";
        }
        if (slideUnlockText) {
            slideUnlockText.style.opacity = "1";
        }

        if (kurtKapaniOverlay) {
            kurtKapaniOverlay.classList.remove("active");
            kurtKapaniOverlay.setAttribute("aria-hidden", "true");
        }

        if (unlockedScreen) {
            unlockedScreen.style.display = "flex";
        }

        playUnlockChime();
    }

    // =========================================================================
    // 3. SECRET DOUBLE-TAP LISTENER ON WOLF AVATAR BADGE
    // =========================================================================
    if (secretUnlockTrigger) {
        secretUnlockTrigger.addEventListener("click", function (e) {
            if (!isKurtKapaniActive) return;
            const now = Date.now();

            if (now - lastUnlockTapTime < 500) {
                unlockTapCount++;
            } else {
                unlockTapCount = 1;
            }
            lastUnlockTapTime = now;

            if (unlockTapCount >= 2) {
                // Secret Double-Tap triggered! Reveal the Slide-to-Unlock track!
                unlockTapCount = 0;
                if (slideUnlockWrapper) {
                    slideUnlockWrapper.classList.add("revealed");
                }
                playCountdownTick();
            }
        });
    }

    // =========================================================================
    // 4. APPLE SLIDE TO UNLOCK DRAG CONTROLLER
    // =========================================================================
    if (slideUnlockThumb && slideUnlockTrack) {
        let isDragging = false;
        let startX = 0;
        let currentTranslateX = 0;

        function getMaxDrag() {
            const trackWidth = slideUnlockTrack.getBoundingClientRect().width;
            const thumbWidth = slideUnlockThumb.getBoundingClientRect().width || 44;
            return Math.max(10, trackWidth - thumbWidth - 8);
        }

        function onDragStart(clientX) {
            isDragging = true;
            startX = clientX - currentTranslateX;
            slideUnlockThumb.style.transition = "none";
            if (slideUnlockText) slideUnlockText.style.transition = "none";
        }

        function onDragMove(clientX) {
            if (!isDragging) return;
            const maxDrag = getMaxDrag();
            const rawX = clientX - startX;
            currentTranslateX = Math.max(0, Math.min(rawX, maxDrag));
            slideUnlockThumb.style.transform = `translateX(${currentTranslateX}px)`;

            if (slideUnlockText) {
                const progress = currentTranslateX / maxDrag;
                slideUnlockText.style.opacity = Math.max(0, 1 - progress * 1.5).toString();
            }
        }

        function onDragEnd() {
            if (!isDragging) return;
            isDragging = false;
            const maxDrag = getMaxDrag();

            // Threshold: 78% of track length reached to unlock
            if (currentTranslateX >= maxDrag * 0.78) {
                slideUnlockThumb.style.transition = "transform 0.15s ease-out";
                slideUnlockThumb.style.transform = `translateX(${maxDrag}px)`;
                if (slideUnlockText) slideUnlockText.style.opacity = "0";

                setTimeout(() => {
                    exitKurtKapaniMode();
                }, 160);
            } else {
                // Snap back with spring
                slideUnlockThumb.style.transition = "transform 0.28s cubic-bezier(0.2, 0.8, 0.2, 1)";
                slideUnlockThumb.style.transform = "translateX(0px)";
                if (slideUnlockText) {
                    slideUnlockText.style.transition = "opacity 0.28s ease";
                    slideUnlockText.style.opacity = "1";
                    setTimeout(() => {
                        if (slideUnlockText) slideUnlockText.style.transition = "";
                    }, 280);
                }
                setTimeout(() => {
                    slideUnlockThumb.style.transition = "";
                }, 280);
            }
        }

        // Pointer Events (Mouse + Touch)
        slideUnlockThumb.addEventListener("pointerdown", function (e) {
            e.preventDefault();
            try { slideUnlockThumb.setPointerCapture(e.pointerId); } catch (err) { }
            onDragStart(e.clientX);
        });

        slideUnlockThumb.addEventListener("pointermove", function (e) {
            if (isDragging) {
                e.preventDefault();
                onDragMove(e.clientX);
            }
        });

        slideUnlockThumb.addEventListener("pointerup", function (e) {
            if (isDragging) {
                try { slideUnlockThumb.releasePointerCapture(e.pointerId); } catch (err) { }
                onDragEnd();
            }
        });

        slideUnlockThumb.addEventListener("pointercancel", function () {
            if (isDragging) onDragEnd();
        });

        // Touch Fallback
        slideUnlockThumb.addEventListener("touchstart", function (e) {
            if (e.touches.length > 0) {
                onDragStart(e.touches[0].clientX);
            }
        }, { passive: true });

        window.addEventListener("touchmove", function (e) {
            if (isDragging && e.touches.length > 0) {
                onDragMove(e.touches[0].clientX);
            }
        }, { passive: true });

        window.addEventListener("touchend", function () {
            if (isDragging) onDragEnd();
        });
    }

    if (restartBtn) {
        restartBtn.addEventListener("click", function () {
            startCountdown();
        });
    }

    // Startup check
    function init() {
        try {
            const isLocked = localStorage.getItem(STORAGE_KURT_LOCK_KEY);
            if (isLocked === "locked") {
                enterKurtKapaniMode(false);
            } else {
                // If not locked, start countdown immediately on load
                setTimeout(() => {
                    startCountdown();
                }, 300);
            }
        } catch (e) {
            startCountdown();
        }
    }

    init();

})();
