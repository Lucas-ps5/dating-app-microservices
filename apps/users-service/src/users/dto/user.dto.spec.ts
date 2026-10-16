import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import {
  CreateUserDto,
  PublicUserResponseDto,
  UpdateLocationDto,
  UpdateProfileDto,
} from "./user.dto";
import { RelationshipType } from "../user-profile.enums";
import { sensitiveTextTransformer } from "../sensitive-text.transformer";

function dateAtAge(age: number, dayOffset = 0): string {
  const now = new Date();
  return new Date(
    Date.UTC(
      now.getUTCFullYear() - age,
      now.getUTCMonth(),
      now.getUTCDate() + dayOffset,
    ),
  )
    .toISOString()
    .slice(0, 10);
}

describe("user profile DTOs", () => {
  it("does not accept profile-only fields during registration", async () => {
    const registration = Object.assign(new CreateUserDto(), {
      email: "member@example.com",
      username: "member",
      password: "password123",
      gender: "female",
      birthdate: dateAtAge(25),
      latitude: 48.8566,
      longitude: 2.3522,
      heightCm: 175,
      languagesSpoken: ["fr", "en"],
    });

    await validate(registration, { whitelist: true });

    expect(registration).not.toHaveProperty("heightCm");
    expect(registration).not.toHaveProperty("languagesSpoken");
  });

  it("accepts an adult and rejects a person who is not yet 18", async () => {
    const adult = Object.assign(new UpdateProfileDto(), {
      birthdate: dateAtAge(18),
    });
    const underage = Object.assign(new UpdateProfileDto(), {
      birthdate: dateAtAge(18, 1),
    });

    expect(await validate(adult)).toHaveLength(0);
    expect((await validate(underage)).map((error) => error.property)).toContain(
      "birthdate",
    );
  });

  it("requires valid geographic coordinates for location updates", async () => {
    const valid = plainToInstance(UpdateLocationDto, {
      latitude: "0",
      longitude: "0",
    });
    const invalid = plainToInstance(UpdateLocationDto, {
      latitude: 91,
      longitude: -181,
    });
    const missing = plainToInstance(UpdateLocationDto, {});

    expect(await validate(valid)).toHaveLength(0);
    expect((await validate(invalid)).map((error) => error.property)).toEqual(
      expect.arrayContaining(["latitude", "longitude"]),
    );
    expect((await validate(missing)).map((error) => error.property)).toEqual(
      expect.arrayContaining(["latitude", "longitude"]),
    );
  });

  it("requires at least one relationship type and an ISO 639-1 language", async () => {
    const dto = Object.assign(new UpdateProfileDto(), {
      relationshipTypesSought: [],
      languagesSpoken: ["zz"],
    });

    const invalidProperties = (await validate(dto)).map(
      (error) => error.property,
    );
    expect(invalidProperties).toContain("relationshipTypesSought");
    expect(invalidProperties).toContain("languagesSpoken");

    const valid = Object.assign(new UpdateProfileDto(), {
      relationshipTypesSought: [RelationshipType.ENHANCED_FRIENDSHIP],
      languagesSpoken: ["en", "fr"],
    });
    expect(await validate(valid)).toHaveLength(0);
  });

  it("allowlists public response fields", () => {
    const response = plainToInstance(
      PublicUserResponseDto,
      {
        id: "user-id",
        username: "member",
        birthdate: "1995-06-15",
        fantasiesText: "private text",
        preferences: { ageMin: 18 },
      },
      { excludeExtraneousValues: true },
    );

    expect(response).toMatchObject({
      id: "user-id",
      username: "member",
      birthdate: "1995-06-15",
    });
    expect(response).not.toHaveProperty("fantasiesText");
    expect(response).toHaveProperty("preferences");
  });

  it("encrypts and decrypts free-text sensitive data", () => {
    const previousKey = process.env.SENSITIVE_PROFILE_ENCRYPTION_KEY;
    process.env.SENSITIVE_PROFILE_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString(
      "base64",
    );
    try {
      const plaintext = "private fantasy text";
      const encrypted = sensitiveTextTransformer.to(plaintext) as string;

      expect(encrypted).not.toContain(plaintext);
      expect(sensitiveTextTransformer.from(encrypted)).toBe(plaintext);
    } finally {
      if (previousKey === undefined) {
        delete process.env.SENSITIVE_PROFILE_ENCRYPTION_KEY;
      } else {
        process.env.SENSITIVE_PROFILE_ENCRYPTION_KEY = previousKey;
      }
    }
  });
});
