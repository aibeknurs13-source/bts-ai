export type Route =
  | { k: 'home' }
  | { k: 'subject'; id: string; tab?: string }
  | { k: 'test'; id: string }
  | { k: 'cards'; id: string }
  | { k: 'note'; id: string }
  | { k: 'review'; subjectId?: string }
  | { k: 'dash' }
  | { k: 'bank' }
  | { k: 'settings' };
