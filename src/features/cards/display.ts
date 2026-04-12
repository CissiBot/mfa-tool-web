const EMPTY_NOTE_PLACEHOLDER = '未命名'

export function getCardNoteLabel(note: string): string {
  return note.trim() === '' ? EMPTY_NOTE_PLACEHOLDER : note
}

export function maskSecret(rawSecret: string): string {
  return rawSecret.replace(/\S/g, '•')
}
