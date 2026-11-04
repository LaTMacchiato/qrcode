let qrCodeApi;
let updateTimeout;
let currentLogoBase64 = null;
let currentLogoName = "";
const PREVIEW_SIZE = 280;

document.addEventListener('DOMContentLoaded', () => {
    // Champ URL
    const inputUrl = document.getElementById('input-url');
    inputUrl.addEventListener('input', () => {
        updateDomainPill();
        scheduleUpdate();
    });

    // Sélecteurs de couleurs
    const colorDotsInput = document.getElementById('color-dots');
    const colorBgInput = document.getElementById('color-bg');

    colorDotsInput.addEventListener('input', (e) => {
        syncSwatchActiveState(e.target.value);
        document.getElementById('hex-dots-label').textContent = e.target.value.toUpperCase();
        updateContrastBadge();
        scheduleUpdate();
    });

    colorBgInput.addEventListener('input', () => {
        updateBgStatusBadge();
        updateContrastBadge();
        scheduleUpdate();
    });

    document.getElementById('bg-transparent').addEventListener('change', handleTransparencyChange);

    // Palette de couleurs rapides (EDF & standards)
    document.querySelectorAll('.color-dot').forEach(dot => {
        dot.addEventListener('click', (e) => {
            const selectedColor = e.currentTarget.dataset.color;
            colorDotsInput.value = selectedColor;
            document.getElementById('hex-dots-label').textContent = selectedColor.toUpperCase();
            syncSwatchActiveState(selectedColor);
            updateContrastBadge();
            scheduleUpdate();
        });
    });

    // Contrôles segmentés tactiles (Forme des motifs, Bords, Taille d'export)
    document.querySelectorAll('.seg-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.dataset.target;
            const value = btn.dataset.value;
            const targetInput = document.getElementById(targetId);
            if (!targetInput) return;

            targetInput.value = value;
            btn.parentElement.querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            if (targetId !== 'export-size') {
                scheduleUpdate();
            }
        });
    });

    // Cartes de niveau de correction d'erreur (L / M / Q / H)
    document.querySelectorAll('.ecc-card').forEach(card => {
        card.addEventListener('click', () => {
            setErrorCorrectionLevel(card.dataset.value);
            scheduleUpdate();
        });
    });

    // Gestion du logo (clic + glisser-déposer)
    const logoInput = document.getElementById('logo-input');
    const logoDropzone = document.getElementById('logo-dropzone');

    logoInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
            processLogoFile(e.target.files[0]);
        }
    });

    if (logoDropzone) {
        ['dragenter', 'dragover'].forEach(evtName => {
            logoDropzone.addEventListener(evtName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                logoDropzone.classList.add('drag-over');
            });
        });
        ['dragleave', 'drop'].forEach(evtName => {
            logoDropzone.addEventListener(evtName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                logoDropzone.classList.remove('drag-over');
            });
        });
        logoDropzone.addEventListener('drop', (e) => {
            const files = e.dataTransfer && e.dataTransfer.files;
            if (files && files[0]) {
                processLogoFile(files[0]);
            }
        });
    }

    document.getElementById('btn-clear-logo').addEventListener('click', clearLogo);

    // Légende et typographie
    document.getElementById('text-bottom').addEventListener('input', scheduleUpdate);
    document.getElementById('text-font').addEventListener('change', scheduleUpdate);
    document.getElementById('text-size').addEventListener('input', (e) => {
        document.getElementById('text-size-val').innerText = e.target.value;
        scheduleUpdate();
    });

    // Boutons d'export et de copie
    document.getElementById('btn-dl-png').addEventListener('click', () => downloadImage('png'));
    document.getElementById('btn-dl-svg').addEventListener('click', () => downloadImage('svg'));
    document.getElementById('btn-copy-png').addEventListener('click', copyImageToClipboard);

    // Gestion de la modale Mentions légales & Confidentialité
    const legalModal = document.getElementById('legal-modal');
    const btnOpenLegal = document.getElementById('btn-open-legal');
    const btnTopLegal = document.getElementById('btn-top-legal');

    if (legalModal) {
        [btnOpenLegal, btnTopLegal].forEach(trigger => {
            if (trigger) {
                trigger.addEventListener('click', () => legalModal.showModal());
            }
        });

        // Fallback light-dismiss pour les navigateurs ne supportant pas encore l'attribut closedby="any"
        if (!('closedBy' in HTMLDialogElement.prototype)) {
            legalModal.addEventListener('click', (event) => {
                if (event.target !== legalModal) return;
                const rect = legalModal.getBoundingClientRect();
                const isDialogContent = (
                    rect.top <= event.clientY &&
                    event.clientY <= rect.top + rect.height &&
                    rect.left <= event.clientX &&
                    event.clientX <= rect.left + rect.width
                );
                if (isDialogContent) return;
                legalModal.close();
            });
        }
    }

    // Démarrage initial
    updateDomainPill();
    handleTransparencyChange();
    updateContrastBadge();
    scheduleUpdate();
});

function setErrorCorrectionLevel(level) {
    document.getElementById('error-correction').value = level;
    document.querySelectorAll('.ecc-card').forEach(c => {
        c.classList.toggle('active', c.dataset.value === level);
    });
}

function syncSwatchActiveState(hexColor) {
    const normalized = hexColor.toUpperCase();
    document.querySelectorAll('.color-dot').forEach(dot => {
        dot.classList.toggle('active', dot.dataset.color.toUpperCase() === normalized);
    });
}

function updateDomainPill() {
    const rawUrl = document.getElementById('input-url').value.trim();
    const pill = document.getElementById('domain-pill');
    const domain = extractDomain(rawUrl);
    pill.textContent = domain || 'texte libre';
}

function updateBgStatusBadge() {
    const isTransparent = document.getElementById('bg-transparent').checked;
    const bgBadge = document.getElementById('bg-status-badge');
    if (isTransparent) {
        bgBadge.textContent = 'Alpha transparent';
        bgBadge.classList.add('badge-emerald');
    } else {
        bgBadge.textContent = document.getElementById('color-bg').value.toUpperCase();
        bgBadge.classList.remove('badge-emerald');
    }
}

function handleTransparencyChange() {
    const isTransparent = document.getElementById('bg-transparent').checked;
    const bgColorPicker = document.getElementById('color-bg');
    const stage = document.querySelector('.canvas-stage');

    bgColorPicker.disabled = isTransparent;
    updateBgStatusBadge();

    if (stage) {
        if (isTransparent) {
            stage.classList.remove('has-bg');
            stage.style.backgroundColor = "transparent";
        } else {
            stage.classList.add('has-bg');
            stage.style.backgroundColor = bgColorPicker.value;
        }
    }

    updateContrastBadge();
    scheduleUpdate();
}

// Calcul du ratio de contraste WCAG 2.1 entre les motifs et le fond
function hexToLuminance(hex) {
    const clean = hex.replace('#', '');
    const r = parseInt(clean.substring(0, 2), 16) / 255;
    const g = parseInt(clean.substring(2, 4), 16) / 255;
    const b = parseInt(clean.substring(4, 6), 16) / 255;
    const toLinear = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
    return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function updateContrastBadge() {
    const badge = document.getElementById('contrast-badge');
    if (!badge) return;

    const fgHex = document.getElementById('color-dots').value || '#001A70';
    const isTransparent = document.getElementById('bg-transparent').checked;
    const bgHex = isTransparent ? '#FFFFFF' : (document.getElementById('color-bg').value || '#FFFFFF');

    const lumFg = hexToLuminance(fgHex);
    const lumBg = hexToLuminance(bgHex);
    const brightest = Math.max(lumFg, lumBg);
    const darkest = Math.min(lumFg, lumBg);
    const ratio = (brightest + 0.05) / (darkest + 0.05);
    const formatted = ratio.toFixed(1) + ':1';

    // Les lecteurs QR nécessitent idéalement des motifs plus sombres que le fond et un contraste >= 3:1
    const isInverted = lumFg > lumBg;
    if (ratio >= 3.0 && !isInverted) {
        badge.textContent = `✓ Contraste ${formatted}`;
        badge.className = 'contrast-badge contrast-ok';
    } else if (isInverted) {
        badge.textContent = `⚠ Motifs clairs (${formatted})`;
        badge.className = 'contrast-badge contrast-warn';
    } else {
        badge.textContent = `⚠ Contraste faible (${formatted})`;
        badge.className = 'contrast-badge contrast-warn';
    }
}

function extractDomain(url) {
    try {
        if (!url) return "";
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'https://' + url;
        }
        const parsed = new URL(url);
        return parsed.hostname.replace(/^www\./, '');
    } catch (e) {
        return "";
    }
}

function processLogoFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        currentLogoBase64 = e.target.result;
        currentLogoName = file.name;
        setErrorCorrectionLevel('H');
        document.getElementById('logo-status-title').textContent = `Logo actif : ${file.name}`;
        document.getElementById('logo-status-sub').textContent = 'Correction H activée automatiquement pour une lecture optimale';
        document.getElementById('btn-clear-logo').hidden = false;
        scheduleUpdate();
    };
    reader.readAsDataURL(file);
}

function clearLogo() {
    document.getElementById('logo-input').value = "";
    currentLogoBase64 = null;
    currentLogoName = "";
    document.getElementById('logo-status-title').textContent = 'Ajouter une icône ou un logo au centre';
    document.getElementById('logo-status-sub').textContent = 'Glisser-déposer ou cliquer • PNG, JPEG, SVG';
    document.getElementById('btn-clear-logo').hidden = true;
    scheduleUpdate();
}

function scheduleUpdate() {
    clearTimeout(updateTimeout);
    updateTimeout = setTimeout(() => {
        generateQR(PREVIEW_SIZE);
    }, 100);
}

function buildQrOptions(size, type = "canvas") {
    const rawUrl = document.getElementById('input-url').value.trim();
    let data = rawUrl;
    if (data && !data.startsWith('http://') && !data.startsWith('https://')) {
        data = 'https://' + data;
    }
    if (!data) return null;

    const colorDots = document.getElementById('color-dots').value;
    const isTransparent = document.getElementById('bg-transparent').checked;
    const colorBg = isTransparent ? "rgba(0,0,0,0)" : document.getElementById('color-bg').value;
    const styleDots = document.getElementById('style-dots').value;
    const styleCorners = document.getElementById('style-corners').value;
    let errLevel = document.getElementById('error-correction').value;
    if (currentLogoBase64) errLevel = 'H';

    return {
        width: size,
        height: size,
        type: type,
        data: data,
        image: currentLogoBase64,
        dotsOptions: { color: colorDots, type: styleDots },
        backgroundOptions: { color: colorBg },
        cornersSquareOptions: { type: styleCorners, color: colorDots },
        cornersDotOptions: { type: styleCorners, color: colorDots },
        qrOptions: { errorCorrectionLevel: errLevel },
        imageOptions: { crossOrigin: "anonymous", margin: 5 }
    };
}

async function generateQR(size, returnBlob = false, extension = "png") {
    const renderType = returnBlob ? (extension === "svg" ? "svg" : "canvas") : "canvas";
    const options = buildQrOptions(size, renderType);
    if (!options) return null;

    qrCodeApi = new QRCodeStyling(options);

    if (!returnBlob) {
        const blob = await qrCodeApi.getRawData("png");
        if (!blob) return null;
        await drawQrBlobToCanvas(blob, document.getElementById('final-canvas'), size);
    } else {
        return await qrCodeApi.getRawData(extension);
    }
}

async function drawQrBlobToCanvas(qrBlob, targetCanvas, qrSize) {
    const objectUrl = URL.createObjectURL(qrBlob);
    try {
        const img = new Image();
        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = objectUrl;
        });

        const ctx = targetCanvas.getContext('2d');
        let textToDraw = document.getElementById('text-bottom').value.trim();
        const rawUrl = document.getElementById('input-url').value.trim();
        if (!textToDraw && rawUrl) textToDraw = extractDomain(rawUrl);

        const fontSize = parseInt(document.getElementById('text-size').value, 10);
        const font = document.getElementById('text-font').value;
        const isTransparent = document.getElementById('bg-transparent').checked;
        const colorBg = isTransparent ? "rgba(0,0,0,0)" : document.getElementById('color-bg').value;

        const scale = qrSize / PREVIEW_SIZE;
        const scaledFontSize = fontSize * scale;
        const padding = 20 * scale;
        const textSpace = textToDraw ? (scaledFontSize + padding * 1.8) : 0;

        targetCanvas.width = qrSize;
        targetCanvas.height = qrSize + textSpace;

        if (!isTransparent) {
            ctx.fillStyle = colorBg;
            ctx.fillRect(0, 0, targetCanvas.width, targetCanvas.height);
            if (targetCanvas.id === 'final-canvas') {
                const stage = document.querySelector('.canvas-stage');
                if (stage) {
                    stage.classList.add('has-bg');
                    stage.style.backgroundColor = colorBg;
                }
            }
        } else {
            ctx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
            if (targetCanvas.id === 'final-canvas') {
                const stage = document.querySelector('.canvas-stage');
                if (stage) {
                    stage.classList.remove('has-bg');
                    stage.style.backgroundColor = "transparent";
                }
            }
        }

        ctx.drawImage(img, 0, 0, qrSize, qrSize);

        if (textToDraw) {
            ctx.fillStyle = document.getElementById('color-dots').value;
            ctx.font = `bold ${scaledFontSize}px ${font}`;
            ctx.textAlign = "center";
            ctx.textBaseline = "top";
            ctx.fillText(textToDraw, targetCanvas.width / 2, qrSize + (padding / 2.5));
        }
    } finally {
        URL.revokeObjectURL(objectUrl);
    }
}

async function renderOffscreenPngBlob(exportSize) {
    const rawBlob = await generateQR(exportSize, true, "png");
    if (!rawBlob) throw new Error("Impossible de générer le QR Code.");
    const offscreenCanvas = document.createElement('canvas');
    await drawQrBlobToCanvas(rawBlob, offscreenCanvas, exportSize);
    return await new Promise((resolve, reject) => {
        offscreenCanvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Échec de conversion PNG"))), "image/png");
    });
}

async function copyImageToClipboard() {
    const btn = document.getElementById('btn-copy-png');
    const labelEl = document.getElementById('copy-btn-label');
    const originalText = labelEl.textContent;

    btn.disabled = true;
    labelEl.textContent = "Copie...";

    try {
        const exportSize = parseInt(document.getElementById('export-size').value, 10);
        const pngBlob = await renderOffscreenPngBlob(exportSize);
        await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': pngBlob })
        ]);
        labelEl.textContent = "✓ Image copiée !";
        setTimeout(() => {
            labelEl.textContent = originalText;
        }, 2000);
    } catch (err) {
        console.error("Erreur lors de la copie dans le presse-papiers :", err);
        labelEl.textContent = "Copie non supportée";
        setTimeout(() => {
            labelEl.textContent = originalText;
        }, 2000);
    } finally {
        btn.disabled = false;
    }
}

async function downloadImage(format) {
    const btnId = format === 'png' ? 'btn-dl-png' : 'btn-dl-svg';
    const btn = document.getElementById(btnId);
    const spanEl = btn.querySelector('span');
    const originalText = spanEl ? spanEl.textContent : btn.innerText;

    if (spanEl) spanEl.textContent = "Génération...";
    btn.disabled = true;
    document.body.style.cursor = 'wait';

    try {
        const exportSize = parseInt(document.getElementById('export-size').value, 10);
        const rawUrl = document.getElementById('input-url').value.trim();
        const domain = extractDomain(rawUrl) || 'lien';

        let textToDraw = document.getElementById('text-bottom').value.trim();
        if (!textToDraw && rawUrl) textToDraw = extractDomain(rawUrl);

        if (format === 'png') {
            const pngBlob = await renderOffscreenPngBlob(exportSize);
            const url = URL.createObjectURL(pngBlob);
            const link = document.createElement('a');
            link.download = `QR-${domain}.png`;
            link.href = url;
            link.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        } else if (format === 'svg') {
            const blob = await generateQR(exportSize, true, "svg");

            if (textToDraw) {
                const svgText = await blob.text();
                const parser = new DOMParser();
                const doc = parser.parseFromString(svgText, "image/svg+xml");
                const svgElement = doc.documentElement;

                if (!svgElement || svgElement.nodeName !== 'svg') {
                    throw new Error("Le format SVG généré est invalide.");
                }

                const fontSize = parseInt(document.getElementById('text-size').value, 10);
                const font = document.getElementById('text-font').value;
                const colorDots = document.getElementById('color-dots').value;
                const isTransparent = document.getElementById('bg-transparent').checked;
                const colorBg = document.getElementById('color-bg').value;

                const scale = exportSize / PREVIEW_SIZE;
                const scaledFontSize = fontSize * scale;
                const padding = 20 * scale;
                const textSpace = scaledFontSize + padding * 1.8;

                const originalWidth = exportSize;
                const originalHeight = exportSize;
                const newHeight = originalHeight + textSpace;

                svgElement.setAttribute("viewBox", `0 0 ${originalWidth} ${newHeight}`);
                svgElement.setAttribute("height", newHeight);

                if (!isTransparent) {
                    const bgRect = svgElement.querySelector("rect");
                    if (bgRect) {
                        bgRect.setAttribute("height", newHeight);
                    } else {
                        const newBg = doc.createElementNS("http://www.w3.org/2000/svg", "rect");
                        newBg.setAttribute("width", originalWidth);
                        newBg.setAttribute("height", newHeight);
                        newBg.setAttribute("fill", colorBg);
                        svgElement.insertBefore(newBg, svgElement.firstChild);
                    }
                }

                const textEl = doc.createElementNS("http://www.w3.org/2000/svg", "text");
                textEl.textContent = textToDraw;
                textEl.setAttribute("x", originalWidth / 2);
                textEl.setAttribute("y", originalHeight + padding / 2.5);
                textEl.setAttribute("fill", colorDots);
                textEl.setAttribute("font-family", font.replace(/"/g, "'"));
                textEl.setAttribute("font-size", scaledFontSize);
                textEl.setAttribute("font-weight", "bold");
                textEl.setAttribute("text-anchor", "middle");
                textEl.setAttribute("dominant-baseline", "hanging");

                svgElement.appendChild(textEl);

                const serializer = new XMLSerializer();
                const finalSvgText = serializer.serializeToString(doc);
                const finalBlob = new Blob([finalSvgText], { type: "image/svg+xml" });
                const url = URL.createObjectURL(finalBlob);

                const link = document.createElement('a');
                link.download = `QR-${domain}.svg`;
                link.href = url;
                link.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
            } else {
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.download = `QR-${domain}.svg`;
                link.href = url;
                link.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
            }
        }
    } catch (error) {
        console.error("Erreur d'exportation :", error);
        alert("Une erreur inattendue est survenue lors de la création du fichier. Veuillez réessayer.");
    } finally {
        if (spanEl) spanEl.textContent = originalText;
        btn.disabled = false;
        document.body.style.cursor = 'default';
    }
}
