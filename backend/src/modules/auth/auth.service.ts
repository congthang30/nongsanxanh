import {
  ConflictException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client, TokenPayload } from 'google-auth-library';
import * as argon2 from 'argon2';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { ROLE } from '../../common/constants/roles.constant';
import {
  ForgotPasswordDto,
  GoogleLoginDto,
  LoginDto,
  RefreshDto,
  RegisterDto,
  ResetPasswordDto,
} from './dto/auth.dto';

@Injectable()
export class AuthService {
  private readonly googleClient = new OAuth2Client();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly notification: NotificationService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email: dto.email }, ...(dto.phone ? [{ phone: dto.phone }] : [])] },
    });
    if (existing) {
      throw new ConflictException({
        code: 'EMAIL_OR_PHONE_TAKEN',
        message: 'Email hoac so dien thoai da duoc su dung',
      });
    }

    const passwordHash = await argon2.hash(dto.password);
    const customerRole = await this.prisma.role.findUnique({
      where: { code: ROLE.CUSTOMER },
    });

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        phone: dto.phone,
        passwordHash,
        profile: { create: { fullName: dto.fullName } },
        userRoles: customerRole
          ? { create: { roleId: customerRole.id } }
          : undefined,
      },
      include: { profile: true },
    });

    return this.issueTokens(user.id);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Email hoac mat khau khong dung',
      });
    }
    if (user.status === 'LOCKED') {
      throw new UnauthorizedException({
        code: 'ACCOUNT_LOCKED',
        message: 'Tai khoan da bi khoa',
      });
    }

    const ok = await argon2.verify(user.passwordHash, dto.password);
    if (!ok) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Email hoac mat khau khong dung',
      });
    }

    return this.issueTokens(user.id);
  }

  getGoogleConfig() {
    return { clientId: this.getGoogleClientId() };
  }

  async googleLogin(dto: GoogleLoginDto) {
    const clientId = this.getGoogleClientId();
    if (!clientId) {
      throw new ServiceUnavailableException({
        code: 'GOOGLE_LOGIN_NOT_CONFIGURED',
        message: 'Dang nhap Google chua duoc cau hinh',
      });
    }

    let payload: TokenPayload | undefined;
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken: dto.credential,
        audience: clientId,
      });
      payload = ticket.getPayload();
    } catch {
      throw new UnauthorizedException({
        code: 'GOOGLE_TOKEN_INVALID',
        message: 'Token Google khong hop le',
      });
    }

    if (!payload?.email || !payload.email_verified) {
      throw new UnauthorizedException({
        code: 'GOOGLE_EMAIL_UNVERIFIED',
        message: 'Email Google chua duoc xac minh',
      });
    }

    const email = payload.email.toLowerCase();
    const displayName = payload.name ?? email.split('@')[0];
    const customerRole = await this.prisma.role.findUnique({
      where: { code: ROLE.CUSTOMER },
    });

    let user = await this.prisma.user.findUnique({
      where: { email },
      include: { profile: true },
    });

    if (user?.status === 'LOCKED') {
      throw new UnauthorizedException({
        code: 'ACCOUNT_LOCKED',
        message: 'Tai khoan da bi khoa',
      });
    }

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email,
          emailVerifiedAt: new Date(),
          profile: {
            create: {
              fullName: displayName,
              avatarUrl: payload.picture,
            },
          },
          userRoles: customerRole
            ? { create: { roleId: customerRole.id } }
            : undefined,
        },
        include: { profile: true },
      });
    } else {
      if (!user.emailVerifiedAt) {
        await this.prisma.user.update({
          where: { id: user.id },
          data: { emailVerifiedAt: new Date() },
        });
      }
      if (!user.profile) {
        await this.prisma.userProfile.create({
          data: {
            userId: user.id,
            fullName: displayName,
            avatarUrl: payload.picture,
          },
        });
      } else if (!user.profile.avatarUrl && payload.picture) {
        await this.prisma.userProfile.update({
          where: { userId: user.id },
          data: { avatarUrl: payload.picture },
        });
      }
    }

    return this.issueTokens(user.id);
  }

  async refresh(dto: RefreshDto) {
    let payload: { sub: string; sessionId: string };
    try {
      payload = await this.jwt.verifyAsync(dto.refreshToken, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException({
        code: 'REFRESH_INVALID',
        message: 'Refresh token khong hop le',
      });
    }

    const stored = await this.prisma.refreshToken.findFirst({
      where: { userId: payload.sub, sessionId: payload.sessionId, revokedAt: null },
    });
    if (!stored) {
      throw new UnauthorizedException({
        code: 'REFRESH_REVOKED',
        message: 'Phien dang nhap da het hieu luc',
      });
    }
    const matches = await argon2.verify(stored.tokenHash, dto.refreshToken);
    if (!matches) {
      // Co dau hieu reuse token -> revoke toan bo session
      await this.prisma.refreshToken.updateMany({
        where: { userId: payload.sub, sessionId: payload.sessionId },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException({
        code: 'REFRESH_REUSE_DETECTED',
        message: 'Phat hien tai su dung refresh token',
      });
    }

    // Rotation: revoke token cu, phat token moi cung sessionId
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });
    return this.issueTokens(payload.sub, payload.sessionId);
  }

  async logout(userId: string, sessionId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { userId, sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { message: 'Da dang xuat' };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    // Khong tiet lo email co ton tai hay khong
    if (user) {
      const code = randomUUID();
      const codeHash = await argon2.hash(code);
      await this.prisma.otpCode.create({
        data: {
          target: dto.email,
          purpose: 'RESET_PASSWORD',
          codeHash,
          expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        },
      });

      const token = `${dto.email}:${code}`;
      const frontendUrl = this.config.get<string>('CORS_ORIGIN', 'http://localhost:5173');
      const resetLink = `${frontendUrl}/reset-password?token=${encodeURIComponent(token)}`;

      // Gui email that (best-effort) + in-app notification
      await this.notification.notify({
        userId: user.id,
        type: 'RESET_PASSWORD',
        title: 'Đặt lại mật khẩu Nông Sản Xanh',
        body:
          'Chúng tôi vừa nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn.\nLiên kết đặt lại mật khẩu có hiệu lực trong 15 phút. Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email.',
        email: user.email,
        emailAction: {
          label: 'Đặt lại mật khẩu',
          url: resetLink,
        },
      });

      const isProd = this.config.get<string>('NODE_ENV') === 'production';
      return {
        message: 'Neu email ton tai, huong dan dat lai mat khau da duoc gui',
        ...(isProd ? {} : { devResetToken: token }),
      };
    }
    return { message: 'Neu email ton tai, huong dan dat lai mat khau da duoc gui' };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const [email, code] = dto.token.split(':');
    if (!email || !code) {
      throw new UnauthorizedException({
        code: 'RESET_TOKEN_INVALID',
        message: 'Token dat lai mat khau khong hop le',
      });
    }
    const otp = await this.prisma.otpCode.findFirst({
      where: {
        target: email,
        purpose: 'RESET_PASSWORD',
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!otp || !(await argon2.verify(otp.codeHash, code))) {
      throw new UnauthorizedException({
        code: 'RESET_TOKEN_INVALID',
        message: 'Token dat lai mat khau khong hop le hoac het han',
      });
    }

    const passwordHash = await argon2.hash(dto.newPassword);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { email }, data: { passwordHash } }),
      this.prisma.otpCode.update({
        where: { id: otp.id },
        data: { consumedAt: new Date() },
      }),
    ]);
    return { message: 'Dat lai mat khau thanh cong' };
  }

  private getGoogleClientId() {
    return (
      this.config.get<string>('GOOGLE_CLIENT_ID') ??
      this.config.get<string>('GOOGLE_KEYS_CLIENT_ID') ??
      this.config.get<string>('GoogleKeys__ClientId') ??
      ''
    );
  }

  /** Sinh access + refresh token, luu hash refresh token. */
  private async issueTokens(userId: string, sessionId?: string) {
    const sid = sessionId ?? randomUUID();
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        userRoles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
      },
    });
    if (!user) {
      throw new UnauthorizedException({ code: 'USER_NOT_FOUND', message: 'Khong tim thay user' });
    }

    const roles = user.userRoles.map((ur) => ur.role.code);
    const permissions = Array.from(
      new Set(
        user.userRoles.flatMap((ur) =>
          ur.role.permissions.map((rp) => rp.permission.code),
        ),
      ),
    );

    const accessToken = await this.jwt.signAsync(
      { sub: user.id, email: user.email, roles, permissions, sessionId: sid },
      {
        secret: this.config.get<string>('JWT_ACCESS_SECRET'),
        expiresIn: Number(this.config.get<string>('JWT_ACCESS_TTL', '900')),
      },
    );
    const refreshToken = await this.jwt.signAsync(
      { sub: user.id, sessionId: sid },
      {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: Number(this.config.get<string>('JWT_REFRESH_TTL', '1209600')),
      },
    );

    const tokenHash = await argon2.hash(refreshToken);
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        sessionId: sid,
        tokenHash,
        expiresAt: new Date(
          Date.now() +
            Number(this.config.get<string>('JWT_REFRESH_TTL', '1209600')) * 1000,
        ),
      },
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.profile?.fullName,
        roles,
        permissions,
      },
    };
  }
}
