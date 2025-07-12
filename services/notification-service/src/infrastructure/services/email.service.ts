import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';

interface EmailOptions {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  template?: string;
  templateData?: Record<string, unknown>;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter;

  constructor(private readonly configService: ConfigService) {
    this.initializeTransporter();
  }

  private initializeTransporter() {
    const config = {
      host: this.configService.get<string>('SMTP_HOST'),
      port: parseInt(this.configService.get<string>('SMTP_PORT') || '587'),
      secure: false, // true for 465, false for other ports
      auth: {
        user: this.configService.get<string>('SMTP_USER'),
        pass: this.configService.get<string>('SMTP_PASS'),
      },
    };

    this.transporter = nodemailer.createTransport(config);
    
    this.transporter.verify((error) => {
      if (error) {
        this.logger.error('SMTP connection failed:', error);
      } else {
        this.logger.log('SMTP server is ready to take our messages');
      }
    });
  }

  async sendEmail(options: EmailOptions): Promise<void> {
    try {
      const mailOptions = {
        from: this.configService.get<string>('EMAIL_FROM') || 'noreply@videoplat.com',
        to: options.to,
        subject: options.subject,
        html: options.html || this.generateTemplateHtml(options.template, options.templateData),
        text: options.text,
      };

      const result = await this.transporter.sendMail(mailOptions);
      this.logger.log(`Email sent successfully to ${options.to}: ${result.messageId}`);
    } catch (error) {
      this.logger.error(`Failed to send email to ${options.to}:`, error);
      throw error;
    }
  }

  private generateTemplateHtml(template: string | undefined, data: Record<string, unknown> = {}): string {
    switch (template) {
      case 'video-processing-complete':
        return this.videoProcessingCompleteTemplate(data);
      case 'video-processing-failed':
        return this.videoProcessingFailedTemplate(data);
      default:
        return `<p>Notificação: ${JSON.stringify(data)}</p>`;
    }
  }

  private videoProcessingCompleteTemplate(data: Record<string, unknown>): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #4CAF50; margin: 0; font-size: 28px;">🎉 Vídeo Processado!</h1>
          </div>
          
          <div style="margin-bottom: 25px;">
            <p style="font-size: 16px; line-height: 1.6; color: #333;">
              Ótimas notícias! Seu vídeo foi processado com sucesso e está pronto para download.
            </p>
          </div>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
            <h3 style="margin: 0 0 10px 0; color: #333;">Detalhes do Processamento:</h3>
            <p style="margin: 5px 0; color: #666;"><strong>ID do Vídeo:</strong> ${data.videoId}</p>
            <p style="margin: 5px 0; color: #666;"><strong>Processado em:</strong> ${new Date(data.processedAt as string).toLocaleString('pt-BR')}</p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${data.downloadUrl}" 
               style="background-color: #4CAF50; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
              📥 Fazer Download
            </a>
          </div>
          
          <div style="border-top: 1px solid #eee; padding-top: 20px; text-align: center; color: #666; font-size: 14px;">
            <p>Obrigado por usar nossa plataforma de processamento de vídeos!</p>
          </div>
        </div>
      </div>
    `;
  }

  private videoProcessingFailedTemplate(data: Record<string, unknown>): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #f44336; margin: 0; font-size: 28px;">❌ Falha no Processamento</h1>
          </div>
          
          <div style="margin-bottom: 25px;">
            <p style="font-size: 16px; line-height: 1.6; color: #333;">
              Infelizmente, houve um problema ao processar seu vídeo. Nossa equipe foi notificada e está trabalhando para resolver a questão.
            </p>
          </div>
          
          <div style="background-color: #fff3f3; padding: 20px; border-radius: 8px; margin-bottom: 25px; border-left: 4px solid #f44336;">
            <h3 style="margin: 0 0 10px 0; color: #333;">Detalhes do Erro:</h3>
            <p style="margin: 5px 0; color: #666;"><strong>ID do Vídeo:</strong> ${data.videoId}</p>
            <p style="margin: 5px 0; color: #666;"><strong>Falhou em:</strong> ${new Date(data.failedAt as string).toLocaleString('pt-BR')}</p>
            <p style="margin: 5px 0; color: #666;"><strong>Erro:</strong> ${data.error}</p>
          </div>
          
          <div style="background-color: #e3f2fd; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
            <h3 style="margin: 0 0 10px 0; color: #333;">🔧 Próximos Passos:</h3>
            <ul style="margin: 0; padding-left: 20px; color: #666;">
              <li>Verifique se o arquivo de vídeo não está corrompido</li>
              <li>Tente fazer o upload novamente</li>
              <li>Entre em contato com o suporte se o problema persistir</li>
            </ul>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${data.supportUrl || 'mailto:support@videoplat.com'}" 
               style="background-color: #2196F3; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
              📧 Entrar em Contato
            </a>
          </div>
          
          <div style="border-top: 1px solid #eee; padding-top: 20px; text-align: center; color: #666; font-size: 14px;">
            <p>Pedimos desculpas pelo inconveniente. Estamos trabalhando para melhorar nosso serviço.</p>
          </div>
        </div>
      </div>
    `;
  }
}
