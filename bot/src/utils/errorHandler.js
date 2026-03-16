export function isRetryableError(error){
    const errorMessage = error.message || '';
    const errorCode = error.code || '';

    console.log(`🔍 Анализ ошибки: "${errorMessage}"`);

    const retryablePatterns = [
        'TimeoutError',
        'timeout',
        'ERR_NETWORK_CHANGED',
        'ECONNRESET',
        'ETIMEDOUT',
        '429',
        '500',  // Server Error
        '503',  // Service Unavailable
        'socket hang up',
        'network error'
    ];

    const shouldRetry = retryablePatterns.some(pattern => 
        errorMessage.includes(pattern) || 
        (errorCode && errorCode.includes(pattern))
    );
    
    console.log(`   🔄 Можно повторить: ${shouldRetry ? '✅ ДА' : '❌ НЕТ'}`);
    
    return shouldRetry;
}

export function calculateRetryDelay(attempt, baseDelay = 2000) {
    const delay = baseDelay * Math.pow(2, attempt - 1)

    const jiter = delay * 0.1 * (Math.random() - 0.5)
    const finalyDelay = Math.round(delay+jiter)

    console.log(`   ⏱️  Задержка перед попыткой ${attempt + 1}: ${finalDelay}мс`);

    return finalyDelay
}

export function withRetry(fn, options = {}) {
    const {
        maxAttempts = 3,
        baseDelay = 2000,
        onRetry = null
    } = options;

    return async function(...args) {
        let lastError

         for (let attempt = 0; attempt < maxAttempts; attempt++) {
            try {
                console.log(`\n🔄 Попытка ${attempt + 1}/${maxAttempts}...`);
                
                // Пробуем выполнить функцию
                const result = await fn(...args);
                
                console.log(`   ✅ Попытка ${attempt + 1} успешна!`);
                return result;
                
            } catch (error) {
                lastError = error;
                
                console.log(`   ❌ Попытка ${attempt + 1} не удалась:`, error.message);
                
                // Проверяем, можно ли повторить
                if (!isRetryableError(error)) {
                    console.log('   ⛔ Ошибка не требует повтора, прекращаем');
                    throw error;
                }
                
                // Если это была последняя попытка
                if (attempt === maxAttempts - 1) {
                    console.log('   ⛔ Исчерпаны все попытки');
                    throw error;
                }
                
                // Вычисляем задержку
                const delay = calculateRetryDelay(attempt + 1, baseDelay);
                
                // Вызываем колбэк если есть
                if (onRetry) {
                    onRetry(attempt + 1, error, delay);
                }
                
                // Ждем перед следующей попыткой
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        throw lastError
    }
}