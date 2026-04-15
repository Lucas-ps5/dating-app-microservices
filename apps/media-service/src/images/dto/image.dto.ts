import { Type } from "class-transformer";
import { IsString, IsNotEmpty, IsUUID, IsNumber } from "class-validator";

export class UploadImageDto {
  @IsUUID()
  id: string;

  @IsUUID()
  @IsNotEmpty()
  imageName: string;

  @IsString()
  @IsNotEmpty()
  originalName: string;

  @IsString()
  @IsNotEmpty()
  imageType: string;

  @IsNumber()
  @IsNotEmpty()
  @Type(() => Number)
  imageSize: number;

  @IsString()
  @IsNotEmpty()
  imageUrl: string;
}
