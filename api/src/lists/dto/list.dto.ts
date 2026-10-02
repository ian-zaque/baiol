import { Transform } from 'class-transformer';
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { CURRENCY_CODES } from '../currencies';

function emptyToUndefined(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const code = value.trim().toUpperCase();
  return code || undefined;
}

export class CreateListDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsString()
  @IsIn(CURRENCY_CODES)
  currency?: string;
}

export class UpdateListDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsString()
  @IsIn(CURRENCY_CODES)
  currency?: string;
}

export class CreateItemDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  amount?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? null : value))
  @IsUUID()
  grocery_type_id?: string | null;
}

export class UpdateItemDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  amount?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? null : value))
  @IsUUID()
  grocery_type_id?: string | null;
}
