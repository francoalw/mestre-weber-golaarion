const MODULE_ID = "mestre-weber-golaarion";
const SOCKET_ACTION = "screen-announcement-show";

const SETTING_TEXT_COLOR = "announceTextColor";
const SETTING_GLOW_COLOR = "announceGlowColor";
const SETTING_SHIMMER_COLOR = "announceShimmerColor";
const SETTING_SUB_COLOR = "announceSubColor";
const SETTING_PARTICLE_COLOR = "announceParticleColor";
const SETTING_BG_INTENSITY = "announceBgIntensity";
const SETTING_DEFAULT_ANIMATION = "announceDefaultAnimation";
const SETTING_DEFAULT_SOUND = "announceDefaultSound";

function hexToRgb(hex) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex ?? "");
    return m
        ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) }
        : { r: 217, g: 178, b: 106 };
}

// Imagens dos tokens (na cena atual) dos membros da Party marcada como principal
// (game.actors.party), pra cair em espiral junto com as partículas. Sem token na cena
// atual, cai no retrato/token padrão do ator.
function getPartyTokenImages() {
    const members = game.actors?.party?.members ?? [];
    const images = [];
    for (const actor of members) {
        if (!actor) continue;
        const [activeToken] = actor.getActiveTokens?.(false, true) ?? [];
        const src = activeToken?.texture?.src || actor.prototypeToken?.texture?.src || actor.img;
        if (src) images.push(src);
    }
    return images;
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

function spawnParticles(spawnDurationMs, totalMs) {
    const canvas = document.createElement("canvas");
    canvas.classList.add("mw-announce-particles");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    document.body.appendChild(canvas);
    const ctx = canvas.getContext("2d");

    // Canvas separado pros tokens, sem "mix-blend-mode: screen" (ver comentário no CSS)
    // — assim eles aparecem realmente opacos, não "meio translúcidos" feito luz.
    const tokenCanvas = document.createElement("canvas");
    tokenCanvas.classList.add("mw-announce-tokens");
    tokenCanvas.width = window.innerWidth;
    tokenCanvas.height = window.innerHeight;
    document.body.appendChild(tokenCanvas);
    const tokenCtx = tokenCanvas.getContext("2d");

    const onResize = () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        tokenCanvas.width = window.innerWidth;
        tokenCanvas.height = window.innerHeight;
    };
    window.addEventListener("resize", onResize);

    const particles = [];
    const startTime = performance.now();
    let stopSpawning = false;
    const particleRgb = hexToRgb(game.settings.get(MODULE_ID, SETTING_PARTICLE_COLOR));

    // Espiral: cada partícula nasce fora da tela (raio baseado na diagonal, não só na
    // metade da tela) e vai sendo puxada pra dentro bem devagar (raio encolhe ao longo
    // de uma vida longa) enquanto gira sempre no mesmo sentido. Duas coisas deixam o
    // formato de espiral óbvio em vez de virar uma nuvem de pontos convergindo:
    // 1) as partículas nascem agrupadas em alguns "braços" fixos, não num ângulo
    //    totalmente aleatório — como uma galáxia/redemoinho, não um enxame;
    // 2) cada partícula desenha um rastro atrás de si (calculado a partir da mesma
    //    fórmula de posição, só que com uma idade um pouco menor) que revela a curva
    //    percorrida, em vez de um pontinho piscando sem indicar a trajetória.
    const SPIN_DIRECTION = 1;
    const ARM_COUNT = 3;
    const ARM_SPREAD = 0.22; // jitter dentro do braço, pra não virar uma linha fina de mais

    // "bornAgeMs" deixa a partícula já nascer "envelhecida" — usado só pra pré-popular a
    // espiral inteira antes do primeiro frame (ver abaixo), pra não começar vazia e ir
    // enchendo aos poucos ao longo de alguns segundos.
    function spawnParticle(bornAgeMs = 0) {
        // Metade da diagonal garante que o raio inicial fica além de qualquer canto da
        // tela, mesmo em telas bem largas ou bem altas.
        const outerRadius = Math.hypot(canvas.width, canvas.height) / 2;
        const arm = Math.floor(Math.random() * ARM_COUNT);
        const armAngle = (arm / ARM_COUNT) * Math.PI * 2;
        particles.push({
            angle: armAngle + (Math.random() - 0.5) * ARM_SPREAD,
            startRadius: outerRadius * (1.1 + Math.random() * 0.35),
            angularSpeed: SPIN_DIRECTION * (0.0007 + Math.random() * 0.0006),
            size: 1.5 + Math.random() * 2,
            born: performance.now() - bornAgeMs,
            life: 5200 + Math.random() * 3200,
            blinkSpeed: 0.003 + Math.random() * 0.004,
            blinkPhase: Math.random() * Math.PI * 2
        });
    }

    // Pré-popula a espiral inteira ANTES do primeiro frame: gera partículas com idades
    // já espalhadas por toda a vida útil, então já nascem em todos os pontos do caminho
    // (perto da borda, no meio, perto do centro) em vez de só nascerem na borda e a
    // espiral ir se formando aos poucos.
    // Teto de 5000ms fica abaixo da menor vida possível (5200ms) — garante que nenhuma
    // partícula pré-populada já nasça "morta" (idade maior que a própria vida).
    for (let i = 0; i < 110; i++) spawnParticle(Math.random() * 5000);

    // Posição de uma partícula numa idade arbitrária — usado tanto pro ponto atual
    // quanto pras amostras do rastro (mesma fórmula, idade menor).
    function positionAt(p, age, centerX, centerY) {
        const lifeRatio = age / p.life;
        const radius = p.startRadius * (1 - lifeRatio);
        const angle = p.angle + age * p.angularSpeed;
        return { x: centerX + Math.cos(angle) * radius, y: centerY + Math.sin(angle) * radius };
    }

    const TRAIL_STEPS = 5;
    const TRAIL_SPACING_MS = 60;

    // Tokens da Party marcada como principal, caindo em espiral junto com as
    // partículas — mesma física (positionAt), só que maiores, uma imagem em vez de um
    // pontinho, e com fade out amarrado na proximidade do centro (não no "piscar" das
    // partículas): ficam nítidos boa parte do caminho e só somem pertinho de chegar.
    const tokenImages = getPartyTokenImages();
    const tokenSize = Math.max(64, Math.min(canvas.width, canvas.height) * 0.09);
    const tokenFallLife = Math.max((totalMs ?? 8000) * 0.65, 3000);
    const tokenParticles = tokenImages.map((src, i) => {
        const img = new Image();
        img.src = src;
        const outerRadius = Math.hypot(canvas.width, canvas.height) / 2;
        return {
            img,
            angle: (i / tokenImages.length) * Math.PI * 2 + (Math.random() - 0.5) * 0.3,
            startRadius: outerRadius * (1.15 + Math.random() * 0.2),
            angularSpeed: SPIN_DIRECTION * (0.0006 + Math.random() * 0.0003),
            // Já nasce "envelhecido" um pouco (em vez de escalonado pro futuro) — assim
            // já aparece caindo, visível em tela, desde o instante 0, sem esperar viajar
            // lá de fora até entrar no quadro.
            born: performance.now() - Math.random() * tokenFallLife * 0.35,
            life: tokenFallLife
        };
    });
    const FADE_ZONE = 0.35; // só começa a sumir nos últimos 35% do caminho até o centro

    function tick(now) {
        const elapsed = now - startTime;
        if (elapsed > spawnDurationMs) stopSpawning = true;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        tokenCtx.clearRect(0, 0, tokenCanvas.width, tokenCanvas.height);

        // Vida das partículas ficou bem mais longa (movimento mais vagaroso), então a
        // chance de nascer por frame caiu também — senão a tela lota de pontos.
        if (!stopSpawning && Math.random() < 0.35) spawnParticle();

        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;

        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            const age = now - p.born;
            if (age > p.life) {
                particles.splice(i, 1);
                continue;
            }

            const lifeRatio = age / p.life; // encolhe até sumir no centro
            const fade = Math.sin(lifeRatio * Math.PI);
            const blink = 0.5 + 0.5 * Math.sin(now * p.blinkSpeed + p.blinkPhase);
            const alpha = fade * (0.25 + 0.75 * blink);

            // Rastro primeiro (mais fraco e menor quanto mais "pra trás" no tempo),
            // depois o ponto atual por cima — isso desenha a curva percorrida.
            for (let step = TRAIL_STEPS; step >= 0; step--) {
                const sampleAge = age - step * TRAIL_SPACING_MS;
                if (sampleAge < 0) continue;
                const { x, y } = positionAt(p, sampleAge, centerX, centerY);
                const trailFactor = 1 - step / (TRAIL_STEPS + 1);
                const pointAlpha = step === 0 ? alpha : alpha * trailFactor * 0.5;
                const pointSize = p.size * (0.5 + 0.5 * trailFactor);

                ctx.beginPath();
                ctx.fillStyle = `rgba(${particleRgb.r}, ${particleRgb.g}, ${particleRgb.b}, ${pointAlpha})`;
                ctx.shadowColor = `rgba(${particleRgb.r}, ${particleRgb.g}, ${particleRgb.b}, ${Math.min(pointAlpha * 1.15, 1)})`;
                ctx.shadowBlur = step === 0 ? 10 : 4;
                ctx.arc(x, y, pointSize, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        let tokensPending = false;
        for (const t of tokenParticles) {
            const age = now - t.born;
            if (age < 0) {
                tokensPending = true; // ainda nem nasceu (escalonamento), não descarta
                continue;
            }
            if (age > t.life) continue; // já chegou ao centro e sumiu — não desenha mais
            tokensPending = true;
            if (!t.img.complete || !t.img.naturalWidth) continue; // imagem ainda carregando

            const { x, y } = positionAt(t, age, centerX, centerY);
            const radiusRatio = 1 - age / t.life;
            const alpha = radiusRatio > FADE_ZONE ? 1 : Math.max(radiusRatio / FADE_ZONE, 0);
            if (alpha <= 0) continue;

            tokenCtx.save();
            tokenCtx.globalAlpha = alpha;
            tokenCtx.shadowColor = `rgba(${particleRgb.r}, ${particleRgb.g}, ${particleRgb.b}, ${alpha})`;
            tokenCtx.shadowBlur = 16;
            tokenCtx.beginPath();
            tokenCtx.arc(x, y, tokenSize / 2, 0, Math.PI * 2);
            tokenCtx.clip();
            tokenCtx.drawImage(t.img, x - tokenSize / 2, y - tokenSize / 2, tokenSize, tokenSize);
            tokenCtx.restore();
        }

        if (stopSpawning && particles.length === 0 && !tokensPending) {
            window.removeEventListener("resize", onResize);
            canvas.remove();
            tokenCanvas.remove();
            return;
        }
        requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
}

function showOverlayText(title, subtitle, animation, totalMs, textDelayMs) {
    const isFall = animation === "fall";
    const total = totalMs ?? (isFall ? 10900 : 10300);
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

// Esconde/devolve toda a UI (barra de cena, hotbar, sidebar, lista de jogadores,
// controles de cena — tudo dentro de #interface — e qualquer janela de aplicação aberta,
// como fichas de personagem) durante o anúncio de tela cheia, pra imersão total. Some na
// hora (sem transição); a volta é com fade-in.
function getUiFadeTargets() {
    const targets = [];
    const iface = document.getElementById("interface");
    if (iface) targets.push(iface);
    targets.push(...document.querySelectorAll(".application"));
    return targets;
}

function setUiHidden(hidden, fadeMs = 0) {
    for (const el of getUiFadeTargets()) {
        el.style.transition = fadeMs ? `opacity ${fadeMs}ms ease` : "none";
        el.style.opacity = hidden ? "0" : "1";
        el.style.pointerEvents = hidden ? "none" : "";
    }
}

// Assinatura no lugar da hotbar (barra de macros), enquanto ela some: aparece na hora
// (junto com o resto da UI sumindo) e desaparece com o mesmo fade usado pra UI voltar.
let hotbarLabelEl = null;

function showHotbarLabel() {
    const hotbar = document.getElementById("hotbar");
    if (!hotbar) return;
    const rect = hotbar.getBoundingClientRect();
    const label = document.createElement("div");
    label.className = "mw-announce-hotbar-label";
    label.textContent = "Mestre Weber – Golaarion";
    label.style.left = `${rect.left}px`;
    label.style.top = `${rect.top}px`;
    label.style.width = `${rect.width}px`;
    label.style.height = `${rect.height}px`;
    document.body.appendChild(label);
    hotbarLabelEl = label;
}

function hideHotbarLabel(fadeMs) {
    if (!hotbarLabelEl) return;
    const label = hotbarLabelEl;
    hotbarLabelEl = null;
    label.style.transition = `opacity ${fadeMs}ms ease`;
    label.style.opacity = "0";
    setTimeout(() => label.remove(), fadeMs + 50);
}

function runSequence({ title, subtitle, animation, duration, soundDelay, textDelay }) {
    const resolvedAnimation = animation ?? game.settings.get(MODULE_ID, SETTING_DEFAULT_ANIMATION);
    // Não existe mais som por chamada — todo anúncio toca o mesmo som padrão configurado
    // em Configurações do Mundo (ou nenhum, se o campo estiver em branco).
    const sound = game.settings.get(MODULE_ID, SETTING_DEFAULT_SOUND);
    const isFall = resolvedAnimation === "fall";
    const totalMs = duration ?? (isFall ? 10900 : 10300);
    const PARTICLE_SPAWN_MS = duration ? Math.max(duration - 3000, 1000) : 4000;
    const SOUND_DELAY_MS = soundDelay ?? 3000;
    const UI_FADE_IN_MS = 1200;

    setUiHidden(true);
    showHotbarLabel();
    setTimeout(() => {
        setUiHidden(false, UI_FADE_IN_MS);
        hideHotbarLabel(UI_FADE_IN_MS);
    }, totalMs);

    spawnParticles(PARTICLE_SPAWN_MS, totalMs);
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
        hint: "Cor das partículas que giram em espiral na tela durante o aviso.",
        scope: "world",
        config: true,
        type: new foundry.data.fields.ColorField({ required: true, nullable: false, initial: "#4da6ff" }),
        default: "#4da6ff"
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

    game.settings.register(MODULE_ID, SETTING_DEFAULT_SOUND, {
        name: "Anúncio de tela: som",
        hint: "Som tocado em todos os anúncios de tela cheia (inclusive no botão \"Revelar local\") — não dá pra escolher um som diferente por chamada. Deixe em branco pra não tocar som nenhum.",
        scope: "world",
        config: true,
        type: String,
        default: "",
        filePicker: "audio"
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
    // GM: game.modules.get("mestre-weber-golaarion").api.showAnnouncement(title, subtitle, animation, duration, soundDelay, textDelay)
    // Bom para imersão e momentos marcantes: chegar a um novo local, avançar um marco, concluir um objetivo, etc.
    // Não dá pra escolher um som por chamada — todo anúncio toca o som padrão configurado
    // em Configurações do Mundo (ou nenhum, se o campo estiver em branco).
    module.api.showAnnouncement = function showAnnouncement(title, subtitle, animation, duration, soundDelay, textDelay) {
        const payload = { action: SOCKET_ACTION, title, subtitle, animation, duration, soundDelay, textDelay };
        game.socket.emit(`module.${MODULE_ID}`, payload);
        runSequence(payload);
    };
});
