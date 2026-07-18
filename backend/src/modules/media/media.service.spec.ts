import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassThrough } from 'stream';
import { v2 as cloudinary } from 'cloudinary';
import { MediaService } from './media.service';

jest.mock('cloudinary', () => ({ v2: { config: jest.fn(), uploader: { upload_stream: jest.fn() } } }));
const uploadStream = cloudinary.uploader.upload_stream as jest.Mock;
const config = (values: Record<string, string> = {}) => ({ get: jest.fn((key: string) => values[key]) }) as unknown as ConfigService;
const file = (mimetype = 'image/png') => ({ fieldname: 'file', originalname: 'image.png', encoding: '7bit', mimetype, size: 4, buffer: Buffer.from('test'), destination: '', filename: '', path: '', stream: new PassThrough() }) as Express.Multer.File;

describe('MediaService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects missing and unsupported files', async () => {
    const service = new MediaService(config());
    await expect(service.uploadProductImage()).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.uploadProductImage(file('text/plain'))).rejects.toBeInstanceOf(BadRequestException);
  });

  it('reports missing Cloudinary credentials clearly', async () => {
    await expect(new MediaService(config()).uploadProductImage(file())).rejects.toMatchObject({ response: { code: 'CLOUDINARY_NOT_CONFIGURED' } });
  });

  it('uploads a buffer and returns the compatible response shape', async () => {
    uploadStream.mockImplementation((_options, callback) => {
      const stream = new PassThrough();
      stream.on('finish', () => callback(undefined, { public_id: 'nongsanxanh/products/id', secure_url: 'https://res.cloudinary.com/demo/image/upload/id.png', bytes: 4 }));
      return stream;
    });
    const service = new MediaService(config({ CLOUDINARY_CLOUD_NAME: 'demo', CLOUDINARY_API_KEY: 'key', CLOUDINARY_API_SECRET: 'secret', CLOUDINARY_FOLDER: '/nongsanxanh/' }));
    await expect(service.uploadProductImage(file())).resolves.toEqual({ key: 'nongsanxanh/products/id', url: 'https://res.cloudinary.com/demo/image/upload/id.png', contentType: 'image/png', size: 4 });
    expect(uploadStream).toHaveBeenCalledWith(expect.objectContaining({ folder: 'nongsanxanh/products', resource_type: 'image' }), expect.any(Function));
  });

  it('hides provider failures', async () => {
    uploadStream.mockImplementation((_options, callback) => { const stream = new PassThrough(); stream.on('finish', () => callback({ message: 'provider detail' })); return stream; });
    const service = new MediaService(config({ CLOUDINARY_CLOUD_NAME: 'demo', CLOUDINARY_API_KEY: 'key', CLOUDINARY_API_SECRET: 'secret' }));
    await expect(service.uploadAvatarImage(file())).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
