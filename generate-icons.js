const Jimp = require('jimp');

async function generateIcon(size, filename) {
    const image = new Jimp(size, size);

    // 그라데이션 배경 (보라 → 핑크)
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            // 대각선 그라데이션
            const ratio = (x + y) / (size * 2);

            // 시작 색상: #667eea (보라)
            // 끝 색상: #f093fb (핑크)
            const r = Math.floor(102 + (240 - 102) * ratio);
            const g = Math.floor(126 + (147 - 126) * ratio);
            const b = Math.floor(234 + (251 - 234) * ratio);

            const color = Jimp.rgbaToInt(r, g, b, 255);
            image.setPixelColor(color, x, y);
        }
    }

    // 중앙에 흰색 로켓 모양 그리기
    const centerX = size / 2;
    const centerY = size / 2;
    const rocketSize = size * 0.5;

    // 로켓 몸체 (타원형)
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const dx = (x - centerX) / (rocketSize * 0.25);
            const dy = (y - centerY) / (rocketSize * 0.5);

            // 타원 방정식
            if (dx * dx + dy * dy < 1) {
                const white = Jimp.rgbaToInt(255, 255, 255, 255);
                image.setPixelColor(white, x, y);
            }
        }
    }

    // 로켓 머리 (삼각형)
    const tipY = centerY - rocketSize * 0.5;
    const baseY = centerY - rocketSize * 0.25;
    const triangleWidth = rocketSize * 0.25;

    for (let y = Math.floor(tipY); y < Math.floor(baseY); y++) {
        const progress = (y - tipY) / (baseY - tipY);
        const width = triangleWidth * progress;

        for (let x = Math.floor(centerX - width); x < Math.floor(centerX + width); x++) {
            if (x >= 0 && x < size && y >= 0 && y < size) {
                const white = Jimp.rgbaToInt(255, 255, 255, 255);
                image.setPixelColor(white, x, y);
            }
        }
    }

    // 로켓 날개 (왼쪽)
    for (let i = 0; i < rocketSize * 0.3; i++) {
        const wingX = centerX - rocketSize * 0.25 - i * 0.5;
        const wingY = centerY + rocketSize * 0.2 + i;
        const wingWidth = rocketSize * 0.15 - i * 0.3;

        for (let wx = 0; wx < wingWidth; wx++) {
            const px = Math.floor(wingX - wx);
            const py = Math.floor(wingY);
            if (px >= 0 && px < size && py >= 0 && py < size) {
                const white = Jimp.rgbaToInt(255, 255, 255, 255);
                image.setPixelColor(white, px, py);
            }
        }
    }

    // 로켓 날개 (오른쪽)
    for (let i = 0; i < rocketSize * 0.3; i++) {
        const wingX = centerX + rocketSize * 0.25 + i * 0.5;
        const wingY = centerY + rocketSize * 0.2 + i;
        const wingWidth = rocketSize * 0.15 - i * 0.3;

        for (let wx = 0; wx < wingWidth; wx++) {
            const px = Math.floor(wingX + wx);
            const py = Math.floor(wingY);
            if (px >= 0 && px < size && py >= 0 && py < size) {
                const white = Jimp.rgbaToInt(255, 255, 255, 255);
                image.setPixelColor(white, px, py);
            }
        }
    }

    // 불꽃 (주황색-노란색)
    const flameBaseY = centerY + rocketSize * 0.4;
    for (let i = 0; i < rocketSize * 0.35; i++) {
        const progress = i / (rocketSize * 0.35);
        const flameWidth = rocketSize * 0.15 * (1 - progress * 0.7);

        // 주황색에서 노란색으로
        const r = 255;
        const g = Math.floor(165 + (255 - 165) * progress);
        const b = Math.floor(0 + (100) * progress);

        for (let fx = -flameWidth; fx < flameWidth; fx++) {
            const px = Math.floor(centerX + fx);
            const py = Math.floor(flameBaseY + i);
            if (px >= 0 && px < size && py >= 0 && py < size) {
                const color = Jimp.rgbaToInt(r, g, b, 255);
                image.setPixelColor(color, px, py);
            }
        }
    }

    // 창문 (파란색 원)
    const windowRadius = rocketSize * 0.08;
    const windowY = centerY - rocketSize * 0.1;

    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const dx = x - centerX;
            const dy = y - windowY;

            if (dx * dx + dy * dy < windowRadius * windowRadius) {
                const blue = Jimp.rgbaToInt(100, 149, 237, 255); // cornflowerblue
                image.setPixelColor(blue, x, y);
            }
        }
    }

    await image.writeAsync(filename);
    console.log(`✅ Generated: ${filename} (${size}x${size})`);
}

async function main() {
    console.log('🚀 Generating PWA icons for DTS Cloud AppStore...\n');

    // PWA에 필요한 다양한 사이즈 생성
    await generateIcon(512, './icon-512.png');
    await generateIcon(192, './icon-192.png');
    await generateIcon(180, './apple-touch-icon.png');
    await generateIcon(32, './favicon-32.png');
    await generateIcon(16, './favicon-16.png');

    console.log('\n🎉 All icons generated successfully!');
}

main().catch(console.error);
