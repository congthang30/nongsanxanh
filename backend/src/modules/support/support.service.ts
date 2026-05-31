import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { customAlphabet } from 'nanoid';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { CreateTicketDto, ReplyTicketDto } from './dto/support.dto';

const ticketNo = customAlphabet('0123456789', 8);

@Injectable()
export class SupportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  async createTicket(userId: string, dto: CreateTicketDto) {
    const ticket = await this.prisma.supportTicket.create({
      data: {
        code: `TK${ticketNo()}`,
        userId,
        orderId: dto.orderId,
        subject: dto.subject,
        priority: dto.priority ?? 'NORMAL',
        status: 'OPEN',
        messages: {
          create: { senderId: userId, senderRole: 'CUSTOMER', body: dto.message },
        },
      },
      include: { messages: true },
    });
    this.events.emit('support.ticket_created', {
      ticketId: ticket.id,
      subject: ticket.subject,
      priority: ticket.priority,
    });
    return ticket;
  }

  listMyTickets(userId: string) {
    return this.prisma.supportTicket.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: { order: { select: { orderNumber: true } } },
    });
  }

  async getTicket(id: string, userId?: string) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        order: { select: { orderNumber: true, status: true } },
        user: { select: { email: true, profile: { select: { fullName: true } } } },
      },
    });
    if (!ticket || (userId && ticket.userId !== userId)) {
      throw new NotFoundException({ code: 'TICKET_NOT_FOUND', message: 'Khong tim thay ticket' });
    }
    return ticket;
  }

  /** Tra loi ticket; senderRole xac dinh boi context controller. */
  async reply(
    id: string,
    senderId: string,
    senderRole: 'CUSTOMER' | 'SUPPORT',
    dto: ReplyTicketDto,
  ) {
    const ticket = await this.prisma.supportTicket.findUnique({ where: { id } });
    if (!ticket) {
      throw new NotFoundException({ code: 'TICKET_NOT_FOUND', message: 'Khong tim thay ticket' });
    }
    await this.prisma.$transaction([
      this.prisma.ticketMessage.create({
        data: { ticketId: id, senderId, senderRole, body: dto.message },
      }),
      this.prisma.supportTicket.update({
        where: { id },
        data: { status: senderRole === 'SUPPORT' ? 'ANSWERED' : 'OPEN' },
      }),
    ]);
    this.events.emit('support.reply', {
      ticketId: id,
      toUserId: ticket.userId,
      bySupport: senderRole === 'SUPPORT',
    });
    return this.getTicket(id);
  }

  // ---- Support staff ----
  listAll(status?: string) {
    return this.prisma.supportTicket.findMany({
      where: status ? { status } : undefined,
      orderBy: { updatedAt: 'desc' },
      include: {
        user: { select: { email: true, profile: { select: { fullName: true } } } },
        order: { select: { orderNumber: true } },
      },
      take: 200,
    });
  }

  async setStatus(id: string, status: string, assignedTo?: string) {
    await this.prisma.supportTicket.update({
      where: { id },
      data: { status, assignedTo },
    });
    return { message: 'Da cap nhat ticket' };
  }
}
