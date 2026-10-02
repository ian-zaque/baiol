import { Module } from '@nestjs/common';
import { GroceryTypesController } from './grocery-types.controller';
import { ListsController } from './lists.controller';
import { ListsService } from './lists.service';
import { SharedController } from './shared.controller';

@Module({
  controllers: [ListsController, SharedController, GroceryTypesController],
  providers: [ListsService],
  exports: [ListsService],
})
export class ListsModule {}
