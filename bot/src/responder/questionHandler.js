// src/responder/questionHandler.js
import { callOpenRouter } from '../gemini/letterGenerator.js';

/* ======================================================
   ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ ОТВЕТОВ
   ====================================================== */

/**
 * Запасные ответы если AI не сработал
 */
function getFallbackAnswer(question) {
    const q = question.toLowerCase();
    if (q.includes('зарплат') || q.includes('компенсац')) {
        return 'Рассчитываю на уровень рынка, готов обсудить на собеседовании.';
    }
    if (q.includes('опыт') || q.includes('сколько лет')) {
        return 'Более 3 лет коммерческой разработки.';
    }
    if (q.includes('почему')) {
        return 'Мой опыт полностью соответствует требованиям вакансии.';
    }
    return 'Имею необходимый опыт и навыки, подробнее в резюме.';
}

/**
 * Генерация ответа на вопрос через AI
 */
export async function generateAnswer(question, resumeText, vacancyData) {
    const vacancyContext = `
ТРЕБОВАНИЯ ВАКАНСИИ:
- Название: ${vacancyData.title}
- Компания: ${vacancyData.company}
- Ключевые навыки: ${vacancyData.skills?.join(', ') || 'не указаны'}
- Описание: ${vacancyData.description?.substring(0, 300) || ''}
`;
    
    const prompt = `
Ты — кандидат на вакансию ${vacancyData.title} в компанию ${vacancyData.company}.
Ответь на вопрос работодателя, основываясь на своём резюме и требованиях вакансии.

${vacancyContext}

ВОПРОС РАБОТОДАТЕЛЯ:
${question}

МОЁ РЕЗЮМЕ:
${resumeText.substring(0, 1500)}

ТРЕБОВАНИЯ К ОТВЕТУ:
- Ответ должен быть правдивым, основываться на резюме
- Подчеркни соответствие требованиям вакансии
- Язык: русский
- Стиль: профессиональный, но живой
- Длина: 2-4 предложения
- Не используй вступления типа "Исходя из моего опыта"
- Отвечай сразу по делу
`;
    
    try {
        const answer = await callOpenRouter(
            { modelId: 'openrouter/free', apiKey: process.env.OPENROUTER_API_KEY },
            prompt
        );
        return answer;
    } catch (error) {
        console.log('⚠️ AI не доступен, использую шаблон');
        return getFallbackAnswer(question);
    }
}

/* ======================================================
   БЕЗОПАСНЫЙ ВВОД ТЕКСТА (ТОЛЬКО ДЛЯ ТЕКСТОВЫХ ПОЛЕЙ)
   ====================================================== */

/**
 * Безопасный ввод текста в поле (ТОЛЬКО ДЛЯ ТЕКСТОВЫХ ПОЛЕЙ!)
 */
export async function typeTextSafely(page, element, text) {
    try {
        // Проверяем, что это действительно текстовое поле
        const tagName = await element.evaluate(el => el.tagName);
        const type = await element.evaluate(el => el.type).catch(() => null);
        
        // Проверяем, что элемент является текстовым полем
        const isTextInput = tagName === 'TEXTAREA' || 
                           (tagName === 'INPUT' && (type === 'text' || type === 'email' || type === 'tel' || !type));
        
        if (!isTextInput) {
            console.log('⚠️ Элемент не является текстовым полем, пропускаем typeTextSafely');
            return false;
        }
        
        // Пробуем кликнуть с увеличенным таймаутом
        await element.click({ clickCount: 3, timeout: 60000 });
        await page.keyboard.press('Backspace');
        await page.waitForTimeout(500);
        await element.type(text, { delay: 20, timeout: 60000 });
        return true;
    } catch (error) {
        console.log('⚠️ Ошибка при вводе текста:', error.message);
        
        // Альтернативный способ через evaluate
        try {
            await page.evaluate((el, txt) => {
                if (el.isContentEditable) {
                    el.textContent = txt;
                } else {
                    el.value = txt;
                }
                el.dispatchEvent(new Event('input', { bubbles: true }));
            }, element, text);
            console.log('✅ Текст вставлен через evaluate');
            return true;
        } catch (e) {
            console.log('❌ Не удалось вставить текст даже через evaluate');
            return false;
        }
    }
}

/* ======================================================
   ОПРЕДЕЛЕНИЕ ТИПА СТРАНИЦЫ
   ====================================================== */

/**
 * Определение типа страницы (нормальная, вопросы, тестовое задание)
 */

// Функция для обработки вопросов с вариантами ответов
async function handleMultipleChoiceQuestions(page) {
  const questionBlocks = await page.$$('[data-qa="task-body"]');
  console.log(`📋 Найдено ${questionBlocks.length} вопросов`);
  
  for (let i = 0; i < questionBlocks.length; i++) {
    const block = questionBlocks[i];
    
    // Получаем текст вопроса
    const questionText = await block.$eval('.g-user-content', el => el.textContent.trim());
    console.log(`\nВопрос ${i+1}: ${questionText.substring(0, 50)}...`);
    
    // Ищем все radio-кнопки в этом блоке
    const radioButtons = await block.$$('input[type="radio"]');
    
    if (radioButtons.length > 0) {
      console.log(`   Найдено ${radioButtons.length} вариантов ответа`);
      
      // Определяем правильный ответ для каждого вопроса
      let answerIndex = 0; // По умолчанию выбираем первый вариант
      
      // Логика выбора ответа в зависимости от вопроса
      if (questionText.includes('компонент, который получает список объектов')) {
        // В React для оптимизации списков используем ключи + React.memo
        // Но нужно выбрать правильный вариант из предложенных
        answerIndex = 0; // "Добавить уникальные ключи"
      } 
      else if (questionText.includes('форма, которая обновляет состояние')) {
        // Для формы с задержками лучше всего debounce
        answerIndex = 2; // "Использовать контролируемые компоненты и Debounce"
      }
      else if (questionText.includes('пересчитываются и рендерятся компоненты')) {
        // Для предотвращения ненужных рендеров
        answerIndex = 3; // "Все вышеперечисленное"
      }
      else if (questionText.includes('динамичную таблицу с множеством данных')) {
        // Для больших таблиц - виртуализация
        answerIndex = 1; // "Применить виртуализацию списка"
      }
      else if (questionText.includes('формат работы')) {
        // Выбираем удаленный формат или гибрид
        answerIndex = 2; // "Удаленный"
      }
      
      // Кликаем по выбранной radio-кнопке
      if (radioButtons[answerIndex]) {
        await radioButtons[answerIndex].click({ force: true });
        console.log(`   ✅ Выбран вариант ${answerIndex + 1}`);
      }
    }
    
    // Проверяем, есть ли текстовое поле (для варианта "Свой вариант")
    const textarea = await block.$('textarea');
    if (textarea) {
      // Если текстовое поле видимо (после выбора "Свой вариант"), заполняем его
      const isVisible = await textarea.isVisible();
      if (isVisible) {
        const answer = generateAnswerForQuestion(questionText); // Ваша логика генерации
        await textarea.fill(answer);
        console.log(`   ✅ Заполнено текстовое поле`);
      }
    }
  }
  
  // После заполнения всех вопросов, ищем кнопку отправки
  const submitButton = await page.$('button[type="submit"][data-qa="vacancy-response-submit-popup"]');
  if (submitButton) {
    await submitButton.click();
    console.log('📤 Ответы отправлены');
    return true;
  }
  
  return false;
}
export async function detectPageType(page) {
    // Используем evaluate, чтобы выполнить проверку прямо в браузере
    const pageType = await page.evaluate(() => {
        const bodyText = document.body.innerText.toLowerCase();

        // --- 1. ПРОВЕРКА НА ТЕСТОВОЕ ЗАДАНИЕ ---
        const testPageIndicators = [
            'ссылка на бэк', 'ссылка на файл', 'выполните задание',
            'необходимо сверстать', 'прикрепите ссылку', 'ссылка на figma'
        ];
        const hasTestIndicators = testPageIndicators.some(ind => bodyText.includes(ind));
        if (hasTestIndicators) {
            console.log('🔍 Обнаружена страница с тестовым заданием');
            return 'test_task';
        }

        // --- 2. ПРОВЕРКА НА ВОПРОСЫ ---
        // Самый надежный признак: есть специальные блоки вопросов
        const hasQuestionBlocks = document.querySelectorAll('[data-qa="task-body"]').length > 0;
        if (hasQuestionBlocks) {
            console.log('🔍 Найдены блоки вопросов [data-qa="task-body"]');
            return 'questions';
        }

        // Второй надежный признак: есть радио-кнопки для выбора вариантов
        const hasRadioButtons = document.querySelectorAll('input[type="radio"]').length > 0;
        if (hasRadioButtons) {
            console.log('🔍 Найдены радио-кнопки (вопросы с вариантами)');
            return 'questions';
        }

        // Третий признак: есть текстовые поля, специально созданные для ответов
        const hasAnswerFields = document.querySelectorAll('textarea[placeholder*="Писать тут"], textarea[name*="task"]').length > 0;
        if (hasAnswerFields) {
            console.log('🔍 Найдены поля для ответов');
            return 'questions';
        }

        // Если ничего из вышеперечисленного не найдено — это обычная страница
        console.log('🔍 Признаки вопросов не обнаружены');
        return 'normal';
    });

    return pageType;
}

/* ======================================================
   ПАРСИНГ ВОПРОСОВ
   ====================================================== */

/**
 * Парсинг вопросов и вариантов ответов (улучшенная версия)
 */
export async function parseQuestions(page) {
    const questions = [];
    
    // Пробуем найти вопросы через data-qa
    let questionBlocks = await page.$$('[data-qa="task-body"]');
    
    // Если не нашли, ищем через заголовки и radio кнопки
    if (questionBlocks.length === 0) {
        console.log('🔍 Ищем вопросы через альтернативные селекторы...');
        
        // Ищем все блоки, содержащие вопросы (по структуре со скриншота)
        questionBlocks = await page.$$('div:has(input[type="radio"]), div:has(> p:has-text("?"))');
    }
    
    for (const block of questionBlocks) {
        // Извлекаем текст вопроса (разные варианты)
        let questionText = '';
        try {
            questionText = await block.$eval('p, div:first-child', el => el.textContent.trim());
        } catch (e) {
            // Если не нашли, пробуем взять текст всего блока
            questionText = await block.evaluate(el => el.textContent.trim());
        }
        
        // Проверяем, есть ли варианты ответов (радио-кнопки)
        const radioButtons = await block.$$('input[type="radio"]');
        const hasOptions = radioButtons.length > 0;
        
        let options = [];
        if (hasOptions) {
            // Собираем варианты ответов (текст рядом с radio)
            for (const radio of radioButtons) {
                const label = await radio.evaluate(el => {
                    // Ищем текст рядом с radio
                    const parent = el.parentElement;
                    return parent?.textContent?.trim() || el.nextSibling?.textContent?.trim() || '';
                });
                if (label) options.push(label);
            }
        }
        
        // Находим поле ввода (если есть)
        const textarea = await block.$('textarea');
        
        questions.push({
            block,
            questionText,
            hasOptions,
            options,
            textarea,
            answered: false
        });
    }
    
    console.log(`📋 Распарсено ${questions.length} вопросов`);
    return questions;
}

/* ======================================================
   ЗАПОЛНЕНИЕ ОТВЕТОВ (ОСНОВНАЯ ЛОГИКА)
   ====================================================== */

/**
 * Заполнение ответов на вопросы
 */
export async function fillAnswers(page, questions, resumeText, vacancyData) {
    console.log(`📝 Заполнение ответов...`);
    
    for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        console.log(`\n   Вопрос ${i + 1}/${questions.length}: ${q.questionText.substring(0, 50)}...`);
        
        // Если есть варианты ответов (radio кнопки)
        if (q.hasOptions && q.options.length > 0) {
            console.log(`   🔘 Варианты ответов: ${q.options.join(' | ')}`);
            
            // Отправляем в AI вопрос вместе с вариантами
            const promptWithOptions = `
Вопрос: ${q.questionText}
Варианты ответов:
${q.options.map((opt, idx) => `${idx + 1}. ${opt}`).join('\n')}

Выбери НАИБОЛЕЕ ПОДХОДЯЩИЙ вариант, основываясь на резюме.
Ответь ТОЛЬКО номером варианта (1, 2, 3 и т.д.)`;
            
            const answerIndex = await generateAnswer(promptWithOptions, resumeText, vacancyData);
            const selectedIndex = parseInt(answerIndex) - 1;
            
            if (selectedIndex >= 0 && selectedIndex < q.options.length) {
                try {
                    // Находим radio по индексу
                    const radioButtons = await q.block.$$('input[type="radio"]');
                    if (radioButtons.length > selectedIndex) {
                        // Кликаем по radio (НЕ ИСПОЛЬЗУЕМ typeTextSafely!)
                        await radioButtons[selectedIndex].click({ 
                            timeout: 60000,
                            force: true  // Принудительный клик, даже если элемент не видим
                        });
                        console.log(`   ✅ Выбран вариант: ${q.options[selectedIndex]}`);
                        await page.waitForTimeout(500);
                    }
                } catch (error) {
                    console.log(`   ⚠️ Ошибка при выборе radio: ${error.message}`);
                    // Альтернативный способ через evaluate
                    await q.block.$eval(
                        `input[type="radio"]:nth-of-type(${selectedIndex + 1})`,
                        el => el.click()
                    );
                    console.log(`   ✅ Выбран вариант (через evaluate): ${q.options[selectedIndex]}`);
                }
            } else {
                console.log(`   ⚠️ Не удалось выбрать вариант, индекс: ${selectedIndex}`);
                // Пробуем первый вариант
                const firstRadio = await q.block.$('input[type="radio"]');
                if (firstRadio) {
                    await firstRadio.click({ force: true });
                    console.log(`   ⚠️ Выбран первый вариант`);
                }
            }
        }
        // Если текстовое поле
        else if (q.textarea) {
            console.log(`   ✍️ Генерация ответа...`);
            const answer = await generateAnswer(q.questionText, resumeText, vacancyData);
            console.log(`   📝 Ответ: ${answer.substring(0, 50)}...`);
            
            // ТОЛЬКО ЗДЕСЬ используем typeTextSafely
            await typeTextSafely(page, q.textarea, answer);
            console.log(`   ✅ Ответ введен`);
        } else {
            console.log(`   ⚠️ Нет поля для ввода и вариантов ответа`);
        }
        
        q.answered = true;
        
        // Небольшая пауза между вопросами
        await page.waitForTimeout(1000);
    }
    
    console.log(`\n✅ Все вопросы обработаны`);
}

/* ======================================================
   ОСНОВНАЯ ФУНКЦИЯ ДЛЯ ОТВЕТОВ
   ====================================================== */

/**
 * Основная функция для ответов на вопросы
 */
export async function answerQuestions(page, resumeText, vacancyData) {
    console.log('📋 Начинаем обработку вопросов...');
    
    // Парсим вопросы
    const questions = await parseQuestions(page);
    
    if (questions.length === 0) {
        console.log('⚠️ Вопросы не найдены');
        return false;
    }
    
    // Заполняем ответы
    await fillAnswers(page, questions, resumeText, vacancyData);
    
    // Ищем кнопку отправки
    const submitBtn = await page.$('button[type="submit"], [data-qa="submit"], [data-qa="response-submit"]');
    if (submitBtn) {
        await submitBtn.click();
        console.log('📤 Ответы отправлены');
        return true;
    } else {
        console.log('⚠️ Кнопка отправки не найдена');
        return false;
    }
}