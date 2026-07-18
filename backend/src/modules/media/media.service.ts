import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, UploadApiErrorResponse, UploadApiResponse } from 'cloudinary';
import { randomUUID } from 'crypto';

const SUPPORTED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

@Injectable()
export class MediaService {
  private readonly folder: string;
  private readonly isConfigured: boolean;

  constructor(config: ConfigService) {
    const cloudName = config.get<string>('CLOUDINARY_CLOUD_NAME')?.trim();
    const apiKey = config.get<string>('CLOUDINARY_API_KEY')?.trim();
    const apiSecret = config.get<string>('CLOUDINARY_API_SECRET')?.trim();

    this.folder = (config.get<string>('CLOUDINARY_FOLDER')?.trim() || 'nongsanxanh')
      .replace(/^\/+|\/+$/g, '');
    this.isConfigured = Boolean(cloudName && apiKey && apiSecret);

    if (this.isConfigured) {
      cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });
    }
  }

  async uploadProductImage(file?: Express.Multer.File) {
    return this.uploadImage(file, 'products', 'Vui long chon anh san pham');
  }

  async uploadAvatarImage(file?: Express.Multer.File) {
    return this.uploadImage(file, 'avatars', 'Vui long chon anh dai dien');
  }

  private async uploadImage(
    file: Express.Multer.File | undefined,
    folder: string,
    requiredMessage: string,
  ) {
    if (!file) {
      throw new BadRequestException({ code: 'IMAGE_REQUIRED', message: requiredMessage });
    }
    if (!SUPPORTED_IMAGE_TYPES.has(file.mimetype)) {
      throw new BadRequestException({
        code: 'IMAGE_TYPE_INVALID',
        message: 'Chi ho tro anh JPG, PNG, WebP hoac GIF',
      });
    }
    if (!this.isConfigured) {
      throw new ServiceUnavailableException({
        code: 'CLOUDINARY_NOT_CONFIGURED',
        message: 'Dich vu luu tru anh chua duoc cau hinh',
      });
    }

    try {
      const result = await new Promise<UploadApiResponse>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            resource_type: 'image',
            folder: `${this.folder}/${folder}`,
            public_id: randomUUID(),
            use_filename: false,
            unique_filename: true,
            overwrite: false,
          },
          (error: UploadApiErrorResponse | undefined, uploadResult: UploadApiResponse | undefined) => {
            if (error || !uploadResult) {
              reject(error ?? new Error('Cloudinary returned no upload result'));
              return;
            }
            resolve(uploadResult);
          },
        );
        stream.end(file.buffer);
      });

      return {
        key: result.public_id,
        url: result.secure_url,
        contentType: file.mimetype,
        size: result.bytes,
      };
    } catch {
      throw new ServiceUnavailableException({
        code: 'IMAGE_UPLOAD_FAILED',
        message: 'Khong the tai anh len dich vu luu tru. Vui long thu lai',
      });
    }
  }
}
