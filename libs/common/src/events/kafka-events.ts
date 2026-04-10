// Kafka Topic constants
export const KAFKA_TOPICS = {
  USER_CREATED: "user.created",
  USER_UPDATED: "user.updated",
  USER_DELETED: "user.deleted",
  MATCH_CREATED: "match.created",
  MESSAGE_SENT: "message.sent",
  IMAGE_UPLOADED: "image.uploaded",
  IMAGE_DELETED: "image.deleted",
} as const;

export type KafkaTopic = (typeof KAFKA_TOPICS)[keyof typeof KAFKA_TOPICS];

// Event payload interfaces
export interface UserCreatedEvent {
  keycloakId: string;
  email: string;
  name?: string;
}

export interface UserUpdatedEvent {
  keycloakId: string;
  email?: string;
  name?: string;
}

export interface UserDeletedEvent {
  keycloakId: string;
}

export interface MatchCreatedEvent {
  matchId: string;
  user1Id: string;
  user2Id: string;
  matchedAt: string;
}

export interface MessageSentEvent {
  messageId: string;
  matchId: string;
  senderId: string;
  content: string;
  type: string;
  sentAt: string;
}

export interface ImageUploadedEvent {
  objectName: string;
  ownerId: string;
  context: string; // e.g. 'profile-photo', 'message-image'
  url: string;
  size: number;
  mimetype: string;
  uploadedAt: string;
}

export interface ImageDeletedEvent {
  objectName: string;
  ownerId: string;
}
