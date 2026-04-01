import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { MessagesService } from '../messages/messages.service';
import { MatchesService } from '../matches/matches.service';
import { MessageType } from '../messages/message.entity';

interface SendMessagePayload {
  matchId: string;
  content: string;
  type?: MessageType;
}

@WebSocketGateway({
  cors: { origin: '*', credentials: true },
  namespace: '/chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);
  // Map socket.id → userId
  private connectedUsers = new Map<string, string>();

  constructor(
    private readonly messagesService: MessagesService,
    private readonly matchesService: MatchesService,
  ) {}

  handleConnection(client: Socket) {
    const userId = client.handshake.auth?.userId as string | undefined;
    if (!userId) {
      this.logger.warn(`Client ${client.id} connected without userId — disconnecting`);
      client.disconnect();
      return;
    }
    this.connectedUsers.set(client.id, userId);
    this.logger.log(`Client connected: ${client.id} (userId=${userId})`);
  }

  handleDisconnect(client: Socket) {
    this.connectedUsers.delete(client.id);
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join-match')
  async handleJoinMatch(
    @ConnectedSocket() client: Socket,
    @MessageBody() matchId: string,
  ) {
    const userId = this.connectedUsers.get(client.id);
    if (!userId) {
      client.emit('error', { message: 'Unauthorised' });
      return;
    }
    try {
      await this.matchesService.validateParticipant(matchId, userId);
      await client.join(`match:${matchId}`);
      this.logger.debug(`${userId} joined room match:${matchId}`);
      client.emit('joined', { matchId });
    } catch {
      client.emit('error', { message: 'Cannot join this match' });
    }
  }

  @SubscribeMessage('message')
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: SendMessagePayload,
  ) {
    const senderId = this.connectedUsers.get(client.id);
    if (!senderId) {
      client.emit('error', { message: 'Unauthorised' });
      return;
    }

    try {
      await this.matchesService.validateParticipant(payload.matchId, senderId);

      const message = await this.messagesService.sendMessage({
        matchId: payload.matchId,
        senderId,
        content: payload.content,
        type: payload.type,
      });

      // Broadcast to everyone in the match room
      this.server.to(`match:${payload.matchId}`).emit('new-message', message);
    } catch (err) {
      client.emit('error', { message: err.message });
    }
  }

  @SubscribeMessage('typing')
  handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() matchId: string,
  ) {
    const userId = this.connectedUsers.get(client.id);
    if (!userId) return;
    client.to(`match:${matchId}`).emit('typing', { userId, matchId });
  }
}
