import { Controller, Get } from '@nestjs/common';
import { ListsService } from './lists.service';

@Controller('grocery-types')
export class GroceryTypesController {
  constructor(private readonly lists: ListsService) {}

  @Get()
  list() {
    return this.lists.listGroceryTypes();
  }
}
