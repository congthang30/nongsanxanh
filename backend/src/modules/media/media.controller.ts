import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { ROLE } from '../../common/constants/roles.constant';
import { Roles } from '../../common/decorators/roles.decorator';
import { MediaService } from './media.service';

@ApiTags('admin-media')
@ApiBearerAuth()
@Roles(ROLE.ADMIN, ROLE.SUPER_ADMIN)
@Controller('admin/media')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Post('products')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, callback) => {
        if (!/^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)) {
          callback(
            new BadRequestException({
              code: 'IMAGE_TYPE_INVALID',
              message: 'Chi ho tro anh JPG, PNG, WebP hoac GIF',
            }),
            false,
          );
          return;
        }
        callback(null, true);
      },
    }),
  )
  uploadProductImage(@UploadedFile() file?: Express.Multer.File) {
    return this.media.uploadProductImage(file);
  }
  @Post('avatars')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, callback) => {
        if (!/^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)) {
          callback(
            new BadRequestException({
              code: 'IMAGE_TYPE_INVALID',
              message: 'Chi ho tro anh JPG, PNG, WebP hoac GIF',
            }),
            false,
          );
          return;
        }
        callback(null, true);
      },
    }),
  )
  uploadAvatarImage(@UploadedFile() file?: Express.Multer.File) {
    return this.media.uploadAvatarImage(file);
  }
}
