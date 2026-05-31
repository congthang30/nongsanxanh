import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../../infrastructure/database/prisma.service';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private transporter: nodemailer.Transporter;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    const smtpUser = this.config.get<string>('SMTP_USER');
    const smtpPass = this.config.get<string>('SMTP_PASS');

    this.transporter = nodemailer.createTransport({
      host: this.config.get<string>('SMTP_HOST', 'localhost'),
      port: Number(this.config.get<string>('SMTP_PORT', '1025')),
      secure: false,
      auth:
        smtpUser && smtpPass
          ? {
              user: smtpUser,
              pass: smtpPass,
            }
          : undefined,
    });
  }

  /** Tao in-app notification va gui email (best-effort). */
  async notify(params: {
    userId: string;
    type: string;
    title: string;
    body: string;
    email?: string | null;
    data?: Record<string, unknown>;
  }) {
    await this.prisma.notification.create({
      data: {
        userId: params.userId,
        type: params.type,
        title: params.title,
        body: params.body,
        data: params.data as object,
      },
    });

    if (params.email) {
      try {
        await this.transporter.sendMail({
          from: this.config.get<string>('SMTP_FROM', 'no-reply@agri.local'),
          to: params.email,
          subject: params.title,
          text: params.body,
        });
      } catch (e) {
        this.logger.warn(`Email gui that bai: ${(e as Error).message}`);
      }
    }
  }

  /** Gui notification cho tat ca user thuoc mot role (vd ADMIN, WAREHOUSE). */
  async notifyRole(
    roleCode: string,
    params: { type: string; title: string; body: string; data?: Record<string, unknown>; sendEmail?: boolean },
  ) {
    const users = await this.prisma.user.findMany({
      where: { userRoles: { some: { role: { code: roleCode } } } },
      select: { id: true, email: true },
    });
    await Promise.all(
      users.map((u) =>
        this.notify({
          userId: u.id,
          type: params.type,
          title: params.title,
          body: params.body,
          email: params.sendEmail ? u.email : null,
          data: params.data,
        }),
      ),
    );
  }

  /** Gui notification cho danh sach userId cu the. */
  async notifyUsers(
    userIds: string[],
    params: { type: string; title: string; body: string; data?: Record<string, unknown>; sendEmail?: boolean },
  ) {
    const uniq = [...new Set(userIds.filter(Boolean))];
    if (uniq.length === 0) return;
    const users = await this.prisma.user.findMany({
      where: { id: { in: uniq } },
      select: { id: true, email: true },
    });
    await Promise.all(
      users.map((u) =>
        this.notify({
          userId: u.id,
          type: params.type,
          title: params.title,
          body: params.body,
          email: params.sendEmail ? u.email : null,
          data: params.data,
        }),
      ),
    );
  }

  listForUser(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async unreadCount(userId: string) {
    const count = await this.prisma.notification.count({
      where: { userId, readAt: null },
    });
    return { count };
  }

  async markRead(userId: string, id: string) {
    await this.prisma.notification.updateMany({
      where: { id, userId },
      data: { readAt: new Date() },
    });
    return { message: 'Da danh dau da doc' };
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { message: 'Da danh dau tat ca da doc' };
  }
}
