import { User } from "../user.entity";

export interface UserWithDistance extends Partial<User> {
  distance?: number;
}
