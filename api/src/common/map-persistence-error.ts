import { InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { PersistenceError } from '../persistence/persistence.error';

export async function fromPersistence<T>(work: Promise<T>): Promise<T> {
  try {
    return await work;
  } catch (error) {
    if (error instanceof PersistenceError) {
      if (error.message.toLowerCase().includes('not found')) {
        throw new NotFoundException(error.message);
      }
      throw new InternalServerErrorException(error.message);
    }
    throw error;
  }
}
