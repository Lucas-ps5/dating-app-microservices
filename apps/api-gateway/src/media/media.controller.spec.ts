import { Test, TestingModule } from "@nestjs/testing";
import { PassThrough, Readable } from "stream";
import type { AxiosResponse } from "axios";
import { MediaController } from "./media.controller";
import { MediaProxyService } from "./media-proxy.service";
import type { AuthenticatedUser } from "@app/common";

type MockResponse = PassThrough & {
  statusCode?: number;
  headers: Record<string, string>;
  status: jest.Mock;
  json: jest.Mock;
  setHeader: jest.Mock;
  destroy: jest.Mock;
};

const USER: AuthenticatedUser = {
  id: "user-1",
  email: "owner@example.com",
  roles: ["user"],
} as AuthenticatedUser;

/** A real writable, since the controller calls `stream.pipe(response)`. */
function mockResponse(): MockResponse {
  const res = new PassThrough() as MockResponse;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn().mockReturnValue(res);
  res.destroy = jest
    .fn()
    .mockReturnValue(res) as unknown as MockResponse["destroy"];
  return res;
}

function upstream(
  status: number,
  data: Readable,
  headers: Record<string, string> = {},
): AxiosResponse<NodeJS.ReadableStream> {
  return {
    status,
    data,
    headers,
  } as unknown as AxiosResponse<NodeJS.ReadableStream>;
}

describe("MediaController.getImage", () => {
  let controller: MediaController;
  let getImage: jest.Mock;

  beforeEach(async () => {
    getImage = jest.fn();
    const app: TestingModule = await Test.createTestingModule({
      controllers: [MediaController],
      providers: [{ provide: MediaProxyService, useValue: { getImage } }],
    }).compile();

    controller = app.get(MediaController);
  });

  it("joins a multi-segment wildcard param back into a folder/name key", async () => {
    getImage.mockResolvedValue(
      upstream(200, Readable.from(Buffer.from("png")), {
        "content-type": "image/png",
      }),
    );
    const response = mockResponse();

    await controller.getImage(
      ["general", "abc.png"],
      USER,
      "Bearer token",
      response as never,
    );

    // A raw array would have been sent upstream as "general,abc.png".
    expect(getImage).toHaveBeenCalledWith(
      "general/abc.png",
      USER,
      "Bearer token",
    );
  });

  it("relays image headers and pipes the body", async () => {
    const response = mockResponse();
    const body = Readable.from(Buffer.from("image-bytes"));
    getImage.mockResolvedValue(
      upstream(200, body, {
        "content-type": "image/png",
        "content-length": "11",
        "cache-control": "private, max-age=3600",
        "content-disposition": 'inline; filename="a.png"',
      }),
    );

    await controller.getImage(
      "general/abc.png",
      USER,
      undefined,
      response as never,
    );

    expect(response.setHeader).toHaveBeenCalledWith(
      "content-type",
      "image/png",
    );
    expect(response.setHeader).toHaveBeenCalledWith("content-length", "11");
    expect(response.setHeader).toHaveBeenCalledWith(
      "content-disposition",
      'inline; filename="a.png"',
    );
    // Reached end-of-stream without being torn down, and bytes were relayed.
    await new Promise((resolve) => setImmediate(resolve));
    expect(response.destroy).not.toHaveBeenCalled();
    const relayed: unknown = response.read();
    expect(Buffer.isBuffer(relayed) && relayed.toString()).toBe("image-bytes");
  });

  // Regression: the error body arrives as a stream because the proxy request
  // sets responseType:"stream", so it must be drained before being re-sent.
  it("parses a streamed JSON error body and preserves the status", async () => {
    const response = mockResponse();
    getImage.mockResolvedValue(
      upstream(
        403,
        Readable.from(
          Buffer.from(
            JSON.stringify({
              message: "You do not own this image",
              statusCode: 403,
            }),
          ),
        ),
      ),
    );

    await controller.getImage(
      "general/abc.png",
      USER,
      undefined,
      response as never,
    );

    expect(response.status).toHaveBeenCalledWith(403);
    expect(response.json).toHaveBeenCalledWith({
      message: "You do not own this image",
      statusCode: 403,
    });
    expect(response.setHeader).not.toHaveBeenCalled();
  });

  it("falls back to a raw message when the error body is not JSON", async () => {
    const response = mockResponse();
    getImage.mockResolvedValue(
      upstream(404, Readable.from(Buffer.from("Not Found"))),
    );

    await controller.getImage(
      "general/gone.png",
      USER,
      undefined,
      response as never,
    );

    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.json).toHaveBeenCalledWith({
      statusCode: 500,
      message: "Not Found",
    });
  });

  it("drops a structured header value instead of stringifying it", async () => {
    const response = mockResponse();
    getImage.mockResolvedValue(
      upstream(200, Readable.from(Buffer.from("x")), {
        // Deliberately not a valid header value, to prove it is dropped.
        "content-type": { bad: true } as unknown as string,
      }),
    );

    await controller.getImage(
      "general/abc.png",
      USER,
      undefined,
      response as never,
    );

    expect(response.setHeader).not.toHaveBeenCalledWith(
      "content-type",
      expect.anything(),
    );
  });
});
