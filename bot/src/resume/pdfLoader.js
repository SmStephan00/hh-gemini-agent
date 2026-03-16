import fs from 'fs';
import { extractText, getDocumentProxy } from 'unpdf';

/**
 * Загружает и парсит PDF-файл с резюме (работает везде)
 */
export async function loadResumeFromPdf(filePath) {
    try {
        console.log(`📄 Загрузка резюме из PDF: ${filePath}`);
        
        // Проверяем файл
        if (!fs.existsSync(filePath)) {
            throw new Error(`Файл не найден: ${filePath}`);
        }
        
        // Читаем файл в буфер
        const buffer = fs.readFileSync(filePath);
        
        // Получаем PDF документ
        const pdf = await getDocumentProxy(new Uint8Array(buffer));
        
        // Извлекаем текст (mergePages: true чтобы получить одну строку)
        const { text } = await extractText(pdf, { mergePages: true });
        
        console.log(`✅ PDF успешно распарсен, получено ${text.length} символов`);
        
        // Очищаем от лишних символов
        const cleanText = text
            .replace(/\s+/g, ' ')
            .replace(/[^\w\sа-яА-ЯёЁ\-.,!?;:()]/g, '')
            .trim();
        
        return cleanText;
        
    } catch (error) {
        console.error('❌ Ошибка загрузки PDF:', error.message);
        
        // Запасной вариант для TXT
        if (filePath.toLowerCase().endsWith('.txt')) {
            try {
                const text = fs.readFileSync(filePath, 'utf8');
                console.log('✅ Текст загружен из TXT (запасной вариант)');
                return text;
            } catch (txtError) {
                throw new Error('Не удалось прочитать файл');
            }
        }
        throw error;
    }
}