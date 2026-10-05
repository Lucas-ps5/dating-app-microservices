import {
  Entity,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  BeforeInsert,
  BeforeUpdate,
  PrimaryColumn,
} from "typeorm";

// 1. Define the Enum (Matches your DTO)
export enum Gender {
  MALE = "male",
  FEMALE = "female",
}

// 2. Define an interface for the JSONB preferences
export interface UserPreferences {
  ageMin?: number;
  ageMax?: number;
  genderPreference?: string;
  maxDistance?: number;
}

@Entity("users")
// `discover` filters on these three columns on every request.
@Index("IDX_users_discover", ["isActive", "gender", "birthdate"])
export class User {
  @PrimaryColumn("uuid")
  id!: string;

  @Column({ unique: true, select: false })
  email!: string;

  @Column({ unique: true })
  username!: string;

  @BeforeInsert()
  @BeforeUpdate()
  normalizeUsername() {
    if (this.username) {
      this.username = this.username.toLowerCase().trim();
    }
  }

  @Column({ nullable: true, length: 255 })
  title?: string;

  @Column({ nullable: true, length: 500 })
  bio?: string;

  @Column({ type: "date", nullable: true })
  birthdate?: string;

  // 5. Using the Enum type for the database column
  @Column({
    type: "enum",
    enum: Gender,
  })
  gender!: Gender;

  // Location
  @Column({ type: "decimal", precision: 10, scale: 7, nullable: true })
  latitude?: number;

  @Column({ type: "decimal", precision: 10, scale: 7, nullable: true })
  longitude?: number;

  @Column({ nullable: true })
  city?: string;

  @Column({ nullable: true })
  country?: string;

  // Photos (array of filenames/URLs)
  @Column("text", { array: true, default: () => "'{}'" })
  photos?: string[];

  // Dating preferences
  @Column({ type: "jsonb", nullable: true })
  preferences?: UserPreferences;

  @Column({ default: true })
  isActive!: boolean;

  @CreateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  createdAt!: string;

  @UpdateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  updatedAt!: string;
}
