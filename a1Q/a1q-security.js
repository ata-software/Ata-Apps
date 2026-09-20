/**
 * ============================================================================
 * α1Q v3.0 w.DRAGON GÜVENLİK SİSTEMİ - ÇEKİRDEK KONTROL MOTORU
 * WebGL Chroma-Key Donanım Hızlandırma, Web Audio API ve 4-Adımlı Gizli Kilit
 * ============================================================================
 */

(function (global) {
    "use strict";

    // ------------------------------------------------------------------------
    // AYARLAR & SABİTLER
    // ------------------------------------------------------------------------
    const STORAGE_LOCK_KEY = "ata_kurt_kapani_lock_v1";
    let isSoundEnabled = true;

    let countdownInterval = null;
    let countdownStartTimeout = null;
    let isKurtKapaniActive = false;
    let isCountingDown = false;

    // Durum Değişikliği Bildirim Aboneleri
    const stateListeners = [];

    function notifyState(state) {
        stateListeners.forEach(cb => {
            try { cb(state); } catch (e) { console.error(e); }
        });
    }

    // ------------------------------------------------------------------------
    // DOM ELEMANLARI
    // ------------------------------------------------------------------------
    let countdownOverlay = null;
    let countdownNumber = null;
    let countdownProgressBar = null;
    let kurtKapaniOverlay = null;

    let dragonVideo = null;
    let dragonCanvas = null;
    let kurtDragonVideo = null;
    let kurtDragonCanvas = null;

    let secretUnlockTrigger = null;
    let guvenlikTrigger = null;

    let slideUnlockWrapper = null;
    let slideUnlockTrack = null;
    let slideUnlockThumb = null;
    let slideUnlockProgress = null;
    let slideUnlockText = null;

    // ------------------------------------------------------------------------
    // WEB AUDIO API - SAF SES SENTEZLEYİCİ
    // ------------------------------------------------------------------------
    let audioCtx = null;
    function getAudioContext() {
        if (!audioCtx) {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (AudioContextClass) {
                audioCtx = new AudioContextClass();
            }
        }
        if (audioCtx && audioCtx.state === "suspended") {
            audioCtx.resume().catch(() => {});
        }
        return audioCtx;
    }

    function playCountdownTick() {
        if (!isSoundEnabled) return;
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

    function playLockdownSound() {
        if (!isSoundEnabled) return;
        try {
            const ctx = getAudioContext();
            if (!ctx) return;
            const now = ctx.currentTime;

            const chords = [130.81, 155.56, 196.0]; // C3 minor akor
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

    function playUnlockChime() {
        if (!isSoundEnabled) return;
        try {
            const ctx = getAudioContext();
            if (!ctx) return;
            const now = ctx.currentTime;

            const freqs = [1046.5, 1567.98]; // C6 -> G6 iOS açılış melodisi
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
                osc.stop(now + idx * 0.1 + 0.55);
            });
        } catch (e) { }
    }

    // ------------------------------------------------------------------------
    // 1. GERİ SAYIM DRAGON VİDEOSU (dragon.mp4) WEBGL CHROMA-KEY MOTORU
    // ------------------------------------------------------------------------
    let dragonCtx = null;
    let dragonAnimFrame = null;
    let isDragonPlaying = false;
    let gl = null;
    let webglProgram = null;
    let videoTexture = null;
    let useWebGL = false;

    function initDragonWebGL() {
        if (!dragonCanvas) return;
        try {
            const ctxOpts = { alpha: true, depth: false, stencil: false, antialias: false, premultipliedAlpha: true };
            gl = dragonCanvas.getContext("webgl", ctxOpts) || dragonCanvas.getContext("experimental-webgl", ctxOpts);
        } catch (e) {
            gl = null;
        }

        if (!gl) {
            useWebGL = false;
            dragonCanvas.width = 360;
            dragonCanvas.height = 640;
            dragonCtx = dragonCanvas.getContext("2d", { willReadFrequently: true, alpha: true });
            return;
        }

        const vsSource = `
            attribute vec2 aPosition;
            attribute vec2 aTexCoord;
            varying vec2 vTexCoord;
            void main() {
                gl_Position = vec4(aPosition, 0.0, 1.0);
                vTexCoord = aTexCoord;
            }
        `;

        const fsSource = `
            precision mediump float;
            varying vec2 vTexCoord;
            uniform sampler2D uTexture;
            void main() {
                vec4 c = texture2D(uTexture, vTexCoord);
                float maxRB = max(c.r, c.b);
                float greenDiff = c.g - maxRB;
                if (c.g > 0.22 && greenDiff > 0.07) {
                    discard;
                } else if (c.g > 0.17 && greenDiff > 0.02) {
                    float alpha = clamp(1.0 - (greenDiff - 0.02) / 0.05, 0.0, 1.0);
                    gl_FragColor = vec4(c.r, maxRB, c.b, c.a * alpha);
                } else {
                    gl_FragColor = c;
                }
            }
        `;

        function compileShader(glContext, source, type) {
            const shader = glContext.createShader(type);
            glContext.shaderSource(shader, source);
            glContext.compileShader(shader);
            if (!glContext.getShaderParameter(shader, glContext.COMPILE_STATUS)) {
                glContext.deleteShader(shader);
                return null;
            }
            return shader;
        }

        const vs = compileShader(gl, vsSource, gl.VERTEX_SHADER);
        const fs = compileShader(gl, fsSource, gl.FRAGMENT_SHADER);
        if (!vs || !fs) {
            useWebGL = false;
            dragonCanvas.width = 360;
            dragonCanvas.height = 640;
            dragonCtx = dragonCanvas.getContext("2d", { willReadFrequently: true, alpha: true });
            return;
        }

        webglProgram = gl.createProgram();
        gl.attachShader(webglProgram, vs);
        gl.attachShader(webglProgram, fs);
        gl.linkProgram(webglProgram);

        if (!gl.getProgramParameter(webglProgram, gl.LINK_STATUS)) {
            useWebGL = false;
            dragonCanvas.width = 360;
            dragonCanvas.height = 640;
            dragonCtx = dragonCanvas.getContext("2d", { willReadFrequently: true, alpha: true });
            return;
        }

        gl.useProgram(webglProgram);

        const vertices = new Float32Array([
            -1,  1,  0, 0,
            -1, -1,  0, 1,
             1,  1,  1, 0,
             1, -1,  1, 1
        ]);

        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

        const aPosition = gl.getAttribLocation(webglProgram, "aPosition");
        gl.enableVertexAttribArray(aPosition);
        gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 16, 0);

        const aTexCoord = gl.getAttribLocation(webglProgram, "aTexCoord");
        gl.enableVertexAttribArray(aTexCoord);
        gl.vertexAttribPointer(aTexCoord, 2, gl.FLOAT, false, 16, 8);

        videoTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, videoTexture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

        useWebGL = true;
    }

    function syncDragonCanvasSize() {
        if (!dragonVideo || !dragonCanvas) return;
        const rawW = dragonVideo.videoWidth || 540;
        const rawH = dragonVideo.videoHeight || 960;
        const scale = Math.min(1, 540 / rawW);
        const vw = Math.round(rawW * scale);
        const vh = Math.round(rawH * scale);
        if (dragonCanvas.width !== vw || dragonCanvas.height !== vh) {
            dragonCanvas.width = vw;
            dragonCanvas.height = vh;
            if (useWebGL && gl) {
                gl.viewport(0, 0, vw, vh);
            }
        }
    }

    function renderDragonFrame() {
        if (!isDragonPlaying || !dragonVideo || !dragonCanvas) return;

        if (!dragonVideo.ended && dragonVideo.readyState >= 2) {
            try {
                if (useWebGL && gl && webglProgram) {
                    gl.viewport(0, 0, dragonCanvas.width, dragonCanvas.height);
                    gl.clearColor(0, 0, 0, 0);
                    gl.clear(gl.COLOR_BUFFER_BIT);

                    gl.bindTexture(gl.TEXTURE_2D, videoTexture);
                    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, dragonVideo);
                    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
                } else if (dragonCtx) {
                    const w = dragonCanvas.width;
                    const h = dragonCanvas.height;
                    dragonCtx.drawImage(dragonVideo, 0, 0, w, h);
                    const imgData = dragonCtx.getImageData(0, 0, w, h);
                    const buf32 = new Uint32Array(imgData.data.buffer);
                    const len = buf32.length;
                    for (let i = 0; i < len; i++) {
                        const pixel = buf32[i];
                        const r = pixel & 0xFF;
                        const g = (pixel >> 8) & 0xFF;
                        const b = (pixel >> 16) & 0xFF;
                        const maxRB = r > b ? r : b;
                        const diff = g - maxRB;
                        if (diff > 16 && g > 60) {
                            buf32[i] = 0;
                        }
                    }
                    dragonCtx.putImageData(imgData, 0, 0);
                }
            } catch (e) { }
        }

        if (isDragonPlaying && !dragonVideo.ended) {
            dragonAnimFrame = requestAnimationFrame(renderDragonFrame);
        }
    }

    function startDragonVideo() {
        if (!dragonVideo) return;
        isDragonPlaying = true;
        syncDragonCanvasSize();

        if (dragonVideo.readyState === 0) {
            dragonVideo.load();
        }

        try { dragonVideo.currentTime = 0; } catch (e) { }
        if (dragonAnimFrame) cancelAnimationFrame(dragonAnimFrame);

        dragonVideo.muted = !isSoundEnabled;
        dragonVideo.volume = 1.0;

        const playPromise = dragonVideo.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {
                syncDragonCanvasSize();
                dragonAnimFrame = requestAnimationFrame(renderDragonFrame);
            }).catch(() => {
                dragonVideo.muted = true;
                dragonVideo.play().then(() => {
                    dragonAnimFrame = requestAnimationFrame(renderDragonFrame);
                }).catch(() => {});
            });
        } else {
            dragonAnimFrame = requestAnimationFrame(renderDragonFrame);
        }
    }

    function stopDragonVideo() {
        isDragonPlaying = false;
        if (dragonAnimFrame) {
            cancelAnimationFrame(dragonAnimFrame);
            dragonAnimFrame = null;
        }
        if (dragonVideo) {
            dragonVideo.pause();
            try { dragonVideo.currentTime = 0; } catch (e) { }
        }
        if (useWebGL && gl) {
            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT);
        } else if (dragonCtx && dragonCanvas) {
            dragonCtx.clearRect(0, 0, dragonCanvas.width, dragonCanvas.height);
        }
    }

    // ------------------------------------------------------------------------
    // 2. KİLİT EKRANI DRAGON VİDEOSU (kilit_dragon.mp4) WEBGL CHROMA-KEY MOTORU
    // ------------------------------------------------------------------------
    let kurtDragonCtx = null;
    let kurtDragonAnimFrame = null;
    let isKurtDragonPlaying = false;
    let kurtGl = null;
    let kurtWebglProgram = null;
    let kurtVideoTexture = null;
    let kurtBuffer = null;
    let kurtPosAttr = -1;
    let kurtTexAttr = -1;
    let useKurtWebGL = false;
    let kurtRestartTimeout = null;

    function initKurtDragonWebGL() {
        if (!kurtDragonCanvas) return;
        try {
            const ctxOpts = { alpha: true, depth: false, stencil: false, antialias: false, premultipliedAlpha: true, powerPreference: "high-performance" };
            kurtGl = kurtDragonCanvas.getContext("webgl", ctxOpts) || kurtDragonCanvas.getContext("experimental-webgl", ctxOpts);
        } catch (e) {
            kurtGl = null;
        }

        if (!kurtGl) {
            useKurtWebGL = false;
            kurtDragonCanvas.width = 360;
            kurtDragonCanvas.height = 640;
            kurtDragonCtx = kurtDragonCanvas.getContext("2d", { willReadFrequently: true, alpha: true });
            return;
        }

        const vsSource = `
            attribute vec2 aPosition;
            attribute vec2 aTexCoord;
            varying vec2 vTexCoord;
            void main() {
                gl_Position = vec4(aPosition, 0.0, 1.0);
                vTexCoord = aTexCoord;
            }
        `;

        const fsSource = `
            precision mediump float;
            varying vec2 vTexCoord;
            uniform sampler2D uTexture;
            void main() {
                vec4 c = texture2D(uTexture, vTexCoord);
                float maxRB = max(c.r, c.b);
                float greenDiff = c.g - maxRB;
                if (c.g > 0.22 && greenDiff > 0.07) {
                    discard;
                } else if (c.g > 0.17 && greenDiff > 0.02) {
                    float alpha = clamp(1.0 - (greenDiff - 0.02) / 0.05, 0.0, 1.0);
                    gl_FragColor = vec4(c.r, maxRB, c.b, c.a * alpha);
                } else {
                    gl_FragColor = c;
                }
            }
        `;

        function compileShader(glContext, source, type) {
            const shader = glContext.createShader(type);
            glContext.shaderSource(shader, source);
            glContext.compileShader(shader);
            if (!glContext.getShaderParameter(shader, glContext.COMPILE_STATUS)) {
                glContext.deleteShader(shader);
                return null;
            }
            return shader;
        }

        const vs = compileShader(kurtGl, vsSource, kurtGl.VERTEX_SHADER);
        const fs = compileShader(kurtGl, fsSource, kurtGl.FRAGMENT_SHADER);
        if (!vs || !fs) {
            useKurtWebGL = false;
            kurtDragonCanvas.width = 360;
            kurtDragonCanvas.height = 640;
            kurtDragonCtx = kurtDragonCanvas.getContext("2d", { willReadFrequently: true, alpha: true });
            return;
        }

        kurtWebglProgram = kurtGl.createProgram();
        kurtGl.attachShader(kurtWebglProgram, vs);
        kurtGl.attachShader(kurtWebglProgram, fs);
        kurtGl.linkProgram(kurtWebglProgram);

        if (!kurtGl.getProgramParameter(kurtWebglProgram, kurtGl.LINK_STATUS)) {
            useKurtWebGL = false;
            kurtDragonCanvas.width = 360;
            kurtDragonCanvas.height = 640;
            kurtDragonCtx = kurtDragonCanvas.getContext("2d", { willReadFrequently: true, alpha: true });
            return;
        }

        kurtGl.useProgram(kurtWebglProgram);

        const vertices = new Float32Array([
            -1,  1,  0, 0,
            -1, -1,  0, 1,
             1,  1,  1, 0,
             1, -1,  1, 1
        ]);

        kurtBuffer = kurtGl.createBuffer();
        kurtGl.bindBuffer(kurtGl.ARRAY_BUFFER, kurtBuffer);
        kurtGl.bufferData(kurtGl.ARRAY_BUFFER, vertices, kurtGl.STATIC_DRAW);

        kurtPosAttr = kurtGl.getAttribLocation(kurtWebglProgram, "aPosition");
        kurtGl.enableVertexAttribArray(kurtPosAttr);
        kurtGl.vertexAttribPointer(kurtPosAttr, 2, kurtGl.FLOAT, false, 16, 0);

        kurtTexAttr = kurtGl.getAttribLocation(kurtWebglProgram, "aTexCoord");
        kurtGl.enableVertexAttribArray(kurtTexAttr);
        kurtGl.vertexAttribPointer(kurtTexAttr, 2, kurtGl.FLOAT, false, 16, 8);

        kurtVideoTexture = kurtGl.createTexture();
        kurtGl.bindTexture(kurtGl.TEXTURE_2D, kurtVideoTexture);
        kurtGl.texParameteri(kurtGl.TEXTURE_2D, kurtGl.TEXTURE_WRAP_S, kurtGl.CLAMP_TO_EDGE);
        kurtGl.texParameteri(kurtGl.TEXTURE_2D, kurtGl.TEXTURE_WRAP_T, kurtGl.CLAMP_TO_EDGE);
        kurtGl.texParameteri(kurtGl.TEXTURE_2D, kurtGl.TEXTURE_MIN_FILTER, kurtGl.LINEAR);
        kurtGl.texParameteri(kurtGl.TEXTURE_2D, kurtGl.TEXTURE_MAG_FILTER, kurtGl.LINEAR);

        useKurtWebGL = true;
    }

    function syncKurtDragonCanvasSize() {
        if (!kurtDragonVideo || !kurtDragonCanvas) return;
        const rawW = kurtDragonVideo.videoWidth || 540;
        const rawH = kurtDragonVideo.videoHeight || 960;
        const scale = Math.min(1, 540 / rawW);
        const vw = Math.round(rawW * scale);
        const vh = Math.round(rawH * scale);
        if (kurtDragonCanvas.width !== vw || kurtDragonCanvas.height !== vh) {
            kurtDragonCanvas.width = vw;
            kurtDragonCanvas.height = vh;
            if (useKurtWebGL && kurtGl) {
                kurtGl.viewport(0, 0, vw, vh);
            }
        }
    }

    function renderKurtDragonFrame() {
        if (!isKurtDragonPlaying || !kurtDragonVideo || !kurtDragonCanvas) return;

        if (!kurtDragonVideo.ended && kurtDragonVideo.readyState >= 2) {
            try {
                if (useKurtWebGL && kurtGl && kurtWebglProgram) {
                    kurtGl.viewport(0, 0, kurtDragonCanvas.width, kurtDragonCanvas.height);
                    kurtGl.clearColor(0, 0, 0, 0);
                    kurtGl.clear(kurtGl.COLOR_BUFFER_BIT);

                    kurtGl.useProgram(kurtWebglProgram);
                    if (kurtBuffer) kurtGl.bindBuffer(kurtGl.ARRAY_BUFFER, kurtBuffer);
                    if (kurtPosAttr >= 0) {
                        kurtGl.enableVertexAttribArray(kurtPosAttr);
                        kurtGl.vertexAttribPointer(kurtPosAttr, 2, kurtGl.FLOAT, false, 16, 0);
                    }
                    if (kurtTexAttr >= 0) {
                        kurtGl.enableVertexAttribArray(kurtTexAttr);
                        kurtGl.vertexAttribPointer(kurtTexAttr, 2, kurtGl.FLOAT, false, 16, 8);
                    }

                    kurtGl.bindTexture(kurtGl.TEXTURE_2D, kurtVideoTexture);
                    kurtGl.texImage2D(kurtGl.TEXTURE_2D, 0, kurtGl.RGBA, kurtGl.RGBA, kurtGl.UNSIGNED_BYTE, kurtDragonVideo);
                    kurtGl.drawArrays(kurtGl.TRIANGLE_STRIP, 0, 4);
                } else if (kurtDragonCtx) {
                    const w = kurtDragonCanvas.width;
                    const h = kurtDragonCanvas.height;
                    kurtDragonCtx.drawImage(kurtDragonVideo, 0, 0, w, h);
                    const imgData = kurtDragonCtx.getImageData(0, 0, w, h);
                    const buf32 = new Uint32Array(imgData.data.buffer);
                    const len = buf32.length;
                    for (let i = 0; i < len; i++) {
                        const pixel = buf32[i];
                        const r = pixel & 0xFF;
                        const g = (pixel >> 8) & 0xFF;
                        const b = (pixel >> 16) & 0xFF;
                        const maxRB = r > b ? r : b;
                        const diff = g - maxRB;
                        if (diff > 16 && g > 60) {
                            buf32[i] = 0;
                        }
                    }
                    kurtDragonCtx.putImageData(imgData, 0, 0);
                }
            } catch (e) { }
        }

        if (isKurtDragonPlaying && !kurtDragonVideo.ended) {
            kurtDragonAnimFrame = requestAnimationFrame(renderKurtDragonFrame);
        }
    }

    function startKurtDragonVideo() {
        if (!kurtDragonVideo) return;
        isKurtDragonPlaying = true;

        if (kurtRestartTimeout) {
            clearTimeout(kurtRestartTimeout);
            kurtRestartTimeout = null;
        }

        syncKurtDragonCanvasSize();
        if (kurtDragonAnimFrame) cancelAnimationFrame(kurtDragonAnimFrame);

        kurtDragonVideo.muted = false;
        kurtDragonVideo.volume = 1.0;

        const p = kurtDragonVideo.play();
        if (p !== undefined) {
            p.then(() => {
                syncKurtDragonCanvasSize();
                kurtDragonAnimFrame = requestAnimationFrame(renderKurtDragonFrame);
            }).catch(() => {
                kurtDragonVideo.muted = true;
                kurtDragonVideo.play().then(() => {
                    kurtDragonAnimFrame = requestAnimationFrame(renderKurtDragonFrame);
                }).catch(() => {});
            });
        } else {
            kurtDragonAnimFrame = requestAnimationFrame(renderKurtDragonFrame);
        }
    }

    function stopKurtDragonVideo() {
        isKurtDragonPlaying = false;
        if (kurtRestartTimeout) {
            clearTimeout(kurtRestartTimeout);
            kurtRestartTimeout = null;
        }
        if (kurtDragonAnimFrame) {
            cancelAnimationFrame(kurtDragonAnimFrame);
            kurtDragonAnimFrame = null;
        }
        if (kurtDragonVideo) {
            kurtDragonVideo.pause();
            try { kurtDragonVideo.currentTime = 0; } catch (e) { }
        }
        if (useKurtWebGL && kurtGl) {
            kurtGl.clearColor(0, 0, 0, 0);
            kurtGl.clear(kurtGl.COLOR_BUFFER_BIT);
        } else if (kurtDragonCtx && kurtDragonCanvas) {
            kurtDragonCtx.clearRect(0, 0, kurtDragonCanvas.width, kurtDragonCanvas.height);
        }
    }

    // ------------------------------------------------------------------------
    // 3. 10 SANİYE GERİ SAYIM PROTOKOLÜ
    // ------------------------------------------------------------------------
    function startCountdown() {
        if (isKurtKapaniActive) return;
        if (isCountingDown && countdownInterval) return;

        isCountingDown = true;
        notifyState("countdown");

        if (countdownStartTimeout) {
            clearTimeout(countdownStartTimeout);
            countdownStartTimeout = null;
        }
        if (countdownInterval) {
            clearInterval(countdownInterval);
            countdownInterval = null;
        }

        const TOTAL_COUNTDOWN_SECONDS = 10;
        let secondsLeft = TOTAL_COUNTDOWN_SECONDS;

        if (countdownNumber) {
            countdownNumber.textContent = secondsLeft;
            countdownNumber.classList.remove("tick-pop");
        }
        if (countdownProgressBar) {
            countdownProgressBar.style.transition = "none";
            countdownProgressBar.style.width = "100%";
            void countdownProgressBar.offsetWidth;
            countdownProgressBar.style.transition = "width 1s linear";
        }

        document.body.classList.add("countdown-screen-active");
        document.body.classList.remove("kurt-screen-active");
        stopKurtDragonVideo();

        if (kurtKapaniOverlay) {
            kurtKapaniOverlay.classList.remove("active");
            kurtKapaniOverlay.style.display = "none";
            kurtKapaniOverlay.setAttribute("aria-hidden", "true");
        }

        if (countdownOverlay) {
            countdownOverlay.style.display = "flex";
            countdownOverlay.classList.add("active");
            countdownOverlay.setAttribute("aria-hidden", "false");
        }

        startDragonVideo();
        playCountdownTick();

        if (kurtDragonVideo && kurtDragonVideo.readyState === 0) {
            kurtDragonVideo.load();
        }

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
                countdownProgressBar.style.width = Math.max(0, (secondsLeft / TOTAL_COUNTDOWN_SECONDS) * 100) + "%";
            }

            playCountdownTick();

            if (secondsLeft <= 0) {
                clearInterval(countdownInterval);
                countdownInterval = null;
                isCountingDown = false;
                transitionCountdownToLockScreen();
            }
        }, 1000);
    }

    function transitionCountdownToLockScreen() {
        isKurtKapaniActive = true;
        isCountingDown = false;
        notifyState("locked");

        resetSecretUnlockState();

        document.body.classList.remove("countdown-screen-active");
        document.body.classList.add("kurt-screen-active");
        document.documentElement.classList.add("kurt-locked-boot", "kurt-screen-active");

        if (slideUnlockWrapper) slideUnlockWrapper.classList.remove("revealed");
        if (slideUnlockThumb) {
            slideUnlockThumb.style.transition = "";
            slideUnlockThumb.style.transform = "translateX(0px)";
            slideUnlockThumb.classList.remove("dragging");
        }
        if (slideUnlockProgress) {
            slideUnlockProgress.style.transition = "";
            slideUnlockProgress.style.width = "0px";
        }
        if (slideUnlockText) {
            slideUnlockText.style.transition = "";
            slideUnlockText.style.opacity = "1";
        }

        document.documentElement.classList.add("kurt-animating");

        if (kurtKapaniOverlay) {
            kurtKapaniOverlay.style.display = "flex";
            kurtKapaniOverlay.classList.add("active");
            kurtKapaniOverlay.setAttribute("aria-hidden", "false");
        }
        startKurtDragonVideo();

        const countdownBox = document.querySelector(".countdown-box");
        if (countdownOverlay) countdownOverlay.classList.add("fading-out");
        if (countdownBox) countdownBox.classList.add("fading-out");
        if (dragonCanvas) dragonCanvas.classList.add("fading-out");

        playLockdownSound();

        setTimeout(() => {
            stopDragonVideo();
            if (countdownOverlay) {
                countdownOverlay.classList.remove("active", "fading-out");
                countdownOverlay.style.display = "none";
                countdownOverlay.setAttribute("aria-hidden", "true");
            }
            if (countdownBox) countdownBox.classList.remove("fading-out");
            if (dragonCanvas) dragonCanvas.classList.remove("fading-out");

            try {
                localStorage.setItem(STORAGE_LOCK_KEY, "locked");
            } catch (e) { }

            document.documentElement.classList.remove("kurt-animating");
        }, 850);
    }

    // ------------------------------------------------------------------------
    // 4. α1Q KİLİT EKRANI MODU
    // ------------------------------------------------------------------------
    function enterKurtKapaniMode(playSound = true) {
        isKurtKapaniActive = true;
        isCountingDown = false;
        notifyState("locked");

        stopDragonVideo();
        resetSecretUnlockState();

        try {
            localStorage.setItem(STORAGE_LOCK_KEY, "locked");
        } catch (e) { }

        document.documentElement.classList.add("kurt-locked-boot", "kurt-screen-active");
        document.body.classList.add("kurt-locked-boot", "kurt-screen-active");
        document.body.classList.remove("countdown-screen-active");

        if (countdownInterval) {
            clearInterval(countdownInterval);
            countdownInterval = null;
        }
        if (countdownStartTimeout) {
            clearTimeout(countdownStartTimeout);
            countdownStartTimeout = null;
        }

        if (countdownOverlay) {
            countdownOverlay.classList.remove("active", "fading-out");
            countdownOverlay.style.display = "none";
            countdownOverlay.setAttribute("aria-hidden", "true");
        }

        if (slideUnlockWrapper) slideUnlockWrapper.classList.remove("revealed");
        if (slideUnlockThumb) {
            slideUnlockThumb.style.transition = "";
            slideUnlockThumb.style.transform = "translateX(0px)";
            slideUnlockThumb.classList.remove("dragging");
        }
        if (slideUnlockProgress) {
            slideUnlockProgress.style.transition = "";
            slideUnlockProgress.style.width = "0px";
        }
        if (slideUnlockText) {
            slideUnlockText.style.transition = "";
            slideUnlockText.style.opacity = "1";
        }

        if (kurtKapaniOverlay) {
            kurtKapaniOverlay.style.display = "flex";
            kurtKapaniOverlay.classList.add("active");
            kurtKapaniOverlay.setAttribute("aria-hidden", "false");
        }
        startKurtDragonVideo();

        if (playSound) {
            playLockdownSound();
        }
    }

    function exitKurtKapaniMode() {
        if (!isKurtKapaniActive) return;
        isKurtKapaniActive = false;
        isCountingDown = false;
        notifyState("unlocked");

        resetSecretUnlockState();

        try {
            localStorage.removeItem(STORAGE_LOCK_KEY);
        } catch (e) { }

        document.documentElement.classList.remove("kurt-locked-boot", "kurt-screen-active");
        document.body.classList.remove("kurt-locked-boot", "kurt-screen-active", "countdown-screen-active");

        stopDragonVideo();
        stopKurtDragonVideo();

        if (countdownInterval) {
            clearInterval(countdownInterval);
            countdownInterval = null;
        }
        if (countdownStartTimeout) {
            clearTimeout(countdownStartTimeout);
            countdownStartTimeout = null;
        }

        if (slideUnlockWrapper) slideUnlockWrapper.classList.remove("revealed");
        if (slideUnlockThumb) {
            slideUnlockThumb.style.transition = "";
            slideUnlockThumb.style.transform = "translateX(0px)";
            slideUnlockThumb.classList.remove("dragging");
        }
        if (slideUnlockProgress) {
            slideUnlockProgress.style.transition = "";
            slideUnlockProgress.style.width = "0px";
        }
        if (slideUnlockText) {
            slideUnlockText.style.transition = "";
            slideUnlockText.style.opacity = "1";
        }

        if (countdownOverlay) {
            countdownOverlay.classList.remove("active", "fading-out");
            countdownOverlay.style.display = "none";
            countdownOverlay.setAttribute("aria-hidden", "true");
        }
        if (kurtKapaniOverlay) {
            kurtKapaniOverlay.classList.remove("active");
            kurtKapaniOverlay.style.display = "none";
            kurtKapaniOverlay.setAttribute("aria-hidden", "true");
        }

        playUnlockChime();
    }

    // ------------------------------------------------------------------------
    // 5. GİZLİ KİLİT AÇMA SIRASI (4-ADIM):
    //    1. "Güvenlik" yazısına 2 kez tıklama
    //    2. Aşağı kaydırma (Swipe Down)
    //    3. Logoya 2 kez tıklama (Çift Tık)
    //    4. Ortada beliren Apple çubuğunu sağa kaydırma
    // ------------------------------------------------------------------------
    let step1_guvenlikTapped = false;
    let step1Time = 0;
    let guvenlikTapCount = 0;
    let lastGuvenlikTapTime = 0;

    let step2_swipedDown = false;
    let step2Time = 0;
    let isSwipeTracking = false;
    let swipeStartX = 0;
    let swipeStartY = 0;
    let ignoreNextLogoClick = false;

    let logoTapCount = 0;
    let lastLogoTapTime = 0;

    function resetSecretUnlockState() {
        step1_guvenlikTapped = false;
        step1Time = 0;
        guvenlikTapCount = 0;
        lastGuvenlikTapTime = 0;

        step2_swipedDown = false;
        step2Time = 0;
        isSwipeTracking = false;
        swipeStartX = 0;
        swipeStartY = 0;
        ignoreNextLogoClick = false;

        logoTapCount = 0;
        lastLogoTapTime = 0;
    }

    function setupSecretUnlockEvents() {
        // ADIM 1: "Güvenlik" satırına çift tıklama
        if (guvenlikTrigger) {
            guvenlikTrigger.addEventListener("click", function (e) {
                if (!isKurtKapaniActive) return;

                const now = Date.now();
                if (now - lastGuvenlikTapTime < 600) {
                    guvenlikTapCount++;
                } else {
                    guvenlikTapCount = 1;
                }
                lastGuvenlikTapTime = now;

                if (guvenlikTapCount >= 2) {
                    step1_guvenlikTapped = true;
                    step1Time = now;
                    guvenlikTapCount = 0;
                    step2_swipedDown = false;
                    logoTapCount = 0;
                    // Güvenlik satırına basıldığında ses çıkarılmaz (gizli adım)
                }
            });
        }

        // ADIM 2: Aşağı kaydırma (Adım 1 tamamlandıktan sonra 10s içinde)
        window.addEventListener("pointerdown", function (e) {
            if (!isKurtKapaniActive) return;
            if (slideUnlockWrapper && slideUnlockWrapper.contains(e.target)) return;

            isSwipeTracking = true;
            swipeStartX = e.clientX;
            swipeStartY = e.clientY;
        });

        window.addEventListener("pointerup", function (e) {
            if (!isSwipeTracking) return;
            isSwipeTracking = false;

            if (!isKurtKapaniActive) return;

            const now = Date.now();
            if (!step1_guvenlikTapped || (now - step1Time > 10000)) {
                step1_guvenlikTapped = false;
                return;
            }

            const finalDeltaY = e.clientY - swipeStartY;
            const finalDeltaX = Math.abs(e.clientX - swipeStartX);

            const isStrictlyDownward = finalDeltaY >= 35 && finalDeltaX < (finalDeltaY * 0.75);

            if (isStrictlyDownward) {
                step2_swipedDown = true;
                step2Time = now;
                logoTapCount = 0;
                ignoreNextLogoClick = true;
                setTimeout(() => { ignoreNextLogoClick = false; }, 320);
                playCountdownTick();
            }
        });

        window.addEventListener("pointercancel", function () {
            isSwipeTracking = false;
        });

        // ADIM 3: Logoya çift tıklama (Adım 2 tamamlandıktan sonra 10s içinde)
        if (secretUnlockTrigger) {
            secretUnlockTrigger.addEventListener("click", function (e) {
                if (!isKurtKapaniActive) return;
                if (ignoreNextLogoClick) return;

                const now = Date.now();

                if (!step2_swipedDown || (now - step2Time > 10000)) {
                    step1_guvenlikTapped = false;
                    step2_swipedDown = false;
                    logoTapCount = 0;
                    return;
                }

                if (now - lastLogoTapTime < 600) {
                    logoTapCount++;
                } else {
                    logoTapCount = 1;
                }
                lastLogoTapTime = now;

                if (logoTapCount >= 2) {
                    resetSecretUnlockState();
                    if (slideUnlockWrapper) {
                        slideUnlockWrapper.classList.add("revealed");
                    }
                    playCountdownTick();
                }
            });
        }

        // ADIM 4: APPLE SLIDE TO UNLOCK SÜRÜKLEME KONTROLCÜSÜ
        if (slideUnlockThumb && slideUnlockTrack) {
            let isDragging = false;
            let startX = 0;
            let currentTranslateX = 0;

            function getMaxDrag() {
                const trackRect = slideUnlockTrack.getBoundingClientRect();
                const thumbRect = slideUnlockThumb.getBoundingClientRect();
                const trackWidth = trackRect.width || 320;
                const thumbWidth = thumbRect.width || 48;
                return Math.max(20, trackWidth - thumbWidth - 8);
            }

            function onDragStart(clientX) {
                isDragging = true;
                startX = clientX - currentTranslateX;
                slideUnlockThumb.classList.add("dragging");
                slideUnlockThumb.style.transition = "none";
                if (slideUnlockProgress) slideUnlockProgress.style.transition = "none";
                if (slideUnlockText) slideUnlockText.style.transition = "none";
            }

            function onDragMove(clientX) {
                if (!isDragging) return;
                const maxDrag = getMaxDrag();
                const rawX = clientX - startX;
                currentTranslateX = Math.max(0, Math.min(rawX, maxDrag));

                slideUnlockThumb.style.transform = `translateX(${currentTranslateX}px)`;

                if (slideUnlockProgress) {
                    const thumbWidth = slideUnlockThumb.offsetWidth || 48;
                    slideUnlockProgress.style.width = `${currentTranslateX + thumbWidth / 2}px`;
                }

                if (slideUnlockText) {
                    const progress = currentTranslateX / maxDrag;
                    slideUnlockText.style.opacity = Math.max(0, 1 - progress * 1.6).toString();
                }
            }

            function onDragEnd() {
                if (!isDragging) return;
                isDragging = false;
                slideUnlockThumb.classList.remove("dragging");
                const maxDrag = getMaxDrag();

                if (currentTranslateX >= maxDrag * 0.70) {
                    slideUnlockThumb.style.transition = "transform 0.18s cubic-bezier(0.16, 1, 0.3, 1)";
                    slideUnlockThumb.style.transform = `translateX(${maxDrag}px)`;
                    if (slideUnlockProgress) {
                        slideUnlockProgress.style.transition = "width 0.18s cubic-bezier(0.16, 1, 0.3, 1)";
                        slideUnlockProgress.style.width = "100%";
                    }
                    if (slideUnlockText) {
                        slideUnlockText.style.transition = "opacity 0.15s ease";
                        slideUnlockText.style.opacity = "0";
                    }

                    setTimeout(() => {
                        exitKurtKapaniMode();
                    }, 180);
                } else {
                    slideUnlockThumb.style.transition = "transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)";
                    slideUnlockThumb.style.transform = "translateX(0px)";
                    if (slideUnlockProgress) {
                        slideUnlockProgress.style.transition = "width 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)";
                        slideUnlockProgress.style.width = "0px";
                    }
                    if (slideUnlockText) {
                        slideUnlockText.style.transition = "opacity 0.3s ease";
                        slideUnlockText.style.opacity = "1";
                    }
                    setTimeout(() => {
                        slideUnlockThumb.style.transition = "";
                        if (slideUnlockProgress) slideUnlockProgress.style.transition = "";
                        if (slideUnlockText) slideUnlockText.style.transition = "";
                    }, 300);
                }
                currentTranslateX = 0;
            }

            slideUnlockThumb.addEventListener("pointerdown", function (e) {
                e.preventDefault();
                try { slideUnlockThumb.setPointerCapture(e.pointerId); } catch (err) { }
                onDragStart(e.clientX);
            });

            window.addEventListener("pointermove", function (e) {
                if (isDragging) onDragMove(e.clientX);
            });

            window.addEventListener("pointerup", function (e) {
                if (isDragging) {
                    try { slideUnlockThumb.releasePointerCapture(e.pointerId); } catch (err) { }
                    onDragEnd();
                }
            });

            window.addEventListener("pointercancel", function () {
                if (isDragging) onDragEnd();
            });
        }
    }

    // ------------------------------------------------------------------------
    // İNİTİALİZATİON & DÖNGÜ BAŞLATMA
    // ------------------------------------------------------------------------
    function init() {
        countdownOverlay = document.getElementById("countdownOverlay");
        countdownNumber = document.getElementById("countdownNumber");
        countdownProgressBar = document.getElementById("countdownProgressBar");
        kurtKapaniOverlay = document.getElementById("kurtKapaniOverlay");

        dragonVideo = document.getElementById("dragonVideo");
        dragonCanvas = document.getElementById("dragonCanvas");
        kurtDragonVideo = document.getElementById("kurtDragonVideo");
        kurtDragonCanvas = document.getElementById("kurtDragonCanvas");

        secretUnlockTrigger = document.getElementById("secretUnlockTrigger");
        guvenlikTrigger = document.getElementById("guvenlikTrigger");

        slideUnlockWrapper = document.getElementById("slideUnlockWrapper");
        slideUnlockTrack = document.getElementById("slideUnlockTrack");
        slideUnlockThumb = document.getElementById("slideUnlockThumb");
        slideUnlockProgress = document.getElementById("slideUnlockProgress");
        slideUnlockText = document.getElementById("slideUnlockText");

        initDragonWebGL();
        initKurtDragonWebGL();
        setupSecretUnlockEvents();

        // Kilit videosu döngü bitiş dinleyicisi
        if (kurtDragonVideo) {
            kurtDragonVideo.addEventListener("ended", function () {
                if (!isKurtDragonPlaying) return;
                if (useKurtWebGL && kurtGl) {
                    kurtGl.clearColor(0, 0, 0, 0);
                    kurtGl.clear(kurtGl.COLOR_BUFFER_BIT);
                } else if (kurtDragonCtx && kurtDragonCanvas) {
                    kurtDragonCtx.clearRect(0, 0, kurtDragonCanvas.width, kurtDragonCanvas.height);
                }

                if (kurtRestartTimeout) clearTimeout(kurtRestartTimeout);
                kurtRestartTimeout = setTimeout(() => {
                    if (isKurtDragonPlaying && kurtDragonVideo) {
                        kurtDragonVideo.currentTime = 0;
                        kurtDragonVideo.play().then(() => {
                            kurtDragonAnimFrame = requestAnimationFrame(renderKurtDragonFrame);
                        }).catch(() => {});
                    }
                }, 1000);
            });
        }

        // Dokunma ile ses kilidini açma
        window.addEventListener("pointerdown", function () {
            if (isKurtKapaniActive && kurtDragonVideo && kurtDragonVideo.muted) {
                kurtDragonVideo.muted = false;
            }
        }, { passive: true });

        // Yerel Hafızadan Kilit Kontrolü
        try {
            const isLocked = localStorage.getItem(STORAGE_LOCK_KEY);
            if (isLocked === "locked") {
                enterKurtKapaniMode(false);
            } else {
                notifyState("unlocked");
            }
        } catch (e) { }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }

    // ------------------------------------------------------------------------
    // DIŞA AKTARILAN GLOBAL API
    // ------------------------------------------------------------------------
    global.A1QSecurity = {
        triggerCountdown: startCountdown,
        enterLockout: () => enterKurtKapaniMode(true),
        unlock: exitKurtKapaniMode,
        isLocked: () => isKurtKapaniActive,
        isCountingDown: () => isCountingDown,
        setSound: (enabled) => { isSoundEnabled = !!enabled; },
        clearPersistentLock: () => {
            try { localStorage.removeItem(STORAGE_LOCK_KEY); } catch (e) { }
            exitKurtKapaniMode();
        },
        onStateChange: (cb) => {
            if (typeof cb === "function") stateListeners.push(cb);
        }
    };

})(window);
