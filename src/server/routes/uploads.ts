import { isUploadSDKError } from "@marinedotsh/upload-sdk";
import { Elysia } from "elysia";
import { createUploadSigner, getUploadPublicUrl } from "@/adapters/uploads";
import { elysiaAuth } from "@/server/http/auth";
import { requestPolicy } from "@/server/http/request-policy";
import {
  messageResponseSchema,
  prepareUploadRequestSchema,
  prepareUploadResponseSchema,
  uploadErrorResponseSchema,
} from "@/shared/schemas";

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
      body: prepareUploadRequestSchema,
      response: {
        200: prepareUploadResponseSchema,
        400: uploadErrorResponseSchema,
        401: messageResponseSchema,
        403: messageResponseSchema,
        500: uploadErrorResponseSchema,
      },
    },
  );
