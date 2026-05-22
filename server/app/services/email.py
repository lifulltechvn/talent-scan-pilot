"""Email service — abstract interface + SMTP/SES implementations."""

import smtplib
from abc import ABC, abstractmethod
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.config import settings


class EmailService(ABC):
    @abstractmethod
    def send(self, to: str, subject: str, html_body: str) -> None: ...


class SmtpEmailService(EmailService):
    def send(self, to: str, subject: str, html_body: str) -> None:
        msg = MIMEMultipart("alternative")
        msg["From"] = f"{settings.MAIL_FROM_NAME} <{settings.MAIL_FROM}>"
        msg["To"] = to
        msg["Subject"] = subject
        msg.attach(MIMEText(html_body, "html"))

        with smtplib.SMTP(settings.MAIL_SERVER, settings.MAIL_PORT) as server:
            if settings.MAIL_USE_TLS:
                server.starttls()
            server.login(settings.MAIL_USERNAME, settings.MAIL_PASSWORD)
            server.sendmail(settings.MAIL_FROM, to, msg.as_string())


class SesEmailService(EmailService):
    def send(self, to: str, subject: str, html_body: str) -> None:
        import boto3
        client = boto3.client("ses")
        client.send_email(
            Source=f"{settings.MAIL_FROM_NAME} <{settings.MAIL_FROM}>",
            Destination={"ToAddresses": [to]},
            Message={
                "Subject": {"Data": subject},
                "Body": {"Html": {"Data": html_body}},
            },
        )


def get_email_service() -> EmailService:
    if settings.MAIL_PROVIDER == "ses":
        return SesEmailService()
    return SmtpEmailService()
