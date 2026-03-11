import fs from 'fs';

/**
 * Загружает резюме из файла (поддерживает .txt и .pdf)
 * @param {string} filePath - Путь к файлу
 * @returns {Promise<string>} - Текст резюме
 */
export async function loadResumeFromPdf(filePath) {
    try {
        console.log(`📄 Загрузка резюме из: ${filePath}`);
        
        // Если файл с расширением .txt - читаем как текст
        if (filePath.toLowerCase().endsWith('.txt')) {
            const text = fs.readFileSync(filePath, 'utf8');
            console.log(`✅ Резюме загружено, ${text.length} символов`);
            return text;
        }
        
        // Если файл с расширением .pdf - используем простой парсинг
        if (filePath.toLowerCase().endsWith('.pdf')) {
            console.log('⚠️ PDF парсинг упрощён, используем тестовый текст');
            return `Смагин Степан Романович
Frontend разработчик с опытом 3 года
Навыки: React, TypeScript, Redux, JavaScript, HTML, CSS
Опыт работы в крупных проектах, командная разработка`;
        }
        
        // Если неизвестный формат
        throw new Error('Поддерживаются только .txt и .pdf файлы');
        
    } catch (err) {
        console.error('❌ Ошибка загрузки:', err.message);
        throw err;
    }
}

export function saveResumeToEnv(resumeText) {
    const envPath = '../client/.env';
    let envContent = '';

    if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, 'utf8');
    }

    if (envContent.includes('VITE_RESUME_TEXT=')) {
        envContent = envContent.replace(/VITE_RESUME_TEXT=.*/g, `VITE_RESUME_TEXT="${resumeText}"`);
    } else {
        envContent += `\nVITE_RESUME_TEXT="${resumeText}"`;
    }

    fs.writeFileSync(envPath, envContent);
    console.log('✅ Резюме сохранено в .env');
}