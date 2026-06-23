import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from config import settings

logger = logging.getLogger(__name__)


def send_verification_email(to_email: str, code: str, display_name: str = "") -> tuple[bool, str]:
    if not settings.smtp_configured:
        return False, (
            "SMTP not configured. Set SMTP_HOST, SMTP_USERNAME, and SMTP_PASSWORD "
            "environment variables to enable email delivery."
        )

    name = display_name or to_email.split("@")[0]
    subject = "UniPath - Verify Your Email"
    body = f"""Hi {name},

Your UniPath email verification code is: {code}

Enter this code in the app to verify your account.

If you didn't request this, you can safely ignore this email.

— UniPath Team
"""

    msg = MIMEMultipart()
    msg["From"] = settings.smtp_from_email
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.attach(MIMEText(body, "plain"))

    try:
        server = smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15)
        server.starttls()
        server.login(settings.smtp_username, settings.smtp_password)
        server.sendmail(settings.smtp_from_email, to_email, msg.as_string())
        server.quit()
        logger.info(f"Verification email sent to {to_email}")
        return True, "Verification email sent"
    except smtplib.SMTPAuthenticationError:
        return False, (
            "SMTP authentication failed. If using Gmail, use an App Password "
            "(https://myaccount.google.com/apppasswords) instead of your regular password."
        )
    except smtplib.SMTPException as e:
        return False, f"Failed to send email: {e}"
    except Exception as e:
        return False, f"Unexpected error sending email: {e}"
