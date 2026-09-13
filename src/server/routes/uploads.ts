import { isUploadSDKError } from "@marinedotsh/upload-sdk";
import { Elysia, t } from "elysia";

import {
  createUploadSigner,
  getUploadPublicUrl,
  type UploadAssetKey,
} from "@/lib/uploads/server";

import { elysiaAuth } from "./auth";
import { requestPolicy } from "./request-policy";

const uploadAssetKeyEnum = {
  avatar: "avatar",
} satisfies Record<UploadAssetKey, UploadAssetKey>;

const prepareUploadResponseSchema = t.Object({
  expiresAt: t.String(),
  fields: t.Record(t.String(), t.String()),
  headers: t.Record(t.String(), t.String()),
  key: t.String(),
  method: t.Literal("POST"),
  strategy: t.Literal("multipart"),
  url: t.String(),
});

export const uploadsRoutes = new Elysia({ prefix: "/uploads" })
  .use(elysiaAuth)
  .use(requestPolicy)
  .post(
    "/",
    async ({ body, status }) => {
      const { key, ...file } = body;

      try {
        const upload = await createUploadSigner().prepareUpload(key, file);

        return {
          key: upload.key,
          publicUrl: getUploadPublicUrl(upload.key),
          upload,
        };
      } catch (error) {
        if (isUploadSDKError(error)) {
          console.error({
            code: error.code,
            details: error.details,
            message: error.message,
            statusCode: error.statusCode,
          });

          if (error.code === "INVALID_UPLOAD_INPUT") {
            return status(400, {
              code: error.code,
              message: error.message,
            });
          }

          return status(500, {
            code: error.code,
            message: "Could not prepare the upload.",
          });
        }

        console.error(error);

        return status(500, { message: "Could not prepare the upload." });
      }
    },
    {
      auth: true,
      sameOrigin: true,
      body: t.Object({
        contentType: t.String({
          minLength: 1,
          error: "Content type is required.",
        }),
        filename: t.String({ minLength: 1, error: "Filename is required." }),
        key: t.Enum(uploadAssetKeyEnum, { error: "Invalid upload key." }),
        size: t.Integer({
          minimum: 1,
          error: "Size must be a positive integer.",
        }),
      }),
      response: {
        200: t.Object({
          key: t.String(),
          publicUrl: t.String(),
          upload: prepareUploadResponseSchema,
        }),
        400: t.Object({
          code: t.Optional(t.String()),
          message: t.String(),
        }),
        401: t.Object({
          message: t.String(),
        }),
        403: t.Object({
          message: t.String(),
        }),
        500: t.Object({
          code: t.Optional(t.String()),
          message: t.String(),
        }),
      },
    },
  );
