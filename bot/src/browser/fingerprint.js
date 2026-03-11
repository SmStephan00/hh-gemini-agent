// Вариант 2: Если библиотека экспортирует как namespace
import * as FingerprintGenerator from 'fingerprint-generator';

export function generateFingerprint(){
    const fingerprintGenerator = new FingerprintGenerator.FingerprintGenerator();
    
    const { fingerprint, headers } = fingerprintGenerator.getFingerprint({
        devices: ['desktop'],
        browsers: ['chrome', 'firefox', 'edge'],
        operatingSystems: ['windows', 'macos', 'linux']
    });

    console.log('🆔 Сгенерирован новый отпечаток:', fingerprint);
    return { fingerprint, headers };
}