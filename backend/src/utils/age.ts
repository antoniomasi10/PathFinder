export function validateAge(birthDate: Date): void {
  const ageMsec = Date.now() - birthDate.getTime();
  const ageYears = ageMsec / (365.25 * 24 * 60 * 60 * 1000);
  if (ageYears < 18) {
    throw new Error('Devi avere almeno 18 anni per registrarti su PathFinder');
  }
}

export function parseAndValidateBirthDate(raw: string): Date {
  const date = new Date(raw);
  if (isNaN(date.getTime())) {
    throw new Error('Data di nascita non valida');
  }
  if (date > new Date()) {
    throw new Error('La data di nascita non può essere nel futuro');
  }
  validateAge(date);
  return date;
}
