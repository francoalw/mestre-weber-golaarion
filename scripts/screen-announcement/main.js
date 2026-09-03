const MODULE_ID = "mestre-weber-golaarion";
const SOCKET_ACTION = "screen-announcement-show";

const SETTING_TEXT_COLOR = "announceTextColor";
const SETTING_GLOW_COLOR = "announceGlowColor";
const SETTING_SHIMMER_COLOR = "announceShimmerColor";
const SETTING_SUB_COLOR = "announceSubColor";
const SETTING_PARTICLE_COLOR = "announceParticleColor";
const SETTING_BG_INTENSITY = "announceBgIntensity";
const SETTING_DEFAULT_ANIMATION = "announceDefaultAnimation";

function hexToRgb(hex) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex ?? "");
    return m
        ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) }
        : { r: 217, g: 178, b: 106 };
}

function applyAnnounceCssVariables() {
    const root = document.documentElement.style;
    root.setProperty("--mw-announce-text-color", game.settings.get(MODULE_ID, SETTING_TEXT_COLOR));
    root.setProperty("--mw-announce-glow-color", game.settings.get(MODULE_ID, SETTING_GLOW_COLOR));
    root.setProperty("--mw-announce-shimmer-color", game.settings.get(MODULE_ID, SETTING_SHIMMER_COLOR));
    root.setProperty("--mw-announce-sub-color", game.settings.get(MODULE_ID, SETTING_SUB_COLOR));

    const intensity = game.settings.get(MODULE_ID, SETTING_BG_INTENSITY);
    root.setProperty("--mw-announce-bg-mid", `rgba(0, 0, 0, ${(intensity * 0.6).toFixed(2)})`);
    root.setProperty("--mw-announce-bg-outer", `rgba(0, 0, 0, ${intensity})`);
}

function spawnParticles(spawnDurationMs) {
    const canvas = document.createElement("canvas");
    canvas.classList.add("mw-announce-particles");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    document.body.appendChild(canvas);
    const ctx = canvas.getContext("2d");

    const onResize = () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", onResize);

    const particles = [];
    const startTime = performance.now();
    let stopSpawning = false;
    const particleRgb = hexToRgb(game.settings.get(MODULE_ID, SETTING_PARTICLE_COLOR));

    function spawnParticle() {
        particles.push({
            x: Math.random() * canvas.width,
            y: canvas.height * (0.15 + Math.random() * 0.8),
            vx: (Math.random() - 0.5) * 0.25,
            vy: -0.15 - Math.random() * 0.15,
            size: 1.5 + Math.random() * 2,
            born: performance.now(),
            life: 3200 + Math.random() * 2600,
            wobble: Math.random() * Math.PI * 2,
            blinkSpeed: 0.002 + Math.random() * 0.003
        });
    }

    function tick(now) {
        const elapsed = now - startTime;
        if (elapsed > spawnDurationMs) stopSpawning = true;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (!stopSpawning && Math.random() < 0.6) spawnParticle();

        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            const age = now - p.born;
            if (age > p.life) {
                particles.splice(i, 1);
                continue;
            }

            p.x += p.vx + Math.sin(now / 900 + p.wobble) * 0.15;
            p.y += p.vy + Math.cos(now / 1300 + p.wobble) * 0.1;

            const lifeRatio = age / p.life;
            const fade = Math.sin(lifeRatio * Math.PI);
            const blink = 0.5 + 0.5 * Math.sin(now * p.blinkSpeed + p.wobble);
            const alpha = fade * (0.25 + 0.75 * blink);

            ctx.beginPath();
            ctx.fillStyle = `rgba(${particleRgb.r}, ${particleRgb.g}, ${particleRgb.b}, ${alpha})`;
            ctx.shadowColor = `rgba(${particleRgb.r}, ${particleRgb.g}, ${particleRgb.b}, ${Math.min(alpha * 1.15, 1)})`;
            ctx.shadowBlur = 10;
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        }

        if (stopSpawning && particles.length === 0) {
            window.removeEventListener("resize", onResize);
            canvas.remove();
            return;
        }
        requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
}

function showOverlayText(title, subtitle, animation, totalMs, textDelayMs) {
    const isFall = animation === "fall";
    const total = totalMs ?? (isFall ? 7900 : 7300);
    const delay = textDelayMs ?? 0;
    const overlay = document.createElement("div");
    overlay.classList.add("mw-announce-overlay");
    const textClass = isFall ? "mw-announce-overlay-text fall" : "mw-announce-overlay-text";
    overlay.innerHTML = `
        <div class="${textClass}">
            <span class="mw-announce-overlay-title">${title}</span>
            ${subtitle ? `<span class="mw-announce-overlay-sub">${subtitle}</span>` : ""}
        </div>
    `;
    document.body.appendChild(overlay);
    const textEl = overlay.querySelector(".mw-announce-overlay-text");

    // fundo escurece na hora, independente do atraso do texto
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            overlay.classList.add("show");
        });
    });

    setTimeout(() => {
        if (isFall) {
            // posição fixada via inline style: não depende da classe "show",
            // então o fade-out final não faz o texto "voltar" pra cima.
            textEl.style.transform = "translateY(0)";
            setTimeout(() => textEl.classList.add("shimmer"), 5500);
        } else {
            textEl.classList.add("reveal");
        }
    }, delay);

    // últimos 2.7s do total são reservados para o fade-out (dura 2.2s no CSS + folga)
    const FADE_OUT_BLOCK_MS = 2700;
    const minFadeStart = delay + (isFall ? 6900 : 2600); // não começa a sumir antes do atraso + entrada (5.5s queda + 1.4s brilho, ou 2.6s fade) terminar
    const FADE_OUT_START_MS = Math.max(total - FADE_OUT_BLOCK_MS, minFadeStart);
    const REMOVE_MS = FADE_OUT_START_MS + FADE_OUT_BLOCK_MS;
    setTimeout(() => overlay.classList.remove("show"), FADE_OUT_START_MS);
    setTimeout(() => overlay.remove(), REMOVE_MS);
}

function runSequence({ title, subtitle, sound, animation, duration, soundDelay, textDelay }) {
    const resolvedAnimation = animation ?? game.settings.get(MODULE_ID, SETTING_DEFAULT_ANIMATION);
    const isFall = resolvedAnimation === "fall";
    const totalMs = duration ?? (isFall ? 7900 : 7300);
    const PARTICLE_SPAWN_MS = duration ? Math.max(duration - 3000, 1000) : 4000;
    const SOUND_DELAY_MS = soundDelay ?? 3000;

    spawnParticles(PARTICLE_SPAWN_MS);
    showOverlayText(title, subtitle, resolvedAnimation, totalMs, textDelay);

    if (sound) {
        setTimeout(async () => {
            try {
                await foundry.audio.AudioHelper.play({ src: sound, volume: 0.8, autoplay: true, loop: false }, false);
            } catch (err) {
                console.error(`${MODULE_ID} | Falha ao tocar som do anúncio ("${sound}"):`, err);
                ui.notifications?.error(`Anúncio de tela: falha ao tocar o som "${sound}". Veja o console (F12) para detalhes.`);
            }
        }, SOUND_DELAY_MS);
    }
}

Hooks.once("init", () => {
    game.settings.register(MODULE_ID, SETTING_TEXT_COLOR, {
        name: "Anúncio de tela: cor do texto",
        hint: "Cor principal do texto exibido no aviso dramático de tela cheia.",
        scope: "world",
        config: true,
        type: new foundry.data.fields.ColorField({ required: true, nullable: false, initial: "#d9b26a" }),
        default: "#d9b26a"
    });

    game.settings.register(MODULE_ID, SETTING_GLOW_COLOR, {
        name: "Anúncio de tela: cor do brilho",
        hint: "Cor do brilho/sombra ao redor do texto e das bordas da tela.",
        scope: "world",
        config: true,
        type: new foundry.data.fields.ColorField({ required: true, nullable: false, initial: "#821ebe" }),
        default: "#821ebe"
    });

    game.settings.register(MODULE_ID, SETTING_SHIMMER_COLOR, {
        name: "Anúncio de tela: cor do lampejo (animação 'queda')",
        hint: "Cor do brilho pulsante que aparece quando o texto termina de cair, na animação 'Queda do alto'.",
        scope: "world",
        config: true,
        type: new foundry.data.fields.ColorField({ required: true, nullable: false, initial: "#d9b26a" }),
        default: "#d9b26a"
    });

    game.settings.register(MODULE_ID, SETTING_SUB_COLOR, {
        name: "Anúncio de tela: cor do subtítulo",
        hint: "Cor da linha de subtítulo, quando houver.",
        scope: "world",
        config: true,
        type: new foundry.data.fields.ColorField({ required: true, nullable: false, initial: "#6a4a35" }),
        default: "#6a4a35"
    });

    game.settings.register(MODULE_ID, SETTING_PARTICLE_COLOR, {
        name: "Anúncio de tela: cor das partículas",
        hint: "Cor das partículas que flutuam na tela durante o aviso.",
        scope: "world",
        config: true,
        type: new foundry.data.fields.ColorField({ required: true, nullable: false, initial: "#d4ff4d" }),
        default: "#d4ff4d"
    });

    game.settings.register(MODULE_ID, SETTING_BG_INTENSITY, {
        name: "Anúncio de tela: intensidade do escurecimento de fundo",
        hint: "Quão escuro o fundo da tela fica durante o aviso (0 = sem escurecer, 1 = quase preto).",
        scope: "world",
        config: true,
        type: Number,
        range: { min: 0, max: 1, step: 0.05 },
        default: 0.92
    });

    game.settings.register(MODULE_ID, SETTING_DEFAULT_ANIMATION, {
        name: "Anúncio de tela: animação padrão",
        hint: "Estilo de transição usado quando o macro ou a chamada da API não especifica uma animação.",
        scope: "world",
        config: true,
        type: String,
        choices: {
            reveal: "Fade suave (reveal)",
            fall: "Queda do alto (fall)"
        },
        default: "reveal"
    });
});

Hooks.once("ready", () => {
    applyAnnounceCssVariables();

    Hooks.on("updateSetting", (setting) => {
        if (setting.key?.startsWith(`${MODULE_ID}.announce`)) applyAnnounceCssVariables();
    });

    game.socket.on(`module.${MODULE_ID}`, (data) => {
        if (data?.action === SOCKET_ACTION) runSequence(data);
    });

    const module = game.modules.get(MODULE_ID);
    module.api ??= {};
    // GM: game.modules.get("mestre-weber-golaarion").api.showAnnouncement(title, subtitle, sound, animation, duration, soundDelay, textDelay)
    // Bom para imersão e momentos marcantes: chegar a um novo local, avançar um marco, concluir um objetivo, etc.
    module.api.showAnnouncement = function showAnnouncement(title, subtitle, sound, animation, duration, soundDelay, textDelay) {
        const payload = { action: SOCKET_ACTION, title, subtitle, sound, animation, duration, soundDelay, textDelay };
        game.socket.emit(`module.${MODULE_ID}`, payload);
        runSequence(payload);
    };
});
