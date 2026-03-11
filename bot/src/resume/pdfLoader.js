import fs from 'fs';
import * as pdfParser from 'pdf-parse';  // <- импортируем всё как объект

export async function loadResumeFromPdf(pdfPath) {
    try{
        console.log(`📄 Загрузка резюме из: ${pdfPath}`)

        const dataBuffer = fs.readFileSync(pdfPath);
        
        // Используем default экспорт из объекта
        const data = await pdfParser.default(dataBuffer);

        console.log(`✅ Резюме загружено, ${data.text.length} символов`);
        return data.text;
    }catch(err){
        console.error('❌ Ошибка загрузки PDF:', err.message);
        throw err;
    }
}

export function saveResumeToEnv(resumeText){
    const envPath = '../client/.env'
    let envContent = ''

    if(fs.existsSync(envPath)){
        envContent = fs.readFileSync(envPath, 'utf8')
    }

    if(envContent.includes('VITE_RESUME_TEXT=')){
        envContent = envContent.replace(/VITE_RESUME_TEXT=.*/g, `VITE_RESUME_TEXT="${resumeText}"`)
    }else{
        envContent += `\nVITE_RESUME_TEXT="${resumeText}"`
    }

    fs.writeFileSync(envPath, envContent)
    console.log('✅ Резюме сохранено в .env');
}