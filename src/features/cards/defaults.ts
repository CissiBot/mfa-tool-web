import { createCardRepository, type CardColor } from '../../lib/storage'

export const DEFAULT_CARD_COLOR: CardColor = 'blue'

export const appCardRepository = createCardRepository()
