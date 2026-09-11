import { isUploadSDKError } from "@marinedotsh/upload-sdk";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { env } from "@/lib/env";
import {
  createUploadSigner,
  getUploadPublicUrl,
  uploadAssetKeys,
} from "@/lib/uploads/server";

export const runtime = "nodejs";

const prepareUploadSchema = z.object({
  contentType: z.string().min(1),
  filename: z.string().min(1),
  key: z.enum(uploadAssetKeys),
  size: z.number().int().positive(),
});

function validationErrorResponse(message: string) {
  return Response.json({ message }, { status: 400 });
}

function forbiddenResponse() {
  return Response.json({ message: "Invalid request origin." }, { status: 403 });
}

function isTrustedOriginRequest(request: Request) {
  const trustedOrigin = new URL(env.NEXT_PUBLIC_BASE_URL).origin;
  const origin = request.headers.get("origin");

  if (origin) {
    return origin === trustedOrigin;
  }

  const referer = request.headers.get("referer");

  if (!referer) {
    return false;
  }

  try {
    return new URL(referer).origin === trustedOrigin;
  } catch {
    return false;
  }
}

async function parseJsonBody(request: Request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  if (!isTrustedOriginRequest(request)) {
    return forbiddenResponse();
  }

  const authSession = await auth.api.getSession({
    headers: request.headers,
    query: {
      disableCookieCache: true,
    },
  });

  if (!authSession) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  const parsed = prepareUploadSchema.safeParse(await parseJsonBody(request));

  if (!parsed.success) {
    const message =
      parsed.error.flatten().formErrors[0] ||
      Object.values(parsed.error.flatten().fieldErrors).flat().find(Boolean) ||
      "Invalid upload request.";

    return validationErrorResponse(message);
  }

  const { key, ...file } = parsed.data;

  try {
    const upload = await createUploadSigner().prepareUpload(key, file);

    return Response.json({
      key: upload.key,
      publicUrl: getUploadPublicUrl(upload.key),
      upload,
    });
  } catch (error) {
    if (isUploadSDKError(error)) {
      console.error({
        code: error.code,
        details: error.details,
        message: error.message,
        statusCode: error.statusCode,
      });

      if (error.code === "INVALID_UPLOAD_INPUT") {
        return Response.json(
          {
            code: error.code,
            message: error.message,
          },
          {
            status: error.statusCode,
          },
        );
      }

      return Response.json(
        {
          code: error.code,
          message: "Could not prepare the upload.",
        },
        {
          status: error.statusCode,
        },
      );
    }

    console.error(error);

    return Response.json(
      { message: "Could not prepare the upload." },
      { status: 500 },
    );
  }
}
