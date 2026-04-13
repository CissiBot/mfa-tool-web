import type { CardRecord } from '../lib/storage'

export type WorkspaceFocusField = 'secret' | 'note'

export type WorkspaceState =
  | { mode: 'create'; focusField: WorkspaceFocusField }
  | { mode: 'edit'; focusField: WorkspaceFocusField; card: CardRecord }
