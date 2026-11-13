/**
 * Internationalization (i18n) messages for MarkUML.
 */

export const MESSAGES = {
  en: {
    validationErrorTitle: 'MarkUML Validation Error',
    undeclaredActor: (actor) => `Undeclared actor: "${actor}". Please declare it in the "## actors" section before using it.`,
    linePrefix: (line) => `Line ${line}`,
    errorTitle: 'UML Error',
  },
  pt: {
    validationErrorTitle: 'Erro de Validação MarkUML',
    undeclaredActor: (actor) => `Ator "${actor}" não foi declarado na seção "## actors". Declare-o antes de utilizá-lo.`,
    linePrefix: (line) => `Linha ${line}`,
    errorTitle: 'Erro UML',
  },
};

/**
 * Resolve locale messages based on language code ('en', 'en-US', 'pt-BR', etc.).
 * Defaults to English.
 * @param {string} [lang='en']
 */
export function getLocale(lang = 'en') {
  if (typeof lang === 'string' && lang.toLowerCase().startsWith('pt')) {
    return MESSAGES.pt;
  }
  return MESSAGES.en;
}
