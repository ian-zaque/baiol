import { GroceryType } from '../common/types';

export abstract class GroceryTypeRepository {
  abstract listActive(): Promise<GroceryType[]>;
  abstract existsActive(id: string): Promise<boolean>;
}
