import { CARD_COLORS, createCardRepository, type CardColor, type CardRecord } from '../../lib/storage'

export const DEFAULT_CARD_COLOR: CardColor = 'blue'

export const appCardRepository = createCardRepository()

export function getNextCardColor(cards: readonly Pick<CardRecord, 'color'>[]): CardColor {
  const lastColor = cards.at(-1)?.color

  if (!lastColor) {
    return DEFAULT_CARD_COLOR
  }

  const lastColorIndex = CARD_COLORS.indexOf(lastColor)

  if (lastColorIndex === -1) {
    return DEFAULT_CARD_COLOR
  }

  return CARD_COLORS[(lastColorIndex + 1) % CARD_COLORS.length]
}
