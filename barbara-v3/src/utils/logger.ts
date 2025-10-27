/**
 * Logger Utility
 * Simple colored console logging with log level support
 */

const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const LOG_LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const currentLevel = LOG_LEVELS[LOG_LEVEL as keyof typeof LOG_LEVELS] || LOG_LEVELS.info;

export const logger = {
  info: (...args: any[]) => {
    if (currentLevel >= LOG_LEVELS.info) console.log('ℹ️ ', ...args);
  },
  warn: (...args: any[]) => {
    if (currentLevel >= LOG_LEVELS.warn) console.warn('⚠️ ', ...args);
  },
  error: (...args: any[]) => {
    if (currentLevel >= LOG_LEVELS.error) console.error('❌', ...args);
  },
  debug: (...args: any[]) => {
    if (currentLevel >= LOG_LEVELS.debug) console.log('🔍', ...args);
  },
  event: (emoji: string, message: string, ...args: any[]) => {
    if (currentLevel >= LOG_LEVELS.info) console.log(emoji, message, ...args);
  },
  section: (title: string, lines: string[]) => {
    if (currentLevel >= LOG_LEVELS.info) {
      console.log('\n' + '='.repeat(60));
      console.log(title);
      console.log('='.repeat(60));
      lines.forEach(line => console.log(line));
      console.log('='.repeat(60) + '\n');
    }
  }
};

