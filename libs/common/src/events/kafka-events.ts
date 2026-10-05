// Kafka Topic constants
export const KAFKA_TOPICS = {
  USER_DELETED: "user.deleted",
  LIKE_CREATED: "like.created",
  MATCH_CREATED: "match.created",
  MESSAGE_SENT: "message.sent",
  IMAGE_DELETED: "image.deleted",
} as const;

export type KafkaTopic = (typeof KAFKA_TOPICS)[keyof typeof KAFKA_TOPICS];

// Event payload interfaces
export interface UserDeletedEvent {
  keycloakId: string;
}

export interface LikeCreatedEvent {
  id: string;
  senderId: string;
  receiverId: string;
  type: string;
  createdAt: string;
}

export interface MatchCreatedEvent {
  matchId: string;
  user1Id: string;
  user2Id: string;
  matchedAt: string;
}

export interface MessageSentEvent {
  messageId: string;
  conversationId: string;
  senderId: string;
  receiverId: string;
  content: string;
  type: string;
  sentAt: string;
}

export interface ImageDeletedEvent {
  objectName: string;
  ownerId: string;
}
