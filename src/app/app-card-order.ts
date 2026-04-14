import type { CardRecord } from '../lib/storage'

export function moveCard(ids: string[], draggedId: string, targetId: string): string[] {
  const draggedIndex = ids.indexOf(draggedId)
  const targetIndex = ids.indexOf(targetId)

  if (draggedIndex === -1 || targetIndex === -1 || draggedIndex === targetIndex) {
    return ids
  }

  const nextIds = [...ids]
  const [dragged] = nextIds.splice(draggedIndex, 1)
  nextIds.splice(targetIndex, 0, dragged)
  return nextIds
}

export function moveCardToIndex(ids: string[], draggedId: string, targetIndex: number): string[] {
  const draggedIndex = ids.indexOf(draggedId)

  if (draggedIndex === -1) {
    return ids
  }

  const boundedTargetIndex = Math.max(0, Math.min(targetIndex, ids.length - 1))

  if (boundedTargetIndex === draggedIndex) {
    return ids
  }

  const nextIds = [...ids]
  const [dragged] = nextIds.splice(draggedIndex, 1)

  nextIds.splice(boundedTargetIndex, 0, dragged)
  return nextIds
}

export function sortCardsByIds(cards: CardRecord[], orderIds: string[] | null): CardRecord[] {
  if (!orderIds) {
    return cards
  }

  const cardMap = new Map(cards.map((card) => [card.id, card]))
  const orderedCards: CardRecord[] = []

  for (const id of orderIds) {
    const card = cardMap.get(id)

    if (!card) {
      return cards
    }

    orderedCards.push(card)
    cardMap.delete(id)
  }

  if (cardMap.size > 0) {
    return cards
  }

  return orderedCards
}
