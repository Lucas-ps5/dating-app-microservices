export type FieldToExtractCodes = "Code-1" | "Code-2";

export type CreationResponse = {
  newId: string;
};

export enum LikeAction {
  LIKE = "LIKE",
  SUPER_LIKE = "SUPER_LIKE",
}

export type CountResponse = {
  count: number;
};

export enum UserHeaders {
  USER_ID = "x-user-id",
  USER_EMAIL = "x-user-email",
  USER_ROLES = "x-user-roles",
}
