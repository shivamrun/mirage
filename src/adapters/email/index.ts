export { getResendClient } from "./client";
export { type EmailConfig, getEmailConfig } from "./config";
export {
  EmailConfigurationError,
  EmailDeliveryError,
  logEmailDeliveryFailure,
} from "./errors";
export { type SendEmailResult, sendEmail } from "./send-email";
