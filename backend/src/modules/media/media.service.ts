import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

@Injectable()
export class MediaService {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicUrl: string;

  constructor(config: ConfigService) {
    const endpoint = config.get<string>('S3_ENDPOINT', 'http://localhost:9000');
    this.bucket = config.get<string>('S3_BUCKET', 'agri-media');
    this.publicUrl = config
      .get<string>('S3_PUBLIC_URL', `${endpoint}/${this.bucket}`)
      .replace(/\/$/, '');
    this.client = new S3Client({
      endpoint,
      region: config.get<string>('S3_REGION', 'us-east-1'),
      forcePathStyle: true,
      credentials: {
        accessKeyId: config.get<string>('S3_ACCESS_KEY', 'minioadmin'),
        secretAccessKey: config.get<string>('S3_SECRET_KEY', 'minioadmin'),
      },
    });
  }

  async uploadProductImage(file?: Express.Multer.File) {
    return this.uploadImage(file, 'products', 'Vui long chon anh san pham');
  }

  async uploadAvatarImage(file?: Express.Multer.File) {
    return this.uploadImage(file, 'avatars', 'Vui long chon anh dai dien');
  }

  private async uploadImage(file: Express.Multer.File | undefined, folder: string, requiredMessage: string) {
    if (!file) {
      throw new BadRequestException({
        code: 'IMAGE_REQUIRED',
        message: requiredMessage,
      });
    }
    const extension = EXTENSIONS[file.mimetype];
    if (!extension) {
      throw new BadRequestException({
        code: 'IMAGE_TYPE_INVALID',
        message: 'Chi ho tro anh JPG, PNG, WebP hoac GIF',
      });
    }

    const now = new Date();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const key = `${folder}/${now.getUTCFullYear()}/${month}/${randomUUID()}.${extension}`;
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );

    return {
      key,
      url: `${this.publicUrl}/${key}`,
      contentType: file.mimetype,
      size: file.size,
    };
  }
}
