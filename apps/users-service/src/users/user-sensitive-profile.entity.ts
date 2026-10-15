import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from "typeorm";
import { Exclude } from "class-transformer";
import { User } from "./user.entity";
import { sensitiveTextTransformer } from "./sensitive-text.transformer";
import {
  HasChildren,
  ProfileVisibility,
  RelationshipType,
  SexualInterest,
  WantsChildren,
} from "./user-profile.enums";

@Entity("user_sensitive_profiles")
@Exclude()
export class UserSensitiveProfile {
  @PrimaryColumn("uuid")
  userId!: string;

  @OneToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user!: User;

  @Column({
    type: "enum",
    enum: RelationshipType,
    enumName: "users_relationship_type_enum",
    array: true,
    nullable: true,
    select: false,
  })
  relationshipTypesSought?: RelationshipType[];

  @Column({
    type: "enum",
    enum: SexualInterest,
    enumName: "users_sexual_interest_enum",
    array: true,
    nullable: true,
    select: false,
  })
  sexualInterests?: SexualInterest[];

  @Column({
    type: "text",
    nullable: true,
    select: false,
    transformer: sensitiveTextTransformer,
  })
  fantasiesText?: string;

  @Column({
    type: "enum",
    enum: HasChildren,
    enumName: "users_has_children_enum",
    nullable: true,
    select: false,
  })
  hasChildren?: HasChildren;

  @Column({
    type: "enum",
    enum: WantsChildren,
    enumName: "users_wants_children_enum",
    nullable: true,
    select: false,
  })
  wantsChildren?: WantsChildren;

  @Column({
    type: "enum",
    enum: ProfileVisibility,
    enumName: "users_profile_visibility_enum",
    default: ProfileVisibility.HIDDEN,
    select: false,
  })
  relationshipTypesSoughtVisibility!: ProfileVisibility;

  @Column({
    type: "enum",
    enum: ProfileVisibility,
    enumName: "users_profile_visibility_enum",
    default: ProfileVisibility.HIDDEN,
    select: false,
  })
  sexualInterestsVisibility!: ProfileVisibility;

  @Column({
    type: "enum",
    enum: ProfileVisibility,
    enumName: "users_profile_visibility_enum",
    default: ProfileVisibility.HIDDEN,
    select: false,
  })
  fantasiesTextVisibility!: ProfileVisibility;

  @Column({
    type: "enum",
    enum: ProfileVisibility,
    enumName: "users_profile_visibility_enum",
    default: ProfileVisibility.HIDDEN,
    select: false,
  })
  hasChildrenVisibility!: ProfileVisibility;

  @Column({
    type: "enum",
    enum: ProfileVisibility,
    enumName: "users_profile_visibility_enum",
    default: ProfileVisibility.HIDDEN,
    select: false,
  })
  wantsChildrenVisibility!: ProfileVisibility;

  @CreateDateColumn({ type: "timestamptz", default: () => "CURRENT_TIMESTAMP" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz", default: () => "CURRENT_TIMESTAMP" })
  updatedAt!: Date;
}
