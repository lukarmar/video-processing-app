import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import * as fs from 'fs';
import * as path from 'path';

interface AWSEmailOptions {
  to: string;
  subject: string;
  template: string;
  templateData: Record<string, unknown>;
}

interface MockSESResponse {
  MessageId: string;
  success: boolean;
  timestamp: string;
}

@Injectable()
export class AWSEmailService {
  private readonly logger = new Logger(AWSEmailService.name);
  private readonly transporter: nodemailer.Transporter;
  private readonly isDevelopment: boolean;

  constructor(private readonly configService: ConfigService) {
    this.isDevelopment = this.configService.get('NODE_ENV') === 'development';
    
    if (this.isDevelopment) {
      this.transporter = nodemailer.createTransport({
        host: this.configService.get('SMTP_HOST', 'smtp.gmail.com'),
        port: parseInt(this.configService.get('SMTP_PORT', '587')),
        secure: false,
        auth: {
          user: this.configService.get('SMTP_USER'),
          pass: this.configService.get('SMTP_PASS'),
        },
        tls: {
          rejectUnauthorized: false,
        },
      });
    } else {
      this.transporter = nodemailer.createTransport({
        SES: {
          aws: {
            region: this.configService.get('AWS_REGION', 'us-east-1'),
            accessKeyId: this.configService.get('AWS_ACCESS_KEY_ID'),
            secretAccessKey: this.configService.get('AWS_SECRET_ACCESS_KEY'),
          },
        },
      });
    }
  }

  async sendEmail(options: AWSEmailOptions): Promise<void> {
    try {
      this.logger.log(`Sending email via ${this.isDevelopment ? 'SMTP' : 'AWS SES'} to: ${options.to}`);
      
      const htmlContent = this.generateEmailTemplate(options.template, options.templateData);
      
      if (this.isDevelopment) {
        await this.sendSMTPEmail(options, htmlContent);
      } else {
        await this.sendSESEmail(options, htmlContent);
      }
      
      this.logger.log(`Email sent successfully to: ${options.to}`);
    } catch (error) {
      this.logger.error(`Failed to send email to ${options.to}:`, error);
      throw error;
    }
  }

  private async sendSMTPEmail(options: AWSEmailOptions, htmlContent: string): Promise<void> {
    const smtpUser = this.configService.get('SMTP_USER');
    if (!smtpUser) {
      await this.sendMockEmail(options, htmlContent);
      return;
    }

    const mailOptions = {
      from: `"VideoPlat Notifications" <${smtpUser}>`,
      to: options.to,
      subject: options.subject,
      html: htmlContent,
    };

    const info = await this.transporter.sendMail(mailOptions);
    this.logger.log(`SMTP Email sent: ${info.messageId}`);
  }

  private async sendSESEmail(options: AWSEmailOptions, htmlContent: string): Promise<void> {
    const mailOptions = {
      from: this.configService.get('SES_FROM_EMAIL', 'noreply@videoplat.com'),
      to: options.to,
      subject: options.subject,
      html: htmlContent,
    };

    const info = await this.transporter.sendMail(mailOptions);
    this.logger.log(`SES Email sent: ${info.messageId}`);
  }

  private async sendMockEmail(options: AWSEmailOptions, htmlContent: string): Promise<MockSESResponse> {
    await new Promise(resolve => setTimeout(resolve, 200));
    
    const mockResponse: MockSESResponse = {
      MessageId: `mock-email-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      success: true,
      timestamp: new Date().toISOString(),
    };

    this.logger.debug('📧 MOCK Email Sent:', {
      to: options.to,
      subject: options.subject,
      template: options.template,
      templateData: options.templateData,
      htmlPreview: htmlContent.substring(0, 200) + '...',
      response: mockResponse,
    });

    this.saveMockEmailToFile(options, htmlContent, mockResponse);

    return mockResponse;
  }

  private generateEmailTemplate(template: string, data: Record<string, unknown>): string {
    switch (template) {
      case 'video-processing-complete':
        return this.videoProcessingCompleteTemplate(data);
      case 'video-processing-failed':
        return this.videoProcessingFailedTemplate(data);
      default:
        return this.defaultTemplate(data);
    }
  }

  private videoProcessingCompleteTemplate(data: Record<string, unknown>): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Vídeo Processado com Sucesso</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: #4CAF50; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
          .success-icon { font-size: 48px; margin-bottom: 20px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="success-icon">🎉</div>
          <h1>Vídeo Processado com Sucesso!</h1>
        </div>
        <div class="content">
          <p>Olá!</p>
          <p>Temos ótimas notícias! Seu vídeo <strong>#${data.videoId}</strong> foi processado com sucesso e está pronto para download.</p>
          
          <p><strong>Detalhes do processamento:</strong></p>
          <ul>
            <li>ID do Vídeo: ${data.videoId}</li>
            <li>Processado em: ${new Date(data.processedAt as string).toLocaleString('pt-BR')}</li>
            <li>Status: Concluído ✅</li>
          </ul>

          <div style="text-align: center;">
            <a href="${data.downloadUrl}" class="button">📥 Baixar Vídeo Processado</a>
          </div>

          <p><strong>⚠️ Importante:</strong> O link de download é válido por 24 horas.</p>
          
          <p>Obrigado por usar a VideoPlat!</p>
        </div>
        <div class="footer">
          <p>VideoPlat - Processamento de Vídeos | Este é um email automático, não responda.</p>
        </div>
      </body>
      </html>
    `;
  }

  private videoProcessingFailedTemplate(data: Record<string, unknown>): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Falha no Processamento do Vídeo</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: #3498db; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
          .error-icon { font-size: 48px; margin-bottom: 20px; }
          .error-box { background: #ffebee; border: 1px solid #ffcdd2; padding: 15px; border-radius: 5px; margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="error-icon">❌</div>
          <h1>Falha no Processamento</h1>
        </div>
        <div class="content">
          <p>Olá!</p>
          <p>Infelizmente, houve um problema ao processar seu vídeo <strong>#${data.videoId}</strong>.</p>
          
          <div class="error-box">
            <p><strong>Detalhes do erro:</strong></p>
            <p>${data.error}</p>
            <p><strong>Ocorreu em:</strong> ${new Date(data.failedAt as string).toLocaleString('pt-BR')}</p>
          </div>

          <p><strong>O que você pode fazer:</strong></p>
          <ul>
            <li>Verificar se o arquivo de vídeo não está corrompido</li>
            <li>Tentar fazer upload novamente</li>
            <li>Entrar em contato com nosso suporte se o problema persistir</li>
          </ul>

          <div style="text-align: center;">
            <a href="${data.supportUrl}" class="button">📞 Entrar em Contato</a>
          </div>
          
          <p>Pedimos desculpas pelo inconveniente.</p>
          <p>Equipe VideoPlat</p>
        </div>
        <div class="footer">
          <p>VideoPlat - Processamento de Vídeos | Este é um email automático, não responda.</p>
        </div>
      </body>
      </html>
    `;
  }

  private defaultTemplate(data: Record<string, unknown>): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Notificação VideoPlat</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2>Notificação VideoPlat</h2>
        <pre>${JSON.stringify(data, null, 2)}</pre>
        <p>Equipe VideoPlat</p>
      </body>
      </html>
    `;
  }

  private saveMockEmailToFile(options: AWSEmailOptions, htmlContent: string, response: MockSESResponse): void {
    try {
      const mockEmailsDir = path.join(process.cwd(), 'mock-emails');
      if (!fs.existsSync(mockEmailsDir)) {
        fs.mkdirSync(mockEmailsDir, { recursive: true });
      }
      
      const filename = `email-${response.MessageId}.html`;
      const filePath = path.join(mockEmailsDir, filename);
      
      fs.writeFileSync(filePath, htmlContent);
      this.logger.debug(`Mock email saved to: ${filePath}`);
    } catch (error) {
      this.logger.warn('Failed to save mock email to file:', error.message);
    }
  }
}
