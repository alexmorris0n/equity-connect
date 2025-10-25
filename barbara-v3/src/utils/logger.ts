/**
 * Logger Utility
 * Simple colored console logging
 */

export const logger = {
  info: (...args: any[]) => console.log('ℹ️ ', ...args),
  warn: (...args: any[]) => console.warn('⚠️ ', ...args),
  error: (...args: any[]) => console.error('❌', ...args),
  debug: (...args: any[]) => console.log('🔍', ...args),
  event: (emoji: string, message: string, ...args: any[]) => {
    console.log(emoji, message, ...args);
  },
  section: (title: string, lines: string[]) => {
    console.log('\n' + '='.repeat(60));
    console.log(title);
    console.log('='.repeat(60));
    lines.forEach(line => console.log(line));
    console.log('='.repeat(60) + '\n');
  }
};

