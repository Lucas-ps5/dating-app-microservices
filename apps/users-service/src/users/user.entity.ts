import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";

@Entity("users")
export class User {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ unique: true })
  @Index()
  keycloakId: string;

  @Column({ unique: true })
  email: string;

  @Column({ nullable: true })
  name: string;

  @Column({ nullable: true, length: 500 })
  bio: string;

  @Column({ type: "date", nullable: true })
  birthdate: Date;

  @Column({ nullable: true })
  gender: string;

  // Location
  @Column({ type: "decimal", precision: 10, scale: 7, nullable: true })
  latitude: number;

  @Column({ type: "decimal", precision: 10, scale: 7, nullable: true })
  longitude: number;

  @Column({ nullable: true })
  city: string;

  @Column({ nullable: true })
  country: string;

  // Photos (array of filenames/URLs)
  @Column("text", { array: true, default: () => "'{}'" })
  photos: string[];

  // Dating preferences
  @Column({ type: "jsonb", nullable: true })
  preferences: {
    ageMin?: number;
    ageMax?: number;
    genderPreference?: string;
    maxDistance?: number;
  };

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
