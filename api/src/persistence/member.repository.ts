import { MemberRow } from '../common/types';

export abstract class MemberRepository {
  abstract listActive(listId: string): Promise<MemberRow[]>;
  abstract findActive(listId: string, userId: string): Promise<MemberRow | null>;
}
