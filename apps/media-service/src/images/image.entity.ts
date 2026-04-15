import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";

@Entity("images")
export class Image {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column("uuid")
  imageName: string;

  @Column()
  originalName: string;

  @Column()
  imageType: string;

  @Column()
  imageSize: number;

  @Column()
  imageUrl: string;
}
