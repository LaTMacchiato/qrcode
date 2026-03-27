let qrCodeApi;
let updateTimeout;
let currentLogoBase64 = null;
const PREVIEW_SIZE = 280; 

// Initialisation globale
document.addEventListener('DOMContentLoaded', () => {
    // Association des événements UI
    document.getElementById('input-url').addEventListener('input', scheduleUpdate);
    document.getElementById('color-dots').addEventListener('input', scheduleUpdate);
    document.getElementById('color-bg').addEventListener('input', scheduleUpdate);
    document.getElementById('bg-transparent').addEventListener('change', handleTransparencyChange);
    document.getElementById('style-dots').addEventListener('change', scheduleUpdate);
    document.getElementById('style-corners').addEventListener('change', scheduleUpdate);
    document.getElementById('error-correction').addEventListener('change', scheduleUpdate);
    
    document.getElementById('logo-input').addEventListener('change', handleLogoUpload);
    document.getElementById('btn-clear-logo').addEventListener('click', clearLogo);
    
    document.getElementById('text-bottom').addEventListener('input', scheduleUpdate);
    document.getElementById('text-font').addEventListener('change', scheduleUpdate);
    document.getElementById('text-size').addEventListener('input', (e) => {
        document.getElementById('text-size-val').innerText = e.target.value;
        scheduleUpdate();
    });

    // Événements boutons de téléchargement
    document.getElementById('btn-dl-png').addEventListener('click', () => downloadImage('png'));
    document.getElementById('btn-dl-svg').addEventListener('click', () => downloadImage('svg'));

    // Gestion de la palette de couleurs rapides
    document.querySelectorAll('.color-dot').forEach(dot => {
        dot.addEventListener('click', (e) => {
            document.getElementById('color-dots').value = e.target.dataset.color;
            scheduleUpdate();
        });
    });

    // Démarrage
    handleTransparencyChange();
    scheduleUpdate();
    document.getElementById('input-url').focus();
});

function handleTransparencyChange() {
    const isTransparent = document.getElementById('bg-transparent').checked;
    const bgColorPicker = document.getElementById('color-bg');
    const container = document.getElementById('final-canvas-container');

    bgColorPicker.disabled = isTransparent;
    
    if (isTransparent) {
        container.classList.add('checkerboard');
        container.style.backgroundColor = "";
    } else {
        container.classList.remove('checkerboard');
        container.style.backgroundColor = bgColorPicker.value;
    }
    scheduleUpdate();
}

function extractDomain(url) {
    try {
        if (!url.startsWith('http://') && !url.startsWith('https://')) { url = 'https://' + url; }
        const parsed = new URL(url);
        return parsed.hostname.replace('www.', '');
    } catch (e) { return ""; }
}

function handleLogoUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        currentLogoBase64 = e.target.result;
        document.getElementById('error-correction').value = 'H';
        scheduleUpdate();
    };
    reader.readAsDataURL(file);
}

function clearLogo() {
    document.getElementById('logo-input').value = "";
    currentLogoBase64 = null;
    scheduleUpdate();
}

function scheduleUpdate() {
    clearTimeout(updateTimeout);
    updateTimeout = setTimeout(() => { generateQR(PREVIEW_SIZE); }, 150); 
}

async function generateQR(size, returnBlob = false, extension = "png") {
    const rawUrl = document.getElementById('input-url').value;
    let data = rawUrl;
    if (data && !data.startsWith('http://') && !data.startsWith('https://')) { data = 'https://' + data; }
    if (!data) return null;

    const colorDots = document.getElementById('color-dots').value;
    const isTransparent = document.getElementById('bg-transparent').checked;
    const colorBg = isTransparent ? "rgba(0,0,0,0)" : document.getElementById('color-bg').value;
    const styleDots = document.getElementById('style-dots').value;
    const styleCorners = document.getElementById('style-corners').value;
    let errLevel = document.getElementById('error-correction').value;
    if (currentLogoBase64) errLevel = 'H'; 
    
    const options = {
        width: size, height: size,
        type: returnBlob ? (extension === "svg" ? "svg" : "canvas") : "canvas",
        data: data, image: currentLogoBase64,
        dotsOptions: { color: colorDots, type: styleDots },
        backgroundOptions: { color: colorBg },
        cornersSquareOptions: { type: styleCorners, color: colorDots },
        cornersDotOptions: { type: styleCorners, color: colorDots },
        qrOptions: { errorCorrectionLevel: errLevel },
        imageOptions: { crossOrigin: "anonymous", margin: 5 }
    };

    qrCodeApi = new QRCodeStyling(options);

    if (!returnBlob) {
        const rawContainer = document.getElementById('raw-qr-container');
        rawContainer.innerHTML = "";
        qrCodeApi.append(rawContainer);
        setTimeout(() => {
            const rawCanvas = rawContainer.querySelector('canvas');
            if(rawCanvas) applyTextAndDraw(rawCanvas, size);
        }, 50);
    } else {
        return await qrCodeApi.getRawData(extension);
    }
}

function applyTextAndDraw(sourceCanvas, qrSize) {
    const finalCanvas = document.getElementById('final-canvas');
    const ctx = finalCanvas.getContext('2d');
    
    let textToDraw = document.getElementById('text-bottom').value;
    const rawUrl = document.getElementById('input-url').value;
    if (!textToDraw && rawUrl) textToDraw = extractDomain(rawUrl);

    const fontSize = parseInt(document.getElementById('text-size').value);
    const font = document.getElementById('text-font').value;
    const isTransparent = document.getElementById('bg-transparent').checked;
    const colorBg = isTransparent ? "rgba(0,0,0,0)" : document.getElementById('color-bg').value;
    
    const scale = qrSize / PREVIEW_SIZE;
    const scaledFontSize = fontSize * scale;
    const padding = 20 * scale;
    const textSpace = textToDraw ? (scaledFontSize + padding * 1.8) : 0;
    
    finalCanvas.width = qrSize;
    finalCanvas.height = qrSize + textSpace;

    if(!isTransparent) {
        ctx.fillStyle = colorBg;
        ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);
        document.getElementById('final-canvas-container').style.backgroundColor = colorBg;
    } else {
        ctx.clearRect(0, 0, finalCanvas.width, finalCanvas.height);
    }

    ctx.drawImage(sourceCanvas, 0, 0, qrSize, qrSize);

    if (textToDraw) {
        ctx.fillStyle = document.getElementById('color-dots').value; 
        ctx.font = `bold ${scaledFontSize}px ${font}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillText(textToDraw, finalCanvas.width / 2, qrSize + (padding/2.5));
    }
}

async function downloadImage(format) {
    const btnId = format === 'png' ? 'btn-dl-png' : 'btn-dl-svg';
    const btn = document.getElementById(btnId);
    const originalText = btn.innerText;
    
    btn.innerText = "Génération en cours...";
    btn.disabled = true;
    document.body.style.cursor = 'wait';

    try {
        const exportSize = parseInt(document.getElementById('export-size').value);
        const rawUrl = document.getElementById('input-url').value;
        const domain = extractDomain(rawUrl) || 'lien';
        
        let textToDraw = document.getElementById('text-bottom').value;
        if (!textToDraw && rawUrl) textToDraw = extractDomain(rawUrl);

        if (format === 'png') {
            await generateQR(exportSize, false); 
            await new Promise(resolve => setTimeout(resolve, 200));
            
            const finalCanvas = document.getElementById('final-canvas');
            const link = document.createElement('a');
            link.download = `QR-${domain}.${format}`;
            link.href = finalCanvas.toDataURL("image/png");
            link.click();
            scheduleUpdate(); 
        } 
        else if (format === 'svg') {
            const blob = await generateQR(exportSize, true, "svg");
            
            if (textToDraw) {
                const svgText = await blob.text();
                const parser = new DOMParser();
                const doc = parser.parseFromString(svgText, "image/svg+xml");
                const svgElement = doc.documentElement;

                if (!svgElement || svgElement.nodeName !== 'svg') {
                    throw new Error("Le format SVG généré est invalide.");
                }

                const fontSize = parseInt(document.getElementById('text-size').value);
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
                const finalBlob = new Blob([finalSvgText], {type: "image/svg+xml"});
                
                const link = document.createElement('a');
                link.download = `QR-${domain}.svg`;
                link.href = URL.createObjectURL(finalBlob);
                link.click();
            } else {
                const link = document.createElement('a');
                link.download = `QR-${domain}.svg`;
                link.href = URL.createObjectURL(blob);
                link.click();
            }
        }
    } catch (error) {
        console.error("Erreur d'exportation :", error);
        alert("Une erreur inattendue est survenue lors de la création du fichier. Veuillez réessayer.");
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
        document.body.style.cursor = 'default';
    }
}