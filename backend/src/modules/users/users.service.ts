import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { GeoService } from '../shipping/geo.service';
import { CreateAddressDto, UpdateProfileDto } from './dto/users.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly geo: GeoService,
  ) {}

  /**
   * Bao dam dia chi co toa do that. Neu FE da gui lat/lng (da xac thuc qua
   * Places) thi dung luon; neu chua, thu geocode tu text. Khong cho luu neu
   * van khong phan giai duoc (tru khi allowManual).
   */
  private async resolveGeo(dto: CreateAddressDto) {
    if (dto.lat != null && dto.lng != null) {
      return {
        lat: dto.lat,
        lng: dto.lng,
        placeId: dto.placeId ?? null,
        formattedAddress: dto.formattedAddress ?? null,
        geocodeProvider: dto.placeId ? this.geo.provider : 'manual',
        geocodeConfidence: 0.9,
      };
    }
    const text = dto.formattedAddress ??
      `${dto.line1}, ${dto.ward}, ${dto.district}, ${dto.province}`;
    const geo = await this.geo.geocode({ placeId: dto.placeId, text });
    if (!geo) {
      if (dto.allowManual) {
        return {
          lat: null,
          lng: null,
          placeId: dto.placeId ?? null,
          formattedAddress: dto.formattedAddress ?? null,
          geocodeProvider: 'manual',
          geocodeConfidence: 0,
        };
      }
      throw new BadRequestException({
        code: 'ADDRESS_NOT_VERIFIED',
        message:
          'Khong xac thuc duoc dia chi tren ban do. Vui long chon dia chi tu goi y.',
      });
    }
    return {
      lat: geo.lat,
      lng: geo.lng,
      placeId: geo.placeId,
      formattedAddress: geo.formattedAddress,
      geocodeProvider: geo.provider,
      geocodeConfidence: geo.confidence,
    };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });
    if (!user) throw new NotFoundException({ code: 'USER_NOT_FOUND', message: 'Khong tim thay user' });
    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      status: user.status,
      profile: user.profile,
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    await this.prisma.userProfile.update({
      where: { userId },
      data: { ...dto },
    });
    return this.getProfile(userId);
  }

  listAddresses(userId: string) {
    return this.prisma.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async createAddress(userId: string, dto: CreateAddressDto) {
    const geo = await this.resolveGeo(dto);
    if (dto.isDefault) {
      await this.prisma.address.updateMany({
        where: { userId },
        data: { isDefault: false },
      });
    }
    const { allowManual, lat, lng, placeId, formattedAddress, ...rest } = dto;
    void allowManual;
    void lat;
    void lng;
    void placeId;
    void formattedAddress;
    return this.prisma.address.create({
      data: { ...rest, ...geo, userId },
    });
  }

  async updateAddress(userId: string, id: string, dto: CreateAddressDto) {
    await this.assertOwner(userId, id);
    const geo = await this.resolveGeo(dto);
    if (dto.isDefault) {
      await this.prisma.address.updateMany({
        where: { userId },
        data: { isDefault: false },
      });
    }
    const { allowManual, lat, lng, placeId, formattedAddress, ...rest } = dto;
    void allowManual;
    void lat;
    void lng;
    void placeId;
    void formattedAddress;
    return this.prisma.address.update({
      where: { id },
      data: { ...rest, ...geo },
    });
  }

  async deleteAddress(userId: string, id: string) {
    await this.assertOwner(userId, id);
    await this.prisma.address.delete({ where: { id } });
    return { message: 'Da xoa dia chi' };
  }

  private async assertOwner(userId: string, id: string) {
    const addr = await this.prisma.address.findUnique({ where: { id } });
    if (!addr || addr.userId !== userId) {
      throw new NotFoundException({
        code: 'ADDRESS_NOT_FOUND',
        message: 'Khong tim thay dia chi',
      });
    }
  }
}
